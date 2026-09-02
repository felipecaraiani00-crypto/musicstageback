import { useRef } from "react";
import { Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section, getSectionLabel, getSectionSigla, getSectionColorWithAlpha } from "@/types/section";

export type TransitionMode = "end_of_section" | "next_bar";

interface SectionMarkersProps {
  sections: Section[];
  totalDuration: number;
  currentTime?: number;
  isPlaying?: boolean;
  pendingSectionId?: string | null;
  pendingMode?: TransitionMode | null;
  onSectionSelect?: (sectionId: string, startTime: number, mode: TransitionMode) => void;
  onSeekToSection: (startTime: number) => void;
  loopSectionId?: string | null;
  onToggleLoop?: (sectionId: string) => void;
}

export function SectionMarkers({
  sections,
  totalDuration,
  currentTime = 0,
  isPlaying = false,
  pendingSectionId,
  pendingMode = "end_of_section",
  onSectionSelect,
  onSeekToSection,
  loopSectionId,
  onToggleLoop,
}: SectionMarkersProps) {
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastClickedIdRef = useRef<string | null>(null);

  if (sections.length === 0 || totalDuration <= 0) return null;

  const handleBlockClick = (e: React.MouseEvent, section: Section) => {
    e.stopPropagation();

    // Se o áudio não estiver tocando, salta imediatamente
    if (!isPlaying) {
      if (onSectionSelect) {
        onSectionSelect(section.id, section.startTime, "end_of_section");
      } else {
        onSeekToSection(section.startTime);
      }
      return;
    }

    // Se já havia um clique recente nesta mesma seção -> DUPLO CLIQUE (Next Bar)!
    if (clickTimerRef.current && lastClickedIdRef.current === section.id) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      lastClickedIdRef.current = null;
      if (onSectionSelect) {
        onSectionSelect(section.id, section.startTime, "next_bar");
      }
    } else {
      // 1º clique: aguarda 240ms para ver se haverá um segundo clique.
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
      lastClickedIdRef.current = section.id;
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        lastClickedIdRef.current = null;
        if (onSectionSelect) {
          onSectionSelect(section.id, section.startTime, "end_of_section");
        } else {
          onSeekToSection(section.startTime);
        }
      }, 240);
    }
  };

  const handleBlockDoubleClick = (e: React.MouseEvent, section: Section) => {
    e.stopPropagation();
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      lastClickedIdRef.current = null;
    }
    if (isPlaying && onSectionSelect) {
      onSectionSelect(section.id, section.startTime, "next_bar");
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {sections.map((section) => {
        const startPct = (section.startTime / totalDuration) * 100;
        const endPct = (section.endTime / totalDuration) * 100;
        const widthPct = Math.max(endPct - startPct, 0.5);
        const isActive = currentTime >= section.startTime && currentTime < section.endTime;
        const isPending = pendingSectionId === section.id;
        const isNextBar = isPending && pendingMode === "next_bar";
        const isLooping = loopSectionId === section.id;
        const sigla = getSectionSigla(section, sections);

        // Fundo translúcido na cor temática da tag (0.15 em repouso, 0.28 ativa/agendada)
        const bgColor = getSectionColorWithAlpha(section.color, isActive || isPending ? 0.28 : 0.15);
        // Borda suave na cor temática da tag (0.4 em repouso, 0.8 ativa)
        const borderColor = getSectionColorWithAlpha(section.color, isActive ? 0.8 : 0.4);

        return (
          <div
            key={section.id}
            className={cn(
              "absolute top-1 bottom-1 rounded-xl transition-all duration-200 select-none overflow-hidden pointer-events-auto cursor-pointer",
              isActive && "ring-1 ring-white/70 shadow-[0_0_20px_rgba(255,255,255,0.15)]",
              isPending && isNextBar && "animate-pending-next-bar ring-2 ring-white z-20",
              isPending && !isNextBar && "animate-pending-section ring-2 ring-white z-20",
              !isActive && !isPending && "hover:brightness-110"
            )}
            style={{
              left: `${startPct}%`,
              width: `calc(${widthPct}% - 3px)`,
              backgroundColor: bgColor,
              border: isPending ? "1.5px solid rgba(255, 255, 255, 0.95)" : `1px solid ${borderColor}`,
            }}
            onClick={(e) => handleBlockClick(e, section)}
            onDoubleClick={(e) => handleBlockDoubleClick(e, section)}
          >
            {/* BADGE CIRCULAR COM SIGLA (Canto superior esquerdo) */}
            <div className="absolute top-1.5 left-1.5 z-20 flex items-center">
              <div
                className={cn(
                  "w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center bg-black/80 backdrop-blur-sm shadow-md transition-transform",
                  isActive && "scale-105",
                  isPending && !isNextBar && "scale-110 ring-2 ring-white animate-pulse",
                  isPending && isNextBar && "scale-115 ring-2 ring-white animate-pulse bg-white/20"
                )}
                style={{
                  border: `2px solid ${isPending ? "#ffffff" : section.color}`,
                  boxShadow: isActive || isPending ? `0 0 12px ${isPending ? "#ffffff" : section.color}` : undefined,
                }}
                title={`Ir para ${getSectionLabel(section.type)}`}
              >
                <span
                  className="text-[9px] sm:text-[10px] font-black tracking-tight"
                  style={{ color: isPending ? "#ffffff" : section.color }}
                >
                  {sigla}
                </span>
              </div>
            </div>

            {/* ÍCONE DE LOOP (Canto superior direito: opacity 0.5 em repouso, opacity 1 quando ativado) */}
            {onToggleLoop && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLoop(section.id);
                }}
                className={cn(
                  "absolute top-1.5 right-1.5 z-20 p-1 rounded-md transition-all select-none",
                  isLooping
                    ? "opacity-100 text-primary bg-primary/20 ring-1 ring-primary shadow-sm"
                    : "opacity-50 hover:opacity-80 text-white"
                )}
                title={isLooping ? "Desativar loop desta seção" : "Repetir seção (Loop)"}
              >
                <Repeat className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
