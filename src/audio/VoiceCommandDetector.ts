import type { AudioFeatures, ReferenceKey, VoiceCommand, VoiceResult } from "./types";

const COMMANDS: Record<ReferenceKey, Exclude<VoiceCommand, "UNKNOWN">> = { um: "SLIDE", ye: "SHORT_JUMP", jwejweiya: "LONG_JUMP" };

export class VoiceCommandDetector {
  private references = new Map<ReferenceKey, AudioFeatures>();
  threshold: number;
  constructor(threshold = 0.75) { this.threshold = threshold; }
  setReferences(references: Map<ReferenceKey, AudioFeatures>): void { this.references = references; }
  detect(features: AudioFeatures): VoiceResult {
    const scores: Record<ReferenceKey, number> = { um: 0, ye: 0, jwejweiya: 0 };
    for (const [key, reference] of this.references) scores[key] = this.similarity(features, reference);
    const best = (Object.keys(scores) as ReferenceKey[]).reduce((a, b) => scores[a] >= scores[b] ? a : b);
    const confidence = scores[best];
    return { command: confidence >= this.threshold ? COMMANDS[best] : "UNKNOWN", confidence, scores, features };
  }
  private similarity(a: AudioFeatures, b: AudioFeatures): number {
    const duration = this.ratioSimilarity(a.duration, b.duration);
    const pitch = this.nullableRatio(a.averagePitch, b.averagePitch);
    const rangeA = a.minPitch !== null && a.maxPitch !== null ? a.maxPitch - a.minPitch : null;
    const rangeB = b.minPitch !== null && b.maxPitch !== null ? b.maxPitch - b.minPitch : null;
    const range = this.nullableRatio(rangeA, rangeB);
    const contour = this.contourSimilarity(a.pitchContour, b.pitchContour);
    return this.clamp(duration * 0.28 + pitch * 0.25 + range * 0.17 + contour * 0.30);
  }
  private ratioSimilarity(a: number, b: number): number { return this.clamp(1 - Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 0.001)); }
  private nullableRatio(a: number | null, b: number | null): number { return a === null && b === null ? 0.5 : a === null || b === null ? 0 : this.ratioSimilarity(a, b); }
  private contourSimilarity(a: number[], b: number[]): number {
    const va = a.filter(Boolean); const vb = b.filter(Boolean); if (va.length < 2 || vb.length < 2) return 0.25;
    const length = 20; const ra = this.resample(va, length); const rb = this.resample(vb, length);
    const normalize = (values: number[]): number[] => { const mean = values.reduce((x, y) => x + y, 0) / values.length; const scale = Math.max(...values.map((v) => Math.abs(v - mean)), 1); return values.map((v) => (v - mean) / scale); };
    const na = normalize(ra); const nb = normalize(rb); const error = na.reduce((sum, value, i) => sum + Math.abs(value - nb[i]), 0) / length;
    return this.clamp(1 - error / 2);
  }
  private resample(values: number[], length: number): number[] { return Array.from({ length }, (_, i) => { const p = i * (values.length - 1) / (length - 1); const left = Math.floor(p); const right = Math.min(left + 1, values.length - 1); return values[left] + (values[right] - values[left]) * (p - left); }); }
  private clamp(value: number): number { return Math.max(0, Math.min(1, value)); }
}
