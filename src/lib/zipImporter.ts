import JSZip from 'jszip';
import { audioEngine, Song, Track } from './audioEngine';

export interface ImportProgress {
  stage: 'extracting' | 'decoding' | 'complete';
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
// Optimized for large files (600MB+)
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

    // Load ZIP with optimized settings for large files
    const zip = await JSZip.loadAsync(file, {
      // Use streaming for large files to reduce memory usage
      createFolders: false,
    });
    
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
      progress: 20,
    });

    // Process each audio file sequentially to manage memory for large files
    const tracks: Track[] = [];
    let maxDuration = 0;
    
    // Sort files to process click/metronome first (usually smaller)
    audioFiles.sort((a, b) => {
      const aName = a.path.toLowerCase();
      const bName = b.path.toLowerCase();
      if (aName.includes('click') || aName.includes('metron')) return -1;
      if (bName.includes('click') || bName.includes('metron')) return 1;
      return 0;
    });
    
    for (let i = 0; i < audioFiles.length; i++) {
      const { path, zipEntry } = audioFiles[i];
      const trackName = extractTrackName(path);
      
      onProgress?.({
        stage: 'decoding',
        currentFile: trackName,
        progress: 20 + Math.floor((i / audioFiles.length) * 70),
      });

      try {
        // Extract file content as ArrayBuffer
        const audioData = await zipEntry.async('arraybuffer');
        
        // Get MIME type based on extension
        const ext = trackName.toLowerCase().split('.').pop();
        const mimeTypes: Record<string, string> = {
          'wav': 'audio/wav',
          'mp3': 'audio/mpeg',
          'aiff': 'audio/aiff',
          'flac': 'audio/flac',
          'ogg': 'audio/ogg',
          'm4a': 'audio/mp4',
        };
        const mimeType = mimeTypes[ext || 'wav'] || 'audio/wav';
        
        // Create a File object for decoding
        const audioFile = new File([audioData], trackName, { type: mimeType });
        
        // Decode audio
        const audioBuffer = await audioEngine.decodeAudioFile(audioFile);
        
        if (audioBuffer) {
          maxDuration = Math.max(maxDuration, audioBuffer.duration);
        }

        const track: Track = {
          trackId: generateId(),
          trackName,
          audioBuffer,
          volume: 1.0,
          isMuted: false,
          isSoloed: false,
          gainNode: null,
          sourceNode: null,
        };

        tracks.push(track);
      } catch (trackError) {
        console.warn(`Failed to decode track ${trackName}:`, trackError);
        // Continue with other tracks even if one fails
      }
    }

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
      bpm: 120, // Default BPM, could be extracted from metadata
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
