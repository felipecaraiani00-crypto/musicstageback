import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Music2, RotateCcw } from "lucide-react";
import { audioEngine } from "@/lib/audioEngine";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class PlayerErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[PlayerErrorBoundary] Erro crítico capturado:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetMemory = () => {
    try {
      audioEngine.clearAllSongs();
    } catch (e) {
      console.warn("Erro ao limpar músicas:", e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0d1117] text-white flex flex-col items-center justify-center p-6 select-none">
          <div className="max-w-md w-full bg-[#161b22] border border-[#30363d] rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
            {/* Ícone */}
            <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-4 text-cyan-400">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            </div>

            <h2 className="text-xl font-bold tracking-tight mb-2">
              Aviso de Execução do Player
            </h2>

            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              Ocorreu um imprevisto na renderização ou decodificação das faixas de áudio neste dispositivo. Os recursos foram preservados para evitar o travamento do sistema.
            </p>

            {/* Ações */}
            <div className="w-full space-y-3">
              <button
                onClick={this.handleReload}
                className="w-full py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-cyan-500/20 active:scale-[0.98]"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar Player
              </button>

              <button
                onClick={this.handleResetMemory}
                className="w-full py-2.5 px-4 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-gray-300 text-sm font-medium flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
              >
                <RotateCcw className="w-4 h-4 text-gray-400" />
                Liberar Memória & Restaurar
              </button>
            </div>

            {/* Detalhes técnicos para debug (recolhível) */}
            {this.state.error && (
              <details className="mt-6 w-full text-left text-xs text-gray-500">
                <summary className="cursor-pointer hover:text-gray-400 select-none">
                  Detalhes técnicos do erro
                </summary>
                <div className="mt-2 p-3 bg-black/50 rounded-lg font-mono text-[11px] overflow-x-auto text-red-400 border border-red-500/20 max-h-40">
                  {this.state.error.toString()}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default PlayerErrorBoundary;
