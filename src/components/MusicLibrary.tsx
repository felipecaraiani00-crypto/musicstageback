import { useState } from "react";
import { Music, Check, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Song } from "./SongList";
import { toast } from "sonner";

interface MusicLibraryProps {
  songs: Song[];
  selectedIds: string[];
  onToggleSelect: (songId: string) => void;
  onDelete?: (songId: string) => Promise<void>;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function MusicLibrary({ songs, selectedIds, onToggleSelect, onDelete, onClose }: MusicLibraryProps) {
  const [search, setSearch] = useState("");
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteSelection, setDeleteSelection] = useState<Set<string>>(new Set());

  const filteredSongs = songs.filter(
    (song) =>
      song.title.toLowerCase().includes(search.toLowerCase()) ||
      (song.artist?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const selectedCount = selectedIds.length;

  const toggleDeleteSelection = (songId: string) => {
    setDeleteSelection(prev => {
      const next = new Set(prev);
      if (next.has(songId)) {
        next.delete(songId);
      } else {
        next.add(songId);
      }
      return next;
    });
  };

  const handleSingleDelete = async (e: React.MouseEvent, songId: string) => {
    e.stopPropagation();
    if (!onDelete) return;
    
    if (confirm("Tem certeza que deseja excluir esta música?")) {
      setDeletingIds(prev => new Set(prev).add(songId));
      await onDelete(songId);
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(songId);
        return next;
      });
      toast.success("Música excluída");
    }
  };

  const handleBatchDelete = async () => {
    if (!onDelete || deleteSelection.size === 0) return;
    
    const count = deleteSelection.size;
    if (!confirm(`Tem certeza que deseja excluir ${count} música${count > 1 ? 's' : ''}?`)) {
      return;
    }

    setDeletingIds(deleteSelection);
    
    for (const songId of deleteSelection) {
      await onDelete(songId);
    }
    
    toast.success(`${count} música${count > 1 ? 's' : ''} excluída${count > 1 ? 's' : ''}`);
    setDeleteSelection(new Set());
    setDeleteMode(false);
    setDeletingIds(new Set());
  };

  const selectAllForDelete = () => {
    setDeleteSelection(new Set(filteredSongs.map(s => s.id)));
  };

  const clearDeleteSelection = () => {
    setDeleteSelection(new Set());
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Music className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold">Biblioteca</h2>
        </div>
        <div className="flex items-center gap-2">
          {deleteMode ? (
            <>
              <button
                onClick={() => {
                  setDeleteMode(false);
                  setDeleteSelection(new Set());
                }}
                className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleBatchDelete}
                disabled={deleteSelection.size === 0 || deletingIds.size > 0}
                className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium disabled:opacity-50"
              >
                {deletingIds.size > 0 ? "Excluindo..." : `Excluir (${deleteSelection.size})`}
              </button>
            </>
          ) : (
            <>
              {onDelete && songs.length > 0 && (
                <button
                  onClick={() => setDeleteMode(true)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Excluir múltiplas"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
              >
                Concluir ({selectedCount})
              </button>
            </>
          )}
        </div>
      </header>

      {/* Delete mode toolbar */}
      {deleteMode && (
        <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/30 flex items-center justify-between">
          <span className="text-sm text-destructive">
            {deleteSelection.size} selecionada{deleteSelection.size !== 1 ? 's' : ''} para excluir
          </span>
          <div className="flex gap-2">
            <button
              onClick={selectAllForDelete}
              className="text-xs text-destructive hover:underline"
            >
              Selecionar todas
            </button>
            <button
              onClick={clearDeleteSelection}
              className="text-xs text-muted-foreground hover:underline"
            >
              Limpar
            </button>
          </div>
        </div>
      )}

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
          const isDeleting = deletingIds.has(song.id);
          const isMarkedForDelete = deleteSelection.has(song.id);

          return (
            <div
              key={song.id}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg transition-all",
                deleteMode && isMarkedForDelete
                  ? "bg-destructive/20 border border-destructive/50"
                  : isSelected
                    ? "bg-primary/20 border border-primary/50"
                    : "bg-secondary/30 hover:bg-secondary/50 border border-transparent",
                isDeleting && "opacity-50 pointer-events-none"
              )}
            >
              {/* Checkbox */}
              <button
                onClick={() => deleteMode ? toggleDeleteSelection(song.id) : onToggleSelect(song.id)}
                className={cn(
                  "w-6 h-6 rounded-md flex items-center justify-center border-2 transition-all flex-shrink-0",
                  deleteMode && isMarkedForDelete
                    ? "bg-destructive border-destructive"
                    : isSelected
                      ? "bg-primary border-primary"
                      : "border-muted-foreground/50 hover:border-primary/50"
                )}
              >
                {(deleteMode ? isMarkedForDelete : isSelected) && (
                  deleteMode ? (
                    <X className="w-4 h-4 text-destructive-foreground" />
                  ) : (
                    <Check className="w-4 h-4 text-primary-foreground" />
                  )
                )}
              </button>

              {/* Song info */}
              <button
                onClick={() => deleteMode ? toggleDeleteSelection(song.id) : onToggleSelect(song.id)}
                className="flex-1 min-w-0 text-left"
              >
                <p className={cn(
                  "text-sm font-medium truncate",
                  deleteMode && isMarkedForDelete ? "text-destructive" : isSelected && "text-primary"
                )}>
                  {song.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {song.artist || (song.trackCount ? `${song.trackCount} tracks` : '')}
                </p>
              </button>

              {/* Duration & BPM */}
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-mono text-muted-foreground">
                  {formatDuration(song.duration)}
                </p>
                <p className="text-xs font-mono text-muted-foreground">{song.bpm} bpm</p>
              </div>

              {/* Delete button (only in normal mode) */}
              {onDelete && !deleteMode && (
                <button
                  onClick={(e) => handleSingleDelete(e, song.id)}
                  className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                  title="Excluir música"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
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