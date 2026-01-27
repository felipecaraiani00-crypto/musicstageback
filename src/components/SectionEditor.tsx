import { useState } from "react";
import { Plus, X, Trash2, Check } from "lucide-react";
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
  onAddSection: (type: string, startTime: number) => void;
  onUpdateSection: (sectionId: string, updates: { type?: string; startTime?: number }) => void;
  onDeleteSection: (sectionId: string) => void;
  onSeekToSection: (startTime: number) => void;
}

export function SectionEditor({
  isOpen,
  onClose,
  sections,
  totalDuration,
  onAddSection,
  onUpdateSection,
  onDeleteSection,
  onSeekToSection,
}: SectionEditorProps) {
  const [newType, setNewType] = useState("verse");
  const [newCustomType, setNewCustomType] = useState("");
  const [newTime, setNewTime] = useState("00:00:000");
  const [isCustomType, setIsCustomType] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState("");

  const handleAddSection = () => {
    const type = isCustomType && newCustomType.trim() ? newCustomType.trim() : newType;
    const startTime = parseTimeToSeconds(newTime);
    
    if (startTime >= 0 && startTime <= totalDuration) {
      onAddSection(type, startTime);
      setNewTime("00:00:000");
      setNewCustomType("");
    }
  };

  const handleStartEdit = (section: Section) => {
    setEditingId(section.id);
    setEditTime(formatTimeWithMs(section.startTime));
  };

  const handleSaveEdit = (sectionId: string) => {
    const startTime = parseTimeToSeconds(editTime);
    if (startTime >= 0 && startTime <= totalDuration) {
      onUpdateSection(sectionId, { startTime });
    }
    setEditingId(null);
  };

  const handleSectionClick = (section: Section) => {
    if (editingId !== section.id) {
      onSeekToSection(section.startTime);
    }
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

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
                Tempo (MM:SS:mmm)
              </label>
              <Input
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                placeholder="00:00:000"
                className="h-8 text-sm font-mono"
              />
            </div>
            <Button
              onClick={handleAddSection}
              size="sm"
              className="h-8 mt-4"
            >
              <Plus className="w-4 h-4 mr-1" />
              Adicionar
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
            sections.map((section) => (
              <div
                key={section.id}
                className="flex items-center gap-2 p-2 rounded bg-secondary/50 hover:bg-secondary/80 transition-colors cursor-pointer"
                onClick={() => handleSectionClick(section)}
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: section.color }}
                />
                <span className="text-sm font-medium flex-1 truncate">
                  {getSectionLabel(section.type)}
                </span>

                {editingId === section.id ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Input
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="w-24 h-7 text-xs font-mono"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveEdit(section.id)}
                      className="p-1 rounded hover:bg-primary/20"
                    >
                      <Check className="w-4 h-4 text-primary" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 rounded hover:bg-destructive/20"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleStartEdit(section)}
                      className="text-xs font-mono text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted"
                    >
                      {formatTimeWithMs(section.startTime)}
                    </button>
                    <button
                      onClick={() => onDeleteSection(section.id)}
                      className="p-1 rounded hover:bg-destructive/20"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="text-[10px] text-muted-foreground text-center">
          Clique em uma seção para ir até ela
        </div>
      </DialogContent>
    </Dialog>
  );
}
