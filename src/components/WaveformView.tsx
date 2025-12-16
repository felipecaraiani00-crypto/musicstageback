import { useRef, useEffect, useMemo } from "react";

interface WaveformViewProps {
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  waveformData?: number[]; // Real waveform data from AudioBuffer
}

export function WaveformView({
  currentTime,
  totalDuration,
  isPlaying,
  onSeek,
  waveformData: externalWaveformData,
}: WaveformViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate fake waveform data only if no real data provided
  const fakeWaveformData = useMemo(() => {
    const points: number[] = [];
    const numPoints = 300;
    for (let i = 0; i < numPoints; i++) {
      const base = 0.3 + Math.random() * 0.4;
      const variation = Math.sin(i * 0.1) * 0.2;
      const spike = Math.random() > 0.9 ? 0.3 : 0;
      points.push(Math.min(1, base + variation + spike));
    }
    return points;
  }, []);

  // Use external waveform data if available, otherwise use fake data
  const waveformPoints = externalWaveformData && externalWaveformData.length > 0 
    ? externalWaveformData 
    : fakeWaveformData;

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  // Auto-scroll to keep playhead visible
  useEffect(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const playheadPosition = (progressPercent / 100) * container.scrollWidth;
    const viewStart = container.scrollLeft;
    const viewEnd = container.scrollLeft + container.clientWidth;
    
    // Check if playhead is outside visible area (with some margin)
    const margin = container.clientWidth * 0.15;
    const isOutOfView = playheadPosition < viewStart + margin || playheadPosition > viewEnd - margin;
    
    if (isPlaying && isOutOfView) {
      // Center the playhead in the view
      const scrollPosition = playheadPosition - container.clientWidth / 2;
      container.scrollTo({ left: Math.max(0, scrollPosition), behavior: "smooth" });
    }
  }, [currentTime, isPlaying, progressPercent]);

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
    const barWidth = width / waveformPoints.length;
    const playedBars = Math.floor((progressPercent / 100) * waveformPoints.length);

    ctx.clearRect(0, 0, width, height);

    waveformPoints.forEach((value, i) => {
      const barHeight = Math.max(2, value * (height * 0.85));
      const x = i * barWidth;
      const y = (height - barHeight) / 2;

      // Played portion in primary color, unplayed in muted
      if (i < playedBars) {
        ctx.fillStyle = "hsl(190, 95%, 50%)";
      } else {
        ctx.fillStyle = "hsl(220, 15%, 30%)";
      }

      ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
    });
  }, [progressPercent, waveformPoints]);

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
        
        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-accent shadow-lg pointer-events-none transition-all duration-100"
          style={{ left: `${progressPercent}%` }}
        >
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-accent rotate-45" />
        </div>
      </div>
    </div>
  );
}
