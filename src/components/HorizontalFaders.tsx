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
      className="overflow-x-auto scrollbar-thin h-full"
    >
      <div className="flex gap-1.5 min-w-max h-full items-stretch">
        {tracks.map((track) => (
          <div
            key={track.id}
            className="flex flex-col items-center justify-between py-1 px-1.5 rounded-lg bg-secondary/50 min-w-[50px]"
          >
            <div
              className="w-6 h-6 rounded flex items-center justify-center text-sm shadow-lg flex-shrink-0"
              style={{ backgroundColor: track.color }}
            >
              {track.icon}
            </div>

            <span className="text-[9px] font-medium text-muted-foreground truncate max-w-[48px]">
              {track.name}
            </span>

            <div className="flex-1 flex items-center justify-center min-h-[40px]">
              <Slider
                orientation="vertical"
                value={[track.volume]}
                max={100}
                step={1}
                onValueChange={([value]) => onVolumeChange(track.id, value)}
                className="h-full max-h-[60px]"
              />
            </div>

            <span className="text-[9px] font-mono text-primary flex-shrink-0">
              {track.volume}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
