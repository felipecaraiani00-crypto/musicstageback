import { useState } from "react";
import { AudioWaveform, SlidersHorizontal, Headphones, RotateCcw } from "lucide-react";
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
  onMuteToggle?: (trackId: string) => void;
  onSoloToggle?: (trackId: string) => void;
  onSplitLR?: (clickToLeft: boolean) => void;
  onResetPans?: () => void;
  isSplit?: boolean;
}

type ViewMode = "waveform" | "faders";

export function SongViewer({
  currentTime,
  totalDuration,
  isPlaying,
  onSeek,
  tracks,
  onVolumeChange,
  onMuteToggle,
  onSoloToggle,
  onSplitLR,
  onResetPans,
  isSplit = false,
}: SongViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("waveform");

  return (
    <div className="glass-panel p-2 h-full flex flex-col">
      <div className="flex items-center justify-between mb-1 gap-2">
        <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          {viewMode === "waveform" ? "Waveform" : "Faders"}
        </h3>

        <div className="flex items-center gap-1">
          {/* Split L/R Button */}
          {viewMode === "faders" && onSplitLR && (
            <button
              onClick={() => isSplit ? onResetPans?.() : onSplitLR(true)}
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all",
                isSplit 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-secondary hover:bg-secondary/80 text-secondary-foreground"
              )}
              title={isSplit ? "Centralizar Pan" : "Click L / Instrumentos R"}
            >
              {isSplit ? (
                <>
                  <RotateCcw className="w-3 h-3" />
                  <span>Centro</span>
                </>
              ) : (
                <>
                  <Headphones className="w-3 h-3" />
                  <span>L|R</span>
                </>
              )}
            </button>
          )}

          {/* View toggle button */}
          <button
            onClick={() => setViewMode(viewMode === "waveform" ? "faders" : "waveform")}
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all",
              "bg-secondary hover:bg-secondary/80 text-secondary-foreground"
            )}
          >
            {viewMode === "waveform" ? (
              <>
                <SlidersHorizontal className="w-3 h-3" />
                <span>Faders</span>
              </>
            ) : (
              <>
                <AudioWaveform className="w-3 h-3" />
                <span>Wave</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* View content */}
      <div className="flex-1 min-h-0 animate-fade-in">
        {viewMode === "waveform" ? (
          <WaveformView
            currentTime={currentTime}
            totalDuration={totalDuration}
            isPlaying={isPlaying}
            onSeek={onSeek}
          />
        ) : (
          <HorizontalFaders 
            tracks={tracks} 
            onVolumeChange={onVolumeChange}
            onMuteToggle={onMuteToggle}
            onSoloToggle={onSoloToggle}
          />
        )}
      </div>
    </div>
  );
}
