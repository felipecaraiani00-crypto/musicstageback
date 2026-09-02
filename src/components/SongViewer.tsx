import { useState } from "react";
import { AudioWaveform, SlidersHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { WaveformView } from "./WaveformView";
import { HorizontalFaders, FaderTrack } from "./HorizontalFaders";
import { Section } from "@/types/section";
import { TransitionMode } from "./SectionMarkers";

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
  loopSectionId?: string | null;
  onToggleLoop?: (sectionId: string) => void;
  onDeleteSection?: (sectionId: string) => void;
  pendingSectionId?: string | null;
  pendingMode?: TransitionMode | null;
  onSectionSelect?: (sectionId: string, startTime: number, mode: TransitionMode) => void;
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
  loopSectionId,
  onToggleLoop,
  onDeleteSection,
  pendingSectionId,
  pendingMode,
  onSectionSelect,
}: SongViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("waveform");

  return (
    <div className="glass-panel p-2 h-full flex flex-col">
      {/* Top action bar: botões discretos alinhados no topo */}
      <div className="flex items-center justify-end mb-1 gap-1.5 flex-shrink-0">
        {onOpenSectionEditor && (
          <button
            onClick={onOpenSectionEditor}
            className="flex items-center gap-1 px-2.5 rounded-lg text-[10px] font-semibold bg-secondary/60 hover:bg-secondary text-secondary-foreground transition-all border border-border/50 select-none h-7 shadow-sm"
            title="Adicionar ou editar seções"
          >
            <Plus className="w-3.5 h-3.5 text-primary" />
            <span>+ Adicionar Seção</span>
            {sections.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-primary/20 text-primary rounded-full text-[9px] font-bold">
                {sections.length}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => setViewMode(viewMode === "waveform" ? "faders" : "waveform")}
          className="flex items-center gap-1 px-2.5 rounded-lg text-[10px] font-semibold bg-secondary/60 hover:bg-secondary text-secondary-foreground transition-all border border-border/50 select-none h-7 shadow-sm"
          title="Alternar entre Waveform e Faders"
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

      {/* Container da Waveform / Faders com formato panorâmico centralizado verticalmente */}
      <div className="flex-1 min-h-0 flex flex-col justify-center animate-fade-in">
        {viewMode === "waveform" ? (
          <div className="w-full h-[120px] sm:h-[140px] md:h-[160px] my-auto">
            <WaveformView
              currentTime={currentTime}
              totalDuration={totalDuration}
              isPlaying={isPlaying}
              pendingSectionId={pendingSectionId}
              pendingMode={pendingMode}
              onSectionSelect={onSectionSelect}
              onSeek={onSeek}
              sections={sections}
              loopSectionId={loopSectionId}
              onToggleLoop={onToggleLoop}
              onDeleteSection={onDeleteSection}
            />
          </div>
        ) : (
          <div className="w-full h-full flex flex-col">
            <div className="flex-1 min-h-0">
              <HorizontalFaders 
                tracks={tracks} 
                onVolumeChange={onVolumeChange}
                onMuteToggle={onMuteToggle}
                onSoloToggle={onSoloToggle}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
