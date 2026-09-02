import { Song } from "./audioEngine";

/**
 * Extrai dados reais de amplitude (picos) a partir do AudioBuffer das faixas da música
 */
export function extractWaveformDataFromSong(song?: Song | null, numPoints = 300): number[] | null {
  if (!song || !song.tracks || song.tracks.length === 0) return null;

  // Procura uma faixa representativa que tenha áudio carregado (preferindo faixas completas/mix/instrumentos)
  const nonClickTracks = song.tracks.filter((t) => !t.isClickTrack && t.audioBuffer);
  const preferredTrack =
    nonClickTracks.find(
      (t) =>
        t.trackName.toLowerCase().includes("master") ||
        t.trackName.toLowerCase().includes("mix") ||
        t.trackName.toLowerCase().includes("full") ||
        t.trackName.toLowerCase().includes("all")
    ) ||
    nonClickTracks.find((t) => t.trackName.toLowerCase().includes("drum")) ||
    nonClickTracks.find((t) => t.trackName.toLowerCase().includes("guit")) ||
    nonClickTracks[0] ||
    song.tracks.find((t) => t.audioBuffer);

  if (!preferredTrack || !preferredTrack.audioBuffer) return null;

  const audioBuffer = preferredTrack.audioBuffer;
  const channelData = audioBuffer.getChannelData(0);
  const length = channelData.length;
  if (length === 0) return null;

  const points: number[] = [];
  const blockSize = Math.max(1, Math.floor(length / numPoints));
  let maxPeak = 0;

  for (let i = 0; i < numPoints; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, length);
    let peak = 0;
    // Amostragem com salto de 4 amostras para alta velocidade
    for (let j = start; j < end; j += 4) {
      const val = Math.abs(channelData[j]);
      if (val > peak) peak = val;
    }
    points.push(peak);
    if (peak > maxPeak) maxPeak = peak;
  }

  // Normaliza os picos entre 0.12 e 0.95
  const scale = maxPeak > 0 ? 0.9 / maxPeak : 1;
  return points.map((p) => Math.max(0.12, Math.min(0.98, p * scale)));
}

/**
 * Gera uma forma de onda com assinatura única e determinística para cada música
 */
export function generateWaveformForSong(songId: string, numPoints = 300): number[] {
  let hash = 0;
  for (let i = 0; i < (songId || "default").length; i++) {
    hash = (hash << 5) - hash + (songId || "default").charCodeAt(i);
    hash |= 0;
  }
  const seed = Math.abs(hash) || 54321;
  const points: number[] = [];

  for (let i = 0; i < numPoints; i++) {
    // Variação orgânica pseudoaleatória
    const r1 = Math.sin((seed * 0.013 + i) * 0.08) * 0.5 + 0.5;
    const r2 = Math.cos((seed * 0.037 + i) * 0.03) * 0.3;
    const spike = (i % 17 === 0 || i % 29 === 0) ? 0.25 : 0;
    const base = 0.2 + r1 * 0.5 + r2 + spike;
    points.push(Math.max(0.12, Math.min(0.95, base)));
  }

  return points;
}

export function generateDefaultWaveform(numPoints = 300): number[] {
  return generateWaveformForSong("default-song-id", numPoints);
}
