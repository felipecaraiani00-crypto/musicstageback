// Audio Engine - Manages songs and tracks with hierarchical structure and playback

export interface Track {
  trackId: string;
  trackName: string;
  audioBuffer: AudioBuffer | null;
  volume: number; // 0.0 to 1.0
  isMuted: boolean;
  isSolo: boolean;
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
  
  // Playback state
  private isPlaying: boolean = false;
  private startTime: number = 0; // AudioContext time when playback started
  private pausedAt: number = 0; // Position in the song when paused
  private animationFrameId: number | null = null;

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

  private ensureContext(): AudioContext {
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
      // Stop current playback if switching songs
      if (this.isPlaying) {
        this.stop();
      }
      this.currentSongId = songId;
      this.pausedAt = 0;
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

  // ========== PLAYBACK CONTROLS ==========

  // Play the current song
  play(): void {
    const song = this.getCurrentSong();
    if (!song || song.tracks.length === 0) return;

    const context = this.ensureContext();
    
    // Resume audio context if suspended (required by browsers)
    if (context.state === 'suspended') {
      context.resume();
    }

    // Stop any existing playback
    this.stopAllSources();

    // Record the start time
    this.startTime = context.currentTime - this.pausedAt;
    this.isPlaying = true;

    // Start all tracks simultaneously
    song.tracks.forEach(track => {
      if (track.audioBuffer && track.gainNode) {
        // Create a new source node for each track
        const sourceNode = context.createBufferSource();
        sourceNode.buffer = track.audioBuffer;
        sourceNode.connect(track.gainNode);
        
        // Set gain based on mute state
        track.gainNode.gain.setValueAtTime(
          track.isMuted ? 0 : track.volume,
          context.currentTime
        );
        
        // Start from the paused position
        sourceNode.start(0, this.pausedAt);
        
        // Handle track end
        sourceNode.onended = () => {
          if (this.isPlaying && track.sourceNode === sourceNode) {
            // Check if this was the longest track that ended
            const currentTime = this.getCurrentTime();
            if (currentTime >= song.duration - 0.1) {
              this.stop();
            }
          }
        };
        
        track.sourceNode = sourceNode;
      }
    });

    // Start time update loop
    this.startTimeUpdateLoop();
    this.notifyListeners();
  }

  // Pause playback
  pause(): void {
    if (!this.isPlaying) return;
    
    const context = this.audioContext;
    if (!context) return;

    // Save current position
    this.pausedAt = context.currentTime - this.startTime;
    
    // Stop all sources
    this.stopAllSources();
    
    this.isPlaying = false;
    this.stopTimeUpdateLoop();
    this.notifyListeners();
  }

  // Stop playback and reset to beginning
  stop(): void {
    this.stopAllSources();
    this.pausedAt = 0;
    this.isPlaying = false;
    this.stopTimeUpdateLoop();
    this.notifyListeners();
  }

  // Seek to a specific position (in seconds)
  seek(time: number): void {
    const song = this.getCurrentSong();
    if (!song) return;

    // Clamp time to valid range
    const newTime = Math.max(0, Math.min(time, song.duration));
    
    if (this.isPlaying) {
      // If playing, restart from new position
      this.pausedAt = newTime;
      this.play();
    } else {
      // If paused, just update position
      this.pausedAt = newTime;
      this.notifyListeners();
    }
  }

  // Get current playback time
  getCurrentTime(): number {
    if (!this.audioContext) return this.pausedAt;
    
    if (this.isPlaying) {
      return this.audioContext.currentTime - this.startTime;
    }
    return this.pausedAt;
  }

  // Check if playing
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  // Toggle play/pause
  togglePlayPause(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  // Skip forward/backward (in seconds)
  skip(seconds: number): void {
    const newTime = this.getCurrentTime() + seconds;
    this.seek(newTime);
  }

  private stopAllSources(): void {
    const song = this.getCurrentSong();
    if (song) {
      song.tracks.forEach(track => {
        if (track.sourceNode) {
          try {
            track.sourceNode.stop();
            track.sourceNode.disconnect();
          } catch (e) {
            // Source may already be stopped
          }
          track.sourceNode = null;
        }
      });
    }
  }

  private startTimeUpdateLoop(): void {
    const update = () => {
      if (this.isPlaying) {
        this.notifyListeners();
        this.animationFrameId = requestAnimationFrame(update);
      }
    };
    this.animationFrameId = requestAnimationFrame(update);
  }

  private stopTimeUpdateLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // ========== VOLUME CONTROLS ==========

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

  // Toggle track solo
  toggleTrackSolo(trackId: string): boolean {
    const song = this.getCurrentSong();
    if (!song) return false;

    const track = song.tracks.find(t => t.trackId === trackId);
    if (!track) return false;

    track.isSolo = !track.isSolo;

    // Update all track gains based on solo state
    const hasSoloActive = song.tracks.some(t => t.isSolo);

    song.tracks.forEach(t => {
      if (t.gainNode) {
        const isEffectivelyMuted = t.isMuted || (hasSoloActive && !t.isSolo);
        const targetVolume = isEffectivelyMuted ? 0 : t.volume;
        t.gainNode.gain.setValueAtTime(targetVolume, this.audioContext?.currentTime || 0);
      }
    });

    this.notifyListeners();
    return track.isSolo;
  }

  // Set master volume
  setMasterVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGainNode) {
      this.masterGainNode.gain.setValueAtTime(clampedVolume, this.audioContext?.currentTime || 0);
    }
  }

  // ========== AUDIO DECODING ==========

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

  // ========== WAVEFORM GENERATION ==========

  // Generate waveform data from song's AudioBuffers
  getWaveformData(songId: string, numPoints: number = 300): number[] {
    const song = this.songs.get(songId);
    if (!song || song.tracks.length === 0) {
      return [];
    }

    // Find the longest track to determine total samples
    let maxLength = 0;
    let sampleRate = 44100;
    
    song.tracks.forEach(track => {
      if (track.audioBuffer) {
        maxLength = Math.max(maxLength, track.audioBuffer.length);
        sampleRate = track.audioBuffer.sampleRate;
      }
    });

    if (maxLength === 0) return [];

    // Combine all tracks into a single waveform (sum and normalize)
    const combinedData = new Float32Array(maxLength);
    let trackCount = 0;

    song.tracks.forEach(track => {
      if (track.audioBuffer) {
        const channelData = track.audioBuffer.getChannelData(0); // Use first channel
        for (let i = 0; i < channelData.length; i++) {
          combinedData[i] += channelData[i];
        }
        trackCount++;
      }
    });

    // Normalize by track count
    if (trackCount > 0) {
      for (let i = 0; i < combinedData.length; i++) {
        combinedData[i] /= trackCount;
      }
    }

    // Downsample to requested number of points
    const samplesPerPoint = Math.floor(maxLength / numPoints);
    const waveformPoints: number[] = [];

    for (let i = 0; i < numPoints; i++) {
      const start = i * samplesPerPoint;
      const end = Math.min(start + samplesPerPoint, maxLength);
      
      // Calculate RMS for this segment
      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += combinedData[j] * combinedData[j];
      }
      const rms = Math.sqrt(sum / (end - start));
      
      // Normalize to 0-1 range (RMS values are typically 0-0.5 for audio)
      const normalized = Math.min(1, rms * 3);
      waveformPoints.push(normalized);
    }

    return waveformPoints;
  }

  // ========== STATE MANAGEMENT ==========

  // Subscribe to state changes
  subscribe(listener: (state: AudioEngineState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const state: AudioEngineState = {
      songs: this.getSongs(),
      currentSongId: this.currentSongId,
      isPlaying: this.isPlaying,
      currentTime: this.getCurrentTime(),
    };
    this.listeners.forEach(listener => listener(state));
  }

  // Get state
  getState(): AudioEngineState {
    return {
      songs: this.getSongs(),
      currentSongId: this.currentSongId,
      isPlaying: this.isPlaying,
      currentTime: this.getCurrentTime(),
    };
  }
}

// Singleton instance
export const audioEngine = new AudioEngine();
