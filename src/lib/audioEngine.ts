// Audio Engine - Manages songs and tracks with hierarchical structure

export interface Track {
  trackId: string;
  trackName: string;
  audioBuffer: AudioBuffer | null;
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
  currentTime: number;
  duration: number;
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
  private startTime: number = 0; // AudioContext time when playback started
  private pauseTime: number = 0; // Position in song when paused
  private playbackListeners: Set<PlaybackListener> = new Set();
  private animationFrameId: number | null = null;
  
  // Instrument fade state
  private instrumentsFaded: boolean = false;
  private savedInstrumentVolumes: Map<string, number> = new Map();

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

  private ensureContext() {
    if (!this.audioContext) {
      this.initAudioContext();
    }
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
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
    });

    this.songs.set(song.id, song);
    
    // Auto-select if first song
    if (!this.currentSongId) {
      this.currentSongId = song.id;
    }
    
    this.notifyListeners();
  }

  // Remove a song
  removeSong(songId: string): void {
    const song = this.songs.get(songId);
    if (song) {
      // Stop if this song is playing
      if (this.currentSongId === songId && this.isPlaying) {
        this.stop();
      }
      
      // Cleanup gain nodes
      song.tracks.forEach(track => {
        if (track.gainNode) {
          track.gainNode.disconnect();
        }
        this.trackGainNodes.delete(track.trackId);
      });
      this.songs.delete(songId);
      
      if (this.currentSongId === songId) {
        this.currentSongId = this.songs.size > 0 ? this.songs.keys().next().value : null;
      }
      
      this.notifyListeners();
    }
  }

  // PLAYBACK CONTROLS
  play(): void {
    const song = this.getCurrentSong();
    if (!song || song.tracks.length === 0) return;
    
    const context = this.ensureContext();
    
    // Stop any existing playback
    this.stopAllSources();
    
    // Start all tracks at the current pause position
    song.tracks.forEach(track => {
      if (!track.audioBuffer || !track.gainNode) return;
      
      const sourceNode = context.createBufferSource();
      sourceNode.buffer = track.audioBuffer;
      sourceNode.connect(track.gainNode);
      
      // Calculate offset and start playback
      const offset = this.pauseTime;
      sourceNode.start(0, offset);
      
      // Handle track end
      sourceNode.onended = () => {
        if (track.sourceNode === sourceNode) {
          track.sourceNode = null;
        }
      };
      
      track.sourceNode = sourceNode;
    });
    
    this.startTime = context.currentTime - this.pauseTime;
    this.isPlaying = true;
    
    // Start time update loop
    this.startTimeUpdateLoop();
    
    this.notifyPlayback();
    this.notifyListeners();
  }

  pause(): void {
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
    this.stopAllSources();
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
      
      // Restart all tracks at new position
      song.tracks.forEach(track => {
        if (!track.audioBuffer || !track.gainNode) return;
        
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
      });
      
      this.startTime = context.currentTime - clampedTime;
    }
    
    this.notifyPlayback();
  }

  private stopAllSources(): void {
    const song = this.getCurrentSong();
    if (!song) return;
    
    song.tracks.forEach(track => {
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

  // Fade instruments out (leave only click), or fade them back in
  fadeInstruments(fadeOut: boolean, duration: number = 1.5): void {
    const song = this.getCurrentSong();
    if (!song) return;
    
    const context = this.audioContext;
    if (!context) return;
    
    const currentTime = context.currentTime;
    
    song.tracks.forEach(track => {
      // Skip click tracks - they stay audible
      if (track.isClickTrack) return;
      
      if (!track.gainNode) return;
      
      if (fadeOut) {
        // Save current volume before fading out
        this.savedInstrumentVolumes.set(track.trackId, track.volume);
        
        // Cancel any ongoing ramps and fade to near zero
        track.gainNode.gain.cancelScheduledValues(currentTime);
        track.gainNode.gain.setValueAtTime(track.gainNode.gain.value, currentTime);
        track.gainNode.gain.linearRampToValueAtTime(0.001, currentTime + duration);
      } else {
        // Fade back in to saved volume
        const savedVolume = this.savedInstrumentVolumes.get(track.trackId) ?? track.volume;
        
        track.gainNode.gain.cancelScheduledValues(currentTime);
        track.gainNode.gain.setValueAtTime(track.gainNode.gain.value, currentTime);
        track.gainNode.gain.linearRampToValueAtTime(savedVolume, currentTime + duration);
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

  // Decode audio file to AudioBuffer
  async decodeAudioFile(file: File): Promise<AudioBuffer | null> {
    try {
      const context = this.ensureContext();
      const arrayBuffer = await file.arrayBuffer();
      return await context.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error('Error decoding audio file:', error);
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
      currentTime: this.getCurrentTime(),
      duration: song?.duration || 0,
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
      currentTime: this.getCurrentTime(),
      duration: song?.duration || 0,
    };
  }
}

// Singleton instance
export const audioEngine = new AudioEngine();
