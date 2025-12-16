// Audio Engine - Manages songs and tracks with hierarchical structure

export interface Track {
  trackId: string;
  trackName: string;
  audioBuffer: AudioBuffer | null;
  volume: number; // 0.0 to 1.0
  isMuted: boolean;
  gainNode: GainNode | null;
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
}

class AudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private songs: Map<string, Song> = new Map();
  private trackGainNodes: Map<string, GainNode> = new Map();
  private currentSongId: string | null = null;
  private listeners: Set<(state: AudioEngineState) => void> = new Set();

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
      this.currentSongId = songId;
      this.notifyListeners();
    }
  }

  // Add a new song with tracks
  addSong(song: Song): void {
    const context = this.ensureContext();
    
    // Create gain nodes for each track
    song.tracks.forEach(track => {
      const gainNode = context.createGain();
      gainNode.gain.value = track.volume;
      gainNode.connect(this.masterGainNode!);
      track.gainNode = gainNode;
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
        
        if (track.gainNode) {
          const targetVolume = track.isMuted ? 0 : track.volume;
          track.gainNode.gain.setValueAtTime(targetVolume, this.audioContext?.currentTime || 0);
        }
        
        this.notifyListeners();
        return track.isMuted;
      }
    }
    return false;
  }

  // Set mute state explicitly
  setTrackMute(trackId: string, muted: boolean): void {
    for (const song of this.songs.values()) {
      const track = song.tracks.find(t => t.trackId === trackId);
      if (track) {
        track.isMuted = muted;
        
        if (track.gainNode) {
          const targetVolume = muted ? 0 : track.volume;
          track.gainNode.gain.setValueAtTime(targetVolume, this.audioContext?.currentTime || 0);
        }
        
        this.notifyListeners();
        return;
      }
    }
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

  private notifyListeners() {
    const state: AudioEngineState = {
      songs: this.getSongs(),
      currentSongId: this.currentSongId,
      isPlaying: false,
      currentTime: 0,
    };
    this.listeners.forEach(listener => listener(state));
  }

  // Get state
  getState(): AudioEngineState {
    return {
      songs: this.getSongs(),
      currentSongId: this.currentSongId,
      isPlaying: false,
      currentTime: 0,
    };
  }
}

// Singleton instance
export const audioEngine = new AudioEngine();
