export type VoiceCommand = "SLIDE" | "SHORT_JUMP" | "LONG_JUMP" | "UNKNOWN";
export type ReferenceKey = "um" | "ye" | "jwejweiya";

export interface AudioFeatures {
  duration: number;
  rms: number;
  zeroCrossingRate: number;
  averagePitch: number | null;
  minPitch: number | null;
  maxPitch: number | null;
  pitchContour: number[];
}

export interface VoiceResult {
  command: VoiceCommand;
  confidence: number;
  scores: Record<ReferenceKey, number>;
  features: AudioFeatures;
}

export interface AudioStatus {
  enabled: boolean;
  rms: number;
  vadState: "idle" | "listening" | "recording" | "processing";
  lastUtteranceDuration: number;
}
