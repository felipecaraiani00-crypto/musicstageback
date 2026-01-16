import { useRef } from "react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { VolumeX, Volume2 } from "lucide-react";

export interface FaderTrack {
  id: string;
  name: string;
  icon: string;
  color: string;
  volume: number;
  isMuted?: boolean;
  isSoloed?: boolean;
}

interface HorizontalFadersProps {
  tracks: FaderTrack[];
  onVolumeChange: (trackId: string, volume: number) => void;
  onMuteToggle?: (trackId: string) => void;
  onSoloToggle?: (trackId: string) => void;
}

export function HorizontalFaders({ tracks, onVolumeChange, onMuteToggle, onSoloToggle }: HorizontalFadersProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Check if any track is soloed
  const hasSoloedTrack = tracks.some(t => t.isSoloed);

  return (
    <div
      ref={containerRef}
      className="overflow-x-auto scrollbar-thin h-full"
    >
      <div className="flex gap-1.5 min-w-max h-full items-stretch">
        {tracks.map((track) => {
          // Track is effectively muted if it's muted OR if another track is soloed and this one isn't
          const isEffectivelyMuted = track.isMuted || (hasSoloedTrack && !track.isSoloed);
          
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
                className={cn(
                  "w-6 h-6 rounded flex items-center justify-center text-sm shadow-lg flex-shrink-0 transition-all"
                )}
                style={{ backgroundColor: track.color }}
              >
                {track.icon}
              </div>

              <span className="text-[9px] font-medium text-muted-foreground truncate max-w-[48px]">
                {track.name}
              </span>

              {/* Mute & Solo buttons */}
              <div className="flex gap-0.5 my-0.5">
                <button
                  onClick={() => onMuteToggle?.(track.id)}
                  className={cn(
                    "w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center transition-all",
                    track.isMuted 
                      ? "bg-red-500 text-white" 
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  )}
                  title="Mute"
                >
                  M
                </button>
                <button
                  onClick={() => onSoloToggle?.(track.id)}
                  className={cn(
                    "w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center transition-all",
                    track.isSoloed 
                      ? "bg-yellow-500 text-black" 
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  )}
                  title="Solo"
                >
                  S
                </button>
              </div>

              <div className="flex-1 flex items-center justify-center min-h-[40px]">
                <Slider
                  orientation="vertical"
                  value={[isEffectivelyMuted ? 0 : track.volume]}
                  max={100}
                  step={1}
                  onValueChange={([value]) => onVolumeChange(track.id, value)}
                  className="h-full max-h-[60px]"
                />
              </div>

              <span className="text-[9px] font-mono text-primary flex-shrink-0">
                {track.isMuted ? "M" : track.isSoloed ? "S" : track.volume}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
