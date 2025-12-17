import JSZip from 'jszip';
import { audioEngine, Song, Track } from './audioEngine';
import { detectBPMFromTracks } from './bpmDetector';

export interface ImportProgress {
  stage: 'extracting' | 'decoding' | 'analyzing' | 'complete';
  currentFile: string;
  progress: number; // 0 to 100
}

export interface ImportResult {
  success: boolean;
  song?: Song;
  error?: string;
}

// Extract song name from ZIP filename
function extractSongName(filename: string): string {
  // Remove .zip extension and clean up the name
  return filename.replace(/\.zip$/i, '').trim();
}

// Check if file is an audio file
function isAudioFile(filename: string): boolean {
  const audioExtensions = ['.wav', '.mp3', '.aiff', '.flac', '.ogg', '.m4a'];
  const lowerName = filename.toLowerCase();
  return audioExtensions.some(ext => lowerName.endsWith(ext));
}

// Get track name from audio filename
function extractTrackName(filepath: string): string {
  // Get just the filename (remove path)
  const filename = filepath.split('/').pop() || filepath;
  return filename;
}

// Generate unique IDs
function generateId(): string {
  return crypto.randomUUID();
}

// Process a ZIP file and create a Song with Tracks
export async function importZipFile(
  file: File,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  try {
    const songName = extractSongName(file.name);
    const songId = generateId();

    onProgress?.({
      stage: 'extracting',
      currentFile: file.name,
      progress: 0,
    });

    // Load and extract ZIP
    const zip = await JSZip.loadAsync(file);
    
    // Find all audio files in the ZIP
    const audioFiles: { path: string; zipEntry: JSZip.JSZipObject }[] = [];
    
    zip.forEach((relativePath, zipEntry) => {
      if (!zipEntry.dir && isAudioFile(relativePath)) {
        audioFiles.push({ path: relativePath, zipEntry });
      }
    });

    if (audioFiles.length === 0) {
      return {
        success: false,
        error: 'Nenhum arquivo de áudio encontrado no ZIP',
      };
    }

    onProgress?.({
      stage: 'extracting',
      currentFile: file.name,
      progress: 15,
    });

    // Process audio files in PARALLEL for better performance
    const tracks: Track[] = [];
    const audioBuffers: AudioBuffer[] = [];
    let maxDuration = 0;
    let processedCount = 0;

    // Extract all files first (parallel extraction)
    const extractedFiles = await Promise.all(
      audioFiles.map(async ({ path, zipEntry }) => ({
        trackName: extractTrackName(path),
        audioData: await zipEntry.async('arraybuffer'),
      }))
    );

    onProgress?.({
      stage: 'decoding',
      currentFile: 'Decodificando áudio...',
      progress: 30,
    });

    // Decode all audio files in parallel (batched to avoid memory issues)
    const DECODE_BATCH_SIZE = 4;
    for (let i = 0; i < extractedFiles.length; i += DECODE_BATCH_SIZE) {
      const batch = extractedFiles.slice(i, i + DECODE_BATCH_SIZE);
      
      const batchResults = await Promise.all(
        batch.map(async ({ trackName, audioData }) => {
          const audioFile = new File([audioData], trackName, { type: 'audio/wav' });
          const audioBuffer = await audioEngine.decodeAudioFile(audioFile);
          
          processedCount++;
          onProgress?.({
            stage: 'decoding',
            currentFile: trackName,
            progress: 30 + Math.floor((processedCount / extractedFiles.length) * 45),
          });

          return { trackName, audioBuffer };
        })
      );

      // Process results from this batch
      for (const { trackName, audioBuffer } of batchResults) {
        if (audioBuffer) {
          maxDuration = Math.max(maxDuration, audioBuffer.duration);
          audioBuffers.push(audioBuffer);
        }

        const track: Track = {
          trackId: generateId(),
          trackName,
          audioBuffer,
          volume: 1.0,
          pan: 0,
          isMuted: false,
          isSolo: false,
          gainNode: null,
          panNode: null,
          sourceNode: null,
        };

        tracks.push(track);
      }
    }

    // Detect BPM from audio buffers
    onProgress?.({
      stage: 'analyzing',
      currentFile: 'Detectando BPM...',
      progress: 80,
    });

    const bpmResult = detectBPMFromTracks(audioBuffers);
    const detectedBpm = bpmResult.bpm;

    console.log(`BPM detectado para "${songName}": ${detectedBpm} (confiança: ${Math.round(bpmResult.confidence * 100)}%)`);

    onProgress?.({
      stage: 'complete',
      currentFile: songName,
      progress: 100,
    });

    // Create the song object
    const song: Song = {
      id: songId,
      songName,
      tracks,
      duration: Math.ceil(maxDuration),
      bpm: detectedBpm,
    };

    // Add song to audio engine
    audioEngine.addSong(song);

    return {
      success: true,
      song,
    };
  } catch (error) {
    console.error('Error importing ZIP file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao importar arquivo ZIP',
    };
  }
}

// Process multiple ZIP files
export async function importMultipleZips(
  files: File[],
  onProgress?: (fileIndex: number, progress: ImportProgress) => void
): Promise<ImportResult[]> {
  const results: ImportResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const result = await importZipFile(file, (progress) => {
      onProgress?.(i, progress);
    });
    results.push(result);
  }

  return results;
}

// Get track icon based on track name
export function getTrackIcon(trackName: string): string {
  const lowerName = trackName.toLowerCase();
  
  if (lowerName.includes('click') || lowerName.includes('metron')) return '🔔';
  if (lowerName.includes('drum') || lowerName.includes('bateria')) return '🥁';
  if (lowerName.includes('bass') || lowerName.includes('baixo')) return '🎸';
  if (lowerName.includes('key') || lowerName.includes('piano') || lowerName.includes('teclado')) return '🎹';
  if (lowerName.includes('guitar') || lowerName.includes('guitarra') || lowerName.includes('violão')) return '🎵';
  if (lowerName.includes('vocal') || lowerName.includes('voz') || lowerName.includes('voice')) return '🎤';
  if (lowerName.includes('pad') || lowerName.includes('synth')) return '🎛️';
  if (lowerName.includes('string') || lowerName.includes('corda')) return '🎻';
  if (lowerName.includes('brass') || lowerName.includes('horn')) return '🎺';
  if (lowerName.includes('perc')) return '🪘';
  
  return '🎵';
}

// Get track color based on track name
export function getTrackColor(trackName: string): string {
  const lowerName = trackName.toLowerCase();
  
  if (lowerName.includes('click') || lowerName.includes('metron')) return 'hsl(38, 95%, 55%)';
  if (lowerName.includes('drum') || lowerName.includes('bateria')) return 'hsl(0, 72%, 55%)';
  if (lowerName.includes('bass') || lowerName.includes('baixo')) return 'hsl(280, 70%, 55%)';
  if (lowerName.includes('key') || lowerName.includes('piano') || lowerName.includes('teclado')) return 'hsl(200, 70%, 45%)';
  if (lowerName.includes('guitar') || lowerName.includes('guitarra') || lowerName.includes('violão')) return 'hsl(145, 70%, 45%)';
  if (lowerName.includes('vocal') || lowerName.includes('voz') || lowerName.includes('voice')) return 'hsl(320, 60%, 50%)';
  if (lowerName.includes('pad') || lowerName.includes('synth')) return 'hsl(180, 60%, 45%)';
  if (lowerName.includes('string') || lowerName.includes('corda')) return 'hsl(30, 70%, 50%)';
  if (lowerName.includes('brass') || lowerName.includes('horn')) return 'hsl(50, 80%, 50%)';
  if (lowerName.includes('perc')) return 'hsl(15, 70%, 50%)';
  
  // Random color based on hash
  const hash = trackName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return `hsl(${hash % 360}, 60%, 50%)`;
}
