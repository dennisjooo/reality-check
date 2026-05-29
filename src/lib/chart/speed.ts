import { SPEED_MIN, SPEED_MAX } from "./chart-constants";

const SPEED_RATIO = SPEED_MAX / SPEED_MIN;

export function clampSpeed(speed: number): number {
  return Math.max(SPEED_MIN, Math.min(SPEED_MAX, speed));
}

export function sliderToSpeed(pos: number): number {
  return SPEED_MIN * Math.pow(SPEED_RATIO, pos / 100);
}

export function speedToSlider(speed: number): number {
  const clamped = clampSpeed(speed);
  return (100 * Math.log(clamped / SPEED_MIN)) / Math.log(SPEED_RATIO);
}

export function formatSpeed(speed: number): string {
  if (Number.isInteger(speed)) return `${speed}x`;
  if (speed < 1) return `${Number(speed.toFixed(2))}x`;
  return `${Number(speed.toFixed(1))}x`;
}

/** -1 at SPEED_MIN, 0 at 1x, +1 at SPEED_MAX */
export function memePlacementFactor(speed: number): number {
  const s = clampSpeed(speed);
  if (s <= 1) {
    return (s - 1) / (1 - SPEED_MIN);
  }
  return (s - 1) / (SPEED_MAX - 1);
}

/** 0 below 1x, ramps to 1 at SPEED_MAX — for tighter meme layout at high speed */
export function memeFastFactor(speed: number): number {
  return Math.max(0, memePlacementFactor(speed));
}

/** Left edge of the anchor window; slower speeds favor recent bars */
export function memeRecentWindowStart(speed: number): number {
  const factor = memePlacementFactor(speed);
  if (factor <= 0) {
    return 0.4 + factor * 0.15;
  }
  return 0.4 + factor * 0.35;
}

/** Wall-clock cooldown inversely scaled so meme pacing tracks chart speed */
export function memeSpawnCooldownMs(baseMs: number, speed: number): number {
  return Math.round(baseMs / clampSpeed(speed));
}

/** Browser-safe playback rate for meme/background audio */
export function audioPlaybackRate(speed: number): number {
  return Math.max(SPEED_MIN, Math.min(clampSpeed(speed), 4));
}
