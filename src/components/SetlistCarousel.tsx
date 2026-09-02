import { useRef, useEffect } from "react";
import { Play, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Song } from "@/components/SongList";

interface SetlistCarouselProps {
  songs: Song[];
  currentSongId: string;
  onSongSelect: (song: Song) => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function SetlistCarousel({ songs, currentSongId, onSongSelect }: SetlistCarouselProps) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [currentSongId]);

  if (songs.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-muted-foreground border-b border-border bg-card/30 min-h-[48px]">
        <span className="opacity-50">♪</span>
        <span>Nenhuma música no setlist — importe músicas pelo menu</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0 overflow-x-auto scrollbar-thin border-b border-border bg-card/30 py-1.5 px-2 min-h-[52px]">
      {songs.map((song, index) => {
        const isActive = song.id === currentSongId;
        const displayKey = song.key ? ` (${song.key})` : "";
        const isLast = index === songs.length - 1;

        return (
          <div key={song.id} className="flex items-center flex-shrink-0">
            <button
              ref={isActive ? activeRef : null}
              onClick={() => onSongSelect(song)}
              className={cn(
                "flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all duration-200 select-none",
                "min-w-[160px] max-w-[220px] text-left",
                isActive
                  ? "bg-primary/15 border-primary shadow-[0_0_10px_rgba(6,182,212,0.3)] ring-1 ring-primary"
                  : "bg-card/60 border-border/50 hover:bg-secondary/60 hover:border-border"
              )}
            >
              {/* Thumbnail / número */}
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                    : "bg-muted/80 text-muted-foreground"
                )}
              >
                {isActive ? (
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              {/* Título + tom + duração */}
              <div className="flex-1 min-w-0">
                <p className={cn("text-[11px] font-semibold leading-tight truncate", isActive ? "text-primary" : "text-foreground")}>
                  {song.title}
                  {displayKey && (
                    <span className={cn("font-bold ml-0.5", isActive ? "text-accent" : "text-muted-foreground")}>
                      {displayKey}
                    </span>
                  )}
                </p>
                <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                  {formatDuration(song.duration)}{song.bpm ? ` · ${song.bpm}bpm` : ""}
                </p>
              </div>
            </button>

            {/* Seta de transição entre cards */}
            {!isLast && (
              <div className="flex items-center justify-center w-5 flex-shrink-0 mx-0.5">
                <div className="w-4 h-4 rounded-full bg-muted/60 border border-border/40 flex items-center justify-center">
                  <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/70" />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
