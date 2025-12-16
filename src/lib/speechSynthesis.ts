// Web Speech API utility for announcing song sections

let speechSynthesis: SpeechSynthesis | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;

export function initSpeech(): boolean {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    speechSynthesis = window.speechSynthesis;
    return true;
  }
  return false;
}

export function speakSection(sectionName: string, options?: {
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
}): void {
  if (!speechSynthesis) {
    if (!initSpeech()) {
      console.warn('Speech synthesis not supported');
      return;
    }
  }

  // Cancel any ongoing speech
  if (currentUtterance) {
    speechSynthesis!.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(sectionName);
  
  // Configure speech
  utterance.rate = options?.rate ?? 1.2; // Slightly faster for live performance
  utterance.pitch = options?.pitch ?? 1.0;
  utterance.volume = options?.volume ?? 0.8;
  utterance.lang = options?.lang ?? 'pt-BR';

  // Try to find a Portuguese voice
  const voices = speechSynthesis!.getVoices();
  const portugueseVoice = voices.find(v => v.lang.startsWith('pt')) || voices[0];
  if (portugueseVoice) {
    utterance.voice = portugueseVoice;
  }

  currentUtterance = utterance;
  speechSynthesis!.speak(utterance);
}

export function cancelSpeech(): void {
  if (speechSynthesis) {
    speechSynthesis.cancel();
    currentUtterance = null;
  }
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}
