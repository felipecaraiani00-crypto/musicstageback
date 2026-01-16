// Metronome - Generates click sounds using Web Audio API

class Metronome {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private isRunning: boolean = false;
  private intervalId: number | null = null;
  private bpm: number = 120;
  private volume: number = 0.75;
  private beatsPerBar: number = 4;
  private currentBeat: number = 1;
  private onBeatCallback: ((beat: number) => void) | null = null;

  constructor() {
    this.initAudioContext();
  }

  private initAudioContext() {
    if (typeof window !== 'undefined' && !this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      this.gainNode.gain.value = this.volume;
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

  // Play a click sound
  private playClick(isAccent: boolean = false) {
    const context = this.ensureContext();
    if (!this.gainNode) return;

    const now = context.currentTime;
    
    // Create oscillator for click sound
    const osc = context.createOscillator();
    const clickGain = context.createGain();
    
    // Accent beat (first beat) is higher pitch and louder
    osc.frequency.value = isAccent ? 1000 : 800;
    clickGain.gain.value = isAccent ? 1.0 : 0.7;
    
    osc.connect(clickGain);
    clickGain.connect(this.gainNode);
    
    // Short click envelope
    clickGain.gain.setValueAtTime(clickGain.gain.value * this.volume, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    
    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Start the metronome
  start(bpm: number, onBeat?: (beat: number) => void) {
    if (this.isRunning) {
      this.stop();
    }

    this.bpm = bpm;
    this.onBeatCallback = onBeat || null;
    this.currentBeat = 1;
    this.isRunning = true;

    const beatInterval = 60000 / this.bpm; // ms per beat

    // Play first beat immediately
    this.playClick(true);
    this.onBeatCallback?.(1);

    this.intervalId = window.setInterval(() => {
      this.currentBeat = (this.currentBeat % this.beatsPerBar) + 1;
      const isAccent = this.currentBeat === 1;
      this.playClick(isAccent);
      this.onBeatCallback?.(this.currentBeat);
    }, beatInterval);
  }

  // Stop the metronome
  stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.currentBeat = 1;
  }

  // Update BPM while running
  setBpm(newBpm: number) {
    if (this.bpm === newBpm) return;
    
    this.bpm = newBpm;
    
    if (this.isRunning) {
      // Restart with new BPM
      const callback = this.onBeatCallback;
      this.stop();
      this.start(newBpm, callback || undefined);
    }
  }

  // Set volume (0-1)
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(this.volume, this.audioContext?.currentTime || 0);
    }
  }

  // Set beats per bar
  setBeatsPerBar(beats: number) {
    this.beatsPerBar = beats;
  }

  // Check if running
  getIsRunning(): boolean {
    return this.isRunning;
  }

  // Get current beat
  getCurrentBeat(): number {
    return this.currentBeat;
  }
}

// Singleton instance
export const metronome = new Metronome();
