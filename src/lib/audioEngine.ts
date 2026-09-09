// ============================================================
// AudioEngine — Arquitetura de Áudio Profissional
// Desktop : AudioBufferSourceNode (sincronia de nanossegundo via Web Audio API)
// Mobile  : HTMLAudioElement Nativo (streaming direto sem OOM, sem silêncio do WebKit, sem engasgos)
// Compatível com Safari/iOS, Chrome Mobile, Android, Firefox.
// ============================================================

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent))
  );
}

export interface Track {
  trackId: string;
  trackName: string;
  audioBuffer: AudioBuffer | null;
  audioUrl?: string;
  audioElement?: HTMLAudioElement | null;
  mediaElementSource?: MediaElementAudioSourceNode | null;
  volume: number;
  pan: number;
  isMuted: boolean;
  isSoloed: boolean;
  isClickTrack: boolean;
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

type StateListener    = (state: AudioEngineState) => void;
type PlaybackListener = (state: { isPlaying: boolean; currentTime: number; duration: number }) => void;

class AudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private masterVolume: number = 1.0;

  private songs: Map<string, Song> = new Map();
  private trackGainNodes: Map<string, GainNode> = new Map();
  private currentSongId: string | null = null;

  private listeners: Set<StateListener> = new Set();
  private playbackListeners: Set<PlaybackListener> = new Set();

  private isPlaying: boolean = false;
  private isBuffering: boolean = false;
  private playRequestId: number = 0;

  // Desktop: tempo absoluto de referência
  private absoluteStartTime: number = 0;
  // Posição pausada
  private pauseOffset: number = 0;

  private animationFrameId: number | null = null;
  private lastSyncCheckTime: number = 0;
  private masterClockTrackId: string | null = null;

  // Fade de instrumentos
  private instrumentsFaded: boolean = false;
  private savedInstrumentVolumes: Map<string, number> = new Map();
  private fadeIntervals: Map<HTMLAudioElement, number> = new Map();

  private createdObjectUrls: Set<string> = new Set();

  constructor() {
    this.initAudioContext();
  }

  // ─── CONTEXTO ────────────────────────────────────────────────────────────────

  private initAudioContext(): void {
    if (typeof window === 'undefined' || this.audioContext) return;
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGainNode = this.audioContext.createGain();
      this.masterGainNode.gain.setValueAtTime(this.masterVolume, this.audioContext.currentTime);
      this.masterGainNode.connect(this.audioContext.destination);
    } catch (e) {
      console.warn('[AudioEngine] Erro ao inicializar AudioContext:', e);
    }
  }

  ensureContext(): AudioContext {
    if (!this.audioContext) this.initAudioContext();
    return this.audioContext!;
  }

  async unlockAudioContext(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
  }

  // ─── GERENCIAMENTO DE RECURSOS ───────────────────────────────────────────────

  registerObjectUrl(url: string): void {
    if (url?.startsWith('blob:')) this.createdObjectUrls.add(url);
  }

  revokeAllObjectUrls(): void {
    this.createdObjectUrls.forEach(url => {
      try { URL.revokeObjectURL(url); } catch (_) {}
    });
    this.createdObjectUrls.clear();
  }

  private clearAllFadeIntervals(): void {
    this.fadeIntervals.forEach(id => clearInterval(id));
    this.fadeIntervals.clear();
  }

  private fadeAudioElement(el: HTMLAudioElement, targetVolume: number, durationSec: number): void {
    const existing = this.fadeIntervals.get(el);
    if (existing) {
      clearInterval(existing);
      this.fadeIntervals.delete(el);
    }

    const startVol = el.volume;
    const startTime = performance.now();
    const durationMs = durationSec * 1000;

    const interval = window.setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      el.volume = Math.max(0, Math.min(1, startVol + (targetVolume - startVol) * progress));

      if (progress >= 1) {
        clearInterval(interval);
        this.fadeIntervals.delete(el);
      }
    }, 30);

    this.fadeIntervals.set(el, interval);
  }

  disposeSong(song: Song): void {
    this.clearAllFadeIntervals();
    song.tracks.forEach(track => {
      if (track.sourceNode) {
        try { track.sourceNode.stop(); } catch (_) {}
        try { track.sourceNode.disconnect(); } catch (_) {}
        track.sourceNode = null;
      }
      if (track.mediaElementSource) {
        try { track.mediaElementSource.disconnect(); } catch (_) {}
        track.mediaElementSource = null;
      }
      if (track.gainNode) {
        try { track.gainNode.disconnect(); } catch (_) {}
        track.gainNode = null;
      }
      if (track.panNode) {
        try { track.panNode.disconnect(); } catch (_) {}
        track.panNode = null;
      }
      track.audioBuffer = null;
      if (track.audioElement) {
        try {
          track.audioElement.pause();
          track.audioElement.removeAttribute('src');
          track.audioElement.load();
        } catch (_) {}
        track.audioElement = null;
      }
      if (track.audioUrl?.startsWith('blob:')) {
        try { URL.revokeObjectURL(track.audioUrl); } catch (_) {}
        this.createdObjectUrls.delete(track.audioUrl!);
      }
      this.trackGainNodes.delete(track.trackId);
    });
  }

  cleanupSongResources(song: Song): void {
    this.disposeSong(song);
  }

  // ─── CRUD DE MÚSICAS ──────────────────────────────────────────────────────────

  getSongs(): Song[] { return Array.from(this.songs.values()); }
  getSong(id: string): Song | undefined { return this.songs.get(id); }
  getCurrentSong(): Song | undefined {
    return this.currentSongId ? this.songs.get(this.currentSongId) : undefined;
  }

  setCurrentSong(songId: string): void {
    if (!this.songs.has(songId)) return;
    if (this.isPlaying) this.stop();
    this.currentSongId = songId;
    this.pauseOffset = 0;
    this.notifyListeners();
  }

  addSong(song: Song): void {
    const ctx = this.ensureContext();

    song.tracks.forEach(track => {
      // Cria os nós Web Audio para faixas Desktop (AudioBufferSourceNode)
      if (!track.gainNode || !track.panNode) {
        const gainNode = ctx.createGain();
        const panNode  = ctx.createStereoPanner();
        gainNode.gain.value = track.isMuted ? 0 : track.volume;
        panNode.pan.value   = track.pan;
        gainNode.connect(panNode);
        if (this.masterGainNode) {
          panNode.connect(this.masterGainNode);
        }
        track.gainNode = gainNode;
        track.panNode  = panNode;
        this.trackGainNodes.set(track.trackId, gainNode);
      }

      // No mobile: o elemento <audio> toca DIRETAMENTE na saída do aparelho!
      // NÃO redirecionamos via createMediaElementSource para não ativar bugs de silêncio do iOS/WebKit.
      if (track.audioElement) {
        const targetVol = track.isMuted ? 0 : Math.max(0, Math.min(1, track.volume * this.masterVolume));
        track.audioElement.volume = targetVol;
      }

      // Se veio de URL remota no mobile sem elemento, instancia o <audio>
      if (track.audioUrl && !track.audioElement && !track.audioBuffer && typeof Audio !== 'undefined') {
        const el = new Audio();
        el.crossOrigin = 'anonymous';
        el.preload = 'auto';
        el.src = track.audioUrl;
        el.volume = track.isMuted ? 0 : Math.max(0, Math.min(1, track.volume * this.masterVolume));
        track.audioElement = el;
      }
    });

    this.songs.set(song.id, song);
    if (!this.currentSongId) this.currentSongId = song.id;
    this.notifyListeners();
  }

  removeSong(songId: string): void {
    const song = this.songs.get(songId);
    if (!song) return;
    if (this.currentSongId === songId && this.isPlaying) this.stop();
    this.disposeSong(song);
    this.songs.delete(songId);
    if (this.currentSongId === songId) {
      this.currentSongId = this.songs.size > 0 ? (this.songs.keys().next().value ?? null) : null;
    }
    this.notifyListeners();
  }

  clearAllSongs(): void {
    this.stop();
    this.songs.forEach(song => this.disposeSong(song));
    this.songs.clear();
    this.currentSongId = null;
    this.revokeAllObjectUrls();
    this.notifyListeners();
  }

  // ─── REPRODUÇÃO (PLAYBACK) ────────────────────────────────────────────────────

  async play(): Promise<void> {
    const song = this.getCurrentSong();
    if (!song || song.tracks.length === 0) return;

    // 1. Destrava AudioContext síncrono no mesmo gesto de clique
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    this.stopAllSources();
    const requestId = ++this.playRequestId;
    const offset    = this.pauseOffset;

    // Separa faixas por mecanismo de execução
    const bufferTracks  = song.tracks.filter(t => t.audioBuffer && t.gainNode);
    const elementTracks = song.tracks.filter(t => t.audioElement && !t.audioBuffer);

    // 2. Decode sob demanda caso o Desktop acesse faixas remotas sem buffer
    const needDecode = song.tracks.filter(t => !t.audioBuffer && !t.audioElement && t.audioUrl);
    if (needDecode.length > 0) {
      this.isBuffering = true;
      this.notifyListeners();
      const BATCH = 3;
      for (let i = 0; i < needDecode.length; i += BATCH) {
        if (this.playRequestId !== requestId) { this.isBuffering = false; this.notifyListeners(); return; }
        await Promise.allSettled(
          needDecode.slice(i, i + BATCH).map(async track => {
            const buf = await this.fetchAndDecodeAudio(track.audioUrl!, track.trackName).catch(() => null);
            if (buf) {
              track.audioBuffer = buf;
              bufferTracks.push(track);
            }
          })
        );
      }
      if (this.playRequestId !== requestId) { this.isBuffering = false; this.notifyListeners(); return; }
      this.isBuffering = false;
      this.notifyListeners();
    }

    // 3. MASTER CLOCK: Elege preferencialmente o click/guide
    const mobileActive = elementTracks.filter(t => !t.isMuted);
    const allReady = [...bufferTracks, ...mobileActive];
    const master   = allReady.find(t => t.isClickTrack || this.isClickOrGuideTrack(t)) ?? allReady[0] ?? null;
    this.masterClockTrackId = master?.trackId ?? null;

    // 4. DESKTOP: Disparo via AudioBufferSourceNode (+50ms para nanossegundo de precisão)
    if (bufferTracks.length > 0) {
      const startTime = ctx.currentTime + 0.05;
      bufferTracks.forEach(track => {
        if (!track.audioBuffer || !track.gainNode) return;
        const src = ctx.createBufferSource();
        src.buffer = track.audioBuffer;
        src.connect(track.gainNode);
        src.onended = () => { if (track.sourceNode === src) track.sourceNode = null; };
        src.start(startTime, offset);
        track.sourceNode = src;
      });
      this.absoluteStartTime = startTime - offset;
    }

    // 5. MOBILE: Disparo DIRETO E IMEDIATO dos elementos <audio>
    // SEM await ou setTimeout antes de play() para manter o User Gesture 100% ativo!
    if (elementTracks.length > 0) {
      this.updateTrackGains(song);

      elementTracks.forEach(track => {
        const el = track.audioElement!;
        try {
          if (Math.abs(el.currentTime - offset) > 0.05) {
            el.currentTime = offset;
          }
        } catch (_) {}
        el.playbackRate = 1.0;
      });

      // Dispara todos os elementos no mesmo tick da interação do usuário
      // Faixas mutadas iniciam com .muted = true em background, desmutando instantaneamente ao clique
      elementTracks.forEach(track => {
        const el = track.audioElement!;
        const p = el.play();
        if (p && typeof p.catch === 'function') {
          p.catch(err => console.warn(`[AudioEngine] play() aviso "${track.trackName}":`, err));
        }
      });

      if (bufferTracks.length === 0) {
        this.absoluteStartTime = ctx.currentTime - offset;
      }
    }

    if (this.playRequestId !== requestId) return;

    this.isPlaying = true;
    this.lastSyncCheckTime = performance.now();
    this.startTimeUpdateLoop();
    this.notifyPlayback();
    this.notifyListeners();
  }

  pause(): void {
    this.playRequestId++;
    this.isBuffering = false;
    if (!this.isPlaying) return;
    this.pauseOffset = this.getCurrentTime();
    this.stopAllSources();
    this.isPlaying = false;
    this.stopTimeUpdateLoop();
    this.notifyPlayback();
    this.notifyListeners();
  }

  stop(): void {
    this.playRequestId++;
    this.isBuffering = false;
    this.stopAllSources();
    this.isPlaying  = false;
    this.pauseOffset = 0;
    this.stopTimeUpdateLoop();
    this.notifyPlayback();
    this.notifyListeners();
  }

  seek(time: number): void {
    const song = this.getCurrentSong();
    if (!song) return;
    const wasPlaying = this.isPlaying;
    const t = Math.max(0, Math.min(time, song.duration));
    if (wasPlaying) this.stopAllSources();
    this.pauseOffset = t;

    if (wasPlaying) {
      const ctx = this.ensureContext();
      // Desktop: re-agenda os nós de buffer
      const startTime = ctx.currentTime + 0.02;
      song.tracks.forEach(track => {
        if (track.audioBuffer && track.gainNode) {
          const src = ctx.createBufferSource();
          src.buffer = track.audioBuffer;
          src.connect(track.gainNode);
          src.onended = () => { if (track.sourceNode === src) track.sourceNode = null; };
          src.start(startTime, t);
          track.sourceNode = src;
        }
        // Mobile: reposiciona e inicia com velocidade normal
        if (track.audioElement && !track.audioBuffer) {
          try { track.audioElement.currentTime = t; } catch (_) {}
          track.audioElement.playbackRate = 1.0;
          if (!track.isMuted) {
            track.audioElement.play().catch(() => {});
          }
        }
      });
      this.absoluteStartTime = startTime - t;
    }
    this.notifyPlayback();
  }

  togglePlayPause(): void {
    if (this.isPlaying) this.pause(); else this.play();
  }

  private stopAllSources(): void {
    const song = this.getCurrentSong();
    this.clearAllFadeIntervals();
    if (!song) return;
    song.tracks.forEach(track => {
      if (track.sourceNode) {
        try { track.sourceNode.stop(); }       catch (_) {}
        try { track.sourceNode.disconnect(); } catch (_) {}
        track.sourceNode = null;
      }
      if (track.audioElement) {
        try {
          track.audioElement.pause();
          track.audioElement.playbackRate = 1.0;
        } catch (_) {}
      }
    });
  }

  // ─── LOOP DE TEMPO E SINCRONIZAÇÃO SUAVE ──────────────────────────────────────

  private startTimeUpdateLoop(): void {
    let lastNotifyMs = 0;

    const update = () => {
      if (!this.isPlaying) return;
      const song = this.getCurrentSong();
      if (!song) return;
      const currentTime = this.getCurrentTime();
      if (currentTime >= song.duration) { this.stop(); return; }

      const now = performance.now();

      // Sincronização inteligente sem cortes (500ms throttle)
      // Ajusta o playbackRate em ±2.5% para alinhar o áudio de forma 100% contínua
      if (now - this.lastSyncCheckTime > 500) {
        this.lastSyncCheckTime = now;

        const masterTrack = this.masterClockTrackId
          ? song.tracks.find(t => t.trackId === this.masterClockTrackId)
          : null;
        const masterEl = masterTrack?.audioElement;
        const masterTime = masterEl && !masterEl.paused
          ? masterEl.currentTime
          : currentTime;

        song.tracks.forEach(track => {
          if (track.trackId === this.masterClockTrackId) return;
          const el = track.audioElement;
          if (el && !el.paused && !track.isMuted) {
            const timeDiff = el.currentTime - masterTime;
            const absDiff = Math.abs(timeDiff);

            if (absDiff < 0.04) {
              if (el.playbackRate !== 1.0) el.playbackRate = 1.0;
            } else if (absDiff <= 0.35) {
              const targetRate = timeDiff < 0 ? 1.025 : 0.975;
              if (el.playbackRate !== targetRate) el.playbackRate = targetRate;
            } else {
              el.playbackRate = 1.0;
              el.currentTime = masterTime;
            }
          }
        });
      }

      // Notifica React a ~16fps (60ms) para não sobrecarregar setState
      if (now - lastNotifyMs >= 60) {
        lastNotifyMs = now;
        this.notifyPlayback();
      }

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
    if (!this.isPlaying) return this.pauseOffset;
    if (this.masterClockTrackId) {
      const song = this.getCurrentSong();
      const masterTrack = song?.tracks.find(t => t.trackId === this.masterClockTrackId);
      if (masterTrack?.audioElement && !masterTrack.audioElement.paused) {
        return masterTrack.audioElement.currentTime;
      }
    }
    const ctx = this.audioContext;
    if (!ctx) return this.pauseOffset;
    return Math.max(0, ctx.currentTime - this.absoluteStartTime);
  }

  getIsPlaying(): boolean { return this.isPlaying; }

  // ─── CONTROLE DE VOLUME / MUTE / SOLO / PAN ───────────────────────────────────

  setTrackVolume(trackId: string, vol: number): void {
    const v = Math.max(0, Math.min(1, vol));
    for (const song of this.songs.values()) {
      const track = song.tracks.find(t => t.trackId === trackId);
      if (track) {
        track.volume = v;
        this.updateTrackGains(song);
        this.notifyListeners();
        return;
      }
    }
  }

  toggleTrackMute(trackId: string): boolean {
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

  private updateTrackGains(song: Song): void {
    const hasSolo = song.tracks.some(t => t.isSoloed);
    const ctx = this.audioContext;
    const now = ctx?.currentTime ?? 0;

    song.tracks.forEach(track => {
      const isMutedEffective = track.isMuted || (hasSolo && !track.isSoloed);
      const vol = isMutedEffective ? 0 : track.volume;

      // 1. Web Audio (Desktop)
      if (track.gainNode) {
        try {
          if (ctx) track.gainNode.gain.cancelScheduledValues(now);
          track.gainNode.gain.setValueAtTime(vol, now);
        } catch (_) {}
        track.gainNode.gain.value = vol;
      }

      // 2. Áudio Nativo (Mobile) — no iOS/Android, o controle de hardware é via .muted!
      if (track.audioElement) {
        track.audioElement.muted = isMutedEffective;
        try {
          track.audioElement.volume = Math.max(0, Math.min(1, vol * this.masterVolume));
        } catch (_) {}
      }
    });
  }

  setTrackPan(trackId: string, pan: number): void {
    const p = Math.max(-1, Math.min(1, pan));
    for (const song of this.songs.values()) {
      const track = song.tracks.find(t => t.trackId === trackId);
      if (track) {
        track.pan = p;
        if (track.panNode) track.panNode.pan.setValueAtTime(p, this.audioContext?.currentTime ?? 0);
        this.notifyListeners();
        return;
      }
    }
  }

  splitClickAndInstruments(clickToLeft = true): void {
    const song = this.getCurrentSong();
    if (!song) return;
    const cPan = clickToLeft ? -1 :  1;
    const iPan = clickToLeft ?  1 : -1;
    const now  = this.audioContext?.currentTime ?? 0;
    song.tracks.forEach(track => {
      const p = track.isClickTrack ? cPan : iPan;
      track.pan = p;
      if (track.panNode) track.panNode.pan.setValueAtTime(p, now);
    });
    this.notifyListeners();
  }

  resetPans(): void {
    const song = this.getCurrentSong();
    if (!song) return;
    const now = this.audioContext?.currentTime ?? 0;
    song.tracks.forEach(track => {
      track.pan = 0;
      if (track.panNode) track.panNode.pan.setValueAtTime(0, now);
    });
    this.notifyListeners();
  }

  isClickOrGuideTrack(track: Track): boolean {
    if (track.isClickTrack) return true;
    const n = (track.trackName || '').toLowerCase();
    return ['click','guide','metronome','metro','count','cue','guia','voz guia'].some(k => n.includes(k));
  }

  // ─── FADE DE INSTRUMENTOS ─────────────────────────────────────────────────────

  fadeInstruments(fadeOut: boolean, duration = 4.5): void {
    const song = this.getCurrentSong();
    if (!song) return;
    const ctx = this.audioContext;
    const now = ctx?.currentTime ?? 0;

    song.tracks.forEach(track => {
      if (this.isClickOrGuideTrack(track)) return;

      if (fadeOut) {
        if (!this.instrumentsFaded) this.savedInstrumentVolumes.set(track.trackId, track.volume);

        // Desktop
        if (track.gainNode && ctx) {
          track.gainNode.gain.cancelScheduledValues(now);
          track.gainNode.gain.setValueAtTime(track.gainNode.gain.value, now);
          track.gainNode.gain.linearRampToValueAtTime(0.0001, now + duration);
          track.gainNode.gain.setValueAtTime(0, now + duration);
        }

        // Mobile
        if (track.audioElement) {
          this.fadeAudioElement(track.audioElement, 0, duration);
        }
      } else {
        const sv = this.savedInstrumentVolumes.get(track.trackId) ?? track.volume;

        // Desktop
        if (track.gainNode && ctx) {
          track.gainNode.gain.cancelScheduledValues(now);
          track.gainNode.gain.setValueAtTime(track.gainNode.gain.value, now);
          track.gainNode.gain.linearRampToValueAtTime(sv, now + 1.0);
        }

        // Mobile
        if (track.audioElement) {
          this.fadeAudioElement(track.audioElement, sv * this.masterVolume, 1.0);
        }
      }
    });

    this.instrumentsFaded = fadeOut;
    this.notifyListeners();
  }

  areInstrumentsFaded(): boolean { return this.instrumentsFaded; }

  setMasterVolume(volume: number): void {
    const v = Math.max(0, Math.min(1, volume));
    this.masterVolume = v;
    if (this.masterGainNode) {
      this.masterGainNode.gain.setValueAtTime(v, this.audioContext?.currentTime ?? 0);
    }
    const song = this.getCurrentSong();
    if (song) {
      this.updateTrackGains(song);
    }
  }

  // ─── DECODE DE ÁUDIO (DESKTOP) ────────────────────────────────────────────────

  async decodeAudioData(ab: ArrayBuffer, trackName = 'Canal'): Promise<AudioBuffer | null> {
    try {
      const ctx = this.ensureContext();
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
      if (!ab || ab.byteLength === 0) { console.error(`[AudioEngine] Buffer vazio "${trackName}".`); return null; }
      const copy = ab.slice(0);
      return await new Promise<AudioBuffer>((resolve, reject) => {
        let done = false;
        const ok  = (b: AudioBuffer) => { if (!done) { done = true; resolve(b); } };
        const err = (e: unknown)     => { if (!done) { done = true; reject(e);  } };
        try {
          const r = ctx.decodeAudioData(copy, ok, err);
          if (r && typeof (r as any).then === 'function') (r as Promise<AudioBuffer>).then(ok).catch(err);
        } catch (e) { err(e); }
      });
    } catch (error) {
      console.error(`[AudioEngine] Falha ao decodificar "${trackName}":`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  async decodeAudioFile(file: File | Blob, trackName?: string): Promise<AudioBuffer | null> {
    const name = trackName || (file instanceof File ? file.name : 'Arquivo de audio');
    try { const ab = await file.arrayBuffer(); return await this.decodeAudioData(ab, name); }
    catch (e) { console.error(`[AudioEngine] Falha ao ler "${name}":`, e instanceof Error ? e.message : e); return null; }
  }

  async fetchAndDecodeAudio(url: string, trackName = 'Canal'): Promise<AudioBuffer | null> {
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit', headers: { 'Accept': 'audio/*, */*' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} (${res.statusText})`);
      return await this.decodeAudioData(await res.arrayBuffer(), trackName);
    } catch (e) {
      console.error(`[AudioEngine] Falha ao carregar "${trackName}" (${url}):`, e instanceof Error ? e.message : e);
      return null;
    }
  }

  // ─── SUBSCRIPTIONS ────────────────────────────────────────────────────────────

  subscribe(listener: StateListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  subscribeToPlayback(listener: PlaybackListener): () => void { this.playbackListeners.add(listener); return () => this.playbackListeners.delete(listener); }

  private notifyPlayback(): void {
    const song = this.getCurrentSong();
    const s = { isPlaying: this.isPlaying, currentTime: this.getCurrentTime(), duration: song?.duration ?? 0 };
    this.playbackListeners.forEach(l => l(s));
  }

  private notifyListeners(): void {
    const song = this.getCurrentSong();
    const st: AudioEngineState = {
      songs: this.getSongs(), currentSongId: this.currentSongId,
      isPlaying: this.isPlaying, isBuffering: this.isBuffering,
      currentTime: this.getCurrentTime(), duration: song?.duration ?? 0,
      instrumentsFaded: this.instrumentsFaded,
    };
    this.listeners.forEach(l => l(st));
  }

  getState(): AudioEngineState {
    const song = this.getCurrentSong();
    return {
      songs: this.getSongs(), currentSongId: this.currentSongId,
      isPlaying: this.isPlaying, isBuffering: this.isBuffering,
      currentTime: this.getCurrentTime(), duration: song?.duration ?? 0,
      instrumentsFaded: this.instrumentsFaded,
    };
  }
}

export const audioEngine = new AudioEngine();

export async function loadInBatches<T, R>(
  items: T[], batchSize = 3,
  fn: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const br = await Promise.allSettled(items.slice(i, i + batchSize).map((item, idx) => fn(item, i + idx)));
    results.push(...br);
  }
  return results;
}

if (typeof window !== 'undefined') {
  const evts = ['touchstart','touchend','pointerdown','mousedown','keydown'];
  const unlock = () => { audioEngine.unlockAudioContext(); evts.forEach(e => window.removeEventListener(e, unlock)); };
  evts.forEach(e => window.addEventListener(e, unlock, { passive: true, once: true }));
}