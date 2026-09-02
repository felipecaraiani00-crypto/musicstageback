import { cn } from "@/lib/utils";
import { Section } from "@/types/section";

interface SectionMarkersProps {
  sections: Section[];
  totalDuration: number;
  onSeekToSection: (startTime: number) => void;
  loopSectionId?: string | null;
  onDeleteSection?: (sectionId: string) => void;
}

export function SectionMarkers({
  sections,
  totalDuration,
  loopSectionId,
}: SectionMarkersProps) {
  if (sections.length === 0 || totalDuration <= 0) return null;

  return (
    <>
      {sections.map((section) => {
        const startPct = (section.startTime / totalDuration) * 100;
        const endPct = (section.endTime / totalDuration) * 100;
        const widthPct = Math.max(endPct - startPct, 0.3);
        const isLooping = loopSectionId === section.id;

        return (
          <div
            key={section.id}
            className="absolute top-0 bottom-0 pointer-events-none z-10"
            style={{ left: `${startPct}%`, width: `${widthPct}%` }}
          >
            {/* Preenchimento colorido/destaque sutil na região da seção sobre a onda */}
            <div
              className={cn(
                "absolute inset-0 opacity-15 pointer-events-none transition-opacity",
                isLooping && "opacity-30"
              )}
              style={{ backgroundColor: section.color }}
            />

            {/* Linha vertical divisória esquerda */}
            <div
              className="absolute top-0 bottom-0 left-0 w-0.5 opacity-70 pointer-events-none"
              style={{ backgroundColor: section.color }}
            />
            {/* Linha vertical divisória direita */}
            <div
              className="absolute top-0 bottom-0 right-0 w-0.5 opacity-70 pointer-events-none"
              style={{ backgroundColor: section.color }}
            />
          </div>
        );
      })}
    </>
  );
}
