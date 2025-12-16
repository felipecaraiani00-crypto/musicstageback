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
    <div className="flex items-center gap-2">
      <button
        onClick={onPrev}
        className="transport-btn"
        aria-label="Previous section"
      >
        <SkipBack className="w-5 h-5" />
      </button>

      <button
        onClick={onStop}
        className="transport-btn-stop"
        aria-label="Stop"
      >
        <Square className="w-5 h-5 fill-current" />
      </button>

      <button
        onClick={onPlayPause}
        className="transport-btn-primary min-w-[56px] min-h-[56px]"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <Pause className="w-7 h-7 fill-current" />
        ) : (
          <Play className="w-7 h-7 fill-current ml-1" />
        )}
      </button>

      <button
        onClick={onNext}
        className="transport-btn"
        aria-label="Next section"
      >
        <SkipForward className="w-5 h-5" />
      </button>
    </div>
  );
}
