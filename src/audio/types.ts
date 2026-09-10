export type VoiceCommand = "SLIDE" | "SHORT_JUMP" | "LONG_JUMP" | "UNKNOWN";
export type ReferenceKey = "um" | "ye" | "jwejweiya";
export type TrainingKey = ReferenceKey | "unknown";

export interface FeatureProfile {
  prepareResampleMs: number;
  rmsEnvelopeMs: number;
  pitchContourMs: number;
  zcrContourMs: number;
  normalizeMs: number;
  totalMs: number;
}

export interface UtteranceTiming {
  speechStartedAt: number;
  speechEndedAt: number;
  utteranceDurationMs: number;
  featureExtractionMs: number;
  featureProfile: FeatureProfile;
}

export interface VoiceLatency {
  speechToEndMs: number;
  featureExtractionMs: number;
  classificationMs: number;
  speechEndToCommandMs: number;
  inputDispatchMs: number;
  commandToActionMs: number | null;
  speechEndToActionMs: number | null;
  speechStartToActionMs: number | null;
  featureProfile: FeatureProfile;
}

export interface AudioFeatures {
  duration: number;
  rms: number;
  zeroCrossingRate: number;
  averagePitch: number | null;
  minPitch: number | null;
  maxPitch: number | null;
  pitchContour: number[];
  rmsEnvelope: number[];
  pitchVoicing: number[];
  zcrContour: number[];
}

export interface VoiceResult {
  command: VoiceCommand;
  confidence: number;
  scores: Record<ReferenceKey, number>;
  distances: Record<ReferenceKey, number>;
  bestKey: ReferenceKey;
  bestDistance: number;
  secondDistance: number;
  margin: number;
  unknownDistance: number;
  unknownMargin: number;
  baseAcceptanceRadius: number;
  acceptanceRadius: number;
  commandRadiusPassed: boolean;
  commandMarginPassed: boolean;
  requiredCommandMargin: number;
  unknownMarginPassed: boolean;
  requiredUnknownMargin: number;
  durationGatePassed: boolean;
  durationLowerBound: number;
  durationUpperBound: number;
  rejectReason: "NONE" | "OUTSIDE_COMMAND_RADIUS" | "LOW_COMMAND_MARGIN" | "TOO_CLOSE_TO_UNKNOWN" | "DURATION_OUT_OF_RANGE" | "LOW_FALLBACK_CONFIDENCE";
  usingPersonalTraining: boolean;
  features: AudioFeatures;
}

export interface AudioStatus {
  enabled: boolean;
  rms: number;
  peak: number;
  nonZeroSamples: number;
  sampleCount: number;
  streamActive: boolean;
  trackLabel: string;
  trackEnabled: boolean;
  trackMuted: boolean;
  trackState: MediaStreamTrackState | "unavailable";
  audioContextState: AudioContextState | "unavailable";
  sampleRate: number;
  vadState: "idle" | "listening" | "recording" | "processing";
  lastUtteranceDuration: number;
}
