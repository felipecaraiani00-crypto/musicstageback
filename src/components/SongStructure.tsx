import { cn } from "@/lib/utils";

export type SectionType = "intro" | "verse" | "chorus" | "bridge" | "outro";

export interface Section {
  id: string;
  type: SectionType;
  label: string;
  duration: number; // in seconds
  startTime: number;
}

interface SongStructureProps {
  sections: Section[];
  currentTime: number;
  totalDuration: number;
  onSectionClick: (section: Section) => void;
}

const sectionColors: Record<SectionType, string> = {
  intro: "bg-section-intro",
  verse: "bg-section-verse",
  chorus: "bg-section-chorus",
  bridge: "bg-section-bridge",
  outro: "bg-section-outro",
};

export function SongStructure({
  sections,
  currentTime,
  totalDuration,
  onSectionClick,
}: SongStructureProps) {
  const getCurrentSection = () => {
    return sections.find(
      (s) => currentTime >= s.startTime && currentTime < s.startTime + s.duration
    );
  };

  const currentSection = getCurrentSection();
  const progressPercent = (currentTime / totalDuration) * 100;

  return (
    <div className="glass-panel p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Song Structure
        </h3>
        {currentSection && (
          <span
            className={cn(
              "section-badge text-primary-foreground",
              sectionColors[currentSection.type]
            )}
          >
            {currentSection.label}
          </span>
        )}
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="flex gap-1 h-12 rounded-lg overflow-hidden">
          {sections.map((section) => {
            const widthPercent = (section.duration / totalDuration) * 100;
            const isActive = currentSection?.id === section.id;
            
            return (
              <button
                key={section.id}
                onClick={() => onSectionClick(section)}
                style={{ width: `${widthPercent}%` }}
                className={cn(
                  "relative flex items-center justify-center transition-all duration-200",
                  sectionColors[section.type],
                  isActive ? "opacity-100 scale-y-100" : "opacity-60 hover:opacity-80",
                  "min-w-[40px]"
                )}
              >
                <span className="text-xs font-semibold text-primary-foreground/90 truncate px-1">
                  {section.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-foreground shadow-lg transition-all duration-100"
          style={{ left: `${progressPercent}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-foreground rotate-45" />
        </div>
      </div>

      {/* Section badges */}
      <div className="flex flex-wrap gap-2">
        {(["intro", "verse", "chorus", "bridge", "outro"] as SectionType[]).map((type) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={cn("w-3 h-3 rounded-sm", sectionColors[type])} />
            <span className="text-xs text-muted-foreground capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
