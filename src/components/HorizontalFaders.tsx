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
      className="overflow-x-auto scrollbar-thin pb-1"
    >
      <div className="flex gap-2 min-w-max px-1">
        {tracks.map((track) => (
          <div
            key={track.id}
            className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-secondary/50 min-w-[60px]"
          >
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center text-base shadow-lg"
              style={{ backgroundColor: track.color }}
            >
              {track.icon}
            </div>

            <span className="text-[10px] font-medium text-muted-foreground truncate max-w-[55px]">
              {track.name}
            </span>

            <div className="h-16 flex items-center justify-center">
              <Slider
                orientation="vertical"
                value={[track.volume]}
                max={100}
                step={1}
                onValueChange={([value]) => onVolumeChange(track.id, value)}
                className="h-14"
              />
            </div>

            <span className="text-[10px] font-mono text-primary">
              {track.volume}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
