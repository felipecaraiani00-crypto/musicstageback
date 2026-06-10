import { useState } from "react";
import { Plus, X, Trash2, Check, Repeat, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Section,
  SECTION_TYPES,
  getSectionLabel,
  parseTimeToSeconds,
  formatTimeWithMs,
} from "@/types/section";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SectionEditorProps {
  isOpen: boolean;
  onClose: () => void;
  sections: Section[];
  totalDuration: number;
  loopSectionId: string | null;
  onAddSection: (type: string, startTime: number, endTime: number) => void;
  onUpdateSection: (
    sectionId: string,
    updates: { type?: string; startTime?: number; endTime?: number }
  ) => void;
  onDeleteSection: (sectionId: string) => void;
  onSeekToSection: (startTime: number) => void;
  onToggleLoop: (sectionId: string) => void;
}

export function SectionEditor({
  isOpen,
  onClose,
  sections,
  totalDuration,
  loopSectionId,
  onAddSection,
  onUpdateSection,
  onDeleteSection,
  onSeekToSection,
  onToggleLoop,
}: SectionEditorProps) {
  const [newType, setNewType] = useState("verse");
  const [newCustomType, setNewCustomType] = useState("");
  const [newStart, setNewStart] = useState("00:00:000");
  const [newEnd, setNewEnd] = useState("00:00:000");
  const [isCustomType, setIsCustomType] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  const handleAddSection = () => {
    const type = isCustomType && newCustomType.trim() ? newCustomType.trim() : newType;
    const startTime = parseTimeToSeconds(newStart);
    const endTime = parseTimeToSeconds(newEnd);

    if (
      startTime >= 0 &&
      startTime <= totalDuration &&
      endTime > startTime &&
      endTime <= totalDuration
    ) {
      onAddSection(type, startTime, endTime);
      setNewStart("00:00:000");
      setNewEnd("00:00:000");
      setNewCustomType("");
    }
  };

  const handleStartEdit = (section: Section) => {
    setEditingId(section.id);
    setEditStart(formatTimeWithMs(section.startTime));
    setEditEnd(formatTimeWithMs(section.endTime));
  };

  const handleSaveEdit = (sectionId: string) => {
    const startTime = parseTimeToSeconds(editStart);
    const endTime = parseTimeToSeconds(editEnd);
    if (
      startTime >= 0 &&
      startTime <= totalDuration &&
      endTime > startTime &&
      endTime <= totalDuration
    ) {
      onUpdateSection(sectionId, { startTime, endTime });
    }
    setEditingId(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            ✂️ Editar Seções
          </DialogTitle>
        </DialogHeader>

        {/* Add new section */}
        <div className="space-y-3 border-b border-border pb-4">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Nova Seção
          </div>

          <div className="flex gap-2 flex-wrap">
            {SECTION_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => {
                  setNewType(type.value);
                  setIsCustomType(false);
                }}
                className={cn(
                  "px-2 py-1 rounded text-xs font-medium transition-all",
                  newType === type.value && !isCustomType
                    ? "ring-2 ring-primary"
                    : "opacity-70 hover:opacity-100"
                )}
                style={{ backgroundColor: type.color, color: "white" }}
              >
                {type.label}
              </button>
            ))}
            <button
              onClick={() => setIsCustomType(true)}
              className={cn(
                "px-2 py-1 rounded text-xs font-medium bg-muted text-muted-foreground transition-all",
                isCustomType && "ring-2 ring-primary"
              )}
            >
              + Outro
            </button>
          </div>

          {isCustomType && (
            <Input
              placeholder="Nome da seção..."
              value={newCustomType}
              onChange={(e) => setNewCustomType(e.target.value)}
              className="h-8 text-sm"
            />
          )}

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
                Início (MM:SS:mmm)
              </label>
              <Input
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                placeholder="00:00:000"
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
                Fim (MM:SS:mmm)
              </label>
              <Input
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                placeholder="00:00:000"
                className="h-8 text-sm font-mono"
              />
            </div>
            <Button onClick={handleAddSection} size="sm" className="h-8">
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
        </div>

        {/* Section list */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Seções ({sections.length})
          </div>

          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma seção ainda. Adicione acima!
            </p>
          ) : (
            sections.map((section) => {
              const isLooping = loopSectionId === section.id;
              const isEditing = editingId === section.id;
              return (
                <div
                  key={section.id}
                  className={cn(
                    "p-2 rounded bg-secondary/50 hover:bg-secondary/80 transition-colors",
                    isLooping && "ring-2 ring-primary"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: section.color }}
                    />
                    <button
                      onClick={() => onSeekToSection(section.startTime)}
                      className="text-sm font-medium flex-1 truncate text-left hover:text-primary"
                    >
                      {getSectionLabel(section.type)}
                    </button>

                    <button
                      onClick={() => onToggleLoop(section.id)}
                      className={cn(
                        "p-1 rounded transition-colors",
                        isLooping
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-primary/20 text-muted-foreground"
                      )}
                      title={isLooping ? "Parar loop" : "Repetir esta seção"}
                    >
                      <Repeat className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        isEditing ? handleSaveEdit(section.id) : handleStartEdit(section)
                      }
                      className="p-1 rounded hover:bg-primary/20"
                      title={isEditing ? "Salvar" : "Editar tempos"}
                    >
                      {isEditing ? (
                        <Check className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={() => onDeleteSection(section.id)}
                      className="p-1 rounded hover:bg-destructive/20"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>

                  {isEditing ? (
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        value={editStart}
                        onChange={(e) => setEditStart(e.target.value)}
                        className="h-7 text-xs font-mono"
                        placeholder="Início"
                      />
                      <span className="text-xs text-muted-foreground">→</span>
                      <Input
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.target.value)}
                        className="h-7 text-xs font-mono"
                        placeholder="Fim"
                      />
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1 rounded hover:bg-destructive/20"
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-muted-foreground">
                      <span>{formatTimeWithMs(section.startTime)}</span>
                      <span>→</span>
                      <span>{formatTimeWithMs(section.endTime)}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="text-[10px] text-muted-foreground text-center">
          Clique no nome para ir até a seção · 🔁 repete · ✏️ edita · 🗑️ exclui
        </div>
      </DialogContent>
    </Dialog>
  );
}
