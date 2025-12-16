import { Play, Pause, Square, SkipBack, SkipForward } from "lucide-react";

interface TransportControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function TransportControls({
  isPlaying,
  onPlayPause,
  onStop,
  onPrev,
  onNext,
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
    </div>
  );
}
