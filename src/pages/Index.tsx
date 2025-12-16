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
import { FaderTrack } from "@/components/HorizontalFaders";

const initialTracks: FaderTrack[] = [
  { id: "1", name: "Click", icon: "🥁", color: "hsl(38, 95%, 55%)", volume: 80 },
  { id: "2", name: "Drums", icon: "🪘", color: "hsl(0, 72%, 55%)", volume: 85 },
  { id: "3", name: "Bass", icon: "🎸", color: "hsl(280, 70%, 55%)", volume: 75 },
  { id: "4", name: "Keys", icon: "🎹", color: "hsl(200, 70%, 45%)", volume: 70 },
  { id: "5", name: "Guitar", icon: "🎵", color: "hsl(145, 70%, 45%)", volume: 65 },
  { id: "6", name: "Vocals", icon: "🎤", color: "hsl(320, 60%, 50%)", volume: 90 },
];

// All available songs in library
const allSongs: Song[] = [
  { id: "1", title: "Amazing Grace", artist: "Gospel Arrangement", duration: 192, bpm: 120 },
  { id: "2", title: "How Great Is Our God", artist: "Chris Tomlin", duration: 245, bpm: 78 },
  { id: "3", title: "10,000 Reasons", artist: "Matt Redman", duration: 330, bpm: 73 },
  { id: "4", title: "What A Beautiful Name", artist: "Hillsong Worship", duration: 285, bpm: 68 },
  { id: "5", title: "Reckless Love", artist: "Cory Asbury", duration: 312, bpm: 76 },
  { id: "6", title: "Way Maker", artist: "Sinach", duration: 295, bpm: 68 },
  { id: "7", title: "Goodness of God", artist: "Bethel Music", duration: 275, bpm: 63 },
  { id: "8", title: "Build My Life", artist: "Housefires", duration: 258, bpm: 72 },
  { id: "9", title: "Great Are You Lord", artist: "All Sons & Daughters", duration: 312, bpm: 66 },
  { id: "10", title: "Oceans", artist: "Hillsong United", duration: 485, bpm: 66 },
  { id: "11", title: "King of Kings", artist: "Hillsong Worship", duration: 378, bpm: 72 },
  { id: "12", title: "Who You Say I Am", artist: "Hillsong Worship", duration: 258, bpm: 74 },
  { id: "13", title: "Living Hope", artist: "Phil Wickham", duration: 312, bpm: 69 },
  { id: "14", title: "Graves Into Gardens", artist: "Elevation Worship", duration: 346, bpm: 72 },
  { id: "15", title: "The Blessing", artist: "Kari Jobe", duration: 425, bpm: 68 },
];

const BEATS_PER_BAR = 4;

export default function Index() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [tracks, setTracks] = useState<FaderTrack[]>(initialTracks);
  const [masterVolume, setMasterVolume] = useState(80);
  const [clickVolume, setClickVolume] = useState(75);
  const [isClickActive, setIsClickActive] = useState(true);
  const [currentBeat, setCurrentBeat] = useState(1);
  
  // Library & Setlist state
  const [librarySongs, setLibrarySongs] = useState<Song[]>(allSongs);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>(["1", "2", "3", "4", "5"]);
  const [currentSongId, setCurrentSongId] = useState<string>("1");

  // Modal states
  const [showSettings, setShowSettings] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Derived state
  const setlistSongs = librarySongs.filter((s) => selectedSongIds.includes(s.id));
  const currentSong = librarySongs.find((s) => s.id === currentSongId) || setlistSongs[0];

  // Simulate playback
  useEffect(() => {
    if (!isPlaying || !currentSong) return;

    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev >= currentSong.duration) {
          setIsPlaying(false);
          return 0;
        }
        return prev + 0.1;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, currentSong]);

  // Simulate beat counter
  useEffect(() => {
    if (!isPlaying || !currentSong) return;

    const beatDuration = 60 / currentSong.bpm;
    const interval = setInterval(() => {
      setCurrentBeat((prev) => (prev % BEATS_PER_BAR) + 1);
    }, beatDuration * 1000);

    return () => clearInterval(interval);
  }, [isPlaying, currentSong]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setCurrentBeat(1);
  }, []);

  const handlePrev = useCallback(() => {
    setCurrentTime((prev) => Math.max(0, prev - 10));
  }, []);

  const handleNext = useCallback(() => {
    if (currentSong) {
      setCurrentTime((prev) => Math.min(currentSong.duration, prev + 10));
    }
  }, [currentSong]);

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleVolumeChange = useCallback((trackId: string, volume: number) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, volume } : t))
    );
  }, []);

  const handleSongSelect = useCallback((song: Song) => {
    setCurrentSongId(song.id);
    setCurrentTime(0);
    setIsPlaying(false);
    setCurrentBeat(1);
  }, []);

  const handleToggleLibrarySong = useCallback((songId: string) => {
    setSelectedSongIds((prev) =>
      prev.includes(songId)
        ? prev.filter((id) => id !== songId)
        : [...prev, songId]
    );
  }, []);

  const handleImportSongs = useCallback((newSongs: Song[]) => {
    setLibrarySongs((prev) => [...prev, ...newSongs]);
    // Auto-select imported songs
    setSelectedSongIds((prev) => [...prev, ...newSongs.map((s) => s.id)]);
  }, []);

  if (!currentSong) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Selecione músicas na biblioteca</p>
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
            <p className="text-[10px] text-muted-foreground">{currentSong.artist}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TimeDisplay currentTime={currentTime} totalDuration={currentSong.duration} />
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

      {/* Main Content */}
      <main className="flex-1 p-3 overflow-hidden min-h-0 flex flex-col gap-3">
        <SongViewer
          currentTime={currentTime}
          totalDuration={currentSong.duration}
          isPlaying={isPlaying}
          onSeek={handleSeek}
          tracks={tracks}
          onVolumeChange={handleVolumeChange}
        />

        {/* Setlist */}
        <SongList
          songs={setlistSongs}
          currentSongId={currentSongId}
          onSongSelect={handleSongSelect}
        />
      </main>

      {/* Footer Controls */}
      <footer className="border-t border-border bg-card/80 backdrop-blur-sm px-3 py-2 space-y-2">
        <MasterControls
          masterVolume={masterVolume}
          clickVolume={clickVolume}
          bpm={currentSong.bpm}
          isClickActive={isClickActive}
          currentBeat={currentBeat}
          beatsPerBar={BEATS_PER_BAR}
          onMasterVolumeChange={setMasterVolume}
          onClickVolumeChange={setClickVolume}
          onClickToggle={() => setIsClickActive((prev) => !prev)}
        />

        <div className="flex justify-center">
          <TransportControls
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onStop={handleStop}
            onPrev={handlePrev}
            onNext={handleNext}
          />
        </div>
      </footer>

      {/* Library Modal */}
      {showLibrary && (
        <MusicLibrary
          songs={librarySongs}
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
    </div>
  );
}
