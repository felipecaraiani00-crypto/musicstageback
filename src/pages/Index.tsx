import { useState, useEffect, useCallback } from "react";
import { Settings, Music, List } from "lucide-react";
import { TransportControls } from "@/components/TransportControls";
import { SongViewer } from "@/components/SongViewer";
import { MasterControls } from "@/components/MasterControls";
import { TimeDisplay } from "@/components/TimeDisplay";
import { SongList, Song } from "@/components/SongList";
import { MusicLibrary } from "@/components/MusicLibrary";
import { ImportMusic } from "@/components/ImportMusic";
import { SettingsMenu } from "@/components/SettingsMenu";
import { SectionEditor } from "@/components/SectionEditor";
import { FaderTrack } from "@/components/HorizontalFaders";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useSections } from "@/hooks/useSections";
import { Song as AudioSong } from "@/lib/audioEngine";
import { metronome } from "@/lib/metronome";

const initialTracks: FaderTrack[] = [
  { id: "1", name: "Click", icon: "🥁", color: "hsl(38, 95%, 55%)", volume: 80 },
  { id: "2", name: "Drums", icon: "🪘", color: "hsl(0, 72%, 55%)", volume: 85 },
  { id: "3", name: "Bass", icon: "🎸", color: "hsl(280, 70%, 55%)", volume: 75 },
  { id: "4", name: "Keys", icon: "🎹", color: "hsl(200, 70%, 45%)", volume: 70 },
  { id: "5", name: "Guitar", icon: "🎵", color: "hsl(145, 70%, 45%)", volume: 65 },
  { id: "6", name: "Vocals", icon: "🎤", color: "hsl(320, 60%, 50%)", volume: 90 },
];

// All available songs in library (demo data)
const demoSongs: Song[] = [
  { id: "demo-1", title: "Amazing Grace", artist: "Gospel Arrangement", duration: 192, bpm: 120 },
  { id: "demo-2", title: "How Great Is Our God", artist: "Chris Tomlin", duration: 245, bpm: 78 },
  { id: "demo-3", title: "10,000 Reasons", artist: "Matt Redman", duration: 330, bpm: 73 },
  { id: "demo-4", title: "What A Beautiful Name", artist: "Hillsong Worship", duration: 285, bpm: 68 },
  { id: "demo-5", title: "Reckless Love", artist: "Cory Asbury", duration: 312, bpm: 76 },
];

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
  const [tracks, setTracks] = useState<FaderTrack[]>(initialTracks);
  const [masterVolume, setMasterVolume] = useState(80);
  const [clickVolume, setClickVolume] = useState(75);
  const [isClickActive, setIsClickActive] = useState(true);
  const [currentBeat, setCurrentBeat] = useState(1);
  
  
  // Demo playback state (for songs without audio)
  const [demoIsPlaying, setDemoIsPlaying] = useState(false);
  const [demoCurrentTime, setDemoCurrentTime] = useState(0);
  
  // Audio Engine integration
  const { 
    songs: audioEngineSongs, 
    currentSongId: audioCurrentSongId,
    currentFaderTracks,
    handleTrackVolumeChange,
    handleTrackMuteToggle,
    handleTrackSoloToggle,
    splitClickAndInstruments,
    resetPans,
    toggleInstrumentsFade,
    areInstrumentsFaded,
    setMasterVolume: setEngineMasterVolume,
    setCurrentSong: setEngineCurrentSong,
    // Playback controls from audio engine
    isPlaying: engineIsPlaying,
    currentTime: engineCurrentTime,
    play: enginePlay,
    pause: enginePause,
    stop: engineStop,
    seek: engineSeek,
    togglePlayPause: engineTogglePlayPause,
  } = useAudioEngine();

  // Track split mode: "off" | "clickLeft" | "clickRight"
  type SplitMode = "off" | "clickLeft" | "clickRight";
  const [splitMode, setSplitMode] = useState<SplitMode>("off");
  const [instrumentsFaded, setInstrumentsFaded] = useState(false);
  
  // Library & Setlist state
  const [librarySongs, setLibrarySongs] = useState<Song[]>(demoSongs);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>(["demo-1", "demo-2", "demo-3"]);
  const [currentSongId, setCurrentSongId] = useState<string>("demo-1");

  // Modal states
  const [showSettings, setShowSettings] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSectionEditor, setShowSectionEditor] = useState(false);

  // Sections hook
  const { getSectionsForSong, addSection, updateSection, deleteSection } = useSections();

  // Merge demo songs with imported audio engine songs
  const allLibrarySongs: Song[] = [
    ...librarySongs,
    ...audioEngineSongs.map(audioSongToUISong),
  ];

  // Derived state
  const setlistSongs = allLibrarySongs.filter((s) => selectedSongIds.includes(s.id));
  const currentSong = allLibrarySongs.find((s) => s.id === currentSongId) || setlistSongs[0];
  
  // Check if current song is from audio engine (has real audio tracks)
  const isImportedSong = audioEngineSongs.some(s => s.id === currentSongId);
  
  // Use audio engine state for imported songs, demo state otherwise
  const isPlaying = isImportedSong ? engineIsPlaying : demoIsPlaying;
  const currentTime = isImportedSong ? engineCurrentTime : demoCurrentTime;
  
  // Get BPM from song
  const effectiveBpm = currentSong?.bpm || 120;
  
  // Use audio engine tracks if available, otherwise use demo tracks
  const activeTracks = isImportedSong && currentFaderTracks.length > 0 
    ? currentFaderTracks 
    : tracks;

  // Simulate playback for demo songs only
  useEffect(() => {
    if (isImportedSong || !demoIsPlaying || !currentSong) return;

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

  // Metronome control
  useEffect(() => {
    metronome.setVolume(clickVolume / 100);
  }, [clickVolume]);

  useEffect(() => {
    if (isPlaying && isClickActive) {
      metronome.start(effectiveBpm, (beat) => {
        setCurrentBeat(beat);
      });
    } else {
      metronome.stop();
      if (!isPlaying) {
        setCurrentBeat(1);
      }
    }

    return () => {
      metronome.stop();
    };
  }, [isPlaying, isClickActive, effectiveBpm]);

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
    const newTime = Math.max(0, currentTime - 10);
    if (isImportedSong) {
      engineSeek(newTime);
    } else {
      setDemoCurrentTime(newTime);
    }
  }, [isImportedSong, currentTime, engineSeek]);

  const handleNext = useCallback(() => {
    if (currentSong) {
      const newTime = Math.min(currentSong.duration, currentTime + 10);
      if (isImportedSong) {
        engineSeek(newTime);
      } else {
        setDemoCurrentTime(newTime);
      }
    }
  }, [currentSong, isImportedSong, currentTime, engineSeek]);

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

  // Handle split mode change
  const handleSplitModeChange = useCallback((mode: SplitMode) => {
    setSplitMode(mode);
    if (mode === "off") {
      resetPans();
    } else {
      splitClickAndInstruments(mode === "clickLeft");
    }
  }, [splitClickAndInstruments, resetPans]);

  // Handle instrument fade toggle
  const handleInstrumentsFadeToggle = useCallback(() => {
    toggleInstrumentsFade();
    setInstrumentsFaded(prev => !prev);
  }, [toggleInstrumentsFade]);
  const handleSongSelect = useCallback((song: Song) => {
    setCurrentSongId(song.id);
    setCurrentBeat(1);
    
    // Stop current playback
    if (audioEngineSongs.some(s => s.id === currentSongId)) {
      engineStop();
    }
    setDemoIsPlaying(false);
    setDemoCurrentTime(0);
    
    // Update audio engine if it's an imported song
    if (audioEngineSongs.some(s => s.id === song.id)) {
      setEngineCurrentSong(song.id);
    }
  }, [audioEngineSongs, setEngineCurrentSong, currentSongId, engineStop]);

  const handleToggleLibrarySong = useCallback((songId: string) => {
    setSelectedSongIds((prev) =>
      prev.includes(songId)
        ? prev.filter((id) => id !== songId)
        : [...prev, songId]
    );
  }, []);

  const handleImportSongs = useCallback((newSongs: AudioSong[]) => {
    // Auto-select imported songs
    setSelectedSongIds((prev) => [...prev, ...newSongs.map((s) => s.id)]);
    
    // Select the first imported song
    if (newSongs.length > 0) {
      setCurrentSongId(newSongs[0].id);
      setEngineCurrentSong(newSongs[0].id);
    }
  }, [setEngineCurrentSong]);

  // Update master volume in audio engine
  useEffect(() => {
    setEngineMasterVolume(masterVolume);
  }, [masterVolume, setEngineMasterVolume]);

  // Use first demo song as fallback
  const displaySong = currentSong || demoSongs[0];

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
              {displaySong.title}
            </h1>
            <p className="text-[10px] text-muted-foreground">
              {displaySong.artist || `${displaySong.trackCount || 0} tracks`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TimeDisplay currentTime={currentTime} totalDuration={displaySong.duration} />
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
      />

      {/* Main Content - Landscape Layout */}
      <main className="flex-1 px-2 py-1 overflow-hidden min-h-0 flex gap-2">
        {/* Left side - Waveform/Faders */}
        <div className="flex-1 min-w-0">
          <SongViewer
            currentTime={currentTime}
            totalDuration={displaySong.duration}
            isPlaying={isPlaying}
            onSeek={handleSeek}
            tracks={activeTracks}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={isImportedSong ? handleMuteToggle : undefined}
            onSoloToggle={isImportedSong ? handleSoloToggle : undefined}
            sections={getSectionsForSong(currentSongId)}
            onOpenSectionEditor={() => setShowSectionEditor(true)}
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
          clickVolume={clickVolume}
          bpm={effectiveBpm}
          isClickActive={isClickActive}
          currentBeat={currentBeat}
          beatsPerBar={BEATS_PER_BAR}
          onMasterVolumeChange={setMasterVolume}
          onClickVolumeChange={setClickVolume}
          onClickToggle={() => setIsClickActive((prev) => !prev)}
          splitMode={splitMode}
          onSplitModeChange={handleSplitModeChange}
          showSplitControl={isImportedSong}
          instrumentsFaded={instrumentsFaded}
          onInstrumentsFadeToggle={handleInstrumentsFadeToggle}
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
      {showSectionEditor && (
        <SectionEditor
          isOpen={showSectionEditor}
          onClose={() => setShowSectionEditor(false)}
          sections={getSectionsForSong(currentSongId)}
          totalDuration={displaySong.duration}
          onAddSection={(type, startTime) => addSection(currentSongId, type, startTime)}
          onUpdateSection={(sectionId, updates) => updateSection(currentSongId, sectionId, updates)}
          onDeleteSection={(sectionId) => deleteSection(currentSongId, sectionId)}
          onSeekToSection={handleSeek}
        />
      )}
    </div>
  );
}
