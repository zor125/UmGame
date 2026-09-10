import { CANVAS, GAME, PLAYER } from "./constants";
import type { Rect } from "./Player";

export type ObstacleType = "LOW" | "WIDE" | "HIGH";
const DIMENSIONS: Record<ObstacleType, { width: number; height: number; bottom: number }> = {
  LOW: { width: 30, height: 14, bottom: 0 },
  WIDE: { width: 102, height: 24, bottom: 0 },
  HIGH: { width: 48, height: 168, bottom: 35 },
};
const WIDE_TRAVERSAL_SECONDS = 0.38;

const SPRITES = {
  "rock-small": "/sprites/obstacles/rock-small.png",
  "rock-wide": "/sprites/obstacles/rock-wide.png",
  cactus: "/sprites/obstacles/cactus.png",
  bird: "/sprites/obstacles/bird.png",
  platform: "/sprites/obstacles/platform.png",
  block: "/sprites/obstacles/block.png",
} as const;
type ObstacleSprite = keyof typeof SPRITES;
const OPAQUE_BOUNDS: Record<ObstacleSprite, readonly [number, number, number, number]> = {
  "rock-small": [0, 25, 48, 23],
  "rock-wide": [0, 35, 48, 13],
  cactus: [9, 0, 30, 48],
  bird: [0, 10, 48, 38],
  platform: [0, 34, 48, 14],
  block: [10, 0, 28, 48],
};
const SPRITES_BY_TYPE: Record<ObstacleType, readonly ObstacleSprite[]> = {
  LOW: ["rock-small"],
  WIDE: ["rock-wide"],
  HIGH: ["bird"],
};
const IMAGES = new Map<ObstacleSprite, HTMLImageElement>();
for (const [name, source] of Object.entries(SPRITES) as [ObstacleSprite, string][]) {
  const image = new Image(); image.src = source; IMAGES.set(name, image);
}

export class Obstacle {
  x: number;
  readonly type: ObstacleType;
  private readonly sprite: ObstacleSprite;
  private readonly dimensions;
  constructor(type: ObstacleType, x = CANVAS.width + 30, speed: number = GAME.initialSpeed) {
    this.type = type; this.x = x;
    const base = DIMENSIONS[type];
    const playerHitboxWidth = PLAYER.width - 10;
    const wideWidth = Math.round(speed * WIDE_TRAVERSAL_SECONDS - playerHitboxWidth + 6);
    this.dimensions = type === "WIDE" ? { ...base, width: wideWidth } : base;
    const choices = SPRITES_BY_TYPE[type]; this.sprite = choices[Math.floor(Math.random() * choices.length)];
  }
  update(dt: number, speed: number): void { this.x -= speed * dt; }
  isOffscreen(): boolean { return this.x + this.dimensions.width < 0; }
  getHitbox(): Rect {
    const { width, height, bottom } = this.dimensions;
    return { x: this.x + 3, y: CANVAS.groundY - bottom - height, width: width - 6, height };
  }
  draw(ctx: CanvasRenderingContext2D, debug = false): void {
    const box = this.getHitbox();
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const image = IMAGES.get(this.sprite);
    if (image?.complete && image.naturalWidth > 0 && this.type === "HIGH") {
      const [sourceX, sourceY, sourceWidth, sourceHeight] = OPAQUE_BOUNDS.bird;
      for (const offsetY of [0, 56, 112]) {
        ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, this.x, box.y + offsetY, 48, 56);
      }
    } else if (image?.complete && image.naturalWidth > 0) {
      const [sourceX, sourceY, sourceWidth, sourceHeight] = OPAQUE_BOUNDS[this.sprite];
      ctx.drawImage(
        image,
        sourceX, sourceY, sourceWidth, sourceHeight,
        this.x, box.y, this.dimensions.width, this.dimensions.height,
      );
    }
    if (debug) { ctx.strokeStyle = "#888"; ctx.lineWidth = 1; ctx.strokeRect(box.x, box.y, box.width, box.height); }
    ctx.restore();
  }
}
