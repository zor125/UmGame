import { AUDIO_CONFIG } from "../game/constants";
import { AudioFeatureExtractor } from "./AudioFeatureExtractor";
import type { AudioFeatures, AudioStatus, ReferenceKey } from "./types";

type StatusListener = (status: AudioStatus) => void;
type UtteranceListener = (features: AudioFeatures) => void;

export class AudioManager {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private animationFrame = 0;
  private recording: number[] = [];
  private silenceStarted = 0;
  private utteranceStarted = 0;
  private extractor = new AudioFeatureExtractor();
  private status: AudioStatus = { enabled: false, rms: 0, vadState: "idle", lastUtteranceDuration: 0 };
  constructor(private readonly onStatus: StatusListener, private readonly onUtterance: UtteranceListener) {}

  async enable(): Promise<void> {
    if (this.status.enabled) return;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.context = new AudioContext(); await this.context.resume();
    const source = this.context.createMediaStreamSource(this.stream);
    this.analyser = this.context.createAnalyser(); this.analyser.fftSize = AUDIO_CONFIG.fftSize; this.analyser.smoothingTimeConstant = 0;
    source.connect(this.analyser); this.setStatus({ enabled: true, vadState: "listening" }); this.monitor();
  }
  async analyzeReferences(): Promise<Map<ReferenceKey, AudioFeatures>> {
    const context = this.context ?? new AudioContext();
    const files: Record<ReferenceKey, string> = { um: "/audio/um.m4a", ye: "/audio/ye.m4a", jwejweiya: "/audio/jwejweiya.m4a" };
    const result = new Map<ReferenceKey, AudioFeatures>();
    await Promise.all((Object.entries(files) as [ReferenceKey, string][]).map(async ([key, url]) => {
      const response = await fetch(url); if (!response.ok) throw new Error(`${url} (${response.status})`);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      result.set(key, this.extractor.extract(this.mixDown(buffer), buffer.sampleRate));
    }));
    if (!this.context) await context.close(); return result;
  }
  private monitor = (): void => {
    if (!this.analyser || !this.context) return;
    const frame = new Float32Array(this.analyser.fftSize); this.analyser.getFloatTimeDomainData(frame);
    const rms = Math.sqrt(frame.reduce((sum, value) => sum + value * value, 0) / frame.length);
    const now = performance.now();
    if (this.status.vadState !== "recording" && rms >= AUDIO_CONFIG.vadThreshold) { this.recording = []; this.utteranceStarted = now; this.silenceStarted = 0; this.setStatus({ vadState: "recording" }); }
    if (this.status.vadState === "recording") {
      this.recording.push(...frame);
      if (rms < AUDIO_CONFIG.vadThreshold) { if (!this.silenceStarted) this.silenceStarted = now; } else this.silenceStarted = 0;
      const duration = now - this.utteranceStarted;
      if ((this.silenceStarted && now - this.silenceStarted >= AUDIO_CONFIG.vadSilenceMs) || duration >= AUDIO_CONFIG.vadMaxDurationMs) this.finishUtterance(duration);
    }
    this.setStatus({ rms }); this.animationFrame = requestAnimationFrame(this.monitor);
  };
  private finishUtterance(durationMs: number): void {
    if (!this.context) return; this.setStatus({ vadState: "processing", lastUtteranceDuration: durationMs / 1000 });
    if (durationMs >= AUDIO_CONFIG.vadMinDurationMs) this.onUtterance(this.extractor.extract(Float32Array.from(this.recording), this.context.sampleRate));
    this.recording = []; this.silenceStarted = 0; this.setStatus({ vadState: "listening" });
  }
  private mixDown(buffer: AudioBuffer): Float32Array {
    const output = new Float32Array(buffer.length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) { const data = buffer.getChannelData(channel); for (let i = 0; i < data.length; i++) output[i] += data[i] / buffer.numberOfChannels; }
    return output;
  }
  private setStatus(patch: Partial<AudioStatus>): void { this.status = { ...this.status, ...patch }; this.onStatus(this.status); }
  destroy(): void { cancelAnimationFrame(this.animationFrame); this.stream?.getTracks().forEach((track) => track.stop()); void this.context?.close(); }
}
