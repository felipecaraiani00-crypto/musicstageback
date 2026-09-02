import { useRef, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Section } from "@/types/section";
import { SectionMarkers, TransitionMode } from "./SectionMarkers";
import { audioEngine } from "@/lib/audioEngine";
import {
  extractWaveformDataFromSong,
  generateWaveformForSong,
  generateDefaultWaveform,
} from "@/lib/waveformExtractor";

interface WaveformViewProps {
  songId?: string;
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  pendingSectionId?: string | null;
  pendingMode?: TransitionMode | null;
  onSectionSelect?: (sectionId: string, startTime: number, mode: TransitionMode) => void;
  onSeek: (time: number) => void;
  sections?: Section[];
  loopSectionId?: string | null;
  onToggleLoop?: (sectionId: string) => void;
  onDeleteSection?: (sectionId: string) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function WaveformView({
  songId,
  currentTime,
  totalDuration,
  isPlaying,
  pendingSectionId,
  pendingMode,
  onSectionSelect,
  onSeek,
  sections = [],
  loopSectionId,
  onToggleLoop,
  onDeleteSection,
}: WaveformViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Waveform dinâmica baseada na música selecionada
  const [waveformData, setWaveformData] = useState<number[]>(() =>
    songId ? generateWaveformForSong(songId) : generateDefaultWaveform()
  );

  // Estado de arraste da agulha (Scrubbing via drag)
  const [isDragging, setIsDragging] = useState(false);
  const [dragPercent, setDragPercent] = useState<number | null>(null);
  const isDraggingRef = useRef(false);

  // Atualiza a forma de onda ao alternar de música ou ao carregar novas faixas
  useEffect(() => {
    if (!songId) {
      setWaveformData(generateDefaultWaveform());
      return;
    }

    const song = audioEngine.getSong(songId);
    const realPeaks = extractWaveformDataFromSong(song);
    if (realPeaks && realPeaks.length > 0) {
      setWaveformData(realPeaks);
    } else {
      setWaveformData(generateWaveformForSong(songId));
    }
  }, [songId]);

  // Porcentagem de progresso real da reprodução
  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
  
  // Posição exibida: segue o mouse enquanto arrasta, ou a reprodução em tempo real
  const displayProgress = isDragging && dragPercent !== null ? dragPercent : progressPercent;

  // Auto-scroll suave para manter a agulha sempre visível se a onda tiver overflow
  useEffect(() => {
    if (containerRef.current && isPlaying && !isDragging) {
      const container = containerRef.current;
      const scrollPosition = (displayProgress / 100) * container.scrollWidth - container.clientWidth / 2;
      container.scrollTo({ left: Math.max(0, scrollPosition), behavior: "smooth" });
    }
  }, [displayProgress, isPlaying, isDragging]);

  // Renderização da forma de onda no Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const pointsCount = waveformData.length || 300;
    const barWidth = width / pointsCount;
    const playedBars = Math.floor((displayProgress / 100) * pointsCount);

    ctx.clearRect(0, 0, width, height);

    // Linha horizontal central
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Linhas de grade verticais (beats / compassos) finas e semitransparentes
    const numGridLines = Math.max(20, Math.floor(width / 32));
    const gridSpacing = width / numGridLines;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    for (let g = 0; g <= numGridLines; g++) {
      const gx = Math.round(g * gridSpacing);
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, height);
      ctx.stroke();
    }

    // Barras da forma de onda
    waveformData.forEach((value, i) => {
      const barHeight = Math.max(2, value * (height * 0.72));
      const x = i * barWidth;
      const y = (height - barHeight) / 2;

      if (i < playedBars) {
        ctx.fillStyle = "rgba(240, 238, 245, 0.95)"; // Porção tocada: prata claro/branco
      } else {
        ctx.fillStyle = "rgba(165, 155, 180, 0.65)"; // Porção não tocada: lavanda suave
      }

      ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
    });
  }, [displayProgress, waveformData]);

  // Cálculo da posição de arraste a partir de coordenada X
  const calculatePercentFromX = useCallback((clientX: number): number => {
    const container = containerRef.current;
    if (!container) return 0;
    const rect = container.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const clampedX = Math.max(0, Math.min(rect.width, offsetX));
    return (clampedX / rect.width) * 100;
  }, []);

  // Início do arraste pelo mouse
  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    isDraggingRef.current = true;
    const initialPercent = calculatePercentFromX(e.clientX);
    setDragPercent(initialPercent);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const percent = calculatePercentFromX(moveEvent.clientX);
      setDragPercent(percent);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      const finalPercent = calculatePercentFromX(upEvent.clientX);
      setDragPercent(null);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      if (totalDuration > 0) {
        const newTime = (finalPercent / 100) * totalDuration;
        onSeek(Math.max(0, Math.min(totalDuration, newTime)));
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Início do arraste por toque (Mobile)
  const handlePlayheadTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length === 0) return;
    setIsDragging(true);
    isDraggingRef.current = true;
    const initialPercent = calculatePercentFromX(e.touches[0].clientX);
    setDragPercent(initialPercent);

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (!isDraggingRef.current || moveEvent.touches.length === 0) return;
      const percent = calculatePercentFromX(moveEvent.touches[0].clientX);
      setDragPercent(percent);
    };

    const handleTouchEnd = (endEvent: TouchEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      const clientX = endEvent.changedTouches[0]?.clientX ?? 0;
      const finalPercent = calculatePercentFromX(clientX);
      setDragPercent(null);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);

      if (totalDuration > 0) {
        const newTime = (finalPercent / 100) * totalDuration;
        onSeek(Math.max(0, Math.min(totalDuration, newTime)));
      }
    };

    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
  };

  const previewTime = totalDuration > 0 ? (displayProgress / 100) * totalDuration : 0;

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden select-none relative"
    >
      <div className="relative w-full h-full min-h-[50px]">
        <canvas
          ref={canvasRef}
          className="w-full h-full pointer-events-none"
          style={{ width: "100%", height: "100%" }}
        />

        {/* Blocos de Seção Envolvendo a Waveform (Cliques EOS e Next Bar 100% preservados) */}
        <SectionMarkers
          sections={sections}
          totalDuration={totalDuration}
          currentTime={currentTime}
          isPlaying={isPlaying}
          pendingSectionId={pendingSectionId}
          pendingMode={pendingMode}
          onSectionSelect={onSectionSelect}
          onSeekToSection={onSeek}
          loopSectionId={loopSectionId}
          onToggleLoop={onToggleLoop}
        />
        
        {/* Cursor de Reprodução (Playhead) - Agulha móvel contínua e arrastável */}
        <div
          className="absolute top-0 bottom-0 z-30 flex items-center justify-center cursor-ew-resize select-none"
          style={{ 
            left: `${displayProgress}%`,
            transform: "translateX(-50%)",
            width: "26px", // Área de hit confortável para clique e toque
          }}
          onMouseDown={handlePlayheadMouseDown}
          onTouchStart={handlePlayheadTouchStart}
          onClick={(e) => e.stopPropagation()}
          title="Clique e arraste a agulha para avançar ou retroceder a música"
        >
          {/* Linha vertical branca que cruza toda a onda */}
          <div
            className={cn(
              "w-[2px] h-full bg-white transition-all pointer-events-none",
              isDragging && "w-[3px] bg-white shadow-[0_0_12px_rgba(255,255,255,1)] scale-y-105"
            )}
            style={{ 
              boxShadow: isDragging 
                ? "0 0 10px rgba(255, 255, 255, 1), 0 0 20px rgba(255, 255, 255, 0.8)"
                : "0 0 6px rgba(255, 255, 255, 0.9), 0 0 12px rgba(255, 255, 255, 0.5)"
            }}
          />

          {/* Ponta superior triangular do cursor */}
          <div
            className={cn(
              "absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rotate-45 rounded-xs shadow-md pointer-events-none transition-transform",
              isDragging && "scale-125"
            )}
          />

          {/* Badge flutuante de tempo durante o arraste (Scrubbing preview) */}
          {isDragging && totalDuration > 0 && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/90 border border-white/40 text-white text-[10px] font-mono px-2 py-0.5 rounded shadow-xl whitespace-nowrap pointer-events-none">
              {formatTime(previewTime)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { WaveformView };
export default WaveformView;

