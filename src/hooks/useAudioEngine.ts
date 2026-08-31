import { useState, useEffect, useCallback } from 'react';
import { audioEngine, Song, AudioEngineState } from '@/lib/audioEngine';
import { FaderTrack } from '@/components/HorizontalFaders';
import { getTrackIcon, getTrackColor } from '@/lib/zipImporter';

export function useAudioEngine() {
  const [state, setState] = useState<AudioEngineState>(audioEngine.getState());
  const [playbackState, setPlaybackState] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
  });

  useEffect(() => {
    const unsubscribe = audioEngine.subscribe((newState) => {
      setState(newState);
    });
    
    const unsubscribePlayback = audioEngine.subscribeToPlayback((newPlaybackState) => {
      setPlaybackState(newPlaybackState);
    });
    
    return () => {
      unsubscribe();
      unsubscribePlayback();
    };
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
      isSoloed: track.isSoloed,
      pan: track.pan,
      isClickTrack: track.isClickTrack,
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

  // Handle solo toggle
  const handleTrackSoloToggle = useCallback((trackId: string) => {
    return audioEngine.toggleTrackSolo(trackId);
  }, []);

  // Split click to one side and instruments to other
  const splitClickAndInstruments = useCallback((clickToLeft: boolean = true) => {
    audioEngine.splitClickAndInstruments(clickToLeft);
  }, []);

  // Reset all pans to center
  const resetPans = useCallback(() => {
    audioEngine.resetPans();
  }, []);

  // Fade instruments in/out (toggle)
  const toggleInstrumentsFade = useCallback((duration: number = 4.5) => {
    const isFaded = audioEngine.areInstrumentsFaded();
    audioEngine.fadeInstruments(!isFaded, duration);
  }, []);

  // Check if instruments are faded
  const areInstrumentsFaded = useCallback(() => {
    return audioEngine.areInstrumentsFaded();
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

  const seek = useCallback((time: number) => {
    audioEngine.seek(time);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (audioEngine.getIsPlaying()) {
      audioEngine.pause();
    } else {
      audioEngine.play();
    }
  }, []);

  // Get current song's fader tracks
  const currentFaderTracks = state.currentSongId 
    ? getFaderTracks(state.currentSongId) 
    : [];

  return {
    songs: state.songs,
    currentSongId: state.currentSongId,
    currentSong: state.currentSongId ? audioEngine.getSong(state.currentSongId) : undefined,
    currentFaderTracks,
    getFaderTracks,
    handleTrackVolumeChange,
    handleTrackMuteToggle,
    handleTrackSoloToggle,
    splitClickAndInstruments,
    resetPans,
    toggleInstrumentsFade,
    areInstrumentsFaded,
    instrumentsFaded: state.instrumentsFaded ?? false,
    setMasterVolume,
    setCurrentSong,
    // Playback
    isPlaying: playbackState.isPlaying,
    currentTime: playbackState.currentTime,
    duration: playbackState.duration,
    play,
    pause,
    stop,
    seek,
    togglePlayPause,
  };
}
