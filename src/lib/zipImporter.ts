import JSZip from 'jszip';
import { audioEngine, Song, Track, isMobileDevice } from './audioEngine';

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
export function isAudioFile(filename: string): boolean {
  const audioExtensions = ['.wav', '.mp3', '.aiff', '.flac', '.ogg', '.m4a'];
  const lowerName = filename.toLowerCase();
  return audioExtensions.some(ext => lowerName.endsWith(ext));
}

// Check if track is a click/guide track based on name
function isClickTrack(filename: string): boolean {
  const lowerName = filename.toLowerCase();
  const clickKeywords = ['click', 'guide', 'metronome', 'metro', 'count', 'cue', 'guia'];
  return clickKeywords.some(keyword => lowerName.includes(keyword));
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
        const ext = trackName.toLowerCase().split('.').pop() || 'wav';
        const mimeTypes: Record<string, string> = {
          wav: 'audio/wav',
          mp3: 'audio/mpeg',
          aiff: 'audio/aiff',
          flac: 'audio/flac',
          ogg: 'audio/ogg',
          m4a: 'audio/mp4',
        };
        const mimeType = mimeTypes[ext] || 'audio/wav';

        // Em dispositivos móveis (Safari/iOS ou Chrome Android), usamos streaming nativo
        // para não estourar a memória RAM (OOM Crash) com decodificação inteira de 32-bit float
        if (isMobileDevice()) {
          const blob = await zipEntry.async('blob');
          const typedBlob = new Blob([blob], { type: mimeType });
          const blobUrl = URL.createObjectURL(typedBlob);
          audioEngine.registerObjectUrl(blobUrl);

          const audioElement = new Audio();
          audioElement.preload = 'metadata';
          audioElement.src = blobUrl;

          // Lê a duração dos metadados de forma quase instantânea
          const duration = await new Promise<number>((resolve) => {
            if (audioElement.readyState >= 1 && !isNaN(audioElement.duration)) {
              resolve(audioElement.duration);
            } else {
              audioElement.addEventListener('loadedmetadata', () => resolve(audioElement.duration || 0), { once: true });
              audioElement.addEventListener('error', () => resolve(0), { once: true });
              setTimeout(() => resolve(audioElement.duration || 0), 2000);
            }
          });

          if (duration > 0) {
            maxDuration = Math.max(maxDuration, duration);
          }

          const isClick = isClickTrack(trackName);

          const track: Track = {
            trackId: generateId(),
            trackName,
            audioBuffer: null, // Sem alocar PCM bruto de 32-bit na RAM
            audioUrl: blobUrl,
            audioElement,
            mediaElementSource: null,
            volume: 1.0,
            pan: 0,
            isMuted: false,
            isSoloed: false,
            isClickTrack: isClick,
            gainNode: null,
            panNode: null,
            sourceNode: null,
          };

          tracks.push(track);
        } else {
          // No Desktop, extrai e decodifica normalmente com fallback para streaming se necessário
          const audioData = await zipEntry.async('arraybuffer');
          const audioBuffer = await audioEngine.decodeAudioData(audioData, trackName);

          if (audioBuffer) {
            maxDuration = Math.max(maxDuration, audioBuffer.duration);
          } else {
            console.error(`[ZIP Importer] Canal "${trackName}" falhou na decodificação e foi ignorado.`);
          }

          const isClick = isClickTrack(trackName);

          const track: Track = {
            trackId: generateId(),
            trackName,
            audioBuffer,
            volume: 1.0,
            pan: 0,
            isMuted: false,
            isSoloed: false,
            isClickTrack: isClick,
            gainNode: null,
            panNode: null,
            sourceNode: null,
          };

          tracks.push(track);
        }
      } catch (trackError) {
        console.error(`[ZIP Importer] Falha ao processar o canal "${trackName}":`, trackError);
        // Continua com as outras faixas para que um canal com problema não quebre a música!
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

/**
 * Importa múltiplos arquivos de áudio selecionados diretamente pelo usuário (<input type="file" multiple />)
 * com try/catch e decodificação individual por canal para que uma falha em uma pista não quebre as outras.
 */
export async function importAudioFiles(
  files: File[],
  customSongName?: string,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  try {
    const audioFiles = files.filter(f => isAudioFile(f.name));
    if (audioFiles.length === 0) {
      return {
        success: false,
        error: 'Nenhum arquivo de áudio válido encontrado.',
      };
    }

    // Define o nome da música com base no nome customizado ou no primeiro arquivo
    const songName = customSongName || extractSongName(audioFiles[0].name) || 'Música Importada';
    const songId = generateId();

    onProgress?.({
      stage: 'extracting',
      currentFile: songName,
      progress: 5,
    });

    // Ordena click/guia para o topo
    audioFiles.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      if (aName.includes('click') || aName.includes('metron') || aName.includes('guia')) return -1;
      if (bName.includes('click') || bName.includes('metron') || bName.includes('guia')) return 1;
      return 0;
    });

    const tracks: Track[] = [];
    let maxDuration = 0;

    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      const trackName = file.name;

      onProgress?.({
        stage: 'decoding',
        currentFile: trackName,
        progress: 10 + Math.floor((i / audioFiles.length) * 85),
      });

      try {
        const blobUrl = URL.createObjectURL(file);
        audioEngine.registerObjectUrl(blobUrl);

        if (isMobileDevice()) {
          const audioElement = new Audio();
          audioElement.preload = 'metadata';
          audioElement.src = blobUrl;

          // Lê metadados de duração rapidamente
          const duration = await new Promise<number>((resolve) => {
            if (audioElement.readyState >= 1 && !isNaN(audioElement.duration)) {
              resolve(audioElement.duration);
            } else {
              audioElement.addEventListener('loadedmetadata', () => resolve(audioElement.duration || 0), { once: true });
              audioElement.addEventListener('error', () => resolve(0), { once: true });
              setTimeout(() => resolve(audioElement.duration || 0), 2000);
            }
          });

          if (duration > 0) {
            maxDuration = Math.max(maxDuration, duration);
          }

          const isClick = isClickTrack(trackName);

          const track: Track = {
            trackId: generateId(),
            trackName,
            audioBuffer: null, // Sem decodificar para RAM no mobile
            audioUrl: blobUrl,
            audioElement,
            mediaElementSource: null,
            volume: 1.0,
            pan: 0,
            isMuted: false,
            isSoloed: false,
            isClickTrack: isClick,
            gainNode: null,
            panNode: null,
            sourceNode: null,
          };

          tracks.push(track);
        } else {
          // No Desktop, lê e decodifica normalmente
          const arrayBuffer = await file.arrayBuffer();
          const audioBuffer = await audioEngine.decodeAudioData(arrayBuffer, trackName);

          if (audioBuffer) {
            maxDuration = Math.max(maxDuration, audioBuffer.duration);
          } else {
            console.error(`[Audio Importer] Falha na decodificação do canal "${trackName}": buffer vazio ou corrompido.`);
          }

          const isClick = isClickTrack(trackName);

          const track: Track = {
            trackId: generateId(),
            trackName,
            audioBuffer,
            audioUrl: blobUrl,
            audioElement: null,
            mediaElementSource: null,
            volume: 1.0,
            pan: 0,
            isMuted: false,
            isSoloed: false,
            isClickTrack: isClick,
            gainNode: null,
            panNode: null,
            sourceNode: null,
          };

          tracks.push(track);
        }
      } catch (trackError) {
        console.error(`[Audio Importer] Erro crítico ao decodificar canal "${trackName}":`, trackError);
        // Continua com as outras faixas para que um erro em um canal não quebre o player!
      }
    }

    onProgress?.({
      stage: 'complete',
      currentFile: songName,
      progress: 100,
    });

    const song: Song = {
      id: songId,
      songName,
      tracks,
      duration: Math.ceil(maxDuration),
      bpm: 120,
    };

    audioEngine.addSong(song);

    return {
      success: true,
      song,
    };
  } catch (error) {
    console.error('[Audio Importer] Erro geral ao importar faixas locais:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao importar arquivos de áudio.',
    };
  }
}

