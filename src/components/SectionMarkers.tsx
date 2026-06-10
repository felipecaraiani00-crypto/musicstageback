import { cn } from "@/lib/utils";
import { Section, getSectionLabel } from "@/types/section";

interface SectionMarkersProps {
  sections: Section[];
  totalDuration: number;
  onSeekToSection: (startTime: number) => void;
  loopSectionId?: string | null;
  onToggleLoop?: (sectionId: string) => void;
  onDeleteSection?: (sectionId: string) => void;
}

export function SectionMarkers({
  sections,
  totalDuration,
  onSeekToSection,
  loopSectionId,
  onToggleLoop,
  onDeleteSection,
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
            className="absolute top-0 bottom-0 group z-10"
            style={{ left: `${startPct}%`, width: `${widthPct}%` }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onSeekToSection(section.startTime);
            }}
          >
            {/* Colored band over the range */}
            <div
              className={cn(
                "absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none",
                isLooping && "opacity-40"
              )}
              style={{ backgroundColor: section.color }}
            />

            {/* Left edge marker */}
            <div
              className="absolute top-0 bottom-0 left-0 w-0.5 opacity-80"
              style={{ backgroundColor: section.color }}
            />
            {/* Right edge marker */}
            <div
              className="absolute top-0 bottom-0 right-0 w-0.5 opacity-80"
              style={{ backgroundColor: section.color }}
            />

            {/* Label badge with quick actions */}
            <div
              className={cn(
                "absolute top-0 left-0.5 flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold uppercase whitespace-nowrap shadow-md",
                "opacity-80 group-hover:opacity-100 transition-all",
                isLooping && "ring-1 ring-white"
              )}
              style={{ backgroundColor: section.color, color: "white" }}
            >
              <span>{getSectionLabel(section.type)}</span>
              {onToggleLoop && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLoop(section.id);
                  }}
                  className={cn(
                    "ml-0.5 px-1 rounded leading-none",
                    isLooping ? "bg-white/30" : "hover:bg-white/20"
                  )}
                  title={isLooping ? "Parar loop" : "Repetir"}
                >
                  🔁
                </button>
              )}
              {onDeleteSection && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSection(section.id);
                  }}
                  className="px-1 rounded leading-none hover:bg-white/20"
                  title="Excluir"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
