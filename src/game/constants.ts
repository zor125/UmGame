export const CANVAS = { width: 960, height: 300, groundY: 238 } as const;

export const PLAYER = {
  x: 120,
  width: 48,
  height: 66,
  slideHeight: 34,
  slideDuration: 620,
  shortJumpGravity: 2300,
  longJumpGravity: 1850,
  shortJumpVelocity: -520,
  longJumpVelocity: -850,
} as const;

export const PLAYER_RENDER_SIZE = 56;

export const GAME = {
  initialSpeed: 330,
  maxSpeed: 650,
  acceleration: 5.5,
  minSpawnGap: 446,
  maxSpawnGap: 770,
  highScoreKey: "um-runner-high-score",
} as const;

export const FIRST_OBSTACLE_DELAY = 2.0;
export const TUTORIAL_OBSTACLE_GAP = 2.7;

export const AUDIO_CONFIG = {
  fftSize: 2048,
  vadThreshold: 0.025,
  vadSilenceMs: 230,
  vadMinDurationMs: 150,
  vadMaxDurationMs: 2000,
  commandThreshold: 0.75,
  pitchMinHz: 70,
  pitchMaxHz: 500,
  pitchFrameSize: 2048,
  pitchHopSize: 1024,
} as const;
