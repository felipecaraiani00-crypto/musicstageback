import { useState, useRef, useEffect } from "react";
import { Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section, getSectionLabel, getSectionTag, formatTimeWithMs } from "@/types/section";

interface SectionTimelineBarProps {
  sections: Section[];
  totalDuration: number;
  currentTime: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  loopSectionId?: string | null;
}

export function SectionTimelineBar({
  sections,
  totalDuration,
  currentTime,
  isPlaying,
  onSeek,
  loopSectionId,
}: SectionTimelineBarProps) {
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);
  const barContainerRef = useRef<HTMLDivElement>(null);
  const activePillRef = useRef<HTMLButtonElement>(null);

  // Limpa o estado pendente quando o áudio atinge a seção ou após um momento
  useEffect(() => {
    if (pendingSectionId) {
      const activeSection = sections.find(
        (s) => currentTime >= s.startTime && currentTime < s.endTime
      );
      if (activeSection && activeSection.id === pendingSectionId) {
        setPendingSectionId(null);
      }
    }
  }, [currentTime, pendingSectionId, sections]);

  // Ao clicar em uma seção
  const handleSectionClick = (section: Section) => {
    onSeek(section.startTime);
    if (isPlaying) {
      setPendingSectionId(section.id);
      // Timeout de segurança para a animação pulsante de seleção/espera
      setTimeout(() => {
        setPendingSectionId((current) => (current === section.id ? null : current));
      }, 1500);
    }
  };

  // Auto-scroll suave para manter a seção ativa visível durante reprodução
  useEffect(() => {
    if (activePillRef.current && isPlaying) {
      activePillRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentTime, isPlaying]);

  if (sections.length === 0 || totalDuration <= 0) return null;

  return (
    <div
      ref={barContainerRef}
      className="relative w-full h-8 overflow-hidden bg-card/50 rounded-lg p-0.5 border border-border/40 select-none flex items-center shadow-inner"
    >
      <div className="relative w-full h-full">
        {sections.map((section) => {
          const startPct = totalDuration > 0 ? (section.startTime / totalDuration) * 100 : 0;
          const duration = Math.max(0.1, section.endTime - section.startTime);
          const widthPct = totalDuration > 0 ? (duration / totalDuration) * 100 : 0;
          const isActive = currentTime >= section.startTime && currentTime < section.endTime;
          const isPending = pendingSectionId === section.id && !isActive;
          const isLooping = loopSectionId === section.id;
          const tag = getSectionTag(section, sections);

          return (
            <button
              key={section.id}
              ref={isActive ? activePillRef : null}
              onClick={() => handleSectionClick(section)}
              style={{
                left: `${startPct}%`,
                width: `calc(${widthPct}% - 2px)`,
                backgroundColor: isActive
                  ? section.color
                  : `${section.color}28`, // Fundo translúcido suave com a cor correspondente da seção (ex: verde suave, roxo suave)
                borderColor: isActive
                  ? "#ffffff"
                  : section.color, // Borda nítida e visível na cor correspondente da seção
                boxShadow: isActive
                  ? `0 0 16px ${section.color}`
                  : isPending
                  ? "0 0 12px rgba(245, 158, 11, 0.6)"
                  : undefined,
              }}
              className={cn(
                "absolute top-0.5 bottom-0.5 rounded-md px-1 flex items-center justify-center transition-all text-left truncate border select-none",
                // Estado inativo: translúcido suave com borda visível da cor da seção e texto em alto contraste
                !isActive && !isPending && "text-white/90 font-bold hover:brightness-125",
                // Estado ativo dinâmico: preenchimento sólido vibrante, texto branco em alto contraste e anel luminoso
                isActive && "text-white font-black ring-2 ring-white brightness-110 z-20 scale-[1.01] shadow-lg",
                // Estado pendente/aguardando clique: animação pulsante sutil na borda
                isPending && "ring-2 ring-amber-400 text-amber-300 animate-pulse z-30",
                isLooping && "ring-2 ring-primary"
              )}
              title={`${getSectionLabel(section.type)} (${formatTimeWithMs(section.startTime)} - ${formatTimeWithMs(section.endTime)})`}
            >
              <div className="flex items-center gap-1 min-w-0 justify-center w-full">
                <span className="text-[10px] font-extrabold uppercase tracking-wider truncate drop-shadow-sm">
                  {tag}
                </span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping flex-shrink-0" />
                )}
                {isLooping && (
                  <Repeat className="w-2.5 h-2.5 text-primary-foreground flex-shrink-0 ml-0.5" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
