import { Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section, getSectionLabel, getSectionSigla } from "@/types/section";

interface SectionMarkersProps {
  sections: Section[];
  totalDuration: number;
  currentTime?: number;
  isPlaying?: boolean;
  onSeekToSection: (startTime: number) => void;
  loopSectionId?: string | null;
  onToggleLoop?: (sectionId: string) => void;
}

export function SectionMarkers({
  sections,
  totalDuration,
  currentTime = 0,
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
        const isLooping = loopSectionId === section.id;
        const sigla = getSectionSigla(section, sections);

        return (
          <div
            key={section.id}
            className={cn(
              "absolute top-1 bottom-1 rounded-xl transition-all duration-200 select-none overflow-hidden pointer-events-auto cursor-pointer",
              isActive
                ? "ring-1 ring-white/70 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                : "hover:brightness-125"
            )}
            style={{
              left: `${startPct}%`,
              width: `calc(${widthPct}% - 3px)`,
              backgroundColor: isActive ? `${section.color}35` : `${section.color}1c`, // Fundo translúcido escuro na cor temática da seção
              border: `1.5px solid ${isActive ? "rgba(255, 255, 255, 0.5)" : section.color + "60"}`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSeekToSection(section.startTime);
            }}
          >
            {/* BADGE CIRCULAR COM SIGLA (Canto superior esquerdo, conforme foto: V1 roxo, R1 laranja) */}
            <div className="absolute top-1.5 left-1.5 z-20 flex items-center">
              <div
                className={cn(
                  "w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center bg-black/80 backdrop-blur-sm shadow-md transition-transform",
                  isActive && "scale-105"
                )}
                style={{
                  border: `2px solid ${section.color}`,
                  boxShadow: isActive ? `0 0 10px ${section.color}` : undefined,
                }}
                title={`Ir para ${getSectionLabel(section.type)}`}
              >
                <span
                  className="text-[9px] sm:text-[10px] font-black tracking-tight"
                  style={{ color: section.color }}
                >
                  {sigla}
                </span>
              </div>
            </div>

            {/* ÍCONE DE LOOP (Canto superior direito) */}
            {onToggleLoop && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLoop(section.id);
                }}
                className={cn(
                  "absolute top-1.5 right-1.5 z-20 p-1 rounded-md transition-all",
                  isLooping
                    ? "text-primary bg-primary/20 ring-1 ring-primary"
                    : "text-white/40 hover:text-white/90 hover:bg-white/10"
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
