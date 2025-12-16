import { useState, useRef } from "react";
import { Upload, FileArchive, X, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { importZipFile, ImportProgress } from "@/lib/zipImporter";
import { Song } from "@/lib/audioEngine";

interface ImportMusicProps {
  onImport: (songs: Song[]) => void;
  onClose: () => void;
}

interface ImportedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  status: 'pending' | 'importing' | 'complete' | 'error';
  progress: ImportProgress | null;
  error?: string;
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
    
    // Filter only ZIP files
    const zipFiles = selectedFiles.filter(f => f.name.toLowerCase().endsWith('.zip'));
    
    const newFiles: ImportedFile[] = zipFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name.replace(/\.zip$/i, ""), // Song name from ZIP filename
      size: file.size,
      status: 'pending',
      progress: null,
    }));

    setFiles((prev) => [...prev, ...newFiles]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleImport = async () => {
    setIsImporting(true);
    const importedSongs: Song[] = [];

    for (const fileItem of files) {
      // Update status to importing
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileItem.id ? { ...f, status: 'importing' as const } : f
        )
      );

      // Process ZIP file
      const result = await importZipFile(fileItem.file, (progress) => {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileItem.id ? { ...f, progress } : f
          )
        );
      });

      if (result.success && result.song) {
        importedSongs.push(result.song);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileItem.id ? { ...f, status: 'complete' as const } : f
          )
        );
      } else {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileItem.id
              ? { ...f, status: 'error' as const, error: result.error }
              : f
          )
        );
      }
    }

    if (importedSongs.length > 0) {
      onImport(importedSongs);
    }

    setIsImporting(false);
    
    // Close if all successful
    const hasErrors = files.some(f => f.status === 'error');
    if (!hasErrors && importedSongs.length > 0) {
      onClose();
    }
  };

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const maxSize = 600 * 1024 * 1024; // 600 MB

  const getStatusIcon = (status: ImportedFile['status']) => {
    switch (status) {
      case 'importing':
        return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
      case 'complete':
        return <span className="text-green-500">✓</span>;
      case 'error':
        return <span className="text-destructive">✗</span>;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold">Importar Músicas (ZIP)</h2>
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
          Importe arquivos ZIP contendo as tracks de áudio (.wav, .mp3). O nome do ZIP será o nome da música.
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
            {formatFileSize(totalSize)} / 600 MB
          </span>
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {files.map((file) => (
          <div
            key={file.id}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg bg-secondary/50",
              file.status === 'error' && "border border-destructive/50"
            )}
          >
            <FileArchive className="w-8 h-8 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(file.size)}
                {file.progress && file.status === 'importing' && (
                  <span className="ml-2">
                    • {file.progress.stage === 'extracting' ? 'Extraindo' : 
                       file.progress.stage === 'analyzing' ? 'Detectando BPM' : 'Decodificando'}: {file.progress.progress}%
                  </span>
                )}
                {file.error && (
                  <span className="text-destructive ml-2">• {file.error}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(file.status)}
              {file.status === 'pending' && (
                <button
                  onClick={() => removeFile(file.id)}
                  className="p-1.5 rounded hover:bg-destructive/20 transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Add more */}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={isImporting}
          className={cn(
            "w-full flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors text-muted-foreground hover:text-primary",
            isImporting && "opacity-50 cursor-not-allowed"
          )}
        >
          <Plus className="w-5 h-5" />
          <span className="text-sm">Adicionar arquivos ZIP</span>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".zip"
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
