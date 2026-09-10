import { CANVAS, FIRST_OBSTACLE_DELAY, GAME, TUTORIAL_OBSTACLE_GAP } from "./constants";
import { InputManager } from "./InputManager";
import { Obstacle, type ObstacleType } from "./Obstacle";
import { Player, type Rect } from "./Player";

export class Game {
  private player = new Player();
  private obstacles: Obstacle[] = [];
  private lastTime = 0;
  private distanceToSpawn = GAME.initialSpeed * FIRST_OBSTACLE_DELAY;
  private elapsed = 0;
  private score = 0;
  private highScore = Number(localStorage.getItem(GAME.highScoreKey) ?? 0);
  private dead = false;
  private begun = false;
  private lastObstacle: ObstacleType | null = null;
  private tutorialObstacleIndex = 0;
  micEnabled = false;
  debugHitboxes = false;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly input: InputManager) {
    canvas.addEventListener("click", () => { if (this.dead) this.input.push("RESTART"); });
  }
  start(): void { requestAnimationFrame(this.loop); }
  begin(): void { this.begun = true; }
  hasBegun(): boolean { return this.begun; }
  private readonly loop = (time: number): void => {
    const dt = this.lastTime ? Math.min((time - this.lastTime) / 1000, 0.05) : 0;
    this.lastTime = time;
    this.update(dt); this.draw(); requestAnimationFrame(this.loop);
  };
  private update(dt: number): void {
    for (const queued of this.input.drain()) {
      const action = queued.action;
      const stateBefore = this.player.state;
      if (action === "RESTART" && this.dead) this.restart();
      else if (!this.dead && action === "SLIDE") this.player.slide();
      else if (!this.dead && action === "SHORT_JUMP") this.player.shortJump();
      else if (!this.dead && action === "LONG_JUMP") this.player.longJump();
      if (this.player.state !== stateBefore) queued.onApplied?.(performance.now());
    }
    if (this.dead || !this.begun) return;
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
    const tutorialTypes: ObstacleType[] = ["HIGH", "LOW", "WIDE"];
    const tutorialActions = ["SLIDE", "SHORT_JUMP", "LONG_JUMP"] as const;
    const tutorialCommands = ["UM", "YE", "JWEJWEIYA"] as const;
    const tutorial = this.tutorialObstacleIndex < tutorialTypes.length;
    let type = tutorial ? tutorialTypes[this.tutorialObstacleIndex] : types[Math.floor(Math.random() * types.length)];
    if (!tutorial && type === this.lastObstacle && Math.random() < 0.65) type = types[(types.indexOf(type) + 1) % types.length];
    this.obstacles.push(new Obstacle(type, CANVAS.width + 30, speed));
    this.lastObstacle = type;
    if (tutorial) {
      const expected = tutorialCommands[this.tutorialObstacleIndex];
      const action = tutorialActions[this.tutorialObstacleIndex];
      console.debug(`Obstacle #${this.tutorialObstacleIndex + 1}: ${type} (${action}) / expected ${expected}`);
      this.tutorialObstacleIndex++;
    } else console.debug("Obstacle #4+: RANDOM", type);
    const reactionScale = Math.min(speed / GAME.initialSpeed, 1.7);
    this.distanceToSpawn = this.tutorialObstacleIndex > 0 && this.tutorialObstacleIndex < tutorialTypes.length
      ? speed * TUTORIAL_OBSTACLE_GAP
      : (GAME.minSpawnGap + Math.random() * (GAME.maxSpawnGap - GAME.minSpawnGap)) * reactionScale;
  }
  private intersects(a: Rect, b: Rect): boolean { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }
  private gameOver(): void {
    this.dead = true; this.player.die();
    if (this.score > this.highScore) { this.highScore = this.score; localStorage.setItem(GAME.highScoreKey, String(this.highScore)); }
  }
  private restart(): void {
    this.player = new Player(); this.obstacles = []; this.elapsed = 0; this.score = 0; this.dead = false;
    this.distanceToSpawn = GAME.initialSpeed * FIRST_OBSTACLE_DELAY; this.lastObstacle = null; this.tutorialObstacleIndex = 0;
  }
  private draw(): void {
    const ctx = this.canvas.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = "#f7f7f7"; ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
    ctx.strokeStyle = "#444"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, CANVAS.groundY + .5); ctx.lineTo(CANVAS.width, CANVAS.groundY + .5); ctx.stroke();
    ctx.fillStyle = "#333"; ctx.font = "14px ui-monospace, monospace";
    ctx.textAlign = "left"; ctx.fillText(this.micEnabled ? "MIC ON" : "MIC OFF", 16, 25);
    ctx.textAlign = "right"; ctx.fillText(`HI ${String(this.highScore).padStart(5, "0")}   ${String(this.score).padStart(5, "0")}`, CANVAS.width - 16, 25);
    if (!this.begun) {
      ctx.textAlign = "center"; ctx.fillStyle = "#333"; ctx.font = "bold 28px ui-monospace, monospace"; ctx.fillText("UM GAME", CANVAS.width / 2, 76);
      ctx.font = "14px ui-monospace, monospace"; ctx.textAlign = "left";
      const x = CANVAS.width / 2 - 110; ctx.fillText('"엄"          SLIDE', x, 112); ctx.fillText('"예?"         SHORT JUMP', x, 138); ctx.fillText('"줴줴이야"     LONG JUMP', x, 164);
      ctx.textAlign = "center"; ctx.font = "bold 15px ui-monospace, monospace"; ctx.fillText("CLICK TO START", CANVAS.width / 2, 207); return;
    }
    this.player.draw(ctx, this.debugHitboxes); this.obstacles.forEach((obstacle) => obstacle.draw(ctx, this.debugHitboxes));
    if (this.dead) { ctx.fillStyle = "rgba(247,247,247,.88)"; ctx.fillRect(320, 91, 320, 82); ctx.textAlign = "center"; ctx.fillStyle = "#333"; ctx.font = "bold 24px ui-monospace, monospace"; ctx.fillText("GAME OVER", CANVAS.width / 2, 122); ctx.font = "13px ui-monospace, monospace"; ctx.fillText("PRESS R TO RESTART", CANVAS.width / 2, 151); }
  }
}
