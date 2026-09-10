import type { VoiceCommand } from "../audio/types";

export type GameAction = "SLIDE" | "SHORT_JUMP" | "LONG_JUMP" | "RESTART";

export class InputManager {
  private readonly queue: GameAction[] = [];
  private readonly keyHandler = (event: KeyboardEvent): void => {
    const action: GameAction | null = event.code === "ArrowDown" ? "SLIDE"
      : event.code === "Space" ? "SHORT_JUMP"
      : event.code === "ArrowUp" ? "LONG_JUMP"
      : event.code === "KeyR" ? "RESTART" : null;
    if (action) {
      event.preventDefault();
      this.push(action);
    }
  };

  constructor() { window.addEventListener("keydown", this.keyHandler); }
  push(action: GameAction): void { this.queue.push(action); }
  fromVoice(command: VoiceCommand): void {
    if (command !== "UNKNOWN") this.push(command);
  }
  drain(): GameAction[] { return this.queue.splice(0); }
  destroy(): void { window.removeEventListener("keydown", this.keyHandler); }
}
