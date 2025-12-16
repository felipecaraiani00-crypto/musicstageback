import { Volume2, VolumeX, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";

export interface Track {
  id: string;
  name: string;
  icon: string;
  color: string;
  volume: number;
  isMuted: boolean;
  isSolo: boolean;
  level: number; // 0-100 for meter
}

interface TrackMixerProps {
  tracks: Track[];
  onVolumeChange: (trackId: string, volume: number) => void;
  onMuteToggle: (trackId: string) => void;
  onSoloToggle: (trackId: string) => void;
}

function LevelMeter({ level }: { level: number }) {
  return (
    <div className="w-2 h-full bg-track-bg rounded-full overflow-hidden flex flex-col-reverse">
      <div
        className={cn(
          "meter-bar w-full",
          level > 85 ? "bg-meter-red" : level > 70 ? "bg-meter-yellow" : "bg-meter-green"
        )}
        style={{ height: `${level}%` }}
      />
    </div>
  );
}

export function TrackMixer({
  tracks,
  onVolumeChange,
  onMuteToggle,
  onSoloToggle,
}: TrackMixerProps) {
  return (
    <div className="glass-panel p-4 space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        Tracks
      </h3>

      <div className="space-y-2">
        {tracks.map((track) => (
          <div
            key={track.id}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg bg-secondary/50 transition-all",
              track.isMuted && "opacity-50"
            )}
          >
            {/* Track icon and name */}
            <div className="flex items-center gap-2 min-w-[100px]">
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center text-lg"
                style={{ backgroundColor: track.color }}
              >
                {track.icon}
              </div>
              <span className="text-sm font-medium truncate">{track.name}</span>
            </div>

            {/* Level meter */}
            <div className="h-8">
              <LevelMeter level={track.isMuted ? 0 : track.level} />
            </div>

            {/* Volume slider */}
            <div className="flex-1 px-2">
              <Slider
                value={[track.volume]}
                max={100}
                step={1}
                onValueChange={([value]) => onVolumeChange(track.id, value)}
                className="cursor-pointer"
              />
            </div>

            {/* Volume display */}
            <span className="text-xs font-mono text-muted-foreground w-10 text-right">
              {track.volume}%
            </span>

            {/* Mute button */}
            <button
              onClick={() => onMuteToggle(track.id)}
              className={cn(
                "transport-btn min-w-[40px] min-h-[40px]",
                track.isMuted && "bg-destructive text-destructive-foreground"
              )}
              aria-label={track.isMuted ? "Unmute" : "Mute"}
            >
              {track.isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>

            {/* Solo button */}
            <button
              onClick={() => onSoloToggle(track.id)}
              className={cn(
                "transport-btn min-w-[40px] min-h-[40px]",
                track.isSolo && "bg-accent text-accent-foreground"
              )}
              aria-label={track.isSolo ? "Unsolo" : "Solo"}
            >
              <Headphones className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
