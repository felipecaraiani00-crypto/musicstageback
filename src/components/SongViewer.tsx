import { useState } from "react";
import { AudioWaveform, SlidersHorizontal, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";
import { WaveformView } from "./WaveformView";
import { HorizontalFaders, FaderTrack } from "./HorizontalFaders";
import { Section } from "@/types/section";

interface SongViewerProps {
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  tracks: FaderTrack[];
  onVolumeChange: (trackId: string, volume: number) => void;
  onMuteToggle?: (trackId: string) => void;
  onSoloToggle?: (trackId: string) => void;
  sections?: Section[];
  onOpenSectionEditor?: () => void;
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
  sections = [],
  onOpenSectionEditor,
}: SongViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("waveform");

  return (
    <div className="glass-panel p-2 h-full flex flex-col">
      <div className="flex items-center justify-between mb-1 gap-2">
        <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          {viewMode === "waveform" ? "Waveform" : "Faders"}
        </h3>

        <div className="flex items-center gap-1">
          {/* Section editor button */}
          {onOpenSectionEditor && (
            <button
              onClick={onOpenSectionEditor}
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all",
                sections.length > 0
                  ? "bg-primary/20 text-primary hover:bg-primary/30"
                  : "bg-secondary hover:bg-secondary/80 text-secondary-foreground"
              )}
              title="Editar seções"
            >
              <Scissors className="w-3 h-3" />
              <span>{sections.length > 0 ? sections.length : "+"}</span>
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

      <div className="flex-1 min-h-0 animate-fade-in">
        {viewMode === "waveform" ? (
          <WaveformView
            currentTime={currentTime}
            totalDuration={totalDuration}
            isPlaying={isPlaying}
            onSeek={onSeek}
            sections={sections}
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
