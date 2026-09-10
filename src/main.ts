import "./style.css";
import { AudioManager } from "./audio/AudioManager";
import { VoiceCommandDetector } from "./audio/VoiceCommandDetector";
import type { AudioStatus } from "./audio/types";
import { AUDIO_CONFIG } from "./game/constants";
import { Game } from "./game/Game";
import { InputManager } from "./game/InputManager";
import { DebugPanel } from "./ui/DebugPanel";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
const debugRoot = document.querySelector<HTMLElement>("#debug-panel");
if (!canvas || !debugRoot) throw new Error("필수 UI 요소를 찾을 수 없습니다.");

const input = new InputManager();
const game = new Game(canvas, input);
const detector = new VoiceCommandDetector(AUDIO_CONFIG.commandThreshold);
let debug: DebugPanel;
const audio = new AudioManager(
  (status: AudioStatus) => { debug?.updateStatus(status); game.micEnabled = status.enabled; },
  (features) => { const result = detector.detect(features); debug.updateResult(result); input.fromVoice(result.command); },
);
debug = new DebugPanel(debugRoot, (action) => input.push(action), (threshold) => { detector.threshold = threshold; }, (enabled) => { game.debugHitboxes = enabled; });

canvas.addEventListener("click", async () => {
  if (game.hasBegun()) return;
  try { await audio.enable(); } catch (error) { console.warn("Microphone unavailable:", error); }
  game.begin();
});

window.addEventListener("keydown", (event) => {
  if (event.code !== "KeyD") return;
  debugRoot.classList.toggle("visible");
});

audio.analyzeReferences().then((references) => { detector.setReferences(references); debug.setReferences(references); }).catch((error: unknown) => { debug.setReferenceError(`기준 음성 로드 실패: ${error instanceof Error ? error.message : String(error)}`); });
game.start();
