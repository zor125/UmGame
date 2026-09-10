import type { VoiceCommand } from "../audio/types";

export type GameAction = "SLIDE" | "SHORT_JUMP" | "LONG_JUMP" | "RESTART";
export interface QueuedAction { action: GameAction; onApplied?: (timestamp: number) => void; }

export class InputManager {
  private readonly queue: QueuedAction[] = [];
  private readonly keyHandler = (event: KeyboardEvent): void => {
    const action: GameAction | null = event.code === "KeyR" ? "RESTART" : null;
    if (action) {
      event.preventDefault();
      this.push(action);
    }
  };

  constructor() { window.addEventListener("keydown", this.keyHandler); }
  push(action: GameAction, onApplied?: (timestamp: number) => void): void { this.queue.push({ action, onApplied }); }
  fromVoice(command: VoiceCommand, onApplied?: (timestamp: number) => void): void {
    if (command !== "UNKNOWN") this.push(command, onApplied);
  }
  drain(): QueuedAction[] { return this.queue.splice(0); }
  destroy(): void { window.removeEventListener("keydown", this.keyHandler); }
}
