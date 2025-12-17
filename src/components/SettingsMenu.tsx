import { Library, Upload, Settings as SettingsIcon, Music2, HardDrive, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLibrary: () => void;
  onOpenImport: () => void;
  onOpenSectionEditor: () => void;
  cacheSize?: string;
  onClearCache?: () => void;
}

export function SettingsMenu({ 
  isOpen, 
  onClose, 
  onOpenLibrary, 
  onOpenImport,
  onOpenSectionEditor,
  cacheSize,
  onClearCache,
}: SettingsMenuProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Menu */}
      <div className="absolute right-3 top-12 z-50 w-52 py-1 rounded-lg bg-card border border-border shadow-xl animate-fade-in">
        <button
          onClick={() => {
            onOpenLibrary();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary transition-colors text-left"
        >
          <Library className="w-4 h-4 text-primary" />
          <span className="text-sm">Biblioteca</span>
        </button>

        <button
          onClick={() => {
            onOpenImport();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary transition-colors text-left"
        >
          <Upload className="w-4 h-4 text-accent" />
          <span className="text-sm">Importar Músicas</span>
        </button>

        <button
          onClick={() => {
            onOpenSectionEditor();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary transition-colors text-left"
        >
          <Music2 className="w-4 h-4 text-green-500" />
          <span className="text-sm">Editar Seções</span>
        </button>

        <div className="h-px bg-border my-1" />

        {/* Cache info */}
        {cacheSize && (
          <div className="px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Cache: {cacheSize}</span>
            </div>
            {onClearCache && (
              <button
                onClick={() => {
                  if (confirm('Limpar cache local? As músicas serão baixadas novamente quando necessário.')) {
                    onClearCache();
                    onClose();
                  }
                }}
                className="p-1 hover:bg-destructive/20 rounded transition-colors"
                title="Limpar cache"
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </button>
            )}
          </div>
        )}

        <div className="h-px bg-border my-1" />

        <button
          onClick={onClose}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary transition-colors text-left"
        >
          <SettingsIcon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">Configurações</span>
        </button>
      </div>
    </>
  );
}