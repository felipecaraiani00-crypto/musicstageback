import { supabase, getAudioPublicUrl } from "@/lib/supabase";
import { Song } from "@/components/SongList";
import { Section, getSectionColor } from "@/types/section";
import { FaderTrack } from "@/components/HorizontalFaders";
import { getTrackIcon, getTrackColor } from "@/lib/zipImporter";
import { audioEngine, Track, Song as AudioSong, loadInBatches, isMobileDevice } from "@/lib/audioEngine";

export interface SupabaseSong {
  id: string;
  name?: string;
  title?: string;
  artist?: string;
  bpm?: number;
  duration?: number;
  audio_url?: string;
  key?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseSection {
  id: string;
  song_id: string;
  start_time: number;
  end_time: number;
  type: string;
  order_index?: number;
  created_at?: string;
}

export interface SupabaseTrack {
  id: string;
  name: string;
  song_id: string;
  file_url?: string;
  volume?: number;
  pan?: number;
  is_click?: boolean;
  is_muted?: boolean;
  is_soloed?: boolean;
  order_index?: number;
  created_at?: string;
}

export interface SongWithDetails {
  song: SupabaseSong;
  sections: SupabaseSection[];
  tracks: SupabaseTrack[];
}

/**
 * Busca todas as faixas cadastradas na tabela songs do Supabase
 */
export async function fetchSongs(): Promise<Song[]> {
  try {
    const { data, error } = await supabase
      .from("songs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Aviso ao buscar músicas no Supabase:", error.message);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Mapeia os registros para a interface Song da aplicação
    return data.map((s: SupabaseSong) => ({
      id: s.id,
      title: s.name || s.title || "Sem título",
      artist: s.artist || undefined,
      duration: Number(s.duration) || 0,
      bpm: s.bpm ? Number(s.bpm) : undefined,
      key: s.key || undefined,
    }));
  } catch (err) {
    console.warn("Exceção ao buscar músicas do Supabase:", err);
    return [];
  }
}

/**
 * Busca a música junto com suas seções e faixas (tracks)
 */
export async function fetchSongDetails(songId: string): Promise<SongWithDetails | null> {
  if (!songId) return null;

  try {
    // 1. Busca a música
    const { data: song, error: songErr } = await supabase
      .from("songs")
      .select("*")
      .eq("id", songId)
      .maybeSingle();

    if (songErr || !song) {
      console.warn(`Música ${songId} não encontrada no Supabase:`, songErr?.message);
      return null;
    }

    // 2. Busca as seções da música ordenadas cronologicamente por start_time
    let sections: SupabaseSection[] = [];
    const { data: secData, error: secErr } = await supabase
      .from("sections")
      .select("*")
      .eq("song_id", songId)
      .order("start_time", { ascending: true });

    if (!secErr && secData) {
      sections = secData;
    }

    // 3. Busca as faixas (tracks) da música
    let tracks: SupabaseTrack[] = [];
    const { data: trkData, error: trkErr } = await supabase
      .from("tracks")
      .select("*")
      .eq("song_id", songId)
      .order("created_at", { ascending: true });

    if (!trkErr && trkData) {
      tracks = trkData;
    }

    return {
      song,
      sections,
      tracks,
    };
  } catch (err) {
    console.warn(`Exceção ao buscar detalhes da música ${songId}:`, err);
    return null;
  }
}

/**
 * Converte seções do Supabase para o formato Section da aplicação
 */
export function mapSupabaseSectionsToApp(supabaseSections: SupabaseSection[]): Section[] {
  return (supabaseSections || []).map((s) => ({
    id: s.id,
    type: s.type || "verse",
    startTime: Number(s.start_time) || 0,
    endTime: Number(s.end_time) || 0,
    color: getSectionColor(s.type || "verse"),
  }));
}

/**
 * Converte faixas do Supabase para o formato FaderTrack da aplicação
 */
export function mapSupabaseTracksToFaders(supabaseTracks: SupabaseTrack[]): FaderTrack[] {
  return (supabaseTracks || []).map((t) => {
    const isClick =
      t.is_click ??
      (t.name?.toLowerCase().includes("click") ||
        t.name?.toLowerCase().includes("guia") ||
        t.name?.toLowerCase().includes("guide"));

    return {
      id: t.id,
      name: t.name || "Track",
      icon: getTrackIcon(t.name || ""),
      color: getTrackColor(t.name || ""),
      volume: typeof t.volume === "number" ? Math.round(t.volume * 100) : 80,
      pan: t.pan ?? 0,
      isMuted: t.is_muted ?? false,
      isSoloed: t.is_soloed ?? false,
      isClickTrack: isClick,
    };
  });
}

/**
 * Carrega e decodifica as pistas de áudio de uma música do Supabase/Nuvem
 * em lotes concorrentes (3 faixas por lote com Promise.allSettled)
 * para não esgotar o pool de conexões HTTP (6 a 12 stems) em navegadores móveis/Safari.
 */
export async function loadSongFromSupabase(
  songId: string,
  onProgress?: (completed: number, total: number) => void
): Promise<AudioSong | null> {
  const details = await fetchSongDetails(songId);
  if (!details || !details.tracks || details.tracks.length === 0) {
    console.warn(`[Supabase Loader] Nenhuma faixa encontrada para a música ${songId}.`);
    return null;
  }

  const { song, tracks: rawTracks } = details;
  const songName = song.name || song.title || "Música Nuvem";
  let completedCount = 0;
  const total = rawTracks.length;

  // Carrega as faixas em lotes de 3 com Promise.allSettled
  const batchResults = await loadInBatches(rawTracks, 3, async (t, idx) => {
    const trackName = t.name || `Pista ${idx + 1}`;
    const fileUrl = t.file_url ? getAudioPublicUrl(t.file_url) : "";

    if (!fileUrl) {
      console.error(`[Supabase Loader] URL ausente ou inválida para o canal "${trackName}".`);
      return null;
    }

    const isMobile = isMobileDevice();
    let audioBuffer: AudioBuffer | null = null;
    let audioElement: HTMLAudioElement | null = null;

    if (isMobile) {
      // Mobile: cria <audio> para streaming gradual — sem decodificar o arquivo inteiro para RAM
      // O AudioEngine conecta o elemento via createMediaElementSource ao grafo Web Audio
      audioElement = new Audio();
      audioElement.crossOrigin = "anonymous";
      audioElement.preload = "metadata";
      audioElement.src = fileUrl;
    } else {
      // Desktop: baixa e decodifica para AudioBufferSourceNode (sincronia absoluta)
      audioBuffer = await audioEngine.fetchAndDecodeAudio(fileUrl, trackName);
    }

    completedCount++;
    onProgress?.(completedCount, total);

    const isClick =
      t.is_click ??
      (trackName.toLowerCase().includes("click") ||
        trackName.toLowerCase().includes("guia") ||
        trackName.toLowerCase().includes("guide") ||
        trackName.toLowerCase().includes("metron"));

    const track: Track = {
      trackId: t.id || crypto.randomUUID(),
      trackName,
      audioBuffer,
      audioUrl: fileUrl,
      audioElement,
      mediaElementSource: null,
      volume: typeof t.volume === "number" ? t.volume : 1.0,
      pan: typeof t.pan === "number" ? t.pan : 0,
      isMuted: t.is_muted ?? false,
      isSoloed: t.is_soloed ?? false,
      isClickTrack: isClick,
      gainNode: null,
      panNode: null,
      sourceNode: null,
    };

    return track;
  });

  const loadedTracks: Track[] = [];
  let maxDuration = Number(song.duration) || 0;

  batchResults.forEach((result, idx) => {
    if (result.status === "fulfilled" && result.value) {
      loadedTracks.push(result.value);
      if (result.value.audioBuffer) {
        maxDuration = Math.max(maxDuration, result.value.audioBuffer.duration);
      }
    } else if (result.status === "rejected") {
      const failedTrackName = rawTracks[idx]?.name || `Pista ${idx + 1}`;
      console.error(`[Supabase Loader] Falha crítica no canal "${failedTrackName}":`, result.reason);
    }
  });

  if (loadedTracks.length === 0) {
    console.error(`[Supabase Loader] Todas as faixas da música "${songName}" falharam.`);
    return null;
  }

  const audioSong: AudioSong = {
    id: song.id,
    songName,
    tracks: loadedTracks,
    duration: Math.ceil(maxDuration),
    bpm: song.bpm ? Number(song.bpm) : 120,
  };

  audioEngine.addSong(audioSong);
  return audioSong;
}
