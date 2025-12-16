import { useState, useEffect, useCallback } from "react";
import { Settings, Music, List } from "lucide-react";
import { TransportControls } from "@/components/TransportControls";
import { SongViewer } from "@/components/SongViewer";
import { TrackMixer, Track } from "@/components/TrackMixer";
import { MasterControls } from "@/components/MasterControls";
import { TimeDisplay } from "@/components/TimeDisplay";

const initialTracks: Track[] = [
  { id: "1", name: "Click", icon: "🥁", color: "hsl(38, 95%, 55%)", volume: 80, isMuted: false, isSolo: false, level: 0 },
  { id: "2", name: "Drums", icon: "🪘", color: "hsl(0, 72%, 55%)", volume: 85, isMuted: false, isSolo: false, level: 0 },
  { id: "3", name: "Bass", icon: "🎸", color: "hsl(280, 70%, 55%)", volume: 75, isMuted: false, isSolo: false, level: 0 },
  { id: "4", name: "Keys", icon: "🎹", color: "hsl(200, 70%, 45%)", volume: 70, isMuted: false, isSolo: false, level: 0 },
  { id: "5", name: "Guitar", icon: "🎵", color: "hsl(145, 70%, 45%)", volume: 65, isMuted: false, isSolo: false, level: 0 },
  { id: "6", name: "Vocals", icon: "🎤", color: "hsl(320, 60%, 50%)", volume: 90, isMuted: false, isSolo: false, level: 0 },
];

const TOTAL_DURATION = 192; // seconds
const BPM = 120;
const BEATS_PER_BAR = 4;

export default function Index() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [masterVolume, setMasterVolume] = useState(80);
  const [clickVolume, setClickVolume] = useState(75);
  const [isClickActive, setIsClickActive] = useState(true);
  const [currentBeat, setCurrentBeat] = useState(1);

  // Simulate playback
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev >= TOTAL_DURATION) {
          setIsPlaying(false);
          return 0;
        }
        return prev + 0.1;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Simulate beat counter
  useEffect(() => {
    if (!isPlaying) return;

    const beatDuration = 60 / BPM;
    const interval = setInterval(() => {
      setCurrentBeat((prev) => (prev % BEATS_PER_BAR) + 1);
    }, beatDuration * 1000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Simulate level meters
  useEffect(() => {
    if (!isPlaying) {
      setTracks((prev) => prev.map((t) => ({ ...t, level: 0 })));
      return;
    }

    const interval = setInterval(() => {
      setTracks((prev) =>
        prev.map((track) => ({
          ...track,
          level: track.isMuted
            ? 0
            : Math.min(100, Math.max(20, track.volume * 0.8 + Math.random() * 40 - 20)),
        }))
      );
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying]);

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
    setCurrentTime((prev) => Math.min(TOTAL_DURATION, prev + 10));
  }, []);

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleVolumeChange = useCallback((trackId: string, volume: number) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, volume } : t))
    );
  }, []);

  const handleMuteToggle = useCallback((trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, isMuted: !t.isMuted } : t))
    );
  }, []);

  const handleSoloToggle = useCallback((trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, isSolo: !t.isSolo } : t))
    );
  }, []);

  // Convert tracks for faders view
  const faderTracks = tracks.map((t) => ({
    id: t.id,
    name: t.name,
    icon: t.icon,
    color: t.color,
    volume: t.volume,
  }));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
          <button className="transport-btn min-w-[44px] min-h-[44px]">
            <List className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Music className="w-5 h-5 text-primary" />
              Amazing Grace
            </h1>
            <p className="text-xs text-muted-foreground">Gospel Arrangement</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <TimeDisplay currentTime={currentTime} totalDuration={TOTAL_DURATION} />
          <button className="transport-btn min-w-[44px] min-h-[44px]">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 space-y-4 overflow-y-auto min-h-0">
        {/* Song Viewer (Waveform / Faders toggle) */}
        <SongViewer
          currentTime={currentTime}
          totalDuration={TOTAL_DURATION}
          isPlaying={isPlaying}
          onSeek={handleSeek}
          tracks={faderTracks}
          onVolumeChange={handleVolumeChange}
        />

        {/* Track Mixer */}
        <TrackMixer
          tracks={tracks}
          onVolumeChange={handleVolumeChange}
          onMuteToggle={handleMuteToggle}
          onSoloToggle={handleSoloToggle}
        />
      </main>

      {/* Footer Controls */}
      <footer className="border-t border-border bg-card/80 backdrop-blur-sm p-4 space-y-4">
        {/* Master Controls */}
        <MasterControls
          masterVolume={masterVolume}
          clickVolume={clickVolume}
          bpm={BPM}
          isClickActive={isClickActive}
          currentBeat={currentBeat}
          beatsPerBar={BEATS_PER_BAR}
          onMasterVolumeChange={setMasterVolume}
          onClickVolumeChange={setClickVolume}
          onClickToggle={() => setIsClickActive((prev) => !prev)}
        />

        {/* Transport */}
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
    </div>
  );
}
