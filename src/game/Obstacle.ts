import { CANVAS } from "./constants";
import type { Rect } from "./Player";

export type ObstacleType = "LOW" | "WIDE" | "HIGH";
const DIMENSIONS: Record<ObstacleType, { width: number; height: number; bottom: number }> = {
  LOW: { width: 34, height: 44, bottom: 0 },
  WIDE: { width: 98, height: 38, bottom: 0 },
  HIGH: { width: 62, height: 30, bottom: 45 },
};

export class Obstacle {
  x: number;
  readonly type: ObstacleType;
  private readonly dimensions;
  constructor(type: ObstacleType, x = CANVAS.width + 30) { this.type = type; this.x = x; this.dimensions = DIMENSIONS[type]; }
  update(dt: number, speed: number): void { this.x -= speed * dt; }
  isOffscreen(): boolean { return this.x + this.dimensions.width < 0; }
  getHitbox(): Rect {
    const { width, height, bottom } = this.dimensions;
    return { x: this.x + 3, y: CANVAS.groundY - bottom - height, width: width - 6, height };
  }
  draw(ctx: CanvasRenderingContext2D, debug = false): void {
    const box = this.getHitbox();
    ctx.save();
    ctx.fillStyle = this.type === "HIGH" ? "#7c5cff" : this.type === "WIDE" ? "#ff7a59" : "#3dd6a2";
    if (this.type === "LOW") {
      ctx.beginPath(); ctx.moveTo(this.x, CANVAS.groundY); ctx.lineTo(this.x + this.dimensions.width / 2, box.y); ctx.lineTo(this.x + this.dimensions.width, CANVAS.groundY); ctx.fill();
    } else ctx.fillRect(this.x, box.y, this.dimensions.width, this.dimensions.height);
    if (debug) { ctx.strokeStyle = "#ff4d6d"; ctx.lineWidth = 2; ctx.strokeRect(box.x, box.y, box.width, box.height); }
    ctx.restore();
  }
}
