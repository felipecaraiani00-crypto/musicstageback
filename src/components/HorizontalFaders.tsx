import { useRef } from "react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export interface FaderTrack {
  id: string;
  name: string;
  icon: string;
  color: string;
  volume: number;
}

interface HorizontalFadersProps {
  tracks: FaderTrack[];
  onVolumeChange: (trackId: string, volume: number) => void;
}

export function HorizontalFaders({ tracks, onVolumeChange }: HorizontalFadersProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="overflow-x-auto scrollbar-thin pb-2"
    >
      <div className="flex gap-3 min-w-max px-1">
        {tracks.map((track) => (
          <div
            key={track.id}
            className="flex flex-col items-center gap-2 p-3 rounded-lg bg-secondary/50 min-w-[80px]"
          >
            {/* Track icon */}
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shadow-lg"
              style={{ backgroundColor: track.color }}
            >
              {track.icon}
            </div>

            {/* Track name */}
            <span className="text-xs font-medium text-muted-foreground truncate max-w-[70px]">
              {track.name}
            </span>

            {/* Vertical slider (rotated to look horizontal in card) */}
            <div className="h-24 flex items-center justify-center">
              <Slider
                orientation="vertical"
                value={[track.volume]}
                max={100}
                step={1}
                onValueChange={([value]) => onVolumeChange(track.id, value)}
                className="h-20"
              />
            </div>

            {/* Volume value */}
            <span className="text-xs font-mono text-primary">
              {track.volume}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
