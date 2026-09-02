import { useState, useCallback } from "react";
import { Section, getSectionColor } from "@/types/section";

export function useSections() {
  // Estado inicial vazio — seções adicionadas pelo usuário manualmente
  const [sections, setSections] = useState<Record<string, Section[]>>({});

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
