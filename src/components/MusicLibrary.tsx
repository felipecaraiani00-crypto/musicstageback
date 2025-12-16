import { useState } from "react";
import { Music, Check, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Song } from "./SongList";

interface MusicLibraryProps {
  songs: Song[];
  selectedIds: string[];
  onToggleSelect: (songId: string) => void;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function MusicLibrary({ songs, selectedIds, onToggleSelect, onClose }: MusicLibraryProps) {
  const [search, setSearch] = useState("");

  const filteredSongs = songs.filter(
    (song) =>
      song.title.toLowerCase().includes(search.toLowerCase()) ||
      (song.artist?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const selectedCount = selectedIds.length;

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Music className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold">Biblioteca</h2>
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
        >
          Concluir ({selectedCount})
        </button>
      </header>

      {/* Search */}
      <div className="px-4 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar músicas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-secondary text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Song list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {filteredSongs.map((song) => {
          const isSelected = selectedIds.includes(song.id);

          return (
            <button
              key={song.id}
              onClick={() => onToggleSelect(song.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left",
                isSelected
                  ? "bg-primary/20 border border-primary/50"
                  : "bg-secondary/30 hover:bg-secondary/50 border border-transparent"
              )}
            >
              {/* Checkbox */}
              <div
                className={cn(
                  "w-6 h-6 rounded-md flex items-center justify-center border-2 transition-all",
                  isSelected
                    ? "bg-primary border-primary"
                    : "border-muted-foreground/50"
                )}
              >
                {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
              </div>

              {/* Song info */}
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium truncate", isSelected && "text-primary")}>
                  {song.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {song.artist || (song.trackCount ? `${song.trackCount} tracks` : '')}
                </p>
              </div>

              {/* Duration & BPM */}
              <div className="text-right">
                <p className="text-xs font-mono text-muted-foreground">
                  {formatDuration(song.duration)}
                </p>
                <p className="text-xs font-mono text-muted-foreground">{song.bpm} bpm</p>
              </div>
            </button>
          );
        })}

        {filteredSongs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Music className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma música encontrada</p>
          </div>
        )}
      </div>
    </div>
  );
}
