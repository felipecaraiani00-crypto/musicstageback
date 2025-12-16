import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { SongSection, SectionType } from "./SectionEditor";

const sectionStyles: Record<SectionType, { label: string; color: string; bg: string }> = {
  intro: { label: "INTRO", color: "text-purple-400", bg: "bg-purple-500/20" },
  verse: { label: "VERSO", color: "text-blue-400", bg: "bg-blue-500/20" },
  "pre-chorus": { label: "PRÉ-REFRÃO", color: "text-yellow-400", bg: "bg-yellow-500/20" },
  chorus: { label: "REFRÃO", color: "text-green-400", bg: "bg-green-500/20" },
  bridge: { label: "PONTE", color: "text-orange-400", bg: "bg-orange-500/20" },
  solo: { label: "SOLO", color: "text-red-400", bg: "bg-red-500/20" },
  interlude: { label: "INTERLÚDIO", color: "text-cyan-400", bg: "bg-cyan-500/20" },
  outro: { label: "OUTRO", color: "text-pink-400", bg: "bg-pink-500/20" },
};

interface CurrentSectionIndicatorProps {
  sections: SongSection[];
  currentTime: number;
  isPlaying: boolean;
}

export function CurrentSectionIndicator({ 
  sections, 
  currentTime, 
  isPlaying 
}: CurrentSectionIndicatorProps) {
  const currentSection = useMemo(() => {
    return sections.find(
      section => currentTime >= section.startTime && currentTime <= section.endTime
    );
  }, [sections, currentTime]);

  if (!currentSection || sections.length === 0) {
    return null;
  }

  const style = sectionStyles[currentSection.type];

  return (
    <div 
      className={cn(
        "px-3 py-1 rounded-full border transition-all duration-300",
        style.bg,
        style.color,
        "border-current/30",
        isPlaying ? "animate-pulse" : ""
      )}
    >
      <span className="text-xs font-bold tracking-wider">
        {style.label}
      </span>
    </div>
  );
}
