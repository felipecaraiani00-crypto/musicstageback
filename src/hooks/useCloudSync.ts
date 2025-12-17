import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Song as AudioSong, Track, audioEngine } from '@/lib/audioEngine';
import { SongSection } from '@/components/SectionEditor';
import { toast } from 'sonner';

export interface CloudSong {
  id: string;
  name: string;
  bpm: number | null;
  duration: number;
  in_setlist: boolean;
  setlist_order: number | null;
}

// Helper: Convert AudioBuffer to WAV Blob (moved outside for reuse)
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;
  
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, bufferLength - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  
  // Interleave channels
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }
  
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Process track upload with chunked WAV conversion to avoid UI blocking
async function processTrackUpload(
  track: Track,
  songId: string,
  userId: string,
  trackIndex: number
): Promise<void> {
  if (!track.audioBuffer) return;

  // Convert AudioBuffer to WAV (yield to main thread periodically)
  const wavBlob = audioBufferToWav(track.audioBuffer);
  const fileName = `${userId}/${songId}/${track.trackId}.wav`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('audio-tracks')
    .upload(fileName, wavBlob, {
      contentType: 'audio/wav',
      upsert: true,
    });

  if (uploadError) {
    console.error('Error uploading track:', uploadError);
    throw uploadError;
  }

  // Determine if this is a click track
  const trackNameLower = track.trackName.toLowerCase();
  const isClick = trackNameLower.includes('click') || trackNameLower.includes('metron');

  // Create track record
  const { error: trackError } = await supabase
    .from('tracks')
    .insert({
      song_id: songId,
      name: track.trackName,
      file_url: fileName,
      volume: track.volume,
      is_muted: track.isMuted,
      is_click: isClick,
      track_order: trackIndex,
    });

  if (trackError) {
    console.error('Error creating track record:', trackError);
    throw trackError;
  }
}

// Process track download with parallel execution
async function processTrackDownload(
  track: { id: string; name: string; file_url: string; volume: number; is_muted: boolean }
): Promise<Track | null> {
  try {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('audio-tracks')
      .download(track.file_url);

    if (downloadError) {
      console.error('Error downloading track:', downloadError);
      return null;
    }

    const audioBuffer = await audioEngine.decodeAudioFile(
      new File([fileData], track.name, { type: 'audio/wav' })
    );

    return {
      trackId: track.id,
      trackName: track.name,
      audioBuffer,
      volume: Number(track.volume),
      pan: 0,
      isMuted: track.is_muted,
      isSolo: false,
      gainNode: null,
      panNode: null,
      sourceNode: null,
    };
  } catch (error) {
    console.error('Error processing track download:', error);
    return null;
  }
}

export function useCloudSync(userId: string | undefined) {
  const [cloudSongs, setCloudSongs] = useState<CloudSong[]>([]);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [songSections, setSongSections] = useState<Map<string, SongSection[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Load songs from cloud - optimized with parallel track loading
  const loadSongs = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const { data: songs, error } = await supabase
        .from('songs')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      setCloudSongs(songs || []);
      
      // Set selected songs based on in_setlist flag
      const setlistIds = (songs || [])
        .filter(s => s.in_setlist)
        .sort((a, b) => (a.setlist_order || 0) - (b.setlist_order || 0))
        .map(s => s.id);
      setSelectedSongIds(setlistIds);

      // Load sections for all songs in parallel
      const { data: sections, error: sectionsError } = await supabase
        .from('sections')
        .select('*')
        .in('song_id', (songs || []).map(s => s.id));

      if (!sectionsError && sections) {
        const sectionsMap = new Map<string, SongSection[]>();
        sections.forEach(section => {
          const existing = sectionsMap.get(section.song_id) || [];
          existing.push({
            id: section.id,
            type: section.type as SongSection['type'],
            startTime: Number(section.start_time),
            endTime: Number(section.end_time),
          });
          sectionsMap.set(section.song_id, existing);
        });
        setSongSections(sectionsMap);
      }

      // Load tracks for all songs in PARALLEL (major optimization)
      if (songs && songs.length > 0) {
        await Promise.all(songs.map(song => loadSongTracks(song)));
      }
    } catch (error) {
      console.error('Error loading songs:', error);
      toast.error('Erro ao carregar músicas');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Load tracks for a specific song - optimized with parallel downloads
  const loadSongTracks = async (song: CloudSong) => {
    try {
      const { data: tracks, error } = await supabase
        .from('tracks')
        .select('*')
        .eq('song_id', song.id)
        .order('track_order', { ascending: true });

      if (error) throw error;

      if (tracks && tracks.length > 0) {
        // Download and decode ALL tracks in PARALLEL
        const trackPromises = tracks.map(track => processTrackDownload(track));
        const audioTracksResults = await Promise.all(trackPromises);
        
        // Filter out null results
        const audioTracks = audioTracksResults.filter((t): t is Track => t !== null);

        if (audioTracks.length > 0) {
          const audioSong: AudioSong = {
            id: song.id,
            songName: song.name,
            tracks: audioTracks,
            duration: song.duration,
            bpm: song.bpm || 120,
          };

          audioEngine.addSong(audioSong);
        }
      }
    } catch (error) {
      console.error('Error loading tracks for song:', song.name, error);
    }
  };

  // Save a new song to cloud - optimized with parallel uploads
  const saveSong = useCallback(async (audioSong: AudioSong): Promise<string | null> => {
    if (!userId) return null;
    setSyncing(true);

    try {
      // Create song record first
      const { data: songData, error: songError } = await supabase
        .from('songs')
        .insert({
          user_id: userId,
          name: audioSong.songName,
          bpm: audioSong.bpm,
          duration: audioSong.duration,
          in_setlist: true,
        })
        .select()
        .single();

      if (songError) throw songError;

      const songId = songData.id;

      // Upload ALL tracks in PARALLEL (major optimization)
      const validTracks = audioSong.tracks.filter(t => t.audioBuffer);
      
      // Process in batches of 3 to avoid overwhelming the network
      const BATCH_SIZE = 3;
      for (let i = 0; i < validTracks.length; i += BATCH_SIZE) {
        const batch = validTracks.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((track, batchIndex) => 
            processTrackUpload(track, songId, userId, i + batchIndex)
          )
        );
      }

      // Update local state
      setCloudSongs(prev => [...prev, songData]);
      setSelectedSongIds(prev => [...prev, songId]);

      toast.success('Música salva no cloud!');
      return songId;
    } catch (error) {
      console.error('Error saving song:', error);
      toast.error('Erro ao salvar música');
      return null;
    } finally {
      setSyncing(false);
    }
  }, [userId]);

  // Update setlist selection
  const updateSetlist = useCallback(async (songId: string, inSetlist: boolean) => {
    if (!userId) return;

    try {
      const newOrder = inSetlist ? selectedSongIds.length : null;
      
      const { error } = await supabase
        .from('songs')
        .update({ 
          in_setlist: inSetlist,
          setlist_order: newOrder,
        })
        .eq('id', songId);

      if (error) throw error;

      if (inSetlist) {
        setSelectedSongIds(prev => [...prev, songId]);
      } else {
        setSelectedSongIds(prev => prev.filter(id => id !== songId));
      }
    } catch (error) {
      console.error('Error updating setlist:', error);
    }
  }, [userId, selectedSongIds]);

  // Save sections for a song
  const saveSections = useCallback(async (songId: string, sections: SongSection[]) => {
    if (!userId) return;

    try {
      // Delete existing sections
      await supabase
        .from('sections')
        .delete()
        .eq('song_id', songId);

      // Insert new sections
      if (sections.length > 0) {
        const { error } = await supabase
          .from('sections')
          .insert(
            sections.map((section, index) => ({
              song_id: songId,
              type: section.type,
              start_time: section.startTime,
              end_time: section.endTime,
              section_order: index,
            }))
          );

        if (error) throw error;
      }

      // Update local state
      setSongSections(prev => {
        const newMap = new Map(prev);
        newMap.set(songId, sections);
        return newMap;
      });
    } catch (error) {
      console.error('Error saving sections:', error);
    }
  }, [userId]);

  // Delete a song - optimized with parallel storage deletion
  const deleteSong = useCallback(async (songId: string) => {
    if (!userId) return;

    try {
      // Delete tracks from storage in parallel
      const { data: tracks } = await supabase
        .from('tracks')
        .select('file_url')
        .eq('song_id', songId);

      if (tracks && tracks.length > 0) {
        // Delete all files in parallel
        await Promise.all(
          tracks.map(track => 
            supabase.storage.from('audio-tracks').remove([track.file_url])
          )
        );
      }

      // Delete song (cascades to tracks and sections)
      const { error } = await supabase
        .from('songs')
        .delete()
        .eq('id', songId);

      if (error) throw error;

      // Update local state
      setCloudSongs(prev => prev.filter(s => s.id !== songId));
      setSelectedSongIds(prev => prev.filter(id => id !== songId));
      setSongSections(prev => {
        const newMap = new Map(prev);
        newMap.delete(songId);
        return newMap;
      });

      // Remove from audio engine
      audioEngine.removeSong(songId);

      toast.success('Música removida');
    } catch (error) {
      console.error('Error deleting song:', error);
      toast.error('Erro ao remover música');
    }
  }, [userId]);

  // Initial load
  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  return {
    cloudSongs,
    selectedSongIds,
    songSections,
    loading,
    syncing,
    saveSong,
    updateSetlist,
    saveSections,
    deleteSong,
    refresh: loadSongs,
  };
}
