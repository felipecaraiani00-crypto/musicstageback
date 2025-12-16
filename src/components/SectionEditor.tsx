import { useState, useEffect } from "react";
import { X, Plus, Trash2, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SongSection {
  id: string;
  type: SectionType;
  startTime: number;
  endTime: number;
  label?: string;
}

export type SectionType = 
  | "intro"
  | "verse"
  | "pre-chorus"
  | "chorus"
  | "bridge"
  | "solo"
  | "outro"
  | "interlude";

const sectionTypes: { value: SectionType; label: string; color: string }[] = [
  { value: "intro", label: "Intro", color: "bg-purple-500" },
  { value: "verse", label: "Verso", color: "bg-blue-500" },
  { value: "pre-chorus", label: "Pré-Refrão", color: "bg-yellow-500" },
  { value: "chorus", label: "Refrão", color: "bg-green-500" },
  { value: "bridge", label: "Ponte", color: "bg-orange-500" },
  { value: "solo", label: "Solo", color: "bg-red-500" },
  { value: "interlude", label: "Interlúdio", color: "bg-cyan-500" },
  { value: "outro", label: "Outro", color: "bg-pink-500" },
];

interface SectionEditorProps {
  songId: string;
  songName: string;
  duration: number;
  currentTime: number;
  sections: SongSection[];
  onSectionsChange: (sections: SongSection[]) => void;
  onSeek: (time: number) => void;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function parseTime(timeStr: string): number {
  const parts = timeStr.split(":");
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  return 0;
}

export function SectionEditor({
  songId,
  songName,
  duration,
  currentTime,
  sections,
  onSectionsChange,
  onSeek,
  onClose,
}: SectionEditorProps) {
  const [editingSection, setEditingSection] = useState<SongSection | null>(null);

  const getSectionTypeInfo = (type: SectionType) => 
    sectionTypes.find(s => s.value === type) || sectionTypes[0];

  const addSection = () => {
    const newSection: SongSection = {
      id: `section-${Date.now()}`,
      type: "verse",
      startTime: currentTime,
      endTime: Math.min(currentTime + 30, duration),
    };
    onSectionsChange([...sections, newSection].sort((a, b) => a.startTime - b.startTime));
  };

  const updateSection = (id: string, updates: Partial<SongSection>) => {
    onSectionsChange(
      sections
        .map(s => s.id === id ? { ...s, ...updates } : s)
        .sort((a, b) => a.startTime - b.startTime)
    );
  };

  const deleteSection = (id: string) => {
    onSectionsChange(sections.filter(s => s.id !== id));
  };

  const markCurrentPosition = (field: "start" | "end", sectionId: string) => {
    if (field === "start") {
      updateSection(sectionId, { startTime: currentTime });
    } else {
      updateSection(sectionId, { endTime: currentTime });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-lg shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Music2 className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-base font-semibold">Editar Seções</h2>
              <p className="text-xs text-muted-foreground">{songName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Time Indicator */}
        <div className="px-4 py-2 bg-secondary/50 border-b border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Posição atual:</span>
            <span className="font-mono text-primary font-medium">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          {/* Timeline */}
          <div className="mt-2 h-6 bg-background rounded relative overflow-hidden">
            {sections.map(section => {
              const left = (section.startTime / duration) * 100;
              const width = ((section.endTime - section.startTime) / duration) * 100;
              const info = getSectionTypeInfo(section.type);
              return (
                <div
                  key={section.id}
                  className={cn("absolute h-full opacity-70 cursor-pointer hover:opacity-100", info.color)}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  onClick={() => onSeek(section.startTime)}
                  title={`${info.label}: ${formatTime(section.startTime)} - ${formatTime(section.endTime)}`}
                />
              );
            })}
            {/* Playhead */}
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-orange-500 z-10"
              style={{ left: `${(currentTime / duration) * 100}%` }}
            />
          </div>
        </div>

        {/* Sections List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Nenhuma seção definida</p>
              <p className="text-xs mt-1">Clique em "Adicionar" para criar uma seção</p>
            </div>
          ) : (
            sections.map(section => {
              const info = getSectionTypeInfo(section.type);
              return (
                <div
                  key={section.id}
                  className="bg-secondary/50 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded-full", info.color)} />
                      <select
                        value={section.type}
                        onChange={(e) => updateSection(section.id, { type: e.target.value as SectionType })}
                        className="bg-background border border-border rounded px-2 py-1 text-sm"
                      >
                        {sectionTypes.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => deleteSection(section.id)}
                      className="p-1.5 text-destructive hover:bg-destructive/20 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <div className="flex-1 flex items-center gap-1">
                      <span className="text-muted-foreground text-xs">Início:</span>
                      <input
                        type="text"
                        value={formatTime(section.startTime)}
                        onChange={(e) => updateSection(section.id, { startTime: parseTime(e.target.value) })}
                        className="w-16 bg-background border border-border rounded px-2 py-1 text-xs font-mono"
                      />
                      <button
                        onClick={() => markCurrentPosition("start", section.id)}
                        className="text-xs px-2 py-1 bg-primary/20 text-primary rounded hover:bg-primary/30 transition-colors"
                        title="Marcar posição atual como início"
                      >
                        Aqui
                      </button>
                    </div>
                    <div className="flex-1 flex items-center gap-1">
                      <span className="text-muted-foreground text-xs">Fim:</span>
                      <input
                        type="text"
                        value={formatTime(section.endTime)}
                        onChange={(e) => updateSection(section.id, { endTime: parseTime(e.target.value) })}
                        className="w-16 bg-background border border-border rounded px-2 py-1 text-xs font-mono"
                      />
                      <button
                        onClick={() => markCurrentPosition("end", section.id)}
                        className="text-xs px-2 py-1 bg-primary/20 text-primary rounded hover:bg-primary/30 transition-colors"
                        title="Marcar posição atual como fim"
                      >
                        Aqui
                      </button>
                    </div>
                  </div>

                  {/* Preview button */}
                  <button
                    onClick={() => onSeek(section.startTime)}
                    className="w-full text-xs py-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ▶ Ouvir seção
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex gap-2">
          <button
            onClick={addSection}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Adicionar Seção</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors text-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
