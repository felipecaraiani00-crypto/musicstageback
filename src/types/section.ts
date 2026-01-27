export interface Section {
  id: string;
  songId: string;
  type: string;
  startTime: number; // in seconds (with millisecond precision)
  color: string;
}

export const SECTION_TYPES = [
  { value: "intro", label: "Intro", color: "hsl(190, 95%, 50%)" },
  { value: "verse", label: "Verso", color: "hsl(145, 70%, 45%)" },
  { value: "chorus", label: "Refrão", color: "hsl(280, 70%, 55%)" },
  { value: "bridge", label: "Ponte", color: "hsl(38, 95%, 55%)" },
  { value: "solo", label: "Solo", color: "hsl(320, 60%, 50%)" },
  { value: "outro", label: "Outro", color: "hsl(0, 72%, 55%)" },
] as const;

export function getSectionColor(type: string): string {
  const found = SECTION_TYPES.find((s) => s.value === type);
  return found?.color || "hsl(200, 70%, 45%)";
}

export function getSectionLabel(type: string): string {
  const found = SECTION_TYPES.find((s) => s.value === type);
  return found?.label || type;
}

// Parse time string (MM:SS:mmm or SS:mmm or SS) to seconds
export function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.split(":").map((p) => p.trim());
  
  if (parts.length === 3) {
    // MM:SS:mmm
    const mins = parseInt(parts[0], 10) || 0;
    const secs = parseInt(parts[1], 10) || 0;
    const ms = parseInt(parts[2].padEnd(3, "0").slice(0, 3), 10) || 0;
    return mins * 60 + secs + ms / 1000;
  } else if (parts.length === 2) {
    // SS:mmm or MM:SS
    const first = parseInt(parts[0], 10) || 0;
    const second = parseInt(parts[1], 10) || 0;
    // If second part is 3 digits, treat as SS:mmm
    if (parts[1].length === 3) {
      return first + second / 1000;
    }
    // Otherwise treat as MM:SS
    return first * 60 + second;
  } else {
    // Just seconds
    return parseFloat(parts[0]) || 0;
  }
}

// Format seconds to MM:SS:mmm
export function formatTimeWithMs(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${ms.toString().padStart(3, "0")}`;
}
