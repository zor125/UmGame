import { AUDIO_CONFIG } from "../game/constants";
import type { AudioFeatures, FeatureProfile } from "./types";

export class AudioFeatureExtractor {
  private lastProfile: FeatureProfile = { prepareResampleMs: 0, rmsEnvelopeMs: 0, pitchContourMs: 0, zcrContourMs: 0, normalizeMs: 0, totalMs: 0 };
  getLastProfile(): FeatureProfile { return { ...this.lastProfile }; }

  extract(samples: Float32Array, sampleRate: number): AudioFeatures {
    const totalStartedAt = performance.now();
    if (!samples.length) return {
      duration: 0, rms: 0, zeroCrossingRate: 0, averagePitch: null, minPitch: null, maxPitch: null,
      pitchContour: Array(32).fill(0), rmsEnvelope: Array(32).fill(0), pitchVoicing: Array(32).fill(0), zcrContour: Array(32).fill(0),
    };
    const prepareStartedAt = performance.now();
    const frameCount = 32;
    const frameStarts = new Int32Array(frameCount);
    const frameEnds = new Int32Array(frameCount);
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      frameStarts[frameIndex] = Math.floor(frameIndex * samples.length / frameCount);
      frameEnds[frameIndex] = Math.max(frameStarts[frameIndex] + 1, Math.floor((frameIndex + 1) * samples.length / frameCount));
    }
    const prepareResampleMs = performance.now() - prepareStartedAt;

    const rmsStartedAt = performance.now();
    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) {
      sumSquares += samples[i] * samples[i];
    }
    const rmsEnvelope: number[] = [];
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const start = frameStarts[frameIndex]; const end = frameEnds[frameIndex];
      let frameSquares = 0;
      for (let i = start; i < end; i++) frameSquares += samples[i] * samples[i];
      rmsEnvelope.push(Math.sqrt(frameSquares / (end - start)));
    }
    const rmsEnvelopeMs = performance.now() - rmsStartedAt;

    const pitchStartedAt = performance.now();
    const rawPitches: number[] = [];
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const frame = samples.subarray(frameStarts[frameIndex], frameEnds[frameIndex]);
      rawPitches.push(frame.length >= 256 ? this.detectPitch(frame, sampleRate, rmsEnvelope[frameIndex]) ?? 0 : 0);
    }
    const pitchContourMs = performance.now() - pitchStartedAt;

    const zcrStartedAt = performance.now();
    const zcrContour: number[] = [];
    let crossings = 0;
    for (let i = 1; i < samples.length; i++) {
      if ((samples[i - 1] < 0 && samples[i] >= 0) || (samples[i - 1] >= 0 && samples[i] < 0)) crossings++;
    }
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const start = frameStarts[frameIndex]; const end = frameEnds[frameIndex];
      let frameCrossings = 0;
      for (let i = start + 1; i < end; i++) {
        if ((samples[i - 1] < 0 && samples[i] >= 0) || (samples[i - 1] >= 0 && samples[i] < 0)) frameCrossings++;
      }
      zcrContour.push(frameCrossings / Math.max(1, end - start - 1));
    }
    const zcrContourMs = performance.now() - zcrStartedAt;

    const normalizeStartedAt = performance.now();
    const envelopePeak = Math.max(...rmsEnvelope, 0.000001);
    const normalizedEnvelope = rmsEnvelope.map((value) => value / envelopePeak);
    const voicedPitches = rawPitches.filter((pitch) => pitch > 0).sort((a, b) => a - b);
    const medianPitch = voicedPitches.length ? voicedPitches[Math.floor(voicedPitches.length / 2)] : 0;
    const pitchContour = rawPitches.map((pitch) => pitch > 0 && medianPitch > 0 ? Math.max(-1, Math.min(1, Math.log2(pitch / medianPitch))) : 0);
    const pitchVoicing = rawPitches.map((pitch) => pitch > 0 ? 1 : 0);
    const pitches = rawPitches;
    const voiced = pitches.filter((pitch) => pitch > 0);
    const result = {
      duration: samples.length / sampleRate,
      rms: Math.sqrt(sumSquares / samples.length),
      zeroCrossingRate: crossings / Math.max(1, samples.length - 1),
      averagePitch: voiced.length ? voiced.reduce((a, b) => a + b, 0) / voiced.length : null,
      minPitch: voiced.length ? Math.min(...voiced) : null,
      maxPitch: voiced.length ? Math.max(...voiced) : null,
      pitchContour,
      rmsEnvelope: normalizedEnvelope,
      pitchVoicing,
      zcrContour,
    };
    const normalizeMs = performance.now() - normalizeStartedAt;
    this.lastProfile = {
      prepareResampleMs, rmsEnvelopeMs, pitchContourMs, zcrContourMs, normalizeMs,
      totalMs: performance.now() - totalStartedAt,
    };
    return result;
  }

  private detectPitch(frame: Float32Array, sampleRate: number, frameRms: number): number | null {
    if (frameRms < 0.01) return null;
    const minLag = Math.floor(sampleRate / AUDIO_CONFIG.pitchMaxHz);
    const maxLag = Math.min(Math.floor(sampleRate / AUDIO_CONFIG.pitchMinHz), frame.length - 2);
    const squarePrefix = new Float64Array(frame.length + 1);
    for (let i = 0; i < frame.length; i++) squarePrefix[i + 1] = squarePrefix[i] + frame[i] * frame[i];
    const totalEnergy = squarePrefix[frame.length];
    const decimation = 4;
    const coarseLength = Math.ceil(frame.length / decimation);
    const coarsePrefix = new Float64Array(coarseLength + 1);
    for (let i = 0; i < coarseLength; i++) coarsePrefix[i + 1] = coarsePrefix[i] + frame[i * decimation] * frame[i * decimation];
    const coarseTotal = coarsePrefix[coarseLength];
    const coarseMinLag = Math.floor(minLag / decimation);
    const coarseMaxLag = Math.min(Math.ceil(maxLag / decimation), coarseLength - 2);
    const coarseCandidates: Array<{ lag: number; correlation: number }> = [];
    for (let lag = coarseMinLag; lag <= coarseMaxLag; lag++) {
      const overlap = coarseLength - lag;
      let correlation = 0;
      for (let i = 0; i < overlap; i++) correlation += frame[i * decimation] * frame[(i + lag) * decimation];
      const normalized = correlation / Math.sqrt(coarsePrefix[overlap] * (coarseTotal - coarsePrefix[lag]) || 1);
      coarseCandidates.push({ lag, correlation: normalized });
    }
    coarseCandidates.sort((a, b) => b.correlation - a.correlation);
    const refineLags = new Set<number>();
    for (const candidate of coarseCandidates.slice(0, 4)) {
      for (let lag = candidate.lag * decimation - 5; lag <= candidate.lag * decimation + 5; lag++) {
        if (lag >= minLag && lag <= maxLag) refineLags.add(lag);
      }
    }
    let bestLag = 0; let bestCorrelation = 0;
    for (const lag of refineLags) {
      const overlap = frame.length - lag;
      let correlation = 0;
      for (let i = 0; i < overlap; i++) correlation += frame[i] * frame[i + lag];
      const normalized = correlation / Math.sqrt(squarePrefix[overlap] * (totalEnergy - squarePrefix[lag]) || 1);
      if (normalized > bestCorrelation) { bestCorrelation = normalized; bestLag = lag; }
    }
    return bestCorrelation > 0.55 && bestLag ? sampleRate / bestLag : null;
  }
}
