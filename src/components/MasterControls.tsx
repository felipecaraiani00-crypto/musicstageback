import { Volume2, Headphones, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type SplitMode = "off" | "clickLeft" | "clickRight";

interface MasterControlsProps {
  masterVolume: number;
  onMasterVolumeChange: (volume: number) => void;
  splitMode?: SplitMode;
  onSplitModeChange?: (mode: SplitMode) => void;
  showSplitControl?: boolean;
  instrumentsFaded?: boolean;
  onInstrumentsFadeToggle?: () => void;
}

export function MasterControls({
  masterVolume,
  onMasterVolumeChange,
  splitMode = "off",
  onSplitModeChange,
  showSplitControl = false,
  instrumentsFaded = false,
  onInstrumentsFadeToggle,
}: MasterControlsProps) {

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
      {/* Master Volume + Split Control + Fade Button */}
      <div className="flex items-center gap-2">
        {/* Instrument Fade Button */}
        {showSplitControl && onInstrumentsFadeToggle && (
          <button
            onClick={onInstrumentsFadeToggle}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all min-w-[50px] justify-center",
              instrumentsFaded
                ? "bg-destructive text-destructive-foreground animate-pulse"
                : "bg-secondary hover:bg-secondary/80 text-secondary-foreground"
            )}
            title={instrumentsFaded ? "Trazer instrumentos de volta" : "Silenciar instrumentos (só click)"}
          >
            <VolumeX className="w-3 h-3" />
            <span>{instrumentsFaded ? "FADE" : "INST"}</span>
          </button>
        )}

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
