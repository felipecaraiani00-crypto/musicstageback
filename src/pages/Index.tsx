import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, Music, List, LogOut, Cloud, CloudOff, Plus } from "lucide-react";
import { TransportControls } from "@/components/TransportControls";
import { SongViewer } from "@/components/SongViewer";
import { MasterControls } from "@/components/MasterControls";
import { TimeDisplay } from "@/components/TimeDisplay";
import { SongList, Song } from "@/components/SongList";
import { MusicLibrary } from "@/components/MusicLibrary";
import { ImportMusic } from "@/components/ImportMusic";
import { SettingsMenu } from "@/components/SettingsMenu";
import { SectionEditor, SongSection, SectionType } from "@/components/SectionEditor";
import { CurrentSectionIndicator } from "@/components/CurrentSectionIndicator";
import { FaderTrack } from "@/components/HorizontalFaders";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useAuth } from "@/hooks/useAuth";
import { useCloudSync } from "@/hooks/useCloudSync";
import { Song as AudioSong } from "@/lib/audioEngine";
import { speakSection, initSpeech, isSpeechSupported } from "@/lib/speechSynthesis";
import { createDemoSong } from "@/lib/demoSong";
import { toast } from "sonner";

const sectionNames: Record<SectionType, string> = {
  intro: "Intro",
  verse: "Verso",
  "pre-chorus": "Pré-Refrão",
  chorus: "Refrão",
  bridge: "Ponte",
  solo: "Solo",
  interlude: "Interlúdio",
  outro: "Outro",
};

const initialTracks: FaderTrack[] = [
  { id: "1", name: "Click", icon: "🥁", color: "hsl(38, 95%, 55%)", volume: 80 },
  { id: "2", name: "Drums", icon: "🪘", color: "hsl(0, 72%, 55%)", volume: 85 },
  { id: "3", name: "Bass", icon: "🎸", color: "hsl(280, 70%, 55%)", volume: 75 },
  { id: "4", name: "Keys", icon: "🎹", color: "hsl(200, 70%, 45%)", volume: 70 },
  { id: "5", name: "Guitar", icon: "🎵", color: "hsl(145, 70%, 45%)", volume: 65 },
  { id: "6", name: "Vocals", icon: "🎤", color: "hsl(320, 60%, 50%)", volume: 90 },
];

// Empty library songs (demo song is generated dynamically)
const demoSongs: Song[] = [];

const BEATS_PER_BAR = 4;

// Convert AudioEngine Song to UI Song format
function audioSongToUISong(audioSong: AudioSong): Song {
  return {
    id: audioSong.id,
    title: audioSong.songName,
    duration: audioSong.duration,
    bpm: audioSong.bpm,
    trackCount: audioSong.tracks.length,
  };
}

export default function Index() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut, isAuthenticated } = useAuth();
  
  // Cloud sync
  const {
    cloudSongs,
    selectedSongIds: cloudSelectedIds,
    songSections: cloudSongSections,
    loading: cloudLoading,
    syncing,
    saveSong,
    updateSetlist,
    saveSections,
  } = useCloudSync(user?.id);

  // Local state for demo songs
  const [demoIsPlaying, setDemoIsPlaying] = useState(false);
  const [demoCurrentTime, setDemoCurrentTime] = useState(0);
  const [tracks, setTracks] = useState<FaderTrack[]>(initialTracks);
  const [masterVolume, setMasterVolume] = useState(80);
  const [isClickActive, setIsClickActive] = useState(true);
  const [currentBeat, setCurrentBeat] = useState(1);
  
  // Fade to click state
  const [isFadingToClick, setIsFadingToClick] = useState(false);
  const [fadeProgress, setFadeProgress] = useState(0);
  const [savedVolumes, setSavedVolumes] = useState<Map<string, number>>(new Map());
  
  // Audio Engine integration
  const { 
    songs: audioEngineSongs, 
    currentSongId: audioCurrentSongId,
    currentFaderTracks,
    currentWaveformData,
    isPlaying: engineIsPlaying,
    currentTime: engineCurrentTime,
    handleTrackVolumeChange,
    handleTrackMuteToggle,
    handleTrackSoloToggle,
    setStereoSplit,
    setMasterVolume: setEngineMasterVolume,
    setCurrentSong: setEngineCurrentSong,
    play: enginePlay,
    pause: enginePause,
    stop: engineStop,
    togglePlayPause: engineTogglePlayPause,
    seek: engineSeek,
    skip: engineSkip,
  } = useAudioEngine();
  
  // Stereo split state
  const [stereoSplit, setStereoSplitState] = useState(0); // -1 = click left, 0 = center, 1 = click right
  
  const handleStereoSplitChange = useCallback((side: number) => {
    setStereoSplitState(side);
    setStereoSplit(side);
  }, [setStereoSplit]);
  
  // Library & Setlist state - use cloud data when authenticated
  const [librarySongs, setLibrarySongs] = useState<Song[]>(demoSongs);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [currentSongId, setCurrentSongId] = useState<string>("");

  // Song sections state - use cloud data when authenticated
  const [localSongSections, setLocalSongSections] = useState<Map<string, SongSection[]>>(new Map());
  const songSections = isAuthenticated ? cloudSongSections : localSongSections;

  // Modal states
  const [showSettings, setShowSettings] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSectionEditor, setShowSectionEditor] = useState(false);
  
  // Voice announcement state
  const [voiceAnnouncementsEnabled, setVoiceAnnouncementsEnabled] = useState(true);
  const lastAnnouncedSectionRef = useRef<string | null>(null);

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Sync selected song IDs from cloud
  useEffect(() => {
    if (isAuthenticated && cloudSelectedIds.length > 0) {
      setSelectedSongIds(cloudSelectedIds);
      if (!currentSongId || !cloudSelectedIds.includes(currentSongId)) {
        setCurrentSongId(cloudSelectedIds[0]);
      }
    }
  }, [isAuthenticated, cloudSelectedIds]);

  // Load demo song when no songs exist
  const [demoLoaded, setDemoLoaded] = useState(false);
  useEffect(() => {
    if (!cloudLoading && audioEngineSongs.length === 0 && !demoLoaded) {
      createDemoSong().then((song) => {
        if (song) {
          setDemoLoaded(true);
          setSelectedSongIds([song.id]);
          setCurrentSongId(song.id);
          toast.success("Música demo carregada!");
        }
      });
    }
  }, [cloudLoading, audioEngineSongs.length, demoLoaded]);

  const allLibrarySongs: Song[] = [
    ...librarySongs,
    ...audioEngineSongs.map(audioSongToUISong),
  ];

  // Derived state
  const setlistSongs = allLibrarySongs.filter((s) => selectedSongIds.includes(s.id));
  const currentSong = allLibrarySongs.find((s) => s.id === currentSongId) || setlistSongs[0];
  
  // Check if current song is from audio engine (has tracks)
  const isImportedSong = audioEngineSongs.some(s => s.id === currentSongId);
  
  // Use audio engine state for imported songs, local state for demo songs
  const isPlaying = isImportedSong ? engineIsPlaying : demoIsPlaying;
  const currentTime = isImportedSong ? engineCurrentTime : demoCurrentTime;
  
  // Use audio engine tracks if available, otherwise use demo tracks
  const activeTracks = isImportedSong && currentFaderTracks.length > 0 
    ? currentFaderTracks 
    : tracks;

  // Get current section based on time
  const currentSections = currentSong ? (songSections.get(currentSong.id) || []) : [];
  const currentSection = useMemo(() => {
    return currentSections.find(
      section => currentTime >= section.startTime && currentTime <= section.endTime
    );
  }, [currentSections, currentTime]);

  // Calculate 2 beats in seconds based on BPM
  const twoBeatsInSeconds = currentSong ? (60 / currentSong.bpm) * 2 : 0;

  // Find upcoming section (2 beats ahead)
  const upcomingSection = useMemo(() => {
    const lookAheadTime = currentTime + twoBeatsInSeconds;
    return currentSections.find(
      section => lookAheadTime >= section.startTime && lookAheadTime <= section.startTime + 0.5
    );
  }, [currentSections, currentTime, twoBeatsInSeconds]);

  // Voice announcement for upcoming sections (2 beats before)
  useEffect(() => {
    if (!voiceAnnouncementsEnabled || !isPlaying || !upcomingSection) {
      return;
    }

    const sectionKey = `${upcomingSection.id}-${upcomingSection.type}`;
    
    if (lastAnnouncedSectionRef.current !== sectionKey) {
      lastAnnouncedSectionRef.current = sectionKey;
      const sectionName = sectionNames[upcomingSection.type];
      speakSection(sectionName);
    }
  }, [upcomingSection, isPlaying, voiceAnnouncementsEnabled]);

  // Reset announced section when song changes or stops
  useEffect(() => {
    if (!isPlaying) {
      lastAnnouncedSectionRef.current = null;
    }
  }, [isPlaying, currentSongId]);

  // Simulate playback for demo songs only
  useEffect(() => {
    if (!demoIsPlaying || !currentSong || isImportedSong) return;

    const interval = setInterval(() => {
      setDemoCurrentTime((prev) => {
        if (prev >= currentSong.duration) {
          setDemoIsPlaying(false);
          return 0;
        }
        return prev + 0.1;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [demoIsPlaying, currentSong, isImportedSong]);

  // Simulate beat counter
  useEffect(() => {
    if (!isPlaying || !currentSong) return;

    const beatDuration = 60 / currentSong.bpm;
    const interval = setInterval(() => {
      setCurrentBeat((prev) => (prev % BEATS_PER_BAR) + 1);
    }, beatDuration * 1000);

    return () => clearInterval(interval);
  }, [isPlaying, currentSong]);

  // Fade direction: true = fading to click, false = restoring volumes
  const [isFadeRestoring, setIsFadeRestoring] = useState(false);

  // Fade to click effect - gradually fade instruments
  useEffect(() => {
    if (!isFadingToClick && !isFadeRestoring) return;

    const fadeSpeed = 2; // Same gradual speed for both directions
    const interval = setInterval(() => {
      setFadeProgress(prev => {
        if (isFadingToClick) {
          const next = prev + fadeSpeed;
          if (next >= 100) {
            return 100;
          }
          return next;
        } else if (isFadeRestoring) {
          const next = prev - fadeSpeed;
          if (next <= 0) {
            setIsFadeRestoring(false);
            return 0;
          }
          return next;
        }
        return prev;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isFadingToClick, isFadeRestoring]);

  // Apply fade to track volumes
  useEffect(() => {
    if (!isImportedSong) return;
    
    const fadeMultiplier = 1 - (fadeProgress / 100);
    
    activeTracks.forEach(track => {
      const trackNameLower = track.name.toLowerCase();
      const isClickTrack = trackNameLower.includes('click') || trackNameLower.includes('metron');
      
      if (!isClickTrack) {
        // Get saved volume or current volume
        const baseVolume = savedVolumes.get(track.id) ?? track.volume;
        const newVolume = Math.round(baseVolume * fadeMultiplier);
        handleTrackVolumeChange(track.id, newVolume);
      }
    });
  }, [fadeProgress, isImportedSong]);

  // Handle fade to click toggle
  const handleFadeToClickToggle = useCallback(() => {
    if (fadeProgress === 0 && !isFadingToClick) {
      // Starting fade - save current volumes
      const volumes = new Map<string, number>();
      activeTracks.forEach(track => {
        volumes.set(track.id, track.volume);
      });
      setSavedVolumes(volumes);
      setIsFadingToClick(true);
      setIsFadeRestoring(false);
    } else if (fadeProgress > 0) {
      // Restoring - start gradual fade back
      setIsFadingToClick(false);
      setIsFadeRestoring(true);
    }
  }, [fadeProgress, activeTracks, isFadingToClick]);

  const handlePlayPause = useCallback(() => {
    if (isImportedSong) {
      engineTogglePlayPause();
    } else {
      setDemoIsPlaying((prev) => !prev);
    }
  }, [isImportedSong, engineTogglePlayPause]);

  const handleStop = useCallback(() => {
    if (isImportedSong) {
      engineStop();
    } else {
      setDemoIsPlaying(false);
      setDemoCurrentTime(0);
    }
    setCurrentBeat(1);
  }, [isImportedSong, engineStop]);

  const handlePrev = useCallback(() => {
    if (isImportedSong) {
      engineSkip(-10);
    } else {
      setDemoCurrentTime((prev) => Math.max(0, prev - 10));
    }
  }, [isImportedSong, engineSkip]);

  const handleNext = useCallback(() => {
    if (currentSong) {
      if (isImportedSong) {
        engineSkip(10);
      } else {
        setDemoCurrentTime((prev) => Math.min(currentSong.duration, prev + 10));
      }
    }
  }, [currentSong, isImportedSong, engineSkip]);

  const handleSeek = useCallback((time: number) => {
    if (isImportedSong) {
      engineSeek(time);
    } else {
      setDemoCurrentTime(time);
    }
  }, [isImportedSong, engineSeek]);

  // Handle volume change - route to appropriate handler
  const handleVolumeChange = useCallback((trackId: string, volume: number) => {
    if (isImportedSong) {
      // Use audio engine for imported songs
      handleTrackVolumeChange(trackId, volume);
    } else {
      // Use local state for demo songs
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, volume } : t))
      );
    }
  }, [isImportedSong, handleTrackVolumeChange]);

  // Handle mute toggle
  const handleMuteToggle = useCallback((trackId: string) => {
    if (isImportedSong) {
      handleTrackMuteToggle(trackId);
    }
  }, [isImportedSong, handleTrackMuteToggle]);

  // Handle solo toggle
  const handleSoloToggle = useCallback((trackId: string) => {
    if (isImportedSong) {
      handleTrackSoloToggle(trackId);
    }
  }, [isImportedSong, handleTrackSoloToggle]);

  const handleSongSelect = useCallback((song: Song) => {
    // Stop any current playback
    if (isImportedSong) {
      engineStop();
    } else {
      setDemoIsPlaying(false);
    }
    
    setCurrentSongId(song.id);
    setDemoCurrentTime(0);
    setCurrentBeat(1);
    
    // Also update audio engine if it's an imported song
    if (audioEngineSongs.some(s => s.id === song.id)) {
      setEngineCurrentSong(song.id);
    }
  }, [audioEngineSongs, setEngineCurrentSong, isImportedSong, engineStop]);

  const handleToggleLibrarySong = useCallback((songId: string) => {
    if (isAuthenticated) {
      const isInSetlist = selectedSongIds.includes(songId);
      updateSetlist(songId, !isInSetlist);
    } else {
      setSelectedSongIds((prev) =>
        prev.includes(songId)
          ? prev.filter((id) => id !== songId)
          : [...prev, songId]
      );
    }
  }, [isAuthenticated, selectedSongIds, updateSetlist]);

  const handleImportSongs = useCallback(async (newSongs: AudioSong[]) => {
    // Save to cloud if authenticated
    if (isAuthenticated) {
      for (const song of newSongs) {
        await saveSong(song);
      }
    } else {
      // Just update local state for demo
      setSelectedSongIds((prev) => [...prev, ...newSongs.map((s) => s.id)]);
    }
    
    // Select the first imported song
    if (newSongs.length > 0) {
      setCurrentSongId(newSongs[0].id);
      setEngineCurrentSong(newSongs[0].id);
    }
  }, [isAuthenticated, saveSong, setEngineCurrentSong]);

  const handleLogout = useCallback(async () => {
    await signOut();
    navigate('/auth', { replace: true });
  }, [signOut, navigate]);

  // Update master volume in audio engine
  useEffect(() => {
    setEngineMasterVolume(masterVolume);
  }, [masterVolume, setEngineMasterVolume]);

  // Loading states
  if (authLoading || cloudLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Cloud className="w-5 h-5 animate-pulse" />
          <span>Carregando...</span>
        </div>
      </div>
    );
  }

  if (!currentSong) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Nenhuma música selecionada</p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowLibrary(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            <Music className="w-4 h-4" />
            Biblioteca
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Importar
          </button>
        </div>
        
        {/* Music Library Modal */}
        {showLibrary && (
          <MusicLibrary
            songs={allLibrarySongs}
            selectedIds={selectedSongIds}
            onToggleSelect={handleToggleLibrarySong}
            onClose={() => setShowLibrary(false)}
          />
        )}
        
        {/* Import Music Modal */}
        {showImport && (
          <ImportMusic
            onImport={handleImportSongs}
            onClose={() => setShowImport(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden relative">
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          <button className="transport-btn min-w-[40px] min-h-[40px]">
            <List className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-sm font-semibold flex items-center gap-1.5">
              <Music className="w-4 h-4 text-primary" />
              {currentSong.title}
            </h1>
            <p className="text-[10px] text-muted-foreground">
              {currentSong.artist || `${currentSong.trackCount} tracks`}
            </p>
          </div>
        </div>

        {/* Current Section Indicator */}
        <CurrentSectionIndicator
          sections={songSections.get(currentSong.id) || []}
          currentTime={currentTime}
          isPlaying={isPlaying}
        />

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {syncing && <Cloud className="w-4 h-4 text-primary animate-pulse" />}
          </div>
          <TimeDisplay currentTime={currentTime} totalDuration={currentSong.duration} />
          <button
            onClick={handleLogout}
            className="transport-btn min-w-[40px] min-h-[40px]"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="transport-btn min-w-[40px] min-h-[40px]"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Settings Menu */}
      <SettingsMenu
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onOpenLibrary={() => setShowLibrary(true)}
        onOpenImport={() => setShowImport(true)}
        onOpenSectionEditor={() => setShowSectionEditor(true)}
      />

      {/* Main Content - Landscape Layout */}
      <main className="flex-1 px-2 py-1 overflow-hidden min-h-0 flex gap-2">
        {/* Left side - Waveform/Faders */}
        <div className="flex-1 min-w-0">
          <SongViewer
            currentTime={currentTime}
            totalDuration={currentSong.duration}
            isPlaying={isPlaying}
            onSeek={handleSeek}
            tracks={activeTracks}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={isImportedSong ? handleMuteToggle : undefined}
            onSoloToggle={isImportedSong ? handleSoloToggle : undefined}
            waveformData={isImportedSong ? currentWaveformData : undefined}
          />
        </div>

        {/* Right side - Setlist */}
        <div className="w-[200px] flex-shrink-0">
          <SongList
            songs={setlistSongs}
            currentSongId={currentSongId}
            onSongSelect={handleSongSelect}
          />
        </div>
      </main>

      {/* Footer Controls - Horizontal Layout */}
      <footer className="border-t border-border bg-card/80 backdrop-blur-sm px-3 py-1 flex items-center justify-between gap-4">
        <MasterControls
          masterVolume={masterVolume}
          bpm={currentSong.bpm}
          isClickActive={isClickActive}
          currentBeat={currentBeat}
          beatsPerBar={BEATS_PER_BAR}
          isFadingToClick={isFadingToClick}
          isFadeRestoring={isFadeRestoring}
          fadeProgress={fadeProgress}
          voiceEnabled={voiceAnnouncementsEnabled}
          stereoSplit={stereoSplit}
          onMasterVolumeChange={setMasterVolume}
          onFadeToClickToggle={handleFadeToClickToggle}
          onVoiceToggle={() => setVoiceAnnouncementsEnabled(prev => !prev)}
          onStereoSplitChange={handleStereoSplitChange}
        />

        <TransportControls
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onStop={handleStop}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      </footer>

      {/* Library Modal */}
      {showLibrary && (
        <MusicLibrary
          songs={allLibrarySongs}
          selectedIds={selectedSongIds}
          onToggleSelect={handleToggleLibrarySong}
          onClose={() => setShowLibrary(false)}
        />
      )}

      {/* Import Modal */}
      {showImport && (
        <ImportMusic
          onImport={handleImportSongs}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* Section Editor Modal */}
      {showSectionEditor && currentSong && (
        <SectionEditor
          songId={currentSong.id}
          songName={currentSong.title}
          duration={currentSong.duration}
          currentTime={currentTime}
          sections={songSections.get(currentSong.id) || []}
          onSectionsChange={(sections) => {
            if (isAuthenticated) {
              saveSections(currentSong.id, sections);
            } else {
              setLocalSongSections(prev => {
                const newMap = new Map(prev);
                newMap.set(currentSong.id, sections);
                return newMap;
              });
            }
          }}
          onSeek={handleSeek}
          onClose={() => setShowSectionEditor(false)}
        />
      )}
    </div>
  );
}
