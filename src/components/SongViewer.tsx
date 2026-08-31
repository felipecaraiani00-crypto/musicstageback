import { useState, useRef, useEffect } from "react";
import { AudioWaveform, SlidersHorizontal, Scissors, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { WaveformView } from "./WaveformView";
import { HorizontalFaders, FaderTrack } from "./HorizontalFaders";
import { Section, getSectionLabel } from "@/types/section";

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
}: SongViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("waveform");
  const sectionRowRef = useRef<HTMLDivElement>(null);
  const activeSectionRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll active section button into view when playing
  useEffect(() => {
    if (activeSectionRef.current && isPlaying) {
      activeSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentTime, isPlaying]);

  return (
    <div className="glass-panel p-2 h-full flex flex-col">
      {/* Top bar */}
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

      {/* Sections Row / Barra de Seções */}
      {sections.length > 0 ? (
        <div
          ref={sectionRowRef}
          className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin py-1 mb-1.5 px-0.5 min-h-[36px]"
        >
          {sections.map((section) => {
            const isActive = currentTime >= section.startTime && currentTime < section.endTime;
            const isLooping = loopSectionId === section.id;
            return (
              <button
                key={section.id}
                ref={isActive ? activeSectionRef : null}
                onClick={() => onSeek(section.startTime)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap shadow-sm select-none flex-shrink-0",
                  isActive
                    ? "ring-2 ring-white scale-105 shadow-[0_0_14px_rgba(255,255,255,0.7)] brightness-125 font-bold z-10"
                    : "opacity-80 hover:opacity-100 hover:scale-102",
                  isLooping && "ring-2 ring-primary"
                )}
                style={{
                  backgroundColor: section.color,
                  color: "#ffffff",
                  textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                }}
                title={`Ir para ${getSectionLabel(section.type)} (${Math.floor(section.startTime / 60)}:${Math.floor(section.startTime % 60).toString().padStart(2, '0')})`}
              >
                <span>{getSectionLabel(section.type)}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-between px-2.5 py-1 mb-1.5 rounded-md bg-secondary/30 border border-border/40 text-[11px] text-muted-foreground min-h-[32px]">
          <span>Nenhuma seção cadastrada</span>
          {onOpenSectionEditor && (
            <button
              onClick={onOpenSectionEditor}
              className="text-primary hover:underline font-medium text-[11px] flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>Adicionar Seção</span>
            </button>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 animate-fade-in">
        {viewMode === "waveform" ? (
          <WaveformView
            currentTime={currentTime}
            totalDuration={totalDuration}
            isPlaying={isPlaying}
            onSeek={onSeek}
            sections={sections}
            loopSectionId={loopSectionId}
            onToggleLoop={onToggleLoop}
            onDeleteSection={onDeleteSection}
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
