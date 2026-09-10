import { CANVAS, PLAYER } from "./constants";
import { PlayerRenderer, type PlayerVisualState } from "./render/PlayerRenderer";

export enum PlayerState { RUNNING, SLIDING, SHORT_JUMP, LONG_JUMP, DEAD }
export interface Rect { x: number; y: number; width: number; height: number }

export class Player {
  private readonly renderer = new PlayerRenderer();
  readonly x = PLAYER.x;
  private y = CANVAS.groundY - PLAYER.height;
  private velocityY = 0;
  private slideRemaining = 0;
  state = PlayerState.RUNNING;

  slide(): void {
    if (this.state !== PlayerState.RUNNING) return;
    this.state = PlayerState.SLIDING;
    this.slideRemaining = PLAYER.slideDuration;
  }
  shortJump(): void { this.jump(PlayerState.SHORT_JUMP, PLAYER.shortJumpVelocity); }
  longJump(): void { this.jump(PlayerState.LONG_JUMP, PLAYER.longJumpVelocity); }
  private jump(state: PlayerState, velocity: number): void {
    if (this.state !== PlayerState.RUNNING) return;
    this.state = state;
    this.velocityY = velocity;
  }
  update(deltaTime: number): void {
    if (this.state === PlayerState.DEAD) return;
    if (this.state === PlayerState.SLIDING) {
      this.slideRemaining -= deltaTime * 1000;
      if (this.slideRemaining <= 0) this.state = PlayerState.RUNNING;
      return;
    }
    if (this.state === PlayerState.SHORT_JUMP || this.state === PlayerState.LONG_JUMP) {
      const gravity = this.state === PlayerState.SHORT_JUMP ? PLAYER.shortJumpGravity : PLAYER.longJumpGravity;
      this.velocityY += gravity * deltaTime;
      this.y += this.velocityY * deltaTime;
      const floor = CANVAS.groundY - PLAYER.height;
      if (this.y >= floor) { this.y = floor; this.velocityY = 0; this.state = PlayerState.RUNNING; }
    }
  }
  getHitbox(): Rect {
    const sliding = this.state === PlayerState.SLIDING;
    const height = sliding ? PLAYER.slideHeight : PLAYER.height;
    return { x: this.x + 5, y: sliding ? CANVAS.groundY - height : this.y + 3, width: PLAYER.width - 10, height: height - 5 };
  }
  die(): void { this.state = PlayerState.DEAD; }
  draw(ctx: CanvasRenderingContext2D, debug = false): void {
    this.renderer.draw(ctx, {
      state: PlayerState[this.state] as PlayerVisualState,
      x: this.x,
      y: this.y,
      groundY: CANVAS.groundY,
      hitbox: this.getHitbox(),
    }, debug);
  }
}
