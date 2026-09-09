// Audio Engine - Manages songs and tracks with hierarchical structure

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));
}

export interface Track {
  trackId: string;
  trackName: string;
  audioBuffer: AudioBuffer | null;
  audioUrl?: string; // Blob URL ou URL remota para streaming nativo
  audioElement?: HTMLAudioElement | null; // Elemento <audio> HTML5 para streaming
  mediaElementSource?: MediaElementAudioSourceNode | null; // Conexão do elemento <audio> ao AudioContext
  volume: number; // 0.0 to 1.0
  pan: number; // -1.0 (left) to 1.0 (right)
  isMuted: boolean;
  isSoloed: boolean;
  isClickTrack: boolean; // True for click/guide tracks
  gainNode: GainNode | null;
  panNode: StereoPannerNode | null;
  sourceNode: AudioBufferSourceNode | null;
}

export interface Song {
  id: string;
  songName: string;
  tracks: Track[];
  duration: number;
  bpm: number;
}

export interface AudioEngineState {
  songs: Song[];
  currentSongId: string | null;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  instrumentsFaded: boolean;
}

type PlaybackListener = (state: { isPlaying: boolean; currentTime: number; duration: number }) => void;

class AudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private songs: Map<string, Song> = new Map();
  private trackGainNodes: Map<string, GainNode> = new Map();
  private currentSongId: string | null = null;
  private listeners: Set<(state: AudioEngineState) => void> = new Set();
  
  // Playback state
  private isPlaying: boolean = false;
  private isBuffering: boolean = false;
  private playRequestId: number = 0;
  private lastSyncCheckTime: number = 0;
  private masterClockTrackId: string | null = null; // ID da faixa mestre para drift correction
  private startTime: number = 0; // AudioContext time when playback started
  private pauseTime: number = 0; // Position in song when paused
  private playbackListeners: Set<PlaybackListener> = new Set();
  private animationFrameId: number | null = null;
  
  // Instrument fade state
  private instrumentsFaded: boolean = false;
  private savedInstrumentVolumes: Map<string, number> = new Map();

  // Controle de Object URLs para liberação explícita de memória (Garbage Collection)
  private createdObjectUrls: Set<string> = new Set();

  registerObjectUrl(url: string): void {
    if (url && typeof url === 'string' && url.startsWith('blob:')) {
      this.createdObjectUrls.add(url);
    }
  }

  revokeAllObjectUrls(): void {
    this.createdObjectUrls.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {}
    });
    this.createdObjectUrls.clear();
  }

  // Liberação explícita de decodificadores e nós de áudio
  cleanupSongResources(song: Song): void {
    song.tracks.forEach((track) => {
      if (track.sourceNode) {
        try {
          track.sourceNode.stop();
          track.sourceNode.disconnect();
        } catch (e) {}
        track.sourceNode = null;
      }

      if (track.mediaElementSource) {
        try {
          track.mediaElementSource.disconnect();
        } catch (e) {}
        track.mediaElementSource = null;
      }

      if (track.gainNode) {
        try {
          track.gainNode.disconnect();
        } catch (e) {}
        track.gainNode = null;
      }

      if (track.panNode) {
        try {
          track.panNode.disconnect();
        } catch (e) {}
        track.panNode = null;
      }

      if (track.audioElement) {
        try {
          track.audioElement.pause();
          track.audioElement.removeAttribute('src');
          track.audioElement.load(); // Descarrega decodificador interno e buffers do navegador
        } catch (e) {}
        track.audioElement = null;
      }

      if (track.audioUrl && track.audioUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(track.audioUrl);
          this.createdObjectUrls.delete(track.audioUrl);
        } catch (e) {}
      }

      // Limpa referência de buffer grande da memória RAM
      track.audioBuffer = null;
      this.trackGainNodes.delete(track.trackId);
    });
  }

  constructor() {
    this.initAudioContext();
  }

  private initAudioContext() {
    if (typeof window !== 'undefined' && !this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGainNode = this.audioContext.createGain();
      this.masterGainNode.connect(this.audioContext.destination);
    }
  }

  // Desbloqueia o AudioContext no Safari/iOS na primeira interação do usuário (clique / toque)
  async unlockAudioContext(): Promise<void> {
    const context = this.ensureContext();
    if (context.state === 'suspended') {
      try {
        await context.resume();
        console.log('[AudioEngine] AudioContext desbloqueado com sucesso via gesto do usuário.');
      } catch (err) {
        console.warn('[AudioEngine] Aviso ao desbloquear AudioContext:', err);
      }
    }
  }

  ensureContext(): AudioContext {
    if (!this.audioContext) {
      this.initAudioContext();
    }
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().catch((err) => {
        console.warn('[AudioEngine] AudioContext em suspended (aguardando gesto do usuário):', err);
      });
    }
    return this.audioContext!;
  }

  // Get all songs
  getSongs(): Song[] {
    return Array.from(this.songs.values());
  }

  // Get a specific song
  getSong(songId: string): Song | undefined {
    return this.songs.get(songId);
  }

  // Get current song
  getCurrentSong(): Song | undefined {
    return this.currentSongId ? this.songs.get(this.currentSongId) : undefined;
  }

  // Set current song
  setCurrentSong(songId: string) {
    if (this.songs.has(songId)) {
      // Stop current playback before switching
      if (this.isPlaying) {
        this.stop();
      }
      this.currentSongId = songId;
      this.pauseTime = 0;
      this.notifyListeners();
    }
  }

  // Add a new song with tracks
  addSong(song: Song): void {
    const context = this.ensureContext();
    
    // Create gain and pan nodes for each track
    song.tracks.forEach(track => {
      const gainNode = context.createGain();
      const panNode = context.createStereoPanner();
      
      gainNode.gain.value = track.volume;
      panNode.pan.value = track.pan;
      
      // Chain: source -> gain -> pan -> master
      gainNode.connect(panNode);
      panNode.connect(this.masterGainNode!);
      
      track.gainNode = gainNode;
      track.panNode = panNode;
      this.trackGainNodes.set(track.trackId, gainNode);

      // Streaming gradual via elemento <audio> nativo e createMediaElementSource
      if (track.audioUrl && !track.audioElement && typeof Audio !== 'undefined') {
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.preload = 'metadata';
        audio.src = track.audioUrl;
        track.audioElement = audio;
      }

      if (track.audioElement && !track.mediaElementSource) {
        try {
          const mediaSource = context.createMediaElementSource(track.audioElement);
          mediaSource.connect(gainNode);
          track.mediaElementSource = mediaSource;
        } catch (err) {
          console.warn(`[AudioEngine] createMediaElementSource aviso para "${track.trackName}":`, err);
        }
      }
    });

    this.songs.set(song.id, song);
    
    // Auto-select if first song
    if (!this.currentSongId) {
      this.currentSongId = song.id;
    }
    
    this.notifyListeners();
  }

  // Remove a song com liberação explícita de recursos
  removeSong(songId: string): void {
    const song = this.songs.get(songId);
    if (song) {
      if (this.currentSongId === songId && this.isPlaying) {
        this.stop();
      }
      this.cleanupSongResources(song);
      this.songs.delete(songId);
      
      if (this.currentSongId === songId) {
        this.currentSongId = this.songs.size > 0 ? this.songs.keys().next().value : null;
      }
      
      this.notifyListeners();
    }
  }

  // Limpa todas as músicas e força liberação de memória RAM
  clearAllSongs(): void {
    this.stop();
    this.songs.forEach((song) => this.cleanupSongResources(song));
    this.songs.clear();
    this.currentSongId = null;
    this.revokeAllObjectUrls();
    this.notifyListeners();
  }

  // PLAYBACK CONTROLS
  async play(): Promise<void> {
    const song = this.getCurrentSong();
    if (!song || song.tracks.length === 0) return;
    
    const context = this.ensureContext();
    if (context.state === 'suspended') {
      await context.resume().catch(() => {});
    }

    // Stop any existing playback
    this.stopAllSources();
    
    const offset = this.pauseTime;
    const currentRequestId = ++this.playRequestId;

    // Identifica faixas <audio> (streaming nativo)
    const elementTracks = song.tracks.filter(t => t.audioElement && !t.isMuted);

    // ─── MASTER CLOCK ──────────────────────────────────────────────────────────
    // Define como master clock a primeira faixa com isClickTrack=true ou cujo
    // nome contenha 'click' / 'guide' / 'guia' / 'metronome'. Se nenhuma, usa a
    // primeira faixa ativa disponível. O master clock é a referência para o
    // drift correction; todas as outras faixas são corrigidas em relação a ele.
    const masterTrack =
      elementTracks.find(t => t.isClickTrack || this.isClickOrGuideTrack(t)) ??
      elementTracks[0] ??
      null;
    this.masterClockTrackId = masterTrack?.trackId ?? null;

    // ─── PRÉ-BUFFER: readyState >= 4 (HAVE_ENOUGH_DATA) ───────────────────────
    // Aguarda canplaythrough (readyState 4) de todas as faixas ativas antes de
    // disparar. Isso garante que o áudio decodificado esteja completamente
    // armazenado em buffer no navegador antes do play unificado.
    const needsBuffering = elementTracks.some(t => t.audioElement!.readyState < 4);

    if (needsBuffering) {
      this.isBuffering = true;
      this.notifyListeners();

      // Aguarda readyState >= 4 (HAVE_ENOUGH_DATA / canplaythrough) em todas as faixas
      const bufferPromises = elementTracks.map(track => {
        const el = track.audioElement!;
        if (el.readyState >= 4) return Promise.resolve();

        return new Promise<void>((resolve) => {
          let resolved = false;
          const settle = () => {
            if (!resolved) {
              resolved = true;
              el.removeEventListener('canplaythrough', settle);
              el.removeEventListener('error', settle);
              resolve();
            }
          };

          // canplaythrough = o navegador acredita ter dados suficientes para tocar sem interrupção
          el.addEventListener('canplaythrough', settle, { once: true });
          el.addEventListener('error', settle, { once: true });

          // Força o início do carregamento caso ainda não tenha iniciado
          if (el.readyState === 0) {
            try { el.load(); } catch (_) {}
          }

          // Timeout de proteção de 2.5s (rede instável ou faixa muito longa)
          setTimeout(settle, 2500);
        });
      });

      await Promise.all(bufferPromises);

      // Se o usuário cancelou o play enquanto aguardava o buffer, aborta
      if (this.playRequestId !== currentRequestId) {
        this.isBuffering = false;
        this.notifyListeners();
        return;
      }

      this.isBuffering = false;
      this.notifyListeners();
    }

    // ─── DISPARO SIMULTÂNEO VIA Promise.all ────────────────────────────────────
    // Todas as faixas <audio> são posicionadas na mesma posição e disparadas
    // juntas no mesmo ciclo de microtask via Promise.all para máxima sincronia.
    const playPromises: Promise<void>[] = [];

    elementTracks.forEach(track => {
      const el = track.audioElement!;
      try {
        el.currentTime = offset;
      } catch (_) {}
      playPromises.push(
        el.play().catch(err => {
          console.warn(`[AudioEngine] Aviso ao reproduzir <audio> "${track.trackName}":`, err);
        })
      );
    });

    // Buffer PCM fallback (não streaming) — disparo síncrono normal
    song.tracks.forEach(track => {
      if (!track.audioElement && track.audioBuffer && track.gainNode) {
        const sourceNode = context.createBufferSource();
        sourceNode.buffer = track.audioBuffer;
        sourceNode.connect(track.gainNode);
        sourceNode.start(0, offset);
        sourceNode.onended = () => {
          if (track.sourceNode === sourceNode) track.sourceNode = null;
        };
        track.sourceNode = sourceNode;
      }
    });

    // Aguarda confirmação de todos os play() — o navegador os dispara em conjunto
    await Promise.all(playPromises).catch(() => {});

    // Cancela se houve interrupção durante o disparo
    if (this.playRequestId !== currentRequestId) return;

    this.startTime = context.currentTime - this.pauseTime;
    this.isPlaying = true;
    this.lastSyncCheckTime = performance.now();
    
    // Start time update loop
    this.startTimeUpdateLoop();
    
    this.notifyPlayback();
    this.notifyListeners();
  }

  pause(): void {
    this.playRequestId++;
    this.isBuffering = false;
    if (!this.isPlaying) return;
    
    const context = this.audioContext;
    if (context) {
      this.pauseTime = context.currentTime - this.startTime;
    }
    
    this.stopAllSources();
    this.isPlaying = false;
    
    // Stop time update loop
    this.stopTimeUpdateLoop();
    
    this.notifyPlayback();
    this.notifyListeners();
  }

  stop(): void {
    this.playRequestId++;
    this.isBuffering = false;
    this.stopAllSources(true);
    this.isPlaying = false;
    this.pauseTime = 0;
    
    // Stop time update loop
    this.stopTimeUpdateLoop();
    
    this.notifyPlayback();
    this.notifyListeners();
  }

  seek(time: number): void {
    const song = this.getCurrentSong();
    if (!song) return;
    
    const wasPlaying = this.isPlaying;
    const clampedTime = Math.max(0, Math.min(time, song.duration));
    
    if (wasPlaying) {
      this.stopAllSources();
    }
    
    this.pauseTime = clampedTime;
    
    if (wasPlaying) {
      const context = this.ensureContext();
      
      // Reinicia todas as faixas na nova posição
      song.tracks.forEach(track => {
        if (track.audioElement) {
          try {
            track.audioElement.currentTime = clampedTime;
            track.audioElement.play().catch(() => {});
          } catch (e) {}
        } else if (track.audioBuffer && track.gainNode) {
          const sourceNode = context.createBufferSource();
          sourceNode.buffer = track.audioBuffer;
          sourceNode.connect(track.gainNode);
          sourceNode.start(0, clampedTime);
          
          sourceNode.onended = () => {
            if (track.sourceNode === sourceNode) {
              track.sourceNode = null;
            }
          };
          
          track.sourceNode = sourceNode;
        }
      });
      
      this.startTime = context.currentTime - clampedTime;
    } else {
      // Quando pausado, atualiza o cursor dos elementos de áudio para sincronia no próximo play
      song.tracks.forEach(track => {
        if (track.audioElement) {
          try {
            track.audioElement.currentTime = clampedTime;
          } catch (e) {}
        }
      });
    }
    
    this.notifyPlayback();
  }

  private stopAllSources(resetPosition = false): void {
    const song = this.getCurrentSong();
    if (!song) return;
    
    song.tracks.forEach(track => {
      // Pausa elementos <audio>
      if (track.audioElement) {
        try {
          track.audioElement.pause();
          if (resetPosition) {
            track.audioElement.currentTime = 0;
          }
        } catch (e) {}
      }

      // Interrompe nós de buffer
      if (track.sourceNode) {
        try {
          track.sourceNode.stop();
        } catch (e) {
          // Ignore errors if already stopped
        }
        track.sourceNode = null;
      }
    });
  }

  private startTimeUpdateLoop(): void {
    const update = () => {
      if (!this.isPlaying) return;
      
      const song = this.getCurrentSong();
      if (!song) return;
      
      const currentTime = this.getCurrentTime();
      
      // Check if playback has ended
      if (currentTime >= song.duration) {
        this.stop();
        return;
      }

      // ─── DRIFT CORRECTION COM MASTER CLOCK ─────────────────────────────────
      // Verifica o desvio a cada 200ms. Usa o currentTime do Master Clock como
      // referência de tempo real (em vez do AudioContext.currentTime, que pode
      // divergir do playback real do elemento <audio> no WebKit).
      // Corrige as faixas escravas APENAS se desviarem mais de 40ms do master.
      const now = performance.now();
      if (now - this.lastSyncCheckTime > 200) {
        this.lastSyncCheckTime = now;

        // Determina o tempo de referência: Master Clock ou AudioContext como fallback
        const masterTrack = this.masterClockTrackId
          ? song.tracks.find(t => t.trackId === this.masterClockTrackId)
          : null;

        const masterTime =
          masterTrack?.audioElement && !masterTrack.audioElement.paused
            ? masterTrack.audioElement.currentTime
            : currentTime; // fallback: tempo calculado pelo AudioContext

        song.tracks.forEach((track) => {
          // O master clock não corrige a si mesmo
          if (track.trackId === this.masterClockTrackId) return;

          if (track.audioElement && !track.audioElement.paused && !track.isMuted) {
            const diff = Math.abs(track.audioElement.currentTime - masterTime);
            // Corrige APENAS se o desvio ultrapassar 40ms (0.04s)
            if (diff > 0.04) {
              console.debug(
                `[AudioEngine] Drift correction em "${track.trackName}": desvio ${(diff * 1000).toFixed(1)}ms → corrigindo para ${masterTime.toFixed(3)}s`
              );
              track.audioElement.currentTime = masterTime;
            }
          }
        });
      }

      this.notifyPlayback();
      this.animationFrameId = requestAnimationFrame(update);
    };
    
    this.animationFrameId = requestAnimationFrame(update);
  }

  private stopTimeUpdateLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  getCurrentTime(): number {
    if (!this.isPlaying) return this.pauseTime;
    
    const context = this.audioContext;
    if (!context) return 0;
    
    return context.currentTime - this.startTime;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  // Set track volume (0.0 to 1.0)
  setTrackVolume(trackId: string, newVolume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    
    // Find the track across all songs
    for (const song of this.songs.values()) {
      const track = song.tracks.find(t => t.trackId === trackId);
      if (track) {
        track.volume = clampedVolume;
        
        if (track.gainNode && !track.isMuted) {
          track.gainNode.gain.setValueAtTime(clampedVolume, this.audioContext?.currentTime || 0);
        }
        
        this.notifyListeners();
        return;
      }
    }
  }

  // Toggle track mute
  toggleTrackMute(trackId: string): boolean {
    // Find the track across all songs
    for (const song of this.songs.values()) {
      const track = song.tracks.find(t => t.trackId === trackId);
      if (track) {
        track.isMuted = !track.isMuted;
        this.updateTrackGains(song);
        this.notifyListeners();
        return track.isMuted;
      }
    }
    return false;
  }

  // Toggle track solo
  toggleTrackSolo(trackId: string): boolean {
    for (const song of this.songs.values()) {
      const track = song.tracks.find(t => t.trackId === trackId);
      if (track) {
        track.isSoloed = !track.isSoloed;
        this.updateTrackGains(song);
        this.notifyListeners();
        return track.isSoloed;
      }
    }
    return false;
  }

  // Update all track gains based on mute/solo state
  private updateTrackGains(song: Song): void {
    const hasSoloedTrack = song.tracks.some(t => t.isSoloed);
    
    song.tracks.forEach(track => {
      if (track.gainNode) {
        let targetVolume: number;
        
        if (track.isMuted) {
          targetVolume = 0;
        } else if (hasSoloedTrack && !track.isSoloed) {
          targetVolume = 0;
        } else {
          targetVolume = track.volume;
        }
        
        track.gainNode.gain.setValueAtTime(targetVolume, this.audioContext?.currentTime || 0);
      }
    });
  }

  // Set mute state explicitly
  setTrackMute(trackId: string, muted: boolean): void {
    for (const song of this.songs.values()) {
      const track = song.tracks.find(t => t.trackId === trackId);
      if (track) {
        track.isMuted = muted;
        this.updateTrackGains(song);
        this.notifyListeners();
        return;
      }
    }
  }

  // Set track pan (-1 = left, 0 = center, 1 = right)
  setTrackPan(trackId: string, pan: number): void {
    const clampedPan = Math.max(-1, Math.min(1, pan));
    
    for (const song of this.songs.values()) {
      const track = song.tracks.find(t => t.trackId === trackId);
      if (track) {
        track.pan = clampedPan;
        
        if (track.panNode) {
          track.panNode.pan.setValueAtTime(clampedPan, this.audioContext?.currentTime || 0);
        }
        
        this.notifyListeners();
        return;
      }
    }
  }

  // Split click tracks to left and instruments to right
  splitClickAndInstruments(clickToLeft: boolean = true): void {
    const song = this.getCurrentSong();
    if (!song) return;
    
    const clickPan = clickToLeft ? -1 : 1;
    const instrumentPan = clickToLeft ? 1 : -1;
    
    song.tracks.forEach(track => {
      const targetPan = track.isClickTrack ? clickPan : instrumentPan;
      track.pan = targetPan;
      
      if (track.panNode) {
        track.panNode.pan.setValueAtTime(targetPan, this.audioContext?.currentTime || 0);
      }
    });
    
    this.notifyListeners();
  }

  // Reset all pans to center
  resetPans(): void {
    const song = this.getCurrentSong();
    if (!song) return;
    
    song.tracks.forEach(track => {
      track.pan = 0;
      
      if (track.panNode) {
        track.panNode.pan.setValueAtTime(0, this.audioContext?.currentTime || 0);
      }
    });
    
    this.notifyListeners();
  }

  // Check if a track is a click, metronome or guide track
  isClickOrGuideTrack(track: Track): boolean {
    if (track.isClickTrack) return true;
    const lowerName = (track.trackName || '').toLowerCase();
    const clickKeywords = ['click', 'guide', 'metronome', 'metro', 'count', 'cue', 'guia', 'voz guia'];
    return clickKeywords.some(keyword => lowerName.includes(keyword));
  }

  // Fade instruments out (leave only click/guide), or fade them back in
  fadeInstruments(fadeOut: boolean, duration: number = 4.5): void {
    const song = this.getCurrentSong();
    if (!song) return;
    
    const context = this.audioContext;
    if (!context) return;
    
    const currentTime = context.currentTime;
    
    song.tracks.forEach(track => {
      // Skip click / metronome / guide tracks - they stay completely audible at full current volume
      if (this.isClickOrGuideTrack(track)) return;
      
      if (!track.gainNode) return;
      
      if (fadeOut) {
        // Save current volume before fading out
        if (!this.instrumentsFaded) {
          this.savedInstrumentVolumes.set(track.trackId, track.volume);
        }
        
        // Cancel any ongoing ramps and fade to 0 over duration (4 a 5s)
        track.gainNode.gain.cancelScheduledValues(currentTime);
        track.gainNode.gain.setValueAtTime(track.gainNode.gain.value, currentTime);
        track.gainNode.gain.linearRampToValueAtTime(0.0001, currentTime + duration);
        track.gainNode.gain.setValueAtTime(0, currentTime + duration);
      } else {
        // Fade back in to saved volume over 1.0s
        const savedVolume = this.savedInstrumentVolumes.get(track.trackId) ?? track.volume;
        
        track.gainNode.gain.cancelScheduledValues(currentTime);
        track.gainNode.gain.setValueAtTime(track.gainNode.gain.value, currentTime);
        track.gainNode.gain.linearRampToValueAtTime(savedVolume, currentTime + 1.0);
      }
    });
    
    this.instrumentsFaded = fadeOut;
    this.notifyListeners();
  }

  // Check if instruments are currently faded
  areInstrumentsFaded(): boolean {
    return this.instrumentsFaded;
  }

  // Set master volume
  setMasterVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGainNode) {
      this.masterGainNode.gain.setValueAtTime(clampedVolume, this.audioContext?.currentTime || 0);
    }
  }

  /**
   * Decodificação de áudio segura compatível com Safari/iOS e navegadores modernos.
   * Suporta tanto Promise quanto callback legado do WebKit, clona o ArrayBuffer
   * para evitar desvinculação (detaching) e trata buffers corrompidos com logs explícitos por canal.
   */
  async decodeAudioData(arrayBuffer: ArrayBuffer, trackName: string = "Canal"): Promise<AudioBuffer | null> {
    try {
      const context = this.ensureContext();
      if (context.state === 'suspended') {
        await context.resume().catch(() => {});
      }

      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        console.error(`[AudioEngine] Buffer de áudio vazio ou nulo no canal "${trackName}".`);
        return null;
      }

      // Clona o arrayBuffer para proteger contra desanexação de memória pelo WebKit do Safari
      const bufferCopy = arrayBuffer.slice(0);

      return await new Promise<AudioBuffer>((resolve, reject) => {
        let isSettled = false;

        const onSuccess = (decoded: AudioBuffer) => {
          if (!isSettled) {
            isSettled = true;
            resolve(decoded);
          }
        };

        const onError = (err: any) => {
          if (!isSettled) {
            isSettled = true;
            reject(err);
          }
        };

        try {
          // No Safari legado, decodeAudioData usa callbacks e retorna void/undefined
          const res = context.decodeAudioData(bufferCopy, onSuccess, onError);
          if (res && typeof (res as any).then === 'function') {
            (res as Promise<AudioBuffer>).then(onSuccess).catch(onError);
          }
        } catch (callErr) {
          onError(callErr);
        }
      });
    } catch (error) {
      console.error(`[AudioEngine] Falha ao decodificar canal "${trackName}":`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  // Decodifica arquivo local File ou Blob com try/catch e logs por canal
  async decodeAudioFile(file: File | Blob, trackName?: string): Promise<AudioBuffer | null> {
    const name = trackName || (file instanceof File ? file.name : "Arquivo de áudio");
    try {
      const arrayBuffer = await file.arrayBuffer();
      return await this.decodeAudioData(arrayBuffer, name);
    } catch (error) {
      console.error(`[AudioEngine] Falha ao ler ArrayBuffer do canal "${name}":`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  // Carrega áudio remoto via fetch com modo CORS / crossOrigin anonymous e timeout
  async fetchAndDecodeAudio(url: string, trackName: string = "Canal"): Promise<AudioBuffer | null> {
    try {
      const response = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Accept': 'audio/*, */*',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} (${response.statusText})`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return await this.decodeAudioData(arrayBuffer, trackName);
    } catch (error) {
      console.error(`[AudioEngine] Falha ao carregar áudio remoto no canal "${trackName}" (${url}):`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  // Subscribe to state changes
  subscribe(listener: (state: AudioEngineState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Subscribe to playback changes (for time updates)
  subscribeToPlayback(listener: PlaybackListener): () => void {
    this.playbackListeners.add(listener);
    return () => this.playbackListeners.delete(listener);
  }

  private notifyPlayback(): void {
    const song = this.getCurrentSong();
    const state = {
      isPlaying: this.isPlaying,
      currentTime: this.getCurrentTime(),
      duration: song?.duration || 0,
    };
    this.playbackListeners.forEach(listener => listener(state));
  }

  private notifyListeners() {
    const song = this.getCurrentSong();
    const state: AudioEngineState = {
      songs: this.getSongs(),
      currentSongId: this.currentSongId,
      isPlaying: this.isPlaying,
      isBuffering: this.isBuffering,
      currentTime: this.getCurrentTime(),
      duration: song?.duration || 0,
      instrumentsFaded: this.instrumentsFaded,
    };
    this.listeners.forEach(listener => listener(state));
  }

  // Get state
  getState(): AudioEngineState {
    const song = this.getCurrentSong();
    return {
      songs: this.getSongs(),
      currentSongId: this.currentSongId,
      isPlaying: this.isPlaying,
      isBuffering: this.isBuffering,
      currentTime: this.getCurrentTime(),
      duration: song?.duration || 0,
      instrumentsFaded: this.instrumentsFaded,
    };
  }
}

// Singleton instance
export const audioEngine = new AudioEngine();

/**
 * Executa requisições em lotes limitados utilizando Promise.allSettled
 * para evitar esgotar o pool de conexões HTTP (6 a 12 arquivos) no mobile e Safari.
 */
export async function loadInBatches<T, R>(
  items: T[],
  batchSize: number = 3,
  fn: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map((item, idx) => fn(item, i + idx))
    );
    results.push(...batchResults);
  }
  return results;
}

// Desbloqueia automaticamente o AudioContext no Safari/iOS no primeiro gesto de interação do usuário
if (typeof window !== "undefined") {
  const unlockEvents = ["touchstart", "touchend", "pointerdown", "mousedown", "keydown"];
  const unlockHandler = () => {
    audioEngine.unlockAudioContext();
    unlockEvents.forEach((evt) => window.removeEventListener(evt, unlockHandler));
  };
  unlockEvents.forEach((evt) =>
    window.addEventListener(evt, unlockHandler, { passive: true, once: true })
  );
}
