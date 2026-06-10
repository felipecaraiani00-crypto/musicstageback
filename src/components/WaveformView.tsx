import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Section } from "@/types/section";
import { SectionMarkers } from "./SectionMarkers";

interface WaveformViewProps {
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
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

    waveformData.current.forEach((value, i) => {
      const barHeight = value * (height * 0.8);
      const x = i * barWidth;
      const y = (height - barHeight) / 2;

      // Played portion in primary color with gradient effect, unplayed in muted
      if (i < playedBars) {
        // Create subtle pulse effect near the playhead
        const distanceFromPlayhead = playedBars - i;
        if (distanceFromPlayhead < 5) {
          const brightness = 50 + (5 - distanceFromPlayhead) * 3;
          ctx.fillStyle = `hsl(190, 95%, ${brightness}%)`;
        } else {
          ctx.fillStyle = "hsl(190, 95%, 50%)";
        }
      } else {
        ctx.fillStyle = "hsl(220, 15%, 30%)";
      }

      ctx.fillRect(x, y, barWidth - 1, barHeight);
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
      className="overflow-x-auto scrollbar-thin cursor-pointer h-full"
      onClick={handleClick}
    >
      <div className="relative min-w-[600px] h-full min-h-[40px]">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ width: "100%", height: "100%" }}
        />

        {/* Section Markers */}
        <SectionMarkers
          sections={sections}
          totalDuration={totalDuration}
          onSeekToSection={onSeek}
          loopSectionId={loopSectionId}
          onToggleLoop={onToggleLoop}
          onDeleteSection={onDeleteSection}
        />
        
        {/* Playhead - follows music in real-time */}
        <div
          className={cn(
            "absolute top-0 bottom-0 w-0.5 bg-accent shadow-lg pointer-events-none",
            isPlaying && "transition-none"
          )}
          style={{ 
            left: `${displayProgress}%`,
            boxShadow: "0 0 8px hsl(var(--accent)), 0 0 16px hsl(var(--accent) / 0.5)"
          }}
        >
          {/* Playhead triangle marker */}
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-accent rotate-45" />
          
          {/* Glow effect when playing */}
          {isPlaying && (
            <div 
              className="absolute top-0 bottom-0 w-1 -left-0.5 bg-accent/30 animate-pulse"
              style={{ filter: "blur(4px)" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
