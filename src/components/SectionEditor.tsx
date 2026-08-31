import { useState, useEffect } from "react";
import { Plus, X, Trash2, Check, Repeat, Pencil, Clock } from "lucide-react";
import { toast } from "sonner";
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
  currentTime?: number;
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
  currentTime = 0,
  loopSectionId,
  onAddSection,
  onUpdateSection,
  onDeleteSection,
  onSeekToSection,
  onToggleLoop,
}: SectionEditorProps) {
  // Helper to find the end time of the last section (+ 0.001s increment) or 0 if none
  const getLastSectionEndTime = (secList: Section[]): number => {
    if (!secList || secList.length === 0) return 0;
    const maxEnd = secList.reduce((max, s) => Math.max(max, s.endTime), 0);
    return maxEnd > 0 ? maxEnd + 0.001 : 0;
  };

  const [newType, setNewType] = useState("verse");
  const [newCustomType, setNewCustomType] = useState("");
  const [newStart, setNewStart] = useState(() => formatTimeWithMs(getLastSectionEndTime(sections)));
  const [newEnd, setNewEnd] = useState("00:00:000");
  const [isCustomType, setIsCustomType] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Início Automático ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      const lastEnd = getLastSectionEndTime(sections);
      setNewStart(formatTimeWithMs(lastEnd));
      setNewEnd("00:00:000");
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Preenchimento inteligente do Fim ao selecionar tipo de seção
  const handleSelectType = (typeValue: string) => {
    setNewType(typeValue);
    setIsCustomType(false);
    setErrorMessage(null);

    const currentEndSec = parseTimeToSeconds(newEnd);
    const currentStartSec = parseTimeToSeconds(newStart);

    // Se o campo de fim estiver zerado ou menor/igual ao início, preenche automaticamente
    if (currentEndSec <= 0 || currentEndSec <= currentStartSec) {
      let autoEnd = 0;
      if (currentTime > currentStartSec + 0.5) {
        // Se a agulha atual da música estiver à frente do início, usa currentTime
        autoEnd = currentTime;
      } else {
        // Senão adiciona duração padrão de +15 segundos à frente do início
        autoEnd = currentStartSec + 15;
      }

      // Limita à duração total da música
      if (totalDuration > 0) {
        autoEnd = Math.min(autoEnd, totalDuration);
      }

      // Evita sobrepor próxima seção existente se houver
      const nextSection = sections
        .filter((s) => s.startTime > currentStartSec + 0.001)
        .sort((a, b) => a.startTime - b.startTime)[0];
      if (nextSection && autoEnd > nextSection.startTime) {
        autoEnd = nextSection.startTime;
      }

      setNewEnd(formatTimeWithMs(autoEnd));
    }
  };

  // Preenchimento ao selecionar "+ Outro"
  const handleSelectCustomType = () => {
    setIsCustomType(true);
    setErrorMessage(null);

    const currentEndSec = parseTimeToSeconds(newEnd);
    const currentStartSec = parseTimeToSeconds(newStart);

    if (currentEndSec <= 0 || currentEndSec <= currentStartSec) {
      let autoEnd = currentTime > currentStartSec + 0.5 ? currentTime : currentStartSec + 15;
      if (totalDuration > 0) {
        autoEnd = Math.min(autoEnd, totalDuration);
      }
      setNewEnd(formatTimeWithMs(autoEnd));
    }
  };

  // Check if [startTime, endTime] overlaps with any existing section
  // Uses EPSILON = 0.0005 (0.5ms) so boundary touching (Início_Nova >= Fim_Anterior) is fully permitted without false overlap
  const checkOverlap = (startTime: number, endTime: number, excludeSectionId?: string): boolean => {
    const EPSILON = 0.0005;
    return sections.some((sec) => {
      if (excludeSectionId && sec.id === excludeSectionId) return false;
      // Overlap occurs strictly when: startTime < sec.endTime - EPSILON && endTime > sec.startTime + EPSILON
      return (startTime < sec.endTime - EPSILON) && (endTime > sec.startTime + EPSILON);
    });
  };

  const handleAddSection = () => {
    const type = isCustomType && newCustomType.trim() ? newCustomType.trim() : newType;
    const startTime = parseTimeToSeconds(newStart);
    const endTime = parseTimeToSeconds(newEnd);

    if (isNaN(startTime) || isNaN(endTime)) {
      setErrorMessage("Formato de tempo inválido!");
      toast.error("Formato de tempo inválido!");
      return;
    }

    if (startTime < 0 || endTime <= startTime) {
      setErrorMessage("O tempo de fim deve ser maior que o início!");
      toast.error("O tempo de fim deve ser maior que o início!");
      return;
    }

    if (totalDuration > 0 && (startTime > totalDuration || endTime > totalDuration)) {
      setErrorMessage(`O tempo não pode ultrapassar a duração total (${formatTimeWithMs(totalDuration)})!`);
      toast.error(`O tempo não pode ultrapassar a duração total (${formatTimeWithMs(totalDuration)})!`);
      return;
    }

    if (checkOverlap(startTime, endTime)) {
      setErrorMessage("Já existe uma seção neste intervalo de tempo!");
      toast.error("Já existe uma seção neste intervalo de tempo!");
      return;
    }

    setErrorMessage(null);
    onAddSection(type, startTime, endTime);

    // Fluxo Contínuo: define início da próxima com +1ms (+0.001s) do fim da anterior e limpa o Fim
    const nextStart = endTime + 0.001;
    setNewStart(formatTimeWithMs(nextStart));
    setNewEnd("00:00:000");
    setNewCustomType("");
    toast.success(`Seção "${getSectionLabel(type)}" criada com sucesso!`);
  };

  const handleStartEdit = (section: Section) => {
    setEditingId(section.id);
    setEditStart(formatTimeWithMs(section.startTime));
    setEditEnd(formatTimeWithMs(section.endTime));
    setErrorMessage(null);
  };

  const handleSaveEdit = (sectionId: string) => {
    const startTime = parseTimeToSeconds(editStart);
    const endTime = parseTimeToSeconds(editEnd);

    if (isNaN(startTime) || isNaN(endTime)) {
      setErrorMessage("Formato de tempo inválido!");
      toast.error("Formato de tempo inválido!");
      return;
    }

    if (startTime < 0 || endTime <= startTime) {
      setErrorMessage("O tempo de fim deve ser maior que o início!");
      toast.error("O tempo de fim deve ser maior que o início!");
      return;
    }

    if (totalDuration > 0 && (startTime > totalDuration || endTime > totalDuration)) {
      setErrorMessage(`O tempo não pode ultrapassar a duração total (${formatTimeWithMs(totalDuration)})!`);
      toast.error(`O tempo não pode ultrapassar a duração total (${formatTimeWithMs(totalDuration)})!`);
      return;
    }

    if (checkOverlap(startTime, endTime, sectionId)) {
      setErrorMessage("Já existe uma seção neste intervalo de tempo!");
      toast.error("Já existe uma seção neste intervalo de tempo!");
      return;
    }

    setErrorMessage(null);
    onUpdateSection(sectionId, { startTime, endTime });
    setEditingId(null);
    toast.success("Seção atualizada!");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              ✂️ Editar Seções
            </DialogTitle>
            <span className="text-[11px] font-mono text-muted-foreground bg-secondary/80 px-2 py-0.5 rounded border border-border/40">
              Cursor: {formatTimeWithMs(currentTime)}
            </span>
          </div>
        </DialogHeader>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="p-2 rounded-md bg-destructive/15 border border-destructive/30 text-destructive text-xs font-medium flex items-center gap-1.5 animate-fade-in">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Add new section */}
        <div className="space-y-3 border-b border-border pb-4">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Nova Seção
          </div>

          <div className="flex gap-2 flex-wrap">
            {SECTION_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => handleSelectType(type.value)}
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
              onClick={handleSelectCustomType}
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
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Início
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setNewStart(formatTimeWithMs(currentTime));
                    setErrorMessage(null);
                  }}
                  className="text-[10px] text-primary hover:underline font-medium flex items-center gap-0.5"
                  title="Usar tempo atual do player"
                >
                  <Clock className="w-2.5 h-2.5" />
                  <span>Atual</span>
                </button>
              </div>
              <div className="relative">
                <Input
                  value={newStart}
                  onChange={(e) => {
                    setNewStart(e.target.value);
                    setErrorMessage(null);
                  }}
                  onFocus={(e) => e.target.select()}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  placeholder="00:00:000"
                  className="h-8 text-sm font-mono pr-7"
                />
                <button
                  type="button"
                  onClick={() => {
                    setNewStart(formatTimeWithMs(currentTime));
                    setErrorMessage(null);
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                  title="Usar tempo atual"
                >
                  <Clock className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Fim
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setNewEnd(formatTimeWithMs(currentTime));
                    setErrorMessage(null);
                  }}
                  className="text-[10px] text-primary hover:underline font-medium flex items-center gap-0.5"
                  title="Usar tempo atual do player"
                >
                  <Clock className="w-2.5 h-2.5" />
                  <span>Atual</span>
                </button>
              </div>
              <div className="relative">
                <Input
                  value={newEnd}
                  onChange={(e) => {
                    setNewEnd(e.target.value);
                    setErrorMessage(null);
                  }}
                  onFocus={(e) => e.target.select()}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  placeholder="00:00:000"
                  className="h-8 text-sm font-mono pr-7"
                />
                <button
                  type="button"
                  onClick={() => {
                    setNewEnd(formatTimeWithMs(currentTime));
                    setErrorMessage(null);
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                  title="Usar tempo atual"
                >
                  <Clock className="w-3.5 h-3.5" />
                </button>
              </div>
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
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/40">
                      <div className="flex-1 relative">
                        <Input
                          value={editStart}
                          onChange={(e) => {
                            setEditStart(e.target.value);
                            setErrorMessage(null);
                          }}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          className="h-7 text-xs font-mono pr-6"
                          placeholder="Início"
                        />
                        <button
                          type="button"
                          onClick={() => setEditStart(formatTimeWithMs(currentTime))}
                          className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-primary"
                          title="Usar tempo atual"
                        >
                          <Clock className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-xs text-muted-foreground">→</span>
                      <div className="flex-1 relative">
                        <Input
                          value={editEnd}
                          onChange={(e) => {
                            setEditEnd(e.target.value);
                            setErrorMessage(null);
                          }}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          className="h-7 text-xs font-mono pr-6"
                          placeholder="Fim"
                        />
                        <button
                          type="button"
                          onClick={() => setEditEnd(formatTimeWithMs(currentTime))}
                          className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-primary"
                          title="Usar tempo atual"
                        >
                          <Clock className="w-3 h-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => handleSaveEdit(section.id)}
                        className="p-1 rounded hover:bg-primary/20 text-primary"
                        title="Salvar"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setErrorMessage(null);
                        }}
                        className="p-1 rounded hover:bg-destructive/20 text-muted-foreground"
                        title="Cancelar"
                      >
                        <X className="w-4 h-4" />
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
