import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Section } from "@/types/section";
import { SectionMarkers, TransitionMode } from "./SectionMarkers";

interface WaveformViewProps {
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

export function WaveformView({
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
  const animationRef = useRef<number | null>(null);
  const [displayProgress, setDisplayProgress] = useState(0);

  // Generate fake waveform data
  const generateWaveform = () => {
    const points: number[] = [];
    const numPoints = 300;
    for (let i = 0; i < numPoints; i++) {
      // Create varied wave heights for visual interest
      const base = 0.3 + Math.random() * 0.4;
      const variation = Math.sin(i * 0.1) * 0.2;
      const spike = Math.random() > 0.9 ? 0.3 : 0;
      points.push(Math.min(1, base + variation + spike));
    }
    return points;
  };

  const waveformData = useRef(generateWaveform());
  
  // Calculate progress percent
  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  // Smooth animation update
  useEffect(() => {
    setDisplayProgress(progressPercent);
  }, [progressPercent]);

  // Auto-scroll to keep playhead visible
  useEffect(() => {
    if (containerRef.current && isPlaying) {
      const container = containerRef.current;
      const scrollPosition = (displayProgress / 100) * container.scrollWidth - container.clientWidth / 2;
      container.scrollTo({ left: Math.max(0, scrollPosition), behavior: "smooth" });
    }
  }, [displayProgress, isPlaying]);

  // Draw waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const barWidth = width / waveformData.current.length;
    const playedBars = Math.floor((displayProgress / 100) * waveformData.current.length);

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

    // Renderização das barras da onda em tom prateado/lavanda orgânico conforme imagem
    waveformData.current.forEach((value, i) => {
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
  }, [displayProgress]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left + container.scrollLeft;
    const totalWidth = container.scrollWidth;
    const clickPercent = clickX / totalWidth;
    const newTime = clickPercent * totalDuration;
    
    onSeek(Math.max(0, Math.min(totalDuration, newTime)));
  };

  return (
    <div
      ref={containerRef}
      className="w-full cursor-pointer h-full overflow-hidden"
      onClick={handleClick}
    >
      <div className="relative w-full h-full min-h-[50px]">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ width: "100%", height: "100%" }}
        />

        {/* Blocos de Seção Envolvendo a Waveform (Badge circular no topo-esquerdo, loop no topo-direito) */}
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
        
        {/* Cursor de Reprodução (Playhead) - Linha vertical branca limpa e bem definida cruzando toda a onda */}
        <div
          className={cn(
            "absolute top-0 bottom-0 w-[2px] bg-white pointer-events-none z-30",
            isPlaying && "transition-none"
          )}
          style={{ 
            left: `${displayProgress}%`,
            boxShadow: "0 0 6px rgba(255, 255, 255, 0.9), 0 0 12px rgba(255, 255, 255, 0.5)"
          }}
        >
          {/* Ponta superior do cursor de reprodução */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rotate-45 rounded-xs shadow-md" />
        </div>
      </div>
    </div>
  );
}
