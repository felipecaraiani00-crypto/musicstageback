// BPM Detection using energy-based beat detection algorithm

interface BpmResult {
  bpm: number;
  confidence: number;
}

/**
 * Detects BPM from an AudioBuffer using energy-based peak detection
 */
export function detectBPM(audioBuffer: AudioBuffer): BpmResult {
  // Get audio data from first channel
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  
  // Configuration
  const minBPM = 60;
  const maxBPM = 180;
  const windowSize = Math.floor(sampleRate * 0.02); // 20ms windows
  const hopSize = Math.floor(windowSize / 2);
  
  // Calculate energy for each window
  const energies: number[] = [];
  for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < windowSize; j++) {
      energy += channelData[i + j] * channelData[i + j];
    }
    energies.push(energy / windowSize);
  }
  
  // Normalize energies
  const maxEnergy = Math.max(...energies);
  const normalizedEnergies = energies.map(e => e / maxEnergy);
  
  // Detect peaks (beats) using local maximum with threshold
  const peaks: number[] = [];
  const threshold = 0.3;
  const minPeakDistance = Math.floor((sampleRate / hopSize) * (60 / maxBPM)); // Min samples between peaks
  
  for (let i = 1; i < normalizedEnergies.length - 1; i++) {
    if (
      normalizedEnergies[i] > threshold &&
      normalizedEnergies[i] > normalizedEnergies[i - 1] &&
      normalizedEnergies[i] > normalizedEnergies[i + 1]
    ) {
      // Check minimum distance from last peak
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minPeakDistance) {
        peaks.push(i);
      }
    }
  }
  
  if (peaks.length < 2) {
    return { bpm: 120, confidence: 0 }; // Default fallback
  }
  
  // Calculate intervals between peaks
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }
  
  // Convert intervals to BPM and find most common
  const bpmCounts: Map<number, number> = new Map();
  const hopDuration = hopSize / sampleRate; // Duration of one hop in seconds
  
  intervals.forEach(interval => {
    const beatDuration = interval * hopDuration; // Duration between beats in seconds
    const rawBpm = 60 / beatDuration;
    
    // Normalize BPM to reasonable range (handle half-time/double-time)
    let normalizedBpm = rawBpm;
    while (normalizedBpm < minBPM) normalizedBpm *= 2;
    while (normalizedBpm > maxBPM) normalizedBpm /= 2;
    
    // Round to nearest integer
    const roundedBpm = Math.round(normalizedBpm);
    
    if (roundedBpm >= minBPM && roundedBpm <= maxBPM) {
      bpmCounts.set(roundedBpm, (bpmCounts.get(roundedBpm) || 0) + 1);
    }
  });
  
  // Find most common BPM with tolerance grouping
  const groupedBpms: Map<number, number> = new Map();
  const tolerance = 2; // Group BPMs within ±2
  
  bpmCounts.forEach((count, bpm) => {
    // Find existing group
    let foundGroup = false;
    groupedBpms.forEach((groupCount, groupBpm) => {
      if (Math.abs(bpm - groupBpm) <= tolerance) {
        groupedBpms.set(groupBpm, groupCount + count);
        foundGroup = true;
      }
    });
    if (!foundGroup) {
      groupedBpms.set(bpm, count);
    }
  });
  
  // Get BPM with highest count
  let bestBpm = 120;
  let bestCount = 0;
  let totalCount = 0;
  
  groupedBpms.forEach((count, bpm) => {
    totalCount += count;
    if (count > bestCount) {
      bestCount = count;
      bestBpm = bpm;
    }
  });
  
  // Calculate confidence (0-1)
  const confidence = totalCount > 0 ? bestCount / totalCount : 0;
  
  return { bpm: bestBpm, confidence };
}

/**
 * Detects BPM from multiple AudioBuffers (tracks) and returns average
 */
export function detectBPMFromTracks(audioBuffers: AudioBuffer[]): BpmResult {
  if (audioBuffers.length === 0) {
    return { bpm: 120, confidence: 0 };
  }
  
  // Detect BPM from each track
  const results = audioBuffers.map(buffer => detectBPM(buffer));
  
  // Weight by confidence and average
  let weightedSum = 0;
  let totalWeight = 0;
  
  results.forEach(result => {
    if (result.confidence > 0.1) { // Ignore very low confidence results
      weightedSum += result.bpm * result.confidence;
      totalWeight += result.confidence;
    }
  });
  
  if (totalWeight === 0) {
    // Fallback to simple average
    const avgBpm = results.reduce((sum, r) => sum + r.bpm, 0) / results.length;
    return { bpm: Math.round(avgBpm), confidence: 0.3 };
  }
  
  const avgBpm = Math.round(weightedSum / totalWeight);
  const avgConfidence = totalWeight / results.length;
  
  return { bpm: avgBpm, confidence: avgConfidence };
}
