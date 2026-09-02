import { Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section, getSectionLabel, getSectionSigla, getSectionColorWithAlpha } from "@/types/section";

interface SectionMarkersProps {
  sections: Section[];
  totalDuration: number;
  currentTime?: number;
  isPlaying?: boolean;
  pendingSectionId?: string | null;
  onSectionSelect?: (sectionId: string, startTime: number) => void;
  onSeekToSection: (startTime: number) => void;
  loopSectionId?: string | null;
  onToggleLoop?: (sectionId: string) => void;
}

export function SectionMarkers({
  sections,
  totalDuration,
  currentTime = 0,
  pendingSectionId,
  onSectionSelect,
  onSeekToSection,
  loopSectionId,
  onToggleLoop,
}: SectionMarkersProps) {
  if (sections.length === 0 || totalDuration <= 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {sections.map((section) => {
        const startPct = (section.startTime / totalDuration) * 100;
        const endPct = (section.endTime / totalDuration) * 100;
        const widthPct = Math.max(endPct - startPct, 0.5);
        const isActive = currentTime >= section.startTime && currentTime < section.endTime;
        const isPending = pendingSectionId === section.id;
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
              isPending && "animate-pending-section ring-2 ring-white z-20",
              !isActive && !isPending && "hover:brightness-110"
            )}
            style={{
              left: `${startPct}%`,
              width: `calc(${widthPct}% - 3px)`,
              backgroundColor: bgColor,
              border: isPending ? "1.5px solid rgba(255, 255, 255, 0.95)" : `1px solid ${borderColor}`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (onSectionSelect) {
                onSectionSelect(section.id, section.startTime);
              } else {
                onSeekToSection(section.startTime);
              }
            }}
          >
            {/* BADGE CIRCULAR COM SIGLA (Canto superior esquerdo) */}
            <div className="absolute top-1.5 left-1.5 z-20 flex items-center">
              <div
                className={cn(
                  "w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center bg-black/80 backdrop-blur-sm shadow-md transition-transform",
                  isActive && "scale-105",
                  isPending && "scale-110 ring-2 ring-white animate-pulse"
                )}
                style={{
                  border: `2px solid ${isPending ? "#ffffff" : section.color}`,
                  boxShadow: isActive || isPending ? `0 0 10px ${isPending ? "#ffffff" : section.color}` : undefined,
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
