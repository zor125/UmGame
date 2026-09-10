export const CANVAS = { width: 960, height: 420, groundY: 342 } as const;

export const PLAYER = {
  x: 120,
  width: 48,
  height: 66,
  slideHeight: 34,
  slideDuration: 620,
  gravity: 1850,
  shortJumpVelocity: -650,
  longJumpVelocity: -850,
} as const;

export const GAME = {
  initialSpeed: 330,
  maxSpeed: 650,
  acceleration: 5.5,
  minSpawnGap: 330,
  maxSpawnGap: 570,
  highScoreKey: "um-runner-high-score",
} as const;

export const AUDIO_CONFIG = {
  fftSize: 2048,
  vadThreshold: 0.025,
  vadSilenceMs: 260,
  vadMinDurationMs: 150,
  vadMaxDurationMs: 2000,
  commandThreshold: 0.75,
  pitchMinHz: 70,
  pitchMaxHz: 500,
  pitchFrameSize: 2048,
  pitchHopSize: 1024,
} as const;
