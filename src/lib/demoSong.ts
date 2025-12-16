import { audioEngine, Song } from './audioEngine';

// Generate a simple sine wave tone
function generateTone(
  context: AudioContext,
  frequency: number,
  duration: number,
  volume: number = 0.5
): AudioBuffer {
  const sampleRate = context.sampleRate;
  const samples = Math.floor(sampleRate * duration);
  const buffer = context.createBuffer(2, samples, sampleRate);
  
  for (let channel = 0; channel < 2; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      // Add envelope to avoid clicks
      const envelope = Math.min(1, Math.min(t * 50, (duration - t) * 50));
      channelData[i] = Math.sin(2 * Math.PI * frequency * t) * volume * envelope;
    }
  }
  
  return buffer;
}

// Generate a click/metronome track
function generateClickTrack(context: AudioContext, bpm: number, duration: number): AudioBuffer {
  const sampleRate = context.sampleRate;
  const samples = Math.floor(sampleRate * duration);
  const buffer = context.createBuffer(2, samples, sampleRate);
  const beatInterval = 60 / bpm;
  const clickDuration = 0.02; // 20ms click
  
  for (let channel = 0; channel < 2; channel++) {
    const channelData = buffer.getChannelData(channel);
    
    for (let beat = 0; beat < Math.floor(duration / beatInterval); beat++) {
      const startSample = Math.floor(beat * beatInterval * sampleRate);
      const clickSamples = Math.floor(clickDuration * sampleRate);
      const isDownbeat = beat % 4 === 0;
      const frequency = isDownbeat ? 1500 : 1000;
      const volume = isDownbeat ? 0.8 : 0.5;
      
      for (let i = 0; i < clickSamples && startSample + i < samples; i++) {
        const t = i / sampleRate;
        const envelope = Math.min(1, Math.min(t * 100, (clickDuration - t) * 100));
        channelData[startSample + i] = Math.sin(2 * Math.PI * frequency * t) * volume * envelope;
      }
    }
  }
  
  return buffer;
}

// Generate a bass track
function generateBassTrack(context: AudioContext, bpm: number, duration: number): AudioBuffer {
  const sampleRate = context.sampleRate;
  const samples = Math.floor(sampleRate * duration);
  const buffer = context.createBuffer(2, samples, sampleRate);
  const beatInterval = 60 / bpm;
  const notePattern = [65.41, 82.41, 98.00, 82.41]; // C2, E2, G2, E2
  
  for (let channel = 0; channel < 2; channel++) {
    const channelData = buffer.getChannelData(channel);
    
    for (let beat = 0; beat < Math.floor(duration / beatInterval); beat++) {
      const startSample = Math.floor(beat * beatInterval * sampleRate);
      const noteDuration = beatInterval * 0.8;
      const noteSamples = Math.floor(noteDuration * sampleRate);
      const frequency = notePattern[beat % notePattern.length];
      
      for (let i = 0; i < noteSamples && startSample + i < samples; i++) {
        const t = i / sampleRate;
        const envelope = Math.exp(-t * 3) * Math.min(1, t * 50);
        channelData[startSample + i] += Math.sin(2 * Math.PI * frequency * t) * 0.4 * envelope;
      }
    }
  }
  
  return buffer;
}

// Generate a pad/synth track
function generatePadTrack(context: AudioContext, bpm: number, duration: number): AudioBuffer {
  const sampleRate = context.sampleRate;
  const samples = Math.floor(sampleRate * duration);
  const buffer = context.createBuffer(2, samples, sampleRate);
  const chordFrequencies = [261.63, 329.63, 392.00]; // C4, E4, G4 chord
  
  for (let channel = 0; channel < 2; channel++) {
    const channelData = buffer.getChannelData(channel);
    
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      let sample = 0;
      
      for (const freq of chordFrequencies) {
        // Slight detuning for warmth
        const detune = channel === 0 ? 0.99 : 1.01;
        sample += Math.sin(2 * Math.PI * freq * detune * t) * 0.15;
      }
      
      // Slow tremolo
      const tremolo = 0.8 + 0.2 * Math.sin(2 * Math.PI * 0.5 * t);
      channelData[i] = sample * tremolo;
    }
  }
  
  return buffer;
}

// Create and add demo song to audio engine
export async function createDemoSong(): Promise<Song | null> {
  try {
    const context = new (window.AudioContext || (window as any).webkitAudioContext)();
    const bpm = 120;
    const duration = 30; // 30 seconds demo
    
    const clickBuffer = generateClickTrack(context, bpm, duration);
    const bassBuffer = generateBassTrack(context, bpm, duration);
    const padBuffer = generatePadTrack(context, bpm, duration);
    
    const demoSong: Song = {
      id: 'demo-song',
      songName: 'Demo - Stageback',
      duration,
      bpm,
      tracks: [
        {
          trackId: 'demo-click',
          trackName: 'Click',
          audioBuffer: clickBuffer,
          volume: 0.7,
          pan: 0,
          isMuted: false,
          isSolo: false,
          gainNode: null,
          panNode: null,
          sourceNode: null,
        },
        {
          trackId: 'demo-bass',
          trackName: 'Bass',
          audioBuffer: bassBuffer,
          volume: 0.8,
          pan: 0,
          isMuted: false,
          isSolo: false,
          gainNode: null,
          panNode: null,
          sourceNode: null,
        },
        {
          trackId: 'demo-pad',
          trackName: 'Synth Pad',
          audioBuffer: padBuffer,
          volume: 0.6,
          pan: 0,
          isMuted: false,
          isSolo: false,
          gainNode: null,
          panNode: null,
          sourceNode: null,
        },
      ],
    };
    
    audioEngine.addSong(demoSong);
    audioEngine.setCurrentSong(demoSong.id);
    
    context.close();
    
    return demoSong;
  } catch (error) {
    console.error('Failed to create demo song:', error);
    return null;
  }
}
