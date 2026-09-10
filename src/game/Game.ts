import { CANVAS, GAME } from "./constants";
import { InputManager } from "./InputManager";
import { Obstacle, type ObstacleType } from "./Obstacle";
import { Player, type Rect } from "./Player";

export class Game {
  private player = new Player();
  private obstacles: Obstacle[] = [];
  private lastTime = 0;
  private distanceToSpawn = 420;
  private elapsed = 0;
  private score = 0;
  private highScore = Number(localStorage.getItem(GAME.highScoreKey) ?? 0);
  private dead = false;
  private lastObstacle: ObstacleType | null = null;
  debugHitboxes = false;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly input: InputManager) {
    canvas.addEventListener("click", () => { if (this.dead) this.input.push("RESTART"); });
  }
  start(): void { requestAnimationFrame(this.loop); }
  private readonly loop = (time: number): void => {
    const dt = this.lastTime ? Math.min((time - this.lastTime) / 1000, 0.05) : 0;
    this.lastTime = time;
    this.update(dt); this.draw(); requestAnimationFrame(this.loop);
  };
  private update(dt: number): void {
    for (const action of this.input.drain()) {
      if (action === "RESTART" && this.dead) this.restart();
      else if (!this.dead && action === "SLIDE") this.player.slide();
      else if (!this.dead && action === "SHORT_JUMP") this.player.shortJump();
      else if (!this.dead && action === "LONG_JUMP") this.player.longJump();
    }
    if (this.dead) return;
    this.elapsed += dt;
    const speed = Math.min(GAME.initialSpeed + this.elapsed * GAME.acceleration, GAME.maxSpeed);
    this.score = Math.floor(this.elapsed * 10);
    this.player.update(dt);
    this.distanceToSpawn -= speed * dt;
    if (this.distanceToSpawn <= 0) this.spawn(speed);
    this.obstacles.forEach((obstacle) => obstacle.update(dt, speed));
    this.obstacles = this.obstacles.filter((obstacle) => !obstacle.isOffscreen());
    if (this.obstacles.some((obstacle) => this.intersects(this.player.getHitbox(), obstacle.getHitbox()))) this.gameOver();
  }
  private spawn(speed: number): void {
    const types: ObstacleType[] = ["LOW", "WIDE", "HIGH"];
    let type = types[Math.floor(Math.random() * types.length)];
    if (type === this.lastObstacle && Math.random() < 0.65) type = types[(types.indexOf(type) + 1) % types.length];
    this.obstacles.push(new Obstacle(type));
    this.lastObstacle = type;
    const reactionScale = Math.min(speed / GAME.initialSpeed, 1.7);
    this.distanceToSpawn = (GAME.minSpawnGap + Math.random() * (GAME.maxSpawnGap - GAME.minSpawnGap)) * reactionScale;
  }
  private intersects(a: Rect, b: Rect): boolean { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }
  private gameOver(): void {
    this.dead = true; this.player.die();
    if (this.score > this.highScore) { this.highScore = this.score; localStorage.setItem(GAME.highScoreKey, String(this.highScore)); }
  }
  private restart(): void { this.player = new Player(); this.obstacles = []; this.elapsed = 0; this.score = 0; this.dead = false; this.distanceToSpawn = 420; this.lastObstacle = null; }
  private draw(): void {
    const ctx = this.canvas.getContext("2d"); if (!ctx) return;
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS.height); gradient.addColorStop(0, "#16243b"); gradient.addColorStop(1, "#0b1220");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
    ctx.fillStyle = "rgba(255,255,255,.05)";
    for (let x = 0; x < CANVAS.width; x += 80) ctx.fillRect(x, 65 + (x % 160), 2, 2);
    ctx.strokeStyle = "#64748b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, CANVAS.groundY + 2); ctx.lineTo(CANVAS.width, CANVAS.groundY + 2); ctx.stroke();
    this.player.draw(ctx, this.debugHitboxes); this.obstacles.forEach((obstacle) => obstacle.draw(ctx, this.debugHitboxes));
    ctx.textAlign = "right"; ctx.fillStyle = "#e8eef9"; ctx.font = "700 18px ui-monospace, monospace"; ctx.fillText(`SCORE ${String(this.score).padStart(5, "0")}`, CANVAS.width - 24, 32); ctx.fillStyle = "#8fa2bd"; ctx.fillText(`BEST ${String(this.highScore).padStart(5, "0")}`, CANVAS.width - 24, 57);
    ctx.textAlign = "left"; ctx.fillStyle = "#3dd6a2"; ctx.font = "600 14px system-ui"; ctx.fillText("● MIC STATUS IN PANEL", 24, 30);
    if (this.dead) { ctx.fillStyle = "rgba(5,10,20,.72)"; ctx.fillRect(0, 0, CANVAS.width, CANVAS.height); ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.font = "800 42px system-ui"; ctx.fillText("GAME OVER", CANVAS.width / 2, 170); ctx.fillStyle = "#f7c948"; ctx.font = "600 18px system-ui"; ctx.fillText("R 키 또는 화면 클릭으로 다시 시작", CANVAS.width / 2, 210); }
  }
}
