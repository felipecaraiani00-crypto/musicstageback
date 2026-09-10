import { useState, useRef } from "react";
import { Upload, FileArchive, Music, X, Plus, Loader2, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { importZipFile, importAudioFiles, isAudioFile, ImportProgress } from "@/lib/zipImporter";
import { Song } from "@/lib/audioEngine";

interface ImportMusicProps {
  onImport: (songs: Song[]) => void;
  onClose: () => void;
}

interface ImportedItem {
  id: string;
  type: 'zip' | 'audioGroup';
  file?: File;
  files: File[];
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
  const [files, setFiles] = useState<ImportedItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;
    
    const zipFiles = selectedFiles.filter(f => f.name.toLowerCase().endsWith('.zip'));
    const looseAudioFiles = selectedFiles.filter(f => isAudioFile(f.name));
    
    const newItems: ImportedItem[] = [];

    // Arquivos ZIP
    zipFiles.forEach((file) => {
      newItems.push({
        id: crypto.randomUUID(),
        type: 'zip',
        file,
        files: [file],
        name: file.name.replace(/\.zip$/i, ""),
        size: file.size,
        status: 'pending',
        progress: null,
      });
    });

    // Múltiplos arquivos de áudio selecionados (multitrack local)
    if (looseAudioFiles.length > 0) {
      const groupSize = looseAudioFiles.reduce((acc, f) => acc + f.size, 0);
      const firstName = looseAudioFiles[0].name.replace(/\.[^/.]+$/, "");
      const cleanName = firstName.replace(/[\s_-]*(click|guia|guide|drums|baixo|bass|vocal|guitar|keys|pad).*/i, "").trim() || "Multitrack Importado";

      newItems.push({
        id: crypto.randomUUID(),
        type: 'audioGroup',
        files: looseAudioFiles,
        name: cleanName,
        size: groupSize,
        status: 'pending',
        progress: null,
      });
    }

    setFiles((prev) => [...prev, ...newItems]);
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

      const onProg = (progress: ImportProgress) => {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileItem.id ? { ...f, progress } : f
          )
        );
      };

      // Processa ZIP ou Grupo de Áudios locais isoladamente
      const result =
        fileItem.type === 'zip' && fileItem.file
          ? await importZipFile(fileItem.file, onProg)
          : await importAudioFiles(fileItem.files, fileItem.name, onProg);

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
    
    // Fecha se todas forem bem-sucedidas
    const hasErrors = files.some(f => f.status === 'error');
    if (!hasErrors && importedSongs.length > 0) {
      onClose();
    }
  };

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const maxSize = 700 * 1024 * 1024; // 700 MB - suporta arquivos grandes

  const getStatusIcon = (status: ImportedItem['status']) => {
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
          <h2 className="text-base font-semibold">Importar Músicas (ZIP ou Áudios)</h2>
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
          Importe arquivos ZIP ou selecione múltiplos stems (.wav, .mp3). Cada canal é decodificado de forma individual e protegida.
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
            {formatFileSize(totalSize)} / 700 MB
          </span>
        </div>

        {/* Dica de Performance Mobile (WAV pesado vs MP3 320k) */}
        <div className="mt-3 p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30 flex items-start gap-2.5 text-xs text-cyan-200">
          <Smartphone className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <span className="font-semibold text-cyan-300">Dica de Performance Mobile:</span>
            <p className="text-cyan-200/80 leading-relaxed text-[11px]">
              Stems em <strong>.WAV</strong> brutos (24-bit / 96kHz) consomem muita memória do navegador móvel. Para performance leve sem risco de travamento no Safari/Chrome móvel, recomendamos o uso de faixas em <strong>.MP3 (320kbps)</strong> ou <strong>.M4A</strong>.
            </p>
          </div>
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
            {file.type === 'audioGroup' ? (
              <Music className="w-8 h-8 text-primary" />
            ) : (
              <FileArchive className="w-8 h-8 text-primary" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {file.type === 'audioGroup' ? `${file.files.length} faixas · ` : ''}
                {formatFileSize(file.size)}
                {file.progress && file.status === 'importing' && (
                  <span className="ml-2">
                    • {file.progress.stage === 'extracting' ? 'Preparando' : 'Decodificando'}: {file.progress.progress}%
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
          <span className="text-sm">Adicionar ZIP ou faixas de áudio (.wav, .mp3)</span>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".zip,.wav,.mp3,.aiff,.flac,.ogg,.m4a,audio/*"
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
              Importar {files.length > 0 ? `(${files.length} itens)` : ""}
            </>
          )}
        </button>
      </footer>
    </div>
  );
}
