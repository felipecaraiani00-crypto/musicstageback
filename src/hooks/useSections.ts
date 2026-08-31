import { useState, useCallback } from "react";
import { Section, getSectionColor } from "@/types/section";

const defaultDemoSections: Record<string, Section[]> = {
  "demo-1": [
    { id: "s1-1", songId: "demo-1", type: "intro", startTime: 0, endTime: 16, color: getSectionColor("intro") },
    { id: "s1-2", songId: "demo-1", type: "verse", startTime: 16, endTime: 48, color: getSectionColor("verse") },
    { id: "s1-3", songId: "demo-1", type: "chorus", startTime: 48, endTime: 80, color: getSectionColor("chorus") },
    { id: "s1-4", songId: "demo-1", type: "verse", startTime: 80, endTime: 112, color: getSectionColor("verse") },
    { id: "s1-5", songId: "demo-1", type: "bridge", startTime: 112, endTime: 144, color: getSectionColor("bridge") },
    { id: "s1-6", songId: "demo-1", type: "chorus", startTime: 144, endTime: 176, color: getSectionColor("chorus") },
    { id: "s1-7", songId: "demo-1", type: "outro", startTime: 176, endTime: 192, color: getSectionColor("outro") },
  ],
  "demo-2": [
    { id: "s2-1", songId: "demo-2", type: "intro", startTime: 0, endTime: 20, color: getSectionColor("intro") },
    { id: "s2-2", songId: "demo-2", type: "verse", startTime: 20, endTime: 60, color: getSectionColor("verse") },
    { id: "s2-3", songId: "demo-2", type: "pre-chorus", startTime: 60, endTime: 80, color: getSectionColor("pre-chorus") },
    { id: "s2-4", songId: "demo-2", type: "chorus", startTime: 80, endTime: 120, color: getSectionColor("chorus") },
    { id: "s2-5", songId: "demo-2", type: "bridge", startTime: 120, endTime: 180, color: getSectionColor("bridge") },
    { id: "s2-6", songId: "demo-2", type: "chorus", startTime: 180, endTime: 220, color: getSectionColor("chorus") },
    { id: "s2-7", songId: "demo-2", type: "outro", startTime: 220, endTime: 245, color: getSectionColor("outro") },
  ],
};

export function useSections() {
  const [sections, setSections] = useState<Record<string, Section[]>>(defaultDemoSections);

  const getSectionsForSong = useCallback(
    (songId: string): Section[] => {
      return sections[songId] || [];
    },
    [sections]
  );

  const addSection = useCallback(
    (songId: string, type: string, startTime: number, endTime: number) => {
      const newSection: Section = {
        id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        songId,
        type,
        startTime,
        endTime: Math.max(endTime, startTime + 0.001),
        color: getSectionColor(type),
      };

      setSections((prev) => ({
        ...prev,
        [songId]: [...(prev[songId] || []), newSection].sort(
          (a, b) => a.startTime - b.startTime
        ),
      }));

      return newSection;
    },
    []
  );

  const updateSection = useCallback(
    (
      songId: string,
      sectionId: string,
      updates: Partial<Pick<Section, "type" | "startTime" | "endTime">>
    ) => {
      setSections((prev) => {
        const songSections = prev[songId] || [];
        const updatedSections = songSections
          .map((s) => {
            if (s.id === sectionId) {
              return {
                ...s,
                ...updates,
                color: updates.type ? getSectionColor(updates.type) : s.color,
              };
            }
            return s;
          })
          .sort((a, b) => a.startTime - b.startTime);

        return { ...prev, [songId]: updatedSections };
      });
    },
    []
  );

  const deleteSection = useCallback((songId: string, sectionId: string) => {
    setSections((prev) => ({
      ...prev,
      [songId]: (prev[songId] || []).filter((s) => s.id !== sectionId),
    }));
  }, []);

  return {
    sections,
    getSectionsForSong,
    addSection,
    updateSection,
    deleteSection,
  };
}
