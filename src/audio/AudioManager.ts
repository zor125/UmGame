import { AUDIO_CONFIG } from "../game/constants";
import { AudioFeatureExtractor } from "./AudioFeatureExtractor";
import type { AudioFeatures, AudioStatus, ReferenceKey, UtteranceTiming } from "./types";

type StatusListener = (status: AudioStatus) => void;
type UtteranceListener = (features: AudioFeatures, timing: UtteranceTiming) => void;

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private timeDomainBuffer: Float32Array<ArrayBuffer> | null = null;
  private animationFrame = 0;
  private recording: number[] = [];
  private silenceStarted = 0;
  private utteranceStarted = 0;
  private extractor = new AudioFeatureExtractor();
  private status: AudioStatus = {
    enabled: false,
    rms: 0,
    peak: 0,
    nonZeroSamples: 0,
    sampleCount: 0,
    streamActive: false,
    trackLabel: "unavailable",
    trackEnabled: false,
    trackMuted: false,
    trackState: "unavailable",
    audioContextState: "unavailable",
    sampleRate: 0,
    vadState: "idle",
    lastUtteranceDuration: 0,
  };
  constructor(private readonly onStatus: StatusListener, private readonly onUtterance: UtteranceListener) {}

  async enable(): Promise<void> {
    if (this.status.enabled) return;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const tracks = this.stream.getAudioTracks();
    const track = tracks[0];
    console.debug("[microphone] MediaStream", {
      tracks: tracks.map(({ label, enabled, muted, readyState }) => ({ label, enabled, muted, readyState })),
      active: this.stream.active,
    });

    this.audioContext = new AudioContext();
    if (this.audioContext.state !== "running") await this.audioContext.resume();
    console.debug("[microphone] AudioContext after resume", {
      state: this.audioContext.state,
      sampleRate: this.audioContext.sampleRate,
    });
    this.setStatus({
      streamActive: this.stream.active,
      trackLabel: track?.label || "unavailable",
      trackEnabled: track?.enabled ?? false,
      trackMuted: track?.muted ?? false,
      trackState: track?.readyState ?? "unavailable",
      audioContextState: this.audioContext.state,
      sampleRate: this.audioContext.sampleRate,
    });
    if (this.audioContext.state !== "running") {
      console.warn("[microphone] RMS loop not started because AudioContext is not running", this.audioContext.state);
      return;
    }

    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = AUDIO_CONFIG.fftSize;
    this.analyser.smoothingTimeConstant = 0;
    this.timeDomainBuffer = new Float32Array(this.analyser.fftSize);
    this.sourceNode.connect(this.analyser);
    this.setStatus({ enabled: true, vadState: "listening" });
    this.monitor();
  }
  async analyzeReferences(): Promise<Map<ReferenceKey, AudioFeatures>> {
    const context = this.audioContext ?? new AudioContext();
    const files: Record<ReferenceKey, string> = { um: "/audio/um.m4a", ye: "/audio/ye.m4a", jwejweiya: "/audio/jwejweiya.m4a" };
    const result = new Map<ReferenceKey, AudioFeatures>();
    await Promise.all((Object.entries(files) as [ReferenceKey, string][]).map(async ([key, url]) => {
      const response = await fetch(url); if (!response.ok) throw new Error(`${url} (${response.status})`);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      result.set(key, this.extractor.extract(this.mixDown(buffer), buffer.sampleRate));
    }));
    if (!this.audioContext) await context.close(); return result;
  }
  private monitor = (): void => {
    if (!this.analyser || !this.audioContext || !this.timeDomainBuffer || !this.stream) return;
    if (this.audioContext.state !== "running") {
      this.setStatus({ audioContextState: this.audioContext.state });
      console.warn("[microphone] RMS loop stopped because AudioContext is not running", this.audioContext.state);
      return;
    }
    const frame = this.timeDomainBuffer;
    this.analyser.getFloatTimeDomainData(frame);
    let sumSquares = 0;
    let peak = 0;
    let nonZeroSamples = 0;
    for (const sample of frame) {
      const absolute = Math.abs(sample);
      sumSquares += sample * sample;
      if (absolute > peak) peak = absolute;
      if (sample !== 0) nonZeroSamples++;
    }
    const rms = Math.sqrt(sumSquares / frame.length);
    const track = this.stream.getAudioTracks()[0];
    const now = performance.now();
    if (this.status.vadState !== "recording" && rms >= AUDIO_CONFIG.vadThreshold) { this.recording = []; this.utteranceStarted = now; this.silenceStarted = 0; this.setStatus({ vadState: "recording" }); }
    if (this.status.vadState === "recording") {
      this.recording.push(...frame);
      if (rms < AUDIO_CONFIG.vadThreshold) { if (!this.silenceStarted) this.silenceStarted = now; } else this.silenceStarted = 0;
      const duration = now - this.utteranceStarted;
      if ((this.silenceStarted && now - this.silenceStarted >= AUDIO_CONFIG.vadSilenceMs) || duration >= AUDIO_CONFIG.vadMaxDurationMs) {
        this.finishUtterance(duration, this.silenceStarted || now);
      }
    }
    this.setStatus({
      rms,
      peak,
      nonZeroSamples,
      sampleCount: frame.length,
      streamActive: this.stream.active,
      trackLabel: track?.label || "unavailable",
      trackEnabled: track?.enabled ?? false,
      trackMuted: track?.muted ?? false,
      trackState: track?.readyState ?? "unavailable",
      audioContextState: this.audioContext.state,
      sampleRate: this.audioContext.sampleRate,
    });
    this.animationFrame = requestAnimationFrame(this.monitor);
  };
  private finishUtterance(durationMs: number, speechEndedAt: number): void {
    if (!this.audioContext) return; this.setStatus({ vadState: "processing", lastUtteranceDuration: durationMs / 1000 });
    if (durationMs >= AUDIO_CONFIG.vadMinDurationMs) {
      const extractionStartedAt = performance.now();
      const samples = Float32Array.from(this.recording);
      const pcmCopyMs = performance.now() - extractionStartedAt;
      const features = this.extractor.extract(samples, this.audioContext.sampleRate);
      const featureExtractionMs = performance.now() - extractionStartedAt;
      const featureProfile = this.extractor.getLastProfile();
      featureProfile.prepareResampleMs += pcmCopyMs;
      featureProfile.totalMs = featureExtractionMs;
      this.onUtterance(features, {
        speechStartedAt: this.utteranceStarted,
        speechEndedAt,
        utteranceDurationMs: Math.max(0, speechEndedAt - this.utteranceStarted),
        featureExtractionMs,
        featureProfile,
      });
    }
    this.recording = []; this.silenceStarted = 0; this.setStatus({ vadState: "listening" });
  }
  private mixDown(buffer: AudioBuffer): Float32Array {
    const output = new Float32Array(buffer.length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) { const data = buffer.getChannelData(channel); for (let i = 0; i < data.length; i++) output[i] += data[i] / buffer.numberOfChannels; }
    return output;
  }
  private setStatus(patch: Partial<AudioStatus>): void { this.status = { ...this.status, ...patch }; this.onStatus(this.status); }
  destroy(): void {
    cancelAnimationFrame(this.animationFrame);
    this.sourceNode?.disconnect();
    this.analyser?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.audioContext?.close();
    this.sourceNode = null;
    this.analyser = null;
    this.timeDomainBuffer = null;
  }
}
