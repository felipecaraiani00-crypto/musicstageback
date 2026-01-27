import { cn } from "@/lib/utils";
import { Section, getSectionLabel } from "@/types/section";

interface SectionMarkersProps {
  sections: Section[];
  totalDuration: number;
  onSeekToSection: (startTime: number) => void;
}

export function SectionMarkers({
  sections,
  totalDuration,
  onSeekToSection,
}: SectionMarkersProps) {
  if (sections.length === 0 || totalDuration <= 0) return null;

  return (
    <>
      {sections.map((section) => {
        const positionPercent = (section.startTime / totalDuration) * 100;

        return (
          <div
            key={section.id}
            className="absolute top-0 bottom-0 group cursor-pointer z-10"
            style={{ left: `${positionPercent}%` }}
            onClick={(e) => {
              e.stopPropagation();
              onSeekToSection(section.startTime);
            }}
          >
            {/* Vertical line marker */}
            <div
              className="w-0.5 h-full opacity-70 group-hover:opacity-100 transition-opacity"
              style={{ backgroundColor: section.color }}
            />

            {/* Label badge */}
            <div
              className={cn(
                "absolute -top-0 left-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase whitespace-nowrap",
                "opacity-80 group-hover:opacity-100 transition-all group-hover:scale-105",
                "shadow-md"
              )}
              style={{
                backgroundColor: section.color,
                color: "white",
              }}
            >
              {getSectionLabel(section.type)}
            </div>

            {/* Hover effect - wider click area */}
            <div className="absolute -left-2 top-0 bottom-0 w-4 opacity-0" />
          </div>
        );
      })}
    </>
  );
}
