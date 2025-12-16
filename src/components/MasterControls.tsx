import { Volume2, Music, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface MasterControlsProps {
  masterVolume: number;
  bpm: number;
  isClickActive: boolean;
  currentBeat: number;
  beatsPerBar: number;
  isFadingToClick: boolean;
  fadeProgress: number; // 0 = full instruments, 100 = only click
  onMasterVolumeChange: (volume: number) => void;
  onFadeToClickToggle: () => void;
}

export function MasterControls({
  masterVolume,
  bpm,
  isClickActive,
  currentBeat,
  beatsPerBar,
  isFadingToClick,
  fadeProgress,
  onMasterVolumeChange,
  onFadeToClickToggle,
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

      {/* Fade to Click Button */}
      <button
        onClick={onFadeToClickToggle}
        className={cn(
          "relative flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-xs transition-all overflow-hidden",
          isFadingToClick || fadeProgress > 0
            ? "bg-accent text-accent-foreground"
            : "bg-secondary hover:bg-secondary/80 text-secondary-foreground"
        )}
      >
        {/* Progress bar background */}
        <div 
          className="absolute inset-0 bg-accent/30 transition-all duration-100"
          style={{ 
            width: `${fadeProgress}%`,
            opacity: fadeProgress > 0 ? 1 : 0
          }}
        />
        
        <span className="relative z-10 flex items-center gap-1.5">
          {fadeProgress >= 100 ? (
            <>
              <VolumeX className="w-4 h-4" />
              <span>SÓ CLICK</span>
            </>
          ) : fadeProgress > 0 ? (
            <>
              <Music className="w-4 h-4 animate-pulse" />
              <span>FADE {Math.round(fadeProgress)}%</span>
            </>
          ) : (
            <>
              <Music className="w-4 h-4" />
              <span>FADE</span>
            </>
          )}
        </span>
      </button>

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
