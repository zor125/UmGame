import { AUDIO_CONFIG } from "../game/constants";
import type { AudioFeatures } from "./types";

export class AudioFeatureExtractor {
  extract(samples: Float32Array, sampleRate: number): AudioFeatures {
    if (!samples.length) return { duration: 0, rms: 0, zeroCrossingRate: 0, averagePitch: null, minPitch: null, maxPitch: null, pitchContour: [] };
    let sumSquares = 0; let crossings = 0;
    for (let i = 0; i < samples.length; i++) {
      sumSquares += samples[i] * samples[i];
      if (i && ((samples[i - 1] < 0 && samples[i] >= 0) || (samples[i - 1] >= 0 && samples[i] < 0))) crossings++;
    }
    const pitches: number[] = [];
    const size = Math.min(AUDIO_CONFIG.pitchFrameSize, samples.length);
    const hop = Math.max(1, Math.min(AUDIO_CONFIG.pitchHopSize, size));
    if (size >= 256) {
      for (let start = 0; start + size <= samples.length; start += hop) {
        const pitch = this.detectPitch(samples.subarray(start, start + size), sampleRate);
        pitches.push(pitch ?? 0);
      }
      if (!pitches.length) pitches.push(this.detectPitch(samples, sampleRate) ?? 0);
    }
    const voiced = pitches.filter((pitch) => pitch > 0);
    return {
      duration: samples.length / sampleRate,
      rms: Math.sqrt(sumSquares / samples.length),
      zeroCrossingRate: crossings / Math.max(1, samples.length - 1),
      averagePitch: voiced.length ? voiced.reduce((a, b) => a + b, 0) / voiced.length : null,
      minPitch: voiced.length ? Math.min(...voiced) : null,
      maxPitch: voiced.length ? Math.max(...voiced) : null,
      pitchContour: pitches,
    };
  }

  private detectPitch(frame: Float32Array, sampleRate: number): number | null {
    let energy = 0; for (const value of frame) energy += value * value;
    if (Math.sqrt(energy / frame.length) < 0.01) return null;
    const minLag = Math.floor(sampleRate / AUDIO_CONFIG.pitchMaxHz);
    const maxLag = Math.min(Math.floor(sampleRate / AUDIO_CONFIG.pitchMinHz), frame.length - 2);
    let bestLag = 0; let bestCorrelation = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let correlation = 0; let normA = 0; let normB = 0;
      for (let i = 0; i < frame.length - lag; i++) { const a = frame[i]; const b = frame[i + lag]; correlation += a * b; normA += a * a; normB += b * b; }
      const normalized = correlation / Math.sqrt(normA * normB || 1);
      if (normalized > bestCorrelation) { bestCorrelation = normalized; bestLag = lag; }
    }
    return bestCorrelation > 0.55 && bestLag ? sampleRate / bestLag : null;
  }
}
