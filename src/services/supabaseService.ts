import { supabase, getAudioPublicUrl } from "@/lib/supabase";
import { Song } from "@/components/SongList";
import { Section, getSectionColor } from "@/types/section";
import { FaderTrack } from "@/components/HorizontalFaders";
import { getTrackIcon, getTrackColor } from "@/lib/zipImporter";

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
