import type { AudioFeatures, ReferenceKey, TrainingKey, VoiceCommand, VoiceResult } from "./types";

const COMMANDS: Record<ReferenceKey, Exclude<VoiceCommand, "UNKNOWN">> = { um: "SLIDE", ye: "SHORT_JUMP", jwejweiya: "LONG_JUMP" };
const KEYS: ReferenceKey[] = ["um", "ye", "jwejweiya"];
const STORAGE_KEY = "um-runner-voice-training-v1";
const MIN_PERSONAL_SAMPLES = 10;
const MAX_PERSONAL_SAMPLES = 20;
const MAX_UNKNOWN_SAMPLES = 40;
const K = 3;
const MIN_UNKNOWN_MARGIN = 0.12;
const WEIGHTS = { duration: 0.15, rmsEnvelope: 0.30, pitchContour: 0.35, zcrContour: 0.20 } as const;
const COMMAND_CALIBRATION: Record<ReferenceKey, { radiusMultiplier: number; radiusPadding: number; commandMargin: number }> = {
  um: { radiusMultiplier: 1.75, radiusPadding: 0.025, commandMargin: 0.12 },
  ye: { radiusMultiplier: 2.4, radiusPadding: 0.05, commandMargin: 0.05 },
  jwejweiya: { radiusMultiplier: 1.75, radiusPadding: 0.025, commandMargin: 0.12 },
};

type TrainingSamples = Record<TrainingKey, AudioFeatures[]>;

export class VoiceCommandDetector {
  private references = new Map<ReferenceKey, AudioFeatures>();
  private trainingSamples: TrainingSamples = this.loadTrainingSamples();
  threshold: number;
  constructor(threshold = 0.75) { this.threshold = threshold; }
  setReferences(references: Map<ReferenceKey, AudioFeatures>): void { this.references = references; }
  addTrainingSample(key: TrainingKey, features: AudioFeatures): { count: number; persisted: boolean } {
    const maximum = key === "unknown" ? MAX_UNKNOWN_SAMPLES : MAX_PERSONAL_SAMPLES;
    if (this.trainingSamples[key].length >= maximum) {
      return { count: this.trainingSamples[key].length, persisted: true };
    }
    this.trainingSamples[key].push(features);
    const persisted = this.saveTrainingSamples();
    return { count: this.trainingSamples[key].length, persisted };
  }
  resetTraining(): void {
    this.trainingSamples = { um: [], ye: [], jwejweiya: [], unknown: [] };
    try { localStorage.removeItem(STORAGE_KEY); } catch (error) { console.warn("Voice training reset failed", error); }
  }
  getTrainingCounts(): Record<TrainingKey, number> {
    return { um: this.trainingSamples.um.length, ye: this.trainingSamples.ye.length, jwejweiya: this.trainingSamples.jwejweiya.length, unknown: this.trainingSamples.unknown.length };
  }
  detect(features: AudioFeatures): VoiceResult {
    const usingPersonalTraining = KEYS.every((key) => this.trainingSamples[key].length >= MIN_PERSONAL_SAMPLES);
    const distances = {} as Record<ReferenceKey, number>;
    for (const key of KEYS) {
      const samples = usingPersonalTraining ? this.trainingSamples[key] : (this.references.has(key) ? [this.references.get(key)!] : []);
      const nearest = samples.map((sample) => this.distance(features, sample)).sort((a, b) => a - b).slice(0, K);
      distances[key] = nearest.length ? nearest.reduce((sum, value) => sum + value, 0) / nearest.length : 1;
    }
    const ranked = [...KEYS].sort((a, b) => distances[a] - distances[b]);
    const bestKey = ranked[0];
    const secondKey = ranked[1];
    const bestDistance = distances[bestKey];
    const secondDistance = distances[secondKey];
    const scores = {} as Record<ReferenceKey, number>;
    for (const key of KEYS) scores[key] = Math.exp(-distances[key]);
    const confidence = scores[bestKey];
    const margin = Math.max(0, (secondDistance - bestDistance) / Math.max(secondDistance, 0.000001));
    const unknownDistance = this.aggregateDistance(features, this.trainingSamples.unknown);
    const unknownMargin = Number.isFinite(unknownDistance) ? (unknownDistance - bestDistance) / Math.max(unknownDistance, 0.000001) : 1;
    const commandSamples = this.trainingSamples[bestKey];
    const calibration = COMMAND_CALIBRATION[bestKey];
    const baseAcceptanceRadius = usingPersonalTraining ? this.baseAcceptanceRadius(commandSamples) : 1;
    const acceptanceRadius = usingPersonalTraining
      ? Math.max(baseAcceptanceRadius * calibration.radiusMultiplier, baseAcceptanceRadius + calibration.radiusPadding)
      : 1;
    const commandRadiusPassed = !usingPersonalTraining || bestDistance <= acceptanceRadius;
    const requiredCommandMargin = calibration.commandMargin;
    const commandMarginPassed = margin >= requiredCommandMargin;
    const requiredUnknownMargin = MIN_UNKNOWN_MARGIN;
    const unknownMarginPassed = !Number.isFinite(unknownDistance) || unknownMargin >= MIN_UNKNOWN_MARGIN;
    const durationRange = usingPersonalTraining ? this.durationRange(commandSamples) : { lower: 0, upper: Number.POSITIVE_INFINITY };
    const durationGatePassed = features.duration >= durationRange.lower && features.duration <= durationRange.upper;
    let rejectReason: VoiceResult["rejectReason"] = "NONE";
    if (!commandRadiusPassed) rejectReason = "OUTSIDE_COMMAND_RADIUS";
    else if (!commandMarginPassed) rejectReason = "LOW_COMMAND_MARGIN";
    else if (!unknownMarginPassed) rejectReason = "TOO_CLOSE_TO_UNKNOWN";
    else if (!durationGatePassed) rejectReason = "DURATION_OUT_OF_RANGE";
    else if (!usingPersonalTraining && confidence < this.threshold) rejectReason = "LOW_FALLBACK_CONFIDENCE";
    return {
      command: rejectReason === "NONE" ? COMMANDS[bestKey] : "UNKNOWN",
      confidence, scores, distances, bestKey, bestDistance, secondDistance, margin,
      unknownDistance, unknownMargin, baseAcceptanceRadius, acceptanceRadius,
      commandRadiusPassed, commandMarginPassed, requiredCommandMargin, unknownMarginPassed, requiredUnknownMargin,
      durationGatePassed, durationLowerBound: durationRange.lower, durationUpperBound: durationRange.upper, rejectReason,
      usingPersonalTraining, features,
    };
  }
  private distance(a: AudioFeatures, b: AudioFeatures): number {
    const duration = Math.min(1, Math.abs(Math.log(Math.max(a.duration, 0.001) / Math.max(b.duration, 0.001))) / Math.log(2));
    const rmsEnvelope = this.meanAbsoluteDistance(a.rmsEnvelope, b.rmsEnvelope, 1);
    const pitchShape = this.meanAbsoluteDistance(a.pitchContour, b.pitchContour, 2);
    const voicing = this.meanAbsoluteDistance(a.pitchVoicing, b.pitchVoicing, 1);
    const pitchContour = pitchShape * 0.75 + voicing * 0.25;
    const zcrContour = this.meanAbsoluteDistance(a.zcrContour, b.zcrContour, 0.25);
    return duration * WEIGHTS.duration + rmsEnvelope * WEIGHTS.rmsEnvelope + pitchContour * WEIGHTS.pitchContour + zcrContour * WEIGHTS.zcrContour;
  }
  private meanAbsoluteDistance(a: number[], b: number[], scale: number): number {
    if (!a.length || a.length !== b.length) return 1;
    return Math.min(1, a.reduce((sum, value, index) => sum + Math.abs(value - b[index]), 0) / a.length / scale);
  }
  private aggregateDistance(features: AudioFeatures, samples: AudioFeatures[]): number {
    const nearest = samples.map((sample) => this.distance(features, sample)).sort((a, b) => a - b).slice(0, K);
    return nearest.length ? nearest.reduce((sum, value) => sum + value, 0) / nearest.length : Number.POSITIVE_INFINITY;
  }
  private baseAcceptanceRadius(samples: AudioFeatures[]): number {
    const leaveOneOut = samples
      .map((sample, index) => this.aggregateDistance(sample, samples.filter((_, otherIndex) => otherIndex !== index)))
      .sort((a, b) => a - b);
    return this.percentile(leaveOneOut, 0.95);
  }
  private durationRange(samples: AudioFeatures[]): { lower: number; upper: number } {
    const durations = samples.map((sample) => sample.duration).sort((a, b) => a - b);
    const low = this.percentile(durations, 0.05);
    const high = this.percentile(durations, 0.95);
    const padding = (high - low) * 0.25;
    const median = this.percentile(durations, 0.5);
    return {
      lower: Math.max(0, Math.min(low - padding, median * 0.60)),
      upper: Math.max(high + padding, median * 1.60),
    };
  }
  private percentile(sortedValues: number[], percentile: number): number {
    if (!sortedValues.length) return 0;
    const position = (sortedValues.length - 1) * percentile;
    const lower = Math.floor(position);
    const upper = Math.min(lower + 1, sortedValues.length - 1);
    return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (position - lower);
  }
  private loadTrainingSamples(): TrainingSamples {
    const empty: TrainingSamples = { um: [], ye: [], jwejweiya: [], unknown: [] };
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<TrainingSamples> | null;
      if (!parsed) return empty;
      for (const key of [...KEYS, "unknown"] as TrainingKey[]) empty[key] = Array.isArray(parsed[key]) ? parsed[key]!.filter((sample) => this.isValidFeature(sample)) : [];
    } catch (error) { console.warn("Voice training load failed", error); }
    return empty;
  }
  private saveTrainingSamples(): boolean {
    try {
      const serialized = JSON.stringify(this.trainingSamples);
      localStorage.setItem(STORAGE_KEY, serialized);
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== serialized) throw new Error("Stored voice training data did not match the saved data");
      return true;
    } catch (error) {
      console.warn("Voice training save failed", error);
      return false;
    }
  }
  private isValidFeature(value: unknown): value is AudioFeatures {
    if (!value || typeof value !== "object") return false;
    const feature = value as Partial<AudioFeatures>;
    return typeof feature.duration === "number" && [feature.rmsEnvelope, feature.pitchContour, feature.pitchVoicing, feature.zcrContour].every((contour) => Array.isArray(contour) && contour.length === 32 && contour.every(Number.isFinite));
  }
}
