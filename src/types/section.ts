export interface Section {
  id: string;
  songId: string;
  type: string;
  startTime: number; // in seconds (with millisecond precision)
  endTime: number; // in seconds (with millisecond precision)
  color: string;
}

export const SECTION_TYPES = [
  { value: "intro", label: "Intro", color: "hsl(200, 85%, 45%)" }, // Tom de azul
  { value: "count", label: "Contagem", color: "hsl(205, 90%, 48%)" }, // Tom de azul
  { value: "verse", label: "Verso", color: "hsl(145, 65%, 40%)" }, // Tom de verde
  { value: "pre-chorus", label: "Pré-Refrão", color: "hsl(35, 92%, 48%)" }, // Tom de amarelo/laranja
  { value: "chorus", label: "Refrão", color: "hsl(25, 92%, 50%)" }, // Tom de amarelo/laranja
  { value: "bridge", label: "Ponte", color: "hsl(280, 65%, 50%)" }, // Tom de vermelho/roxo
  { value: "solo", label: "Solo", color: "hsl(330, 70%, 48%)" }, // Tom de vermelho/roxo
  { value: "outro", label: "Outro", color: "hsl(220, 15%, 45%)" }, // Tom de cinza
  { value: "ending", label: "Final", color: "hsl(215, 15%, 45%)" }, // Tom de cinza
] as const;

export function getSectionColor(type: string): string {
  const lower = (type || "").toLowerCase().trim();
  if (lower.includes("intro") || lower.includes("count") || lower.includes("contagem")) return "hsl(200, 85%, 45%)"; // Azul
  if (lower.includes("vers") || lower.includes("verse")) return "hsl(145, 65%, 40%)"; // Verde
  if (lower.includes("refr") || lower.includes("chorus") || lower.includes("pr") || lower.includes("pre")) return "hsl(28, 92%, 50%)"; // Amarelo/Laranja
  if (lower.includes("pont") || lower.includes("bridge") || lower.includes("solo")) return "hsl(280, 65%, 50%)"; // Vermelho/Roxo
  if (lower.includes("out") || lower.includes("fim") || lower.includes("final")) return "hsl(220, 15%, 45%)"; // Cinza

  const found = SECTION_TYPES.find((s) => s.value === type);
  return found?.color || "hsl(200, 70%, 45%)";
}

export function getSectionLabel(type: string): string {
  const found = SECTION_TYPES.find((s) => s.value === type);
  return found?.label || type;
}

// Parse time string (MM:SS:mmm or SS:mmm or SS) to seconds
export function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim();
  const parts = clean.split(":").map((p) => p.trim());

  if (parts.length === 3) {
    const mins = parseInt(parts[0], 10) || 0;
    const secs = parseInt(parts[1], 10) || 0;
    const msStr = parts[2].padEnd(3, "0").slice(0, 3);
    const ms = parseInt(msStr, 10) || 0;
    return mins * 60 + secs + ms / 1000;
  } else if (parts.length === 2) {
    const first = parseInt(parts[0], 10) || 0;
    if (parts[1].includes(".")) {
      const secFloat = parseFloat(parts[1]) || 0;
      return first * 60 + secFloat;
    }
    const second = parseInt(parts[1], 10) || 0;
    return first * 60 + second;
  } else {
    return parseFloat(parts[0]) || 0;
  }
}

export function formatTimeWithMs(seconds: number): string {
  const totalMs = Math.max(0, Math.round((seconds || 0) * 1000));
  const mins = Math.floor(totalMs / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${ms.toString().padStart(3, "0")}`;
}
