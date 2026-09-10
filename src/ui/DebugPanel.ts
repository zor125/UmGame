import type { AudioFeatures, AudioStatus, ReferenceKey, VoiceResult } from "../audio/types";
import type { GameAction } from "../game/InputManager";

export class DebugPanel {
  private status: AudioStatus = { enabled: false, rms: 0, vadState: "idle", lastUtteranceDuration: 0 };
  private result: VoiceResult | null = null;
  private references = new Map<ReferenceKey, AudioFeatures>();
  private referenceError = "분석 중…";
  private threshold = 0.75;
  private showHitboxes = false;
  constructor(private readonly root: HTMLElement, private readonly onTest: (action: GameAction) => void, private readonly onThreshold: (value: number) => void, private readonly onHitboxes: (enabled: boolean) => void) { this.render(); }
  updateStatus(status: AudioStatus): void { this.status = status; this.render(); }
  updateResult(result: VoiceResult): void { this.result = result; this.render(); }
  setReferences(references: Map<ReferenceKey, AudioFeatures>): void { this.references = references; this.referenceError = ""; this.render(); }
  setReferenceError(message: string): void { this.referenceError = message; this.render(); }
  private render(): void {
    const score = (key: ReferenceKey): string => (this.result?.scores[key] ?? 0).toFixed(2);
    this.root.innerHTML = `<div class="panel-card"><div class="panel-heading"><span>DEBUG CONSOLE</span><i class="status-dot ${this.status.enabled ? "active" : ""}"></i></div>
      <dl class="metrics">
        <div><dt>microphone</dt><dd>${this.status.enabled ? "enabled" : "disabled"}</dd></div><div><dt>current RMS</dt><dd>${this.status.rms.toFixed(4)}</dd></div>
        <div><dt>VAD state</dt><dd>${this.status.vadState}</dd></div><div><dt>utterance</dt><dd>${this.status.lastUtteranceDuration.toFixed(2)}s</dd></div>
        <div><dt>command</dt><dd class="accent">${this.result?.command ?? "—"}</dd></div><div><dt>confidence</dt><dd>${(this.result?.confidence ?? 0).toFixed(2)}</dd></div>
        <div><dt>um score</dt><dd>${score("um")}</dd></div><div><dt>ye score</dt><dd>${score("ye")}</dd></div><div><dt>jwejweiya</dt><dd>${score("jwejweiya")}</dd></div>
        <div><dt>average pitch</dt><dd>${this.result?.features.averagePitch?.toFixed(1) ?? "—"} Hz</dd></div>
      </dl>
      <label class="slider-label">Threshold <output id="threshold-value">${this.threshold.toFixed(2)}</output><input id="threshold" type="range" min="0.3" max="0.95" value="${this.threshold}" step="0.01"></label>
      <label class="check-label"><input id="hitboxes" type="checkbox" ${this.showHitboxes ? "checked" : ""}> Hitboxes 표시</label>
      <div class="test-buttons"><button data-action="SLIDE">Test Slide</button><button data-action="SHORT_JUMP">Test Short Jump</button><button data-action="LONG_JUMP">Test Long Jump</button></div>
    </div><div class="panel-card references"><h2>REFERENCE FEATURES</h2>${this.referenceMarkup()}</div>`;
    this.root.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => button.addEventListener("click", () => this.onTest(button.dataset.action as GameAction)));
    const slider = this.root.querySelector<HTMLInputElement>("#threshold"); const output = this.root.querySelector<HTMLOutputElement>("#threshold-value");
    if (slider && output) slider.addEventListener("input", () => { this.threshold = Number(slider.value); output.value = this.threshold.toFixed(2); this.onThreshold(this.threshold); });
    this.root.querySelector<HTMLInputElement>("#hitboxes")?.addEventListener("change", (event) => { this.showHitboxes = (event.target as HTMLInputElement).checked; this.onHitboxes(this.showHitboxes); });
  }
  private referenceMarkup(): string {
    if (this.referenceError) return `<p class="muted">${this.referenceError}</p>`;
    return (["um", "ye", "jwejweiya"] as ReferenceKey[]).map((key) => { const f = this.references.get(key); return `<div class="reference"><strong>${key}</strong><span>${f?.duration.toFixed(2)}s</span><span>RMS ${f?.rms.toFixed(3)}</span><span>pitch ${f?.averagePitch?.toFixed(0) ?? "—"}Hz</span><span>range ${f?.minPitch?.toFixed(0) ?? "—"}–${f?.maxPitch?.toFixed(0) ?? "—"}</span><span>ZCR ${f?.zeroCrossingRate.toFixed(3)}</span></div>`; }).join("");
  }
}
