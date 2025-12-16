import { useState, useRef } from "react";
import { Upload, FileAudio, X, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Song } from "./SongList";

interface ImportMusicProps {
  onImport: (songs: Song[]) => void;
  onClose: () => void;
}

interface ImportedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  trackCount: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function ImportMusic({ onImport, onClose }: ImportMusicProps) {
  const [files, setFiles] = useState<ImportedFile[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    const newFiles: ImportedFile[] = selectedFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
      size: file.size,
      trackCount: Math.floor(Math.random() * 8) + 6, // Simulated 6-13 tracks
    }));

    setFiles((prev) => [...prev, ...newFiles]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleImport = async () => {
    setIsImporting(true);
    
    // Simulate import process
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const newSongs: Song[] = files.map((f) => ({
      id: crypto.randomUUID(),
      title: f.name,
      artist: "Importado",
      duration: Math.floor(Math.random() * 180) + 180, // 3-6 min
      bpm: Math.floor(Math.random() * 60) + 60, // 60-120 bpm
    }));

    onImport(newSongs);
    setIsImporting(false);
    onClose();
  };

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const maxSize = 200 * 1024 * 1024; // 200 MB

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold">Importar Músicas</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-secondary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Info */}
      <div className="px-4 py-3 border-b border-border bg-secondary/30">
        <p className="text-xs text-muted-foreground">
          Importe arquivos de áudio com até 13 tracks. Tamanho máximo: 200 MB por sessão.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                totalSize > maxSize ? "bg-destructive" : "bg-primary"
              )}
              style={{ width: `${Math.min(100, (totalSize / maxSize) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {formatFileSize(totalSize)} / 200 MB
          </span>
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {files.map((file) => (
          <div
            key={file.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50"
          >
            <FileAudio className="w-8 h-8 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(file.size)} • {file.trackCount} tracks
              </p>
            </div>
            <button
              onClick={() => removeFile(file.id)}
              className="p-1.5 rounded hover:bg-destructive/20 transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        ))}

        {/* Add more */}
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors text-muted-foreground hover:text-primary"
        >
          <Plus className="w-5 h-5" />
          <span className="text-sm">Adicionar arquivos</span>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.wav,.mp3,.aiff,.flac"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Footer */}
      <footer className="px-4 py-3 border-t border-border">
        <button
          onClick={handleImport}
          disabled={files.length === 0 || totalSize > maxSize || isImporting}
          className={cn(
            "w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2",
            files.length > 0 && totalSize <= maxSize && !isImporting
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          {isImporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Importar {files.length > 0 ? `(${files.length} arquivos)` : ""}
            </>
          )}
        </button>
      </footer>
    </div>
  );
}
