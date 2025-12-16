interface TimeDisplayProps {
  currentTime: number;
  totalDuration: number;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function TimeDisplay({ currentTime, totalDuration }: TimeDisplayProps) {
  return (
    <div className="flex items-baseline gap-1 font-mono">
      <span className="text-2xl font-bold text-primary text-glow-primary">
        {formatTime(currentTime)}
      </span>
      <span className="text-lg text-muted-foreground">/</span>
      <span className="text-lg text-muted-foreground">
        {formatTime(totalDuration)}
      </span>
    </div>
  );
}
