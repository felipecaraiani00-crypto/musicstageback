// ============================================================
// AudioEngine — Arquitetura Hibrida
// Desktop  : AudioBufferSourceNode (sincronia absoluta via startTime)
// Mobile   : HTMLAudioElement + createMediaElementSource (streaming sem OOM)
// Compativel com Safari/iOS, Chrome Mobile, Firefox Mobile.
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
  private songs: Map<string, Song> = new Map();
  private trackGainNodes: Map<string, GainNode> = new Map();
  private currentSongId: string | null = null;
  private listeners: Set<StateListener> = new Set();
  private playbackListeners: Set<PlaybackListener> = new Set();

  private isPlaying     = false;
  private isBuffering   = false;
  private playRequestId = 0;

  // Desktop: tempo absoluto do AudioContext
  private absoluteStartTime = 0;
  // Posicao pausada (usada por ambas as arquiteturas)
  private pauseOffset = 0;

  private animationFrameId: number | null = null;
  private lastSyncCheckTime  = 0;
  private masterClockTrackId: string | null = null;

  private instrumentsFaded = false;
  private savedInstrumentVolumes: Map<string, number> = new Map();
  private createdObjectUrls: Set<string> = new Set();

  constructor() { this.initAudioContext(); }

  // ─── CONTEXTO ────────────────────────────────────────────────────────────────

  private initAudioContext(): void {
    if (typeof window === 'undefined' || this.audioContext) return;
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGainNode = this.audioContext.createGain();
    this.masterGainNode.connect(this.audioContext.destination);
  }

  ensureContext(): AudioContext {
    if (!this.audioContext) this.initAudioContext();
    return this.audioContext!;
  }

  async unlockAudioContext(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
  }

  // ─── OBJECT URL TRACKING ─────────────────────────────────────────────────────

  registerObjectUrl(url: string): void {
    if (url?.startsWith('blob:')) this.createdObjectUrls.add(url);
  }

  revokeAllObjectUrls(): void {
    this.createdObjectUrls.forEach(url => { try { URL.revokeObjectURL(url); } catch (_) {} });
    this.createdObjectUrls.clear();
  }

  // ─── LIBERACAO DE RECURSOS ───────────────────────────────────────────────────

  disposeSong(song: Song): void {
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
      if (track.gainNode)  { try { track.gainNode.disconnect(); }  catch (_) {} track.gainNode  = null; }
      if (track.panNode)   { try { track.panNode.disconnect();  }  catch (_) {} track.panNode   = null; }
      track.audioBuffer = null;
      if (track.audioElement) {
        try { track.audioElement.pause(); track.audioElement.removeAttribute('src'); track.audioElement.load(); } catch (_) {}
        track.audioElement = null;
      }
      if (track.audioUrl?.startsWith('blob:')) {
        try { URL.revokeObjectURL(track.audioUrl); } catch (_) {}
        this.createdObjectUrls.delete(track.audioUrl!);
      }
      this.trackGainNodes.delete(track.trackId);
    });
  }

  cleanupSongResources(song: Song): void { this.disposeSong(song); }

  // ─── CRUD DE MUSICAS ──────────────────────────────────────────────────────────

  getSongs(): Song[] { return Array.from(this.songs.values()); }
  getSong(id: string): Song | undefined { return this.songs.get(id); }
  getCurrentSong(): Song | undefined { return this.currentSongId ? this.songs.get(this.currentSongId) : undefined; }

  setCurrentSong(songId: string): void {
    if (!this.songs.has(songId)) return;
    if (this.isPlaying) this.stop();
    this.currentSongId = songId;
    this.pauseOffset   = 0;
    this.notifyListeners();
  }

  addSong(song: Song): void {
    const ctx = this.ensureContext();
    song.tracks.forEach(track => {
      if (track.gainNode && track.panNode) return;

      const gainNode = ctx.createGain();
      const panNode  = ctx.createStereoPanner();
      gainNode.gain.value = track.isMuted ? 0 : track.volume;
      panNode.pan.value   = track.pan;
      gainNode.connect(panNode);
      panNode.connect(this.masterGainNode!);
      track.gainNode = gainNode;
      track.panNode  = panNode;
      this.trackGainNodes.set(track.trackId, gainNode);

      // Mobile: conecta audioElement ao grafo Web Audio via createMediaElementSource
      // Isso preserva todos os efeitos (volume, mute, solo, fade, pan) sem decodificar para RAM
      if (track.audioElement && !track.mediaElementSource) {
        try {
          const src = ctx.createMediaElementSource(track.audioElement);
          src.connect(gainNode);
          track.mediaElementSource = src;
        } catch (err) {
          console.warn(`[AudioEngine] createMediaElementSource aviso "${track.trackName}":`, err);
        }
      }

      // Cria audioElement a partir de audioUrl se nao existir e nao ha audioBuffer (mobile remoto)
      if (track.audioUrl && !track.audioElement && !track.audioBuffer && typeof Audio !== 'undefined') {
        const el = new Audio();
        el.crossOrigin = 'anonymous';
        el.preload = 'metadata';
        el.src = track.audioUrl;
        track.audioElement = el;
        try {
          const src = ctx.createMediaElementSource(el);
          src.connect(gainNode);
          track.mediaElementSource = src;
        } catch (err) {
          console.warn(`[AudioEngine] createMediaElementSource (url) aviso "${track.trackName}":`, err);
        }
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

  // ─── PLAYBACK ─────────────────────────────────────────────────────────────────

  async play(): Promise<void> {
    const song = this.getCurrentSong();
    if (!song || song.tracks.length === 0) return;

    // 1. Destrava AudioContext (primeiro gesto do usuario obrigatorio no Safari/iOS)
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

    // Para fontes ativas anteriores
    this.stopAllSources();
    const requestId = ++this.playRequestId;
    const offset    = this.pauseOffset;

    // Separa faixas por tipo de engine
    const bufferTracks  = song.tracks.filter(t => t.audioBuffer && t.gainNode);
    const elementTracks = song.tracks.filter(t => t.audioElement && !t.audioBuffer && t.gainNode);

    // 2. Decode sob demanda para faixas remotas sem buffer e sem elemento (desktop remoto)
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

    // 3. Pre-buffer minimo para elementos <audio> mobile (nao bloqueante, max 1s)
    const mobileActive = elementTracks.filter(t => !t.isMuted);
    const needBuffer   = mobileActive.filter(t => t.audioElement!.readyState < 2);
    if (needBuffer.length > 0) {
      this.isBuffering = true;
      this.notifyListeners();
      await Promise.allSettled(
        needBuffer.map(track => new Promise<void>(resolve => {
          const el = track.audioElement!;
          if (el.readyState >= 2) { resolve(); return; }
          let done = false;
          const settle = () => { if (!done) { done = true; resolve(); } };
          el.addEventListener('canplay', settle, { once: true });
          el.addEventListener('canplaythrough', settle, { once: true });
          el.addEventListener('error', settle, { once: true });
          if (el.readyState === 0) try { el.load(); } catch (_) {}
          setTimeout(settle, 1000);
        }))
      );
      if (this.playRequestId !== requestId) { this.isBuffering = false; this.notifyListeners(); return; }
      this.isBuffering = false;
      this.notifyListeners();
    }

    // 4. MASTER CLOCK
    const allReady = [...bufferTracks, ...mobileActive];
    const master   = allReady.find(t => t.isClickTrack || this.isClickOrGuideTrack(t)) ?? allReady[0] ?? null;
    this.masterClockTrackId = master?.trackId ?? null;

    // 5a. DESKTOP: startTime absoluto +50ms — sincronia de nanosegundo
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

    // 5b. MOBILE: posiciona todos e dispara em conjunto via Promise.allSettled
    if (elementTracks.length > 0) {
      elementTracks.forEach(track => {
        const el = track.audioElement!;
        try { el.currentTime = offset; } catch (_) {}
      });
      // Dispara todos no mesmo tick — catch isolado por faixa
      Promise.allSettled(
        mobileActive.map(track =>
          track.audioElement!.play().catch(err =>
            console.warn(`[AudioEngine] play() aviso "${track.trackName}":`, err)
          )
        )
      );
      // Se nao houver buffer tracks, usa currentTime do elemento como referencia
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
      // Buffer tracks: re-agenda com novo startTime
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
        // Element tracks: reposiciona e reinicia
        if (track.audioElement && !track.audioBuffer) {
          try { track.audioElement.currentTime = t; } catch (_) {}
          if (!track.isMuted) track.audioElement.play().catch(() => {});
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
    if (!song) return;
    song.tracks.forEach(track => {
      if (track.sourceNode) {
        try { track.sourceNode.stop(); }       catch (_) {}
        try { track.sourceNode.disconnect(); } catch (_) {}
        track.sourceNode = null;
      }
      if (track.audioElement) {
        try { track.audioElement.pause(); } catch (_) {}
      }
    });
  }

  // ─── LOOP INTERNO ─────────────────────────────────────────────────────────────

  private startTimeUpdateLoop(): void {
    let lastNotifyMs    = 0;

    const update = () => {
      if (!this.isPlaying) return;
      const song = this.getCurrentSong();
      if (!song) return;
      const currentTime = this.getCurrentTime();
      if (currentTime >= song.duration) { this.stop(); return; }

      const now = performance.now();

      // Drift correction para faixas <audio> mobile (200ms throttle, tolerancia 40ms)
      if (now - this.lastSyncCheckTime > 200) {
        this.lastSyncCheckTime = now;

        // Tempo de referencia: master clock ou AudioContext
        const masterTrack = this.masterClockTrackId
          ? song.tracks.find(t => t.trackId === this.masterClockTrackId)
          : null;
        const masterEl = masterTrack?.audioElement;
        const masterTime = masterEl && !masterEl.paused
          ? masterEl.currentTime
          : currentTime;

        song.tracks.forEach(track => {
          if (track.trackId === this.masterClockTrackId) return;
          if (track.audioElement && !track.audioElement.paused && !track.isMuted) {
            const diff = Math.abs(track.audioElement.currentTime - masterTime);
            if (diff > 0.04) {
              track.audioElement.currentTime = masterTime;
            }
          }
        });
      }

      // Notifica React a ~16fps (60ms) — nao sobrecarrega setState
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
    const ctx = this.audioContext;
    if (!ctx) return this.pauseOffset;
    return Math.max(0, ctx.currentTime - this.absoluteStartTime);
  }

  getIsPlaying(): boolean { return this.isPlaying; }

  // ─── VOLUME / MUTE / SOLO / PAN ───────────────────────────────────────────────

  setTrackVolume(trackId: string, vol: number): void {
    const v = Math.max(0, Math.min(1, vol));
    for (const song of this.songs.values()) {
      const track = song.tracks.find(t => t.trackId === trackId);
      if (track) {
        track.volume = v;
        if (track.gainNode && !track.isMuted)
          track.gainNode.gain.setValueAtTime(v, this.audioContext?.currentTime ?? 0);
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
        // Para faixas element: pausa ou retoma conforme mute
        if (track.audioElement && this.isPlaying) {
          if (track.isMuted) track.audioElement.pause();
          else track.audioElement.play().catch(() => {});
        }
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
      if (track) { track.isMuted = muted; this.updateTrackGains(song); this.notifyListeners(); return; }
    }
  }

  private updateTrackGains(song: Song): void {
    const hasSolo = song.tracks.some(t => t.isSoloed);
    const now = this.audioContext?.currentTime ?? 0;
    song.tracks.forEach(track => {
      if (!track.gainNode) return;
      const vol = track.isMuted ? 0 : (hasSolo && !track.isSoloed ? 0 : track.volume);
      track.gainNode.gain.setValueAtTime(vol, now);
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
    if (!ctx) return;
    const now = ctx.currentTime;
    song.tracks.forEach(track => {
      if (this.isClickOrGuideTrack(track)) return;
      if (!track.gainNode) return;
      if (fadeOut) {
        if (!this.instrumentsFaded) this.savedInstrumentVolumes.set(track.trackId, track.volume);
        track.gainNode.gain.cancelScheduledValues(now);
        track.gainNode.gain.setValueAtTime(track.gainNode.gain.value, now);
        track.gainNode.gain.linearRampToValueAtTime(0.0001, now + duration);
        track.gainNode.gain.setValueAtTime(0, now + duration);
      } else {
        const sv = this.savedInstrumentVolumes.get(track.trackId) ?? track.volume;
        track.gainNode.gain.cancelScheduledValues(now);
        track.gainNode.gain.setValueAtTime(track.gainNode.gain.value, now);
        track.gainNode.gain.linearRampToValueAtTime(sv, now + 1.0);
      }
    });
    this.instrumentsFaded = fadeOut;
    this.notifyListeners();
  }

  areInstrumentsFaded(): boolean { return this.instrumentsFaded; }

  setMasterVolume(volume: number): void {
    const v = Math.max(0, Math.min(1, volume));
    if (this.masterGainNode) this.masterGainNode.gain.setValueAtTime(v, this.audioContext?.currentTime ?? 0);
  }

  // ─── DECODE DE AUDIO ──────────────────────────────────────────────────────────

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