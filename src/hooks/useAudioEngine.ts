import { useState, useEffect, useCallback } from 'react';
import { audioEngine, Song, AudioEngineState } from '@/lib/audioEngine';
import { FaderTrack } from '@/components/HorizontalFaders';
import { getTrackIcon, getTrackColor } from '@/lib/zipImporter';

export function useAudioEngine() {
  const [state, setState] = useState<AudioEngineState>(audioEngine.getState());

  useEffect(() => {
    const unsubscribe = audioEngine.subscribe((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  // Convert Song tracks to FaderTrack format for UI
  const getFaderTracks = useCallback((songId: string): FaderTrack[] => {
    const song = audioEngine.getSong(songId);
    if (!song) return [];

    return song.tracks.map((track) => ({
      id: track.trackId,
      name: track.trackName.replace(/\.[^/.]+$/, ''), // Remove extension
      icon: getTrackIcon(track.trackName),
      color: getTrackColor(track.trackName),
      volume: Math.round(track.volume * 100),
      isMuted: track.isMuted,
    }));
  }, []);

  // Handle volume change from fader (converts 0-100 to 0-1)
  const handleTrackVolumeChange = useCallback((trackId: string, volume: number) => {
    audioEngine.setTrackVolume(trackId, volume / 100);
  }, []);

  // Handle mute toggle
  const handleTrackMuteToggle = useCallback((trackId: string) => {
    return audioEngine.toggleTrackMute(trackId);
  }, []);

  // Set master volume (0-100)
  const setMasterVolume = useCallback((volume: number) => {
    audioEngine.setMasterVolume(volume / 100);
  }, []);

  // Set current song
  const setCurrentSong = useCallback((songId: string) => {
    audioEngine.setCurrentSong(songId);
  }, []);

  // Playback controls
  const play = useCallback(() => {
    audioEngine.play();
  }, []);

  const pause = useCallback(() => {
    audioEngine.pause();
  }, []);

  const stop = useCallback(() => {
    audioEngine.stop();
  }, []);

  const togglePlayPause = useCallback(() => {
    audioEngine.togglePlayPause();
  }, []);

  const seek = useCallback((time: number) => {
    audioEngine.seek(time);
  }, []);

  const skip = useCallback((seconds: number) => {
    audioEngine.skip(seconds);
  }, []);

  // Get current song's fader tracks
  const currentFaderTracks = state.currentSongId 
    ? getFaderTracks(state.currentSongId) 
    : [];

  return {
    // State
    songs: state.songs,
    currentSongId: state.currentSongId,
    currentSong: state.currentSongId ? audioEngine.getSong(state.currentSongId) : undefined,
    isPlaying: state.isPlaying,
    currentTime: state.currentTime,
    currentFaderTracks,
    
    // Track controls
    getFaderTracks,
    handleTrackVolumeChange,
    handleTrackMuteToggle,
    setMasterVolume,
    setCurrentSong,
    
    // Playback controls
    play,
    pause,
    stop,
    togglePlayPause,
    seek,
    skip,
  };
}
