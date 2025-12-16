import { Music, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Song {
  id: string;
  title: string;
  artist: string;
  duration: number; // seconds
  bpm: number;
}

interface SongListProps {
  songs: Song[];
  currentSongId: string;
  onSongSelect: (song: Song) => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function SongList({ songs, currentSongId, onSongSelect }: SongListProps) {
  return (
    <div className="glass-panel p-2 h-full overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Setlist
        </h3>
        <span className="text-[9px] text-muted-foreground">
          {songs.length} músicas
        </span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin space-y-0.5">
        {songs.map((song, index) => {
          const isActive = song.id === currentSongId;
          
          return (
            <button
              key={song.id}
              onClick={() => onSongSelect(song)}
              className={cn(
                "w-full flex items-center gap-1.5 px-1.5 py-1 rounded transition-all text-left",
                isActive
                  ? "bg-primary/20 border border-primary/50"
                  : "bg-secondary/30 hover:bg-secondary/50 border border-transparent"
              )}
            >
              {/* Track number */}
              <div
                className={cn(
                  "w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold flex-shrink-0",
                  isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {isActive ? <Play className="w-2.5 h-2.5 fill-current" /> : index + 1}
              </div>

              {/* Song info */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-[10px] font-medium truncate leading-tight",
                  isActive && "text-primary"
                )}>
                  {song.title}
                </p>
                <p className="text-[9px] text-muted-foreground truncate leading-tight">
                  {song.artist}
                </p>
              </div>

              {/* Duration & BPM */}
              <div className="text-right flex-shrink-0">
                <p className="text-[9px] font-mono text-muted-foreground leading-tight">
                  {formatDuration(song.duration)}
                </p>
                <p className="text-[9px] font-mono text-muted-foreground leading-tight">
                  {song.bpm}bpm
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
