import { useState, useEffect } from "react";
import { Download, Smartphone, Check, Share, MoreVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Install() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl">
            <Smartphone className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Stageback</h1>
          <p className="text-muted-foreground">
            App de playback profissional para músicos em palco
          </p>
        </div>

        {isInstalled ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-green-500">
              <Check className="w-6 h-6" />
              <span className="text-lg font-medium">App instalado!</span>
            </div>
            <button
              onClick={() => navigate("/")}
              className="w-full py-4 px-6 bg-primary text-primary-foreground rounded-xl font-semibold text-lg hover:bg-primary/90 transition-colors"
            >
              Abrir Stageback
            </button>
          </div>
        ) : isIOS ? (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-semibold">Como instalar no iPhone/iPad:</h2>
              <ol className="text-left space-y-4 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</span>
                  <span>Toque no botão <Share className="inline w-4 h-4 mx-1" /> Compartilhar na barra do Safari</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</span>
                  <span>Role para baixo e toque em "Adicionar à Tela de Início"</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</span>
                  <span>Confirme tocando em "Adicionar"</span>
                </li>
              </ol>
            </div>
            <button
              onClick={() => navigate("/")}
              className="w-full py-3 px-6 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-secondary/80 transition-colors"
            >
              Continuar no navegador
            </button>
          </div>
        ) : deferredPrompt ? (
          <div className="space-y-4">
            <button
              onClick={handleInstall}
              className="w-full py-4 px-6 bg-primary text-primary-foreground rounded-xl font-semibold text-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-3"
            >
              <Download className="w-6 h-6" />
              Instalar Stageback
            </button>
            <button
              onClick={() => navigate("/")}
              className="w-full py-3 px-6 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-secondary/80 transition-colors"
            >
              Continuar no navegador
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-semibold">Como instalar no Android:</h2>
              <ol className="text-left space-y-4 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</span>
                  <span>Toque no menu <MoreVertical className="inline w-4 h-4 mx-1" /> do navegador</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</span>
                  <span>Selecione "Instalar app" ou "Adicionar à tela inicial"</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</span>
                  <span>Confirme a instalação</span>
                </li>
              </ol>
            </div>
            <button
              onClick={() => navigate("/")}
              className="w-full py-3 px-6 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-secondary/80 transition-colors"
            >
              Continuar no navegador
            </button>
          </div>
        )}

        {/* Features */}
        <div className="pt-8 border-t border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Por que instalar?</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Check className="w-4 h-4 text-green-500" />
              <span>Funciona offline</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Check className="w-4 h-4 text-green-500" />
              <span>Tela cheia</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Check className="w-4 h-4 text-green-500" />
              <span>Acesso rápido</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Check className="w-4 h-4 text-green-500" />
              <span>Carrega rápido</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
