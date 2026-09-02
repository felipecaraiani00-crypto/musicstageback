export interface Section {
  id: string;
  songId: string;
  type: string;
  startTime: number; // in seconds (with millisecond precision)
  endTime: number; // in seconds (with millisecond precision)
  color: string;
}

export const SECTION_TYPES = [
  { value: "intro", label: "Intro", color: "hsl(200, 85%, 50%)" }, // Azul
  { value: "count", label: "Contagem", color: "hsl(205, 90%, 50%)" }, // Azul
  { value: "verse", label: "Verso", color: "hsl(285, 75%, 60%)" }, // Roxo (como na foto de referência)
  { value: "pre-chorus", label: "Pré-Refrão", color: "hsl(45, 95%, 50%)" }, // Amarelo
  { value: "chorus", label: "Refrão", color: "hsl(28, 95%, 52%)" }, // Laranja (como R1 na foto)
  { value: "bridge", label: "Ponte", color: "hsl(325, 75%, 55%)" }, // Magenta
  { value: "solo", label: "Solo", color: "hsl(0, 80%, 55%)" }, // Vermelho
  { value: "outro", label: "Outro", color: "hsl(220, 15%, 50%)" }, // Cinza
  { value: "ending", label: "Final", color: "hsl(215, 15%, 50%)" }, // Cinza
] as const;

export function getSectionColor(type: string): string {
  const lower = (type || "").toLowerCase().trim();
  if (lower.includes("intro") || lower.includes("count") || lower.includes("contagem")) return "hsl(200, 85%, 50%)"; // Azul
  if (lower.includes("vers") || lower.includes("verse")) return "hsl(285, 75%, 60%)"; // Roxo (V1 na foto)
  if (lower.includes("pr") || lower.includes("pre")) return "hsl(45, 95%, 50%)"; // Amarelo
  if (lower.includes("refr") || lower.includes("chorus")) return "hsl(28, 95%, 52%)"; // Laranja (R1 na foto)
  if (lower.includes("pont") || lower.includes("bridge")) return "hsl(325, 75%, 55%)"; // Magenta
  if (lower.includes("solo")) return "hsl(0, 80%, 55%)"; // Vermelho
  if (lower.includes("out") || lower.includes("fim") || lower.includes("final")) return "hsl(220, 15%, 50%)"; // Cinza

  const found = SECTION_TYPES.find((s) => s.value === type);
  return found?.color || "hsl(285, 75%, 60%)";
}

// Converte a cor da seção (hsl) para hsla com opacidade/transparência personalizada (ex: 0.15 para fundo, 0.4 para borda)
export function getSectionColorWithAlpha(color: string, alpha: number): string {
  if (!color) return `rgba(168, 85, 247, ${alpha})`;
  const clean = color.trim();
  if (clean.startsWith("hsl(") && clean.endsWith(")")) {
    const inner = clean.slice(4, -1);
    return `hsla(${inner}, ${alpha})`;
  }
  if (clean.startsWith("#")) {
    const hex = clean.slice(1);
    const r = parseInt(hex.slice(0, 2), 16) || 0;
    const g = parseInt(hex.slice(2, 4), 16) || 0;
    const b = parseInt(hex.slice(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return clean;
}

// Retorna a sigla compacta estilo Playback (ex: V1, R1, IN, PR, P)
export function getSectionSigla(section: Section, allSections?: Section[]): string {
  const typeLower = (section.type || "").toLowerCase().trim();

  let base = "";
  if (typeLower.includes("intro") || typeLower.includes("count") || typeLower.includes("contagem")) {
    base = "IN";
  } else if (typeLower.includes("vers") || typeLower.includes("verse")) {
    base = "V";
  } else if (typeLower.includes("pr") || typeLower.includes("pre")) {
    base = "PR";
  } else if (typeLower.includes("refr") || typeLower.includes("chorus")) {
    base = "R";
  } else if (typeLower.includes("pont") || typeLower.includes("bridge")) {
    base = "P";
  } else if (typeLower.includes("solo")) {
    base = "SO";
  } else if (typeLower.includes("out") || typeLower.includes("fim") || typeLower.includes("final") || typeLower.includes("ending")) {
    base = "OUT";
  } else {
    base = (section.type || "").toUpperCase().slice(0, 2);
  }

  if (allSections && allSections.length > 0) {
    if (base === "V") {
      const verses = allSections.filter((s) => (s.type || "").toLowerCase().includes("vers"));
      const idx = verses.findIndex((s) => s.id === section.id);
      return `V${idx !== -1 ? idx + 1 : 1}`;
    }
    if (base === "R") {
      const choruses = allSections.filter((s) => {
        const t = (s.type || "").toLowerCase();
        return t.includes("refr") || t.includes("chorus");
      });
      const idx = choruses.findIndex((s) => s.id === section.id);
      return `R${idx !== -1 ? idx + 1 : 1}`;
    }
    if (base === "PR") {
      const pres = allSections.filter((s) => {
        const t = (s.type || "").toLowerCase();
        return t.includes("pr") || t.includes("pre");
      });
      if (pres.length > 1) {
        const idx = pres.findIndex((s) => s.id === section.id);
        return `PR${idx !== -1 ? idx + 1 : 1}`;
      }
      return "PR";
    }
    if (base === "P") {
      const bridges = allSections.filter((s) => {
        const t = (s.type || "").toLowerCase();
        return t.includes("pont") || t.includes("bridge");
      });
      if (bridges.length > 1) {
        const idx = bridges.findIndex((s) => s.id === section.id);
        return `P${idx !== -1 ? idx + 1 : 1}`;
      }
      return "P";
    }
  }

  if (base === "V") return "V1";
  if (base === "R") return "R1";

  return base;
}

export function getSectionLabel(type: string): string {
  const found = SECTION_TYPES.find((s) => s.value === type);
  return found?.label || type;
}

// Retorna a sigla ou nome curto estilizado da seção (ex: INTRO, V1, V2, CHORUS, BRIDGE, OUTRO)
export function getSectionTag(section: Section, allSections?: Section[]): string {
  const typeLower = (section.type || "").toLowerCase().trim();

  let base = "";
  if (typeLower.includes("intro") || typeLower.includes("count") || typeLower.includes("contagem")) {
    base = "INTRO";
  } else if (typeLower.includes("vers") || typeLower.includes("verse")) {
    base = "V";
  } else if (typeLower.includes("pr") || typeLower.includes("pre")) {
    base = "PRE";
  } else if (typeLower.includes("refr") || typeLower.includes("chorus")) {
    base = "CHORUS";
  } else if (typeLower.includes("pont") || typeLower.includes("bridge")) {
    base = "BRIDGE";
  } else if (typeLower.includes("solo")) {
    base = "SOLO";
  } else if (typeLower.includes("out") || typeLower.includes("fim") || typeLower.includes("final") || typeLower.includes("ending")) {
    base = "OUTRO";
  } else {
    base = (section.type || "").toUpperCase().slice(0, 7);
  }

  // Se houver múltiplas seções do mesmo tipo, enumera (ex: V1, V2, CHORUS 1, CHORUS 2)
  if (allSections && allSections.length > 0) {
    if (base === "V") {
      const verses = allSections.filter((s) => (s.type || "").toLowerCase().includes("vers"));
      const idx = verses.findIndex((s) => s.id === section.id);
      return `V${idx !== -1 ? idx + 1 : 1}`;
    }
    if (base === "CHORUS") {
      const choruses = allSections.filter((s) => {
        const t = (s.type || "").toLowerCase();
        return t.includes("refr") || t.includes("chorus");
      });
      if (choruses.length > 1) {
        const idx = choruses.findIndex((s) => s.id === section.id);
        return `CHORUS ${idx !== -1 ? idx + 1 : 1}`;
      }
      return "CHORUS";
    }
    if (base === "BRIDGE") {
      const bridges = allSections.filter((s) => {
        const t = (s.type || "").toLowerCase();
        return t.includes("pont") || t.includes("bridge");
      });
      if (bridges.length > 1) {
        const idx = bridges.findIndex((s) => s.id === section.id);
        return `BRIDGE ${idx !== -1 ? idx + 1 : 1}`;
      }
      return "BRIDGE";
    }
  }

  if (base === "V") return "V1";

  return base;
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
