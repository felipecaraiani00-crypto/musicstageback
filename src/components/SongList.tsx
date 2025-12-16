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
    <div className="glass-panel p-3 flex-1 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Setlist
        </h3>
        <span className="text-[10px] text-muted-foreground">
          {songs.length} músicas
        </span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1">
        {songs.map((song, index) => {
          const isActive = song.id === currentSongId;
          
          return (
            <button
              key={song.id}
              onClick={() => onSongSelect(song)}
              className={cn(
                "w-full flex items-center gap-2 p-2 rounded-lg transition-all text-left",
                isActive
                  ? "bg-primary/20 border border-primary/50"
                  : "bg-secondary/30 hover:bg-secondary/50 border border-transparent"
              )}
            >
              {/* Track number */}
              <div
                className={cn(
                  "w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold",
                  isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {isActive ? <Play className="w-3 h-3 fill-current" /> : index + 1}
              </div>

              {/* Song info */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-xs font-medium truncate",
                  isActive && "text-primary"
                )}>
                  {song.title}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {song.artist}
                </p>
              </div>

              {/* Duration & BPM */}
              <div className="text-right">
                <p className="text-[10px] font-mono text-muted-foreground">
                  {formatDuration(song.duration)}
                </p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  {song.bpm} bpm
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
