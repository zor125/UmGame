import type { AudioFeatures, AudioStatus, ReferenceKey, TrainingKey, VoiceLatency, VoiceResult } from "../audio/types";
import type { GameAction } from "../game/InputManager";

export class DebugPanel {
  private status: AudioStatus = {
    enabled: false, rms: 0, peak: 0, nonZeroSamples: 0, sampleCount: 0,
    streamActive: false, trackLabel: "unavailable", trackEnabled: false, trackMuted: false,
    trackState: "unavailable", audioContextState: "unavailable", sampleRate: 0,
    vadState: "idle", lastUtteranceDuration: 0,
  };
  private result: VoiceResult | null = null;
  private voiceLatency: VoiceLatency | null = null;
  private references = new Map<ReferenceKey, AudioFeatures>();
  private referenceError = "분석 중…";
  private threshold = 0.75;
  private showHitboxes = false;
  private trainingKey: TrainingKey | null = null;
  private trainingCounts: Record<TrainingKey, number> = { um: 0, ye: 0, jwejweiya: 0, unknown: 0 };
  private pointerInteractionActive = false;
  private renderPending = false;
  constructor(
    private readonly root: HTMLElement,
    private readonly onTest: (action: GameAction) => void,
    private readonly onThreshold: (value: number) => void,
    private readonly onHitboxes: (enabled: boolean) => void,
    private readonly onTraining: (key: TrainingKey | null) => void,
    private readonly onResetTraining: () => void,
  ) {
    this.root.addEventListener("pointerdown", this.handlePointerDown);
    this.root.addEventListener("click", this.handleClick);
    this.root.addEventListener("input", this.handleInput);
    this.root.addEventListener("change", this.handleChange);
    window.addEventListener("pointerup", this.releasePointerInteraction);
    window.addEventListener("pointercancel", this.releasePointerInteraction);
    this.render();
  }
  updateStatus(status: AudioStatus): void { this.status = status; this.render(); }
  updateResult(result: VoiceResult): void { this.result = result; this.render(); }
  updateVoiceLatency(latency: VoiceLatency): void { this.voiceLatency = latency; this.render(); }
  setTrainingState(key: TrainingKey | null): void { this.trainingKey = key; this.render(); }
  updateTrainingCounts(counts: Record<TrainingKey, number>): void { this.trainingCounts = { ...counts }; this.render(); }
  setReferences(references: Map<ReferenceKey, AudioFeatures>): void { this.references = references; this.referenceError = ""; this.render(); }
  setReferenceError(message: string): void { this.referenceError = message; this.render(); }
  private handlePointerDown = (event: PointerEvent): void => {
    if (!(event.target as Element).closest("button, input")) return;
    this.pointerInteractionActive = true;
    event.stopPropagation();
  };
  private releasePointerInteraction = (): void => {
    window.setTimeout(() => {
      this.pointerInteractionActive = false;
      if (this.renderPending) this.render();
    }, 0);
  };
  private handleClick = (event: MouseEvent): void => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button");
    if (!button || !this.root.contains(button)) return;
    event.stopPropagation();
    const training = button.dataset.training as TrainingKey | undefined;
    if (training) {
      console.debug(`TRAIN BUTTON CLICKED: ${training.toUpperCase()}`);
      this.trainingKey = this.trainingKey === training ? null : training;
      this.onTraining(this.trainingKey);
      return;
    }
    if (button.id === "reset-training") {
      console.debug("TRAINING RESET CLICKED");
      if (!window.confirm("저장된 음성 학습 데이터를 모두 삭제할까요?")) return;
      this.trainingKey = null;
      this.onResetTraining();
      return;
    }
    const action = button.dataset.action as GameAction | undefined;
    if (action) this.onTest(action);
  };
  private handleInput = (event: Event): void => {
    const slider = event.target as HTMLInputElement;
    if (slider.id !== "threshold") return;
    this.threshold = Number(slider.value);
    const output = this.root.querySelector<HTMLOutputElement>("#threshold-value");
    if (output) output.value = this.threshold.toFixed(2);
    this.onThreshold(this.threshold);
  };
  private handleChange = (event: Event): void => {
    const checkbox = event.target as HTMLInputElement;
    if (checkbox.id !== "hitboxes") return;
    this.showHitboxes = checkbox.checked;
    this.onHitboxes(this.showHitboxes);
  };
  private render(): void {
    if (this.pointerInteractionActive) { this.renderPending = true; return; }
    this.renderPending = false;
    const score = (key: ReferenceKey): string => (this.result?.scores[key] ?? 0).toFixed(2);
    const distance = (key: ReferenceKey): string => this.result ? this.result.distances[key].toFixed(3) : "-";
    this.root.innerHTML = `<div class="panel-card"><div class="panel-heading"><span>DEBUG CONSOLE</span><i class="status-dot ${this.status.enabled ? "active" : ""}"></i></div>
      <dl class="metrics">
        <div><dt>MIC</dt><dd>${this.status.enabled ? "ON" : "OFF"}</dd></div><div><dt>Stream active</dt><dd>${this.status.streamActive}</dd></div>
        <div><dt>Track</dt><dd>${this.status.trackLabel}</dd></div><div><dt>Track enabled</dt><dd>${this.status.trackEnabled}</dd></div>
        <div><dt>Track muted</dt><dd>${this.status.trackMuted}</dd></div><div><dt>Track state</dt><dd>${this.status.trackState}</dd></div>
        <div><dt>AudioContext</dt><dd>${this.status.audioContextState}</dd></div><div><dt>Sample rate</dt><dd>${this.status.sampleRate || "-"}</dd></div>
        <div><dt>Non-zero samples</dt><dd>${this.status.nonZeroSamples} / ${this.status.sampleCount}</dd></div><div><dt>Peak</dt><dd>${this.status.peak.toFixed(4)}</dd></div>
        <div><dt>RMS</dt><dd>${this.status.rms.toFixed(4)}</dd></div>
        <div><dt>VAD state</dt><dd>${this.status.vadState}</dd></div><div><dt>utterance</dt><dd>${this.status.lastUtteranceDuration.toFixed(2)}s</dd></div>
        <div><dt>Detected</dt><dd class="accent">${this.result?.command ?? "—"}</dd></div><div><dt>Best command</dt><dd>${this.result?.bestKey.toUpperCase() ?? "-"}</dd></div>
        <div><dt>Confidence</dt><dd>${(this.result?.confidence ?? 0).toFixed(2)}</dd></div><div><dt>Best command distance</dt><dd>${this.result?.bestDistance.toFixed(3) ?? "-"}</dd></div>
        <div><dt>Second command distance</dt><dd>${this.result?.secondDistance.toFixed(3) ?? "-"}</dd></div><div><dt>Unknown distance</dt><dd>${this.formatDistance(this.result?.unknownDistance)}</dd></div>
        <div><dt>Base radius</dt><dd>${this.result?.baseAcceptanceRadius.toFixed(3) ?? "-"}</dd></div><div><dt>Effective radius</dt><dd>${this.result?.acceptanceRadius.toFixed(3) ?? "-"}</dd></div>
        <div><dt>Radius gate</dt><dd>${this.gate(this.result?.commandRadiusPassed)}</dd></div><div><dt>Command margin</dt><dd>${this.result?.margin.toFixed(3) ?? "-"}</dd></div>
        <div><dt>Required command margin</dt><dd>${this.result?.requiredCommandMargin.toFixed(3) ?? "-"}</dd></div><div><dt>Command margin gate</dt><dd>${this.gate(this.result?.commandMarginPassed)}</dd></div>
        <div><dt>Unknown margin</dt><dd>${this.result?.unknownMargin.toFixed(3) ?? "-"}</dd></div><div><dt>Required UNKNOWN margin</dt><dd>${this.result?.requiredUnknownMargin.toFixed(3) ?? "-"}</dd></div>
        <div><dt>UNKNOWN gate</dt><dd>${this.gate(this.result?.unknownMarginPassed)}</dd></div><div><dt>Duration</dt><dd>${this.result ? `${this.result.features.duration.toFixed(2)}s` : "-"}</dd></div>
        <div><dt>Accepted duration</dt><dd>${this.durationRange()}</dd></div><div><dt>Duration gate</dt><dd>${this.gate(this.result?.durationGatePassed)}</dd></div>
        <div><dt>Final reject reason</dt><dd>${this.result?.rejectReason ?? "-"}</dd></div><div><dt>Classifier</dt><dd>${this.result?.usingPersonalTraining ? "personal k-NN" : "fallback"}</dd></div>
        <div><dt>Training</dt><dd class="accent">${this.trainingKey?.toUpperCase() ?? "OFF"}</dd></div>
        <div><dt>UM score / distance</dt><dd>${score("um")} / ${distance("um")}</dd></div><div><dt>YE score / distance</dt><dd>${score("ye")} / ${distance("ye")}</dd></div><div><dt>JWEJWEIYA score / distance</dt><dd>${score("jwejweiya")} / ${distance("jwejweiya")}</dd></div>
        <div><dt>average pitch</dt><dd>${this.result?.features.averagePitch?.toFixed(1) ?? "—"} Hz</dd></div>
      </dl>
      <label class="slider-label">Threshold <output id="threshold-value">${this.threshold.toFixed(2)}</output><input id="threshold" type="range" min="0.3" max="0.95" value="${this.threshold}" step="0.01"></label>
      <label class="check-label"><input id="hitboxes" type="checkbox" ${this.showHitboxes ? "checked" : ""}> Hitboxes 표시</label>
      <div class="test-buttons"><button data-action="SLIDE">Test Slide</button><button data-action="SHORT_JUMP">Test Short Jump</button><button data-action="LONG_JUMP">Test Long Jump</button></div>
    </div><div class="panel-card references"><h2>VOICE LATENCY</h2><dl class="metrics">
      <div><dt>Speech → End</dt><dd>${this.latency("speechToEndMs")}</dd></div><div><dt>Feature</dt><dd>${this.latency("featureExtractionMs", 1)}</dd></div>
      <div><dt>Classifier</dt><dd>${this.latency("classificationMs", 1)}</dd></div><div><dt>End → Command</dt><dd>${this.latency("speechEndToCommandMs", 1)}</dd></div>
      <div><dt>Input dispatch</dt><dd>${this.latency("inputDispatchMs", 1)}</dd></div><div><dt>Command → Action</dt><dd>${this.latency("commandToActionMs", 1)}</dd></div>
      <div><dt>End → Action</dt><dd>${this.latency("speechEndToActionMs", 1)}</dd></div><div><dt>Start → Action</dt><dd>${this.latency("speechStartToActionMs", 1)}</dd></div>
    </dl></div><div class="panel-card references"><h2>FEATURE PROFILE</h2><dl class="metrics">
      <div><dt>Prepare/resample</dt><dd>${this.featureProfile("prepareResampleMs")}</dd></div><div><dt>RMS envelope</dt><dd>${this.featureProfile("rmsEnvelopeMs")}</dd></div>
      <div><dt>Pitch contour</dt><dd>${this.featureProfile("pitchContourMs")}</dd></div><div><dt>ZCR contour</dt><dd>${this.featureProfile("zcrContourMs")}</dd></div>
      <div><dt>Normalize</dt><dd>${this.featureProfile("normalizeMs")}</dd></div><div><dt>Total</dt><dd>${this.featureProfile("totalMs")}</dd></div>
    </dl></div><div class="panel-card training"><h2>VOICE TRAINING</h2>
      <p class="muted">각 명령을 최소 10회, 권장 20회 녹음하세요. 선택한 버튼을 다시 누르면 중지됩니다.</p>
      ${this.trainingButton("um", "UM", 20)}${this.trainingButton("ye", "YE", 20)}${this.trainingButton("jwejweiya", "JWEJWEIYA", 20)}${this.trainingButton("unknown", "UNKNOWN", 40)}
      <button id="reset-training">Reset Training</button>
    </div><div class="panel-card references"><h2>REFERENCE FEATURES</h2>${this.referenceMarkup()}</div>`;
  }
  private trainingButton(key: TrainingKey, label: string, target: number): string {
    const active = this.trainingKey === key;
    const complete = this.trainingCounts[key] >= target;
    return `<button class="training-button ${active ? "active" : ""}" data-training="${key}" ${complete && !active ? "disabled" : ""}>${active ? `Recording ${label}...` : complete ? "Complete" : `Train ${label}`}<span>${label}: ${this.trainingCounts[key]} / ${target}</span></button>`;
  }
  private formatDistance(value: number | undefined): string { return value === undefined || !Number.isFinite(value) ? "-" : value.toFixed(3); }
  private gate(value: boolean | undefined): string { return value === undefined ? "-" : value ? "PASS" : "FAIL"; }
  private durationRange(): string {
    if (!this.result || !Number.isFinite(this.result.durationUpperBound)) return "-";
    return `${this.result.durationLowerBound.toFixed(2)}s - ${this.result.durationUpperBound.toFixed(2)}s`;
  }
  private latency(key: keyof VoiceLatency, digits = 0): string {
    const value = this.voiceLatency?.[key];
    return typeof value !== "number" ? "-" : `${value.toFixed(digits)} ms`;
  }
  private featureProfile(key: keyof VoiceLatency["featureProfile"]): string {
    const value = this.voiceLatency?.featureProfile[key];
    return value === undefined ? "-" : `${value.toFixed(1)} ms`;
  }
  private referenceMarkup(): string {
    if (this.referenceError) return `<p class="muted">${this.referenceError}</p>`;
    return (["um", "ye", "jwejweiya"] as ReferenceKey[]).map((key) => { const f = this.references.get(key); return `<div class="reference"><strong>${key}</strong><span>${f?.duration.toFixed(2)}s</span><span>RMS ${f?.rms.toFixed(3)}</span><span>pitch ${f?.averagePitch?.toFixed(0) ?? "—"}Hz</span><span>range ${f?.minPitch?.toFixed(0) ?? "—"}–${f?.maxPitch?.toFixed(0) ?? "—"}</span><span>ZCR ${f?.zeroCrossingRate.toFixed(3)}</span></div>`; }).join("");
  }
}
