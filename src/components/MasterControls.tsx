import { Volume2, Disc3 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

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
}: MasterControlsProps) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      {/* BPM Display */}
      <div className="flex items-center gap-2">
        <div className="text-center">
          <div className="text-xl font-mono font-bold text-primary text-glow-primary leading-none">
            {bpm}
          </div>
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
  );
}
