import type { Rect } from "../Player";
import { PLAYER, PLAYER_RENDER_SIZE } from "../constants";

export type PlayerVisualState = "RUNNING" | "SLIDING" | "SHORT_JUMP" | "LONG_JUMP" | "DEAD";

interface PlayerRenderModel {
  state: PlayerVisualState;
  x: number;
  y: number;
  groundY: number;
  hitbox: Rect;
}

const SOURCES = {
  run1: "/sprites/player/run-1.png",
  run2: "/sprites/player/run-2.png",
  jump: "/sprites/player/jump.png",
  longJump: "/sprites/player/long-jump.png",
  slide1: "/sprites/player/slide-1.png",
  slide2: "/sprites/player/slide-2.png",
  dead: "/sprites/player/dead.png",
} as const;

type SpriteName = keyof typeof SOURCES;

export class PlayerRenderer {
  private static readonly FRAME_MS = 120;
  private readonly sprites = new Map<SpriteName, HTMLImageElement>();

  constructor() {
    for (const [name, source] of Object.entries(SOURCES) as [SpriteName, string][]) {
      const image = new Image();
      image.src = source;
      this.sprites.set(name, image);
    }
  }

  draw(ctx: CanvasRenderingContext2D, model: PlayerRenderModel, debug = false): void {
    const frame = Math.floor(performance.now() / PlayerRenderer.FRAME_MS) % 2;
    const name = this.spriteFor(model.state, frame);
    const sprite = this.sprites.get(name);
    const airOffset = Math.round(model.y - (model.groundY - 66));
    const x = Math.round(model.x + (PLAYER.width - PLAYER_RENDER_SIZE) / 2);
    const y = Math.round(model.groundY + airOffset - PLAYER_RENDER_SIZE);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (sprite?.complete && sprite.naturalWidth > 0) {
      ctx.drawImage(sprite, x, y, PLAYER_RENDER_SIZE, PLAYER_RENDER_SIZE);
    }
    if (debug) {
      ctx.strokeStyle = "#888";
      ctx.lineWidth = 1;
      ctx.strokeRect(model.hitbox.x + 0.5, model.hitbox.y + 0.5, model.hitbox.width, model.hitbox.height);
    }
    ctx.restore();
  }

  private spriteFor(state: PlayerVisualState, frame: number): SpriteName {
    if (state === "RUNNING") return frame ? "run2" : "run1";
    if (state === "SLIDING") return frame ? "slide2" : "slide1";
    if (state === "SHORT_JUMP") return "jump";
    if (state === "LONG_JUMP") return "longJump";
    return "dead";
  }
}
