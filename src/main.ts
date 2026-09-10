import "./style.css";
import { AudioManager } from "./audio/AudioManager";
import { VoiceCommandDetector } from "./audio/VoiceCommandDetector";
import type { AudioStatus, TrainingKey, VoiceLatency } from "./audio/types";
import { AUDIO_CONFIG } from "./game/constants";
import { Game } from "./game/Game";
import { InputManager } from "./game/InputManager";
import { DebugPanel } from "./ui/DebugPanel";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
const debugRoot = document.querySelector<HTMLElement>("#debug-panel");
if (!canvas || !debugRoot) throw new Error("필수 UI 요소를 찾을 수 없습니다.");
const DEBUG_ENABLED = false;
debugRoot.classList.remove("visible");

const input = new InputManager();
const game = new Game(canvas, input);
const detector = new VoiceCommandDetector(AUDIO_CONFIG.commandThreshold);
let debug: DebugPanel;
let trainingKey: TrainingKey | null = null;
const audio = new AudioManager(
  (status: AudioStatus) => { debug?.updateStatus(status); game.micEnabled = status.enabled; },
  (features, timing) => {
    if (trainingKey) {
      const savedKey = trainingKey;
      const saved = detector.addTrainingSample(savedKey, features);
      const counts = detector.getTrainingCounts();
      debug.updateTrainingCounts(counts);
      console.debug("TRAINING SAVED", {
        command: savedKey.toUpperCase(),
        count: `${saved.count} / ${savedKey === "unknown" ? 40 : 20}`,
        localStorage: saved.persisted ? "saved" : "failed",
      });
      if (counts[savedKey] >= (savedKey === "unknown" ? 40 : 20)) trainingKey = null;
      debug.setTrainingState(trainingKey);
      return;
    }
    const classificationStartedAt = performance.now();
    const result = detector.detect(features);
    const commandDetectedAt = performance.now();
    const classificationMs = commandDetectedAt - classificationStartedAt;
    debug.updateResult(result);
    let inputDispatchMs = 0;
    const latency: VoiceLatency = {
      speechToEndMs: timing.utteranceDurationMs,
      featureExtractionMs: timing.featureExtractionMs,
      classificationMs,
      speechEndToCommandMs: commandDetectedAt - timing.speechEndedAt,
      inputDispatchMs: 0,
      commandToActionMs: null,
      speechEndToActionMs: null,
      speechStartToActionMs: null,
      featureProfile: timing.featureProfile,
    };
    const dispatchStartedAt = performance.now();
    input.fromVoice(result.command, (actionTimestamp) => {
      debug.updateVoiceLatency({
        ...latency,
        inputDispatchMs,
        commandToActionMs: actionTimestamp - commandDetectedAt,
        speechEndToActionMs: actionTimestamp - timing.speechEndedAt,
        speechStartToActionMs: actionTimestamp - timing.speechStartedAt,
      });
    });
    inputDispatchMs = performance.now() - dispatchStartedAt;
    debug.updateVoiceLatency({ ...latency, inputDispatchMs });
  },
);
debug = new DebugPanel(
  debugRoot,
  (action) => input.push(action),
  (threshold) => { detector.threshold = threshold; },
  (enabled) => { game.debugHitboxes = enabled; },
  (key) => { trainingKey = key; debug.setTrainingState(trainingKey); },
  () => {
    detector.resetTraining();
    trainingKey = null;
    debug.updateTrainingCounts(detector.getTrainingCounts());
    debug.setTrainingState(null);
  },
);
debug.updateTrainingCounts(detector.getTrainingCounts());
debug.setTrainingState(null);

canvas.addEventListener("click", async () => {
  if (game.hasBegun()) return;
  try { await audio.enable(); } catch (error) { console.warn("Microphone unavailable:", error); }
  game.begin();
});

if (DEBUG_ENABLED) debugRoot.classList.add("visible");

audio.analyzeReferences().then((references) => { detector.setReferences(references); debug.setReferences(references); }).catch((error: unknown) => { debug.setReferenceError(`기준 음성 로드 실패: ${error instanceof Error ? error.message : String(error)}`); });
game.start();
