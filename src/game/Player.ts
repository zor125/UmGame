import { CANVAS, PLAYER } from "./constants";

export enum PlayerState { RUNNING, SLIDING, SHORT_JUMP, LONG_JUMP, DEAD }
export interface Rect { x: number; y: number; width: number; height: number }

export class Player {
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
      this.velocityY += PLAYER.gravity * deltaTime;
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
    const box = this.getHitbox();
    ctx.save();
    ctx.fillStyle = this.state === PlayerState.DEAD ? "#ef476f" : "#f7c948";
    ctx.fillRect(box.x - 5, box.y - (this.state === PlayerState.SLIDING ? 2 : 3), PLAYER.width, this.state === PlayerState.SLIDING ? PLAYER.slideHeight : PLAYER.height);
    ctx.fillStyle = "#101827";
    ctx.fillRect(box.x + box.width - 8, box.y + 10, 5, 5);
    if (this.state !== PlayerState.SLIDING) {
      const stride = Math.floor(performance.now() / 110) % 2;
      ctx.fillRect(box.x + 3, box.y + box.height, 9, stride ? 9 : 5);
      ctx.fillRect(box.x + 25, box.y + box.height, 9, stride ? 5 : 9);
    }
    if (debug) { ctx.strokeStyle = "#ff4d6d"; ctx.lineWidth = 2; ctx.strokeRect(box.x, box.y, box.width, box.height); }
    ctx.restore();
  }
}
