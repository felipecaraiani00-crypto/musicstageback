import { Library, Upload, Settings as SettingsIcon, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLibrary: () => void;
  onOpenImport: () => void;
  onOpenSectionEditor: () => void;
}

export function SettingsMenu({ 
  isOpen, 
  onClose, 
  onOpenLibrary, 
  onOpenImport,
  onOpenSectionEditor,
}: SettingsMenuProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Menu */}
      <div className="absolute right-3 top-12 z-50 w-48 py-1 rounded-lg bg-card border border-border shadow-xl animate-fade-in">
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