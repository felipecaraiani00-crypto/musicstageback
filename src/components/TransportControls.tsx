import { Play, Pause, Square, SkipBack, SkipForward, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TransportControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onPrev: () => void;
  onNext: () => void;
  isFadingOut?: boolean;
  onToggleFadeOut?: () => void;
}

export function TransportControls({
  isPlaying,
  onPlayPause,
  onStop,
  onPrev,
  onNext,
  isFadingOut = false,
  onToggleFadeOut,
}: TransportControlsProps) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={onPrev}
        className="transport-btn min-w-[40px] min-h-[40px]"
        aria-label="Previous section"
      >
        <SkipBack className="w-4 h-4" />
      </button>

      <button
        onClick={onStop}
        className="transport-btn-stop min-w-[40px] min-h-[40px]"
        aria-label="Stop"
      >
        <Square className="w-4 h-4 fill-current" />
      </button>

      <button
        onClick={onPlayPause}
        className="transport-btn-primary min-w-[48px] min-h-[48px]"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <Pause className="w-5 h-5 fill-current" />
        ) : (
          <Play className="w-5 h-5 fill-current ml-0.5" />
        )}
      </button>

      <button
        onClick={onNext}
        className="transport-btn min-w-[40px] min-h-[40px]"
        aria-label="Next section"
      >
        <SkipForward className="w-4 h-4" />
      </button>

      {onToggleFadeOut && (
        <button
          onClick={onToggleFadeOut}
          className={cn(
            "transport-btn min-w-[40px] min-h-[40px] transition-all duration-300",
            isFadingOut
              ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.3)]"
              : "text-muted-foreground hover:text-foreground"
          )}
          title={
            isFadingOut
              ? "Cancelar Fade Out (Restaurar instrumentos)"
              : "Fade Out (Reduzir instrumentos em 4.5s, mantendo click/guia)"
          }
          aria-label="Fade Out"
        >
          <TrendingDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

