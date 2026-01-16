import { useState } from "react";
import { Volume2, Disc3, Edit2, Check, Headphones } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type SplitMode = "off" | "clickLeft" | "clickRight";

interface MasterControlsProps {
  masterVolume: number;
  clickVolume: number;
  bpm: number;
  isClickActive: boolean;
  currentBeat: number;
  beatsPerBar: number;
  onMasterVolumeChange: (volume: number) => void;
  onClickVolumeChange: (volume: number) => void;
  onClickToggle: () => void;
  onBpmChange?: (bpm: number) => void;
  splitMode?: SplitMode;
  onSplitModeChange?: (mode: SplitMode) => void;
  showSplitControl?: boolean;
}

export function MasterControls({
  masterVolume,
  clickVolume,
  bpm,
  isClickActive,
  currentBeat,
  beatsPerBar,
  onMasterVolumeChange,
  onClickVolumeChange,
  onClickToggle,
  onBpmChange,
  splitMode = "off",
  onSplitModeChange,
  showSplitControl = false,
}: MasterControlsProps) {
  const [isEditingBpm, setIsEditingBpm] = useState(false);
  const [editBpmValue, setEditBpmValue] = useState(bpm.toString());

  const handleBpmSubmit = () => {
    const newBpm = parseInt(editBpmValue, 10);
    if (!isNaN(newBpm) && newBpm >= 20 && newBpm <= 300) {
      onBpmChange?.(newBpm);
    } else {
      setEditBpmValue(bpm.toString());
    }
    setIsEditingBpm(false);
  };

  const handleBpmKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBpmSubmit();
    } else if (e.key === "Escape") {
      setEditBpmValue(bpm.toString());
      setIsEditingBpm(false);
    }
  };

  const startEditing = () => {
    setEditBpmValue(bpm.toString());
    setIsEditingBpm(true);
  };

  const cycleSplitMode = () => {
    const modes: SplitMode[] = ["off", "clickLeft", "clickRight"];
    const currentIndex = modes.indexOf(splitMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    onSplitModeChange?.(modes[nextIndex]);
  };

  const getSplitLabel = () => {
    switch (splitMode) {
      case "clickLeft": return "C←|→I";
      case "clickRight": return "I←|→C";
      default: return "L|R";
    }
  };

  const getSplitTitle = () => {
    switch (splitMode) {
      case "clickLeft": return "Click à esquerda, Instrumentos à direita";
      case "clickRight": return "Click à direita, Instrumentos à esquerda";
      default: return "Separar Click e Instrumentos";
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      {/* BPM Display/Edit */}
      <div className="flex items-center gap-2">
        <div className="text-center">
          {isEditingBpm ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={20}
                max={300}
                value={editBpmValue}
                onChange={(e) => setEditBpmValue(e.target.value)}
                onKeyDown={handleBpmKeyDown}
                onBlur={handleBpmSubmit}
                autoFocus
                className="w-14 text-xl font-mono font-bold text-primary bg-secondary border border-primary/50 rounded px-1 text-center focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={handleBpmSubmit}
                className="p-1 rounded hover:bg-secondary"
              >
                <Check className="w-3 h-3 text-primary" />
              </button>
            </div>
          ) : (
            <button
              onClick={startEditing}
              className="group flex items-center gap-1 hover:bg-secondary/50 rounded px-1 transition-colors"
              title="Clique para editar BPM"
            >
              <div className="text-xl font-mono font-bold text-primary text-glow-primary leading-none">
                {bpm}
              </div>
              <Edit2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">
            BPM
          </div>
        </div>

        {/* Beat indicators */}
        <div className="flex gap-1">
          {Array.from({ length: beatsPerBar }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all duration-100",
                currentBeat === i + 1 && isClickActive
                  ? i === 0
                    ? "bg-accent scale-125 shadow-[var(--glow-accent)]"
                    : "bg-primary scale-110 shadow-[var(--glow-primary)]"
                  : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      {/* Click Track Control */}
      <div className="flex items-center gap-2">
        <button
          onClick={onClickToggle}
          className={cn(
            "transport-btn min-w-[36px] min-h-[36px]",
            isClickActive && "bg-accent text-accent-foreground"
          )}
          aria-label="Toggle click track"
        >
          <Disc3 className={cn("w-4 h-4", isClickActive && "animate-spin")} />
        </button>

        <div className="flex items-center gap-1 w-[80px]">
          <Slider
            value={[clickVolume]}
            max={100}
            step={1}
            onValueChange={([value]) => onClickVolumeChange(value)}
            className="flex-1"
          />
          <span className="text-[10px] font-mono text-muted-foreground w-6">
            {clickVolume}
          </span>
        </div>
      </div>

      {/* Master Volume + Split Control */}
      <div className="flex items-center gap-2">
        {/* L/R Split Control */}
        {showSplitControl && onSplitModeChange && (
          <button
            onClick={cycleSplitMode}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all min-w-[50px] justify-center",
              splitMode !== "off"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary hover:bg-secondary/80 text-secondary-foreground"
            )}
            title={getSplitTitle()}
          >
            <Headphones className="w-3 h-3" />
            <span>{getSplitLabel()}</span>
          </button>
        )}

        {/* Master Volume */}
        <div className="flex items-center gap-1">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <div className="flex items-center gap-1 w-[80px]">
            <Slider
              value={[masterVolume]}
              max={100}
              step={1}
              onValueChange={([value]) => onMasterVolumeChange(value)}
              className="flex-1"
            />
            <span className="text-[10px] font-mono text-muted-foreground w-6">
              {masterVolume}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
