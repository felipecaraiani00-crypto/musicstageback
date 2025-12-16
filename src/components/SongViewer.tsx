import { useState } from "react";
import { AudioWaveform, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { WaveformView } from "./WaveformView";
import { HorizontalFaders, FaderTrack } from "./HorizontalFaders";

interface SongViewerProps {
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  tracks: FaderTrack[];
  onVolumeChange: (trackId: string, volume: number) => void;
}

type ViewMode = "waveform" | "faders";

export function SongViewer({
  currentTime,
  totalDuration,
  isPlaying,
  onSeek,
  tracks,
  onVolumeChange,
}: SongViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("waveform");

  return (
    <div className="glass-panel p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {viewMode === "waveform" ? "Waveform" : "Faders"}
        </h3>

        <button
          onClick={() => setViewMode(viewMode === "waveform" ? "faders" : "waveform")}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all",
            "bg-secondary hover:bg-secondary/80 text-secondary-foreground"
          )}
        >
          {viewMode === "waveform" ? (
            <>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Faders</span>
            </>
          ) : (
            <>
              <AudioWaveform className="w-3.5 h-3.5" />
              <span>Wave</span>
            </>
          )}
        </button>
      </div>

      {/* View content with animation */}
      <div className="animate-fade-in">
        {viewMode === "waveform" ? (
          <WaveformView
            currentTime={currentTime}
            totalDuration={totalDuration}
            isPlaying={isPlaying}
            onSeek={onSeek}
          />
        ) : (
          <HorizontalFaders tracks={tracks} onVolumeChange={onVolumeChange} />
        )}
      </div>
    </div>
  );
}
