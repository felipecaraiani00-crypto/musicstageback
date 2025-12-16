import { useRef } from "react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export interface FaderTrack {
  id: string;
  name: string;
  icon: string;
  color: string;
  volume: number;
  isMuted?: boolean;
  isSolo?: boolean;
}

interface HorizontalFadersProps {
  tracks: FaderTrack[];
  onVolumeChange: (trackId: string, volume: number) => void;
  onMuteToggle?: (trackId: string) => void;
  onSoloToggle?: (trackId: string) => void;
}

export function HorizontalFaders({ tracks, onVolumeChange, onMuteToggle, onSoloToggle }: HorizontalFadersProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if any track has solo active
  const hasSoloActive = tracks.some(t => t.isSolo);

  return (
    <div
      ref={containerRef}
      className="overflow-x-auto scrollbar-thin h-full"
    >
      <div className="flex gap-1.5 min-w-max h-full items-stretch">
        {tracks.map((track) => {
          // Track is effectively muted if: explicitly muted OR (solo is active elsewhere and this track is not solo)
          const isEffectivelyMuted = track.isMuted || (hasSoloActive && !track.isSolo);
          
          return (
            <div
              key={track.id}
              className={cn(
                "flex flex-col items-center justify-between py-1 px-1.5 rounded-lg bg-secondary/50 min-w-[50px]",
                isEffectivelyMuted && "opacity-50"
              )}
            >
              {/* Track icon */}
              <div
                className="w-6 h-6 rounded flex items-center justify-center text-sm shadow-lg flex-shrink-0"
                style={{ backgroundColor: track.color }}
              >
                {track.icon}
              </div>

              <span className="text-[9px] font-medium text-muted-foreground truncate max-w-[48px]">
                {track.name}
              </span>

              {/* Fader */}
              <div className="flex-1 flex items-center justify-center min-h-[40px]">
                <Slider
                  orientation="vertical"
                  value={[isEffectivelyMuted ? 0 : track.volume]}
                  max={100}
                  step={1}
                  onValueChange={([value]) => onVolumeChange(track.id, value)}
                  className="h-full max-h-[60px]"
                  disabled={isEffectivelyMuted}
                />
              </div>

              {/* Solo & Mute buttons */}
              <div className="flex gap-0.5 flex-shrink-0">
                <button
                  onClick={() => onSoloToggle?.(track.id)}
                  className={cn(
                    "w-5 h-5 rounded text-[9px] font-bold transition-all",
                    track.isSolo
                      ? "bg-yellow-500 text-yellow-950"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  S
                </button>
                <button
                  onClick={() => onMuteToggle?.(track.id)}
                  className={cn(
                    "w-5 h-5 rounded text-[9px] font-bold transition-all",
                    track.isMuted
                      ? "bg-red-500 text-red-950"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  M
                </button>
              </div>

              <span className="text-[9px] font-mono text-primary flex-shrink-0">
                {track.volume}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
