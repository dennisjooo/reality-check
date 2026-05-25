import type { PriceSnapshot, LocalExtreme } from "@/lib/chart";

export function computeStep(snapshot: PriceSnapshot): number {
  const { firstClose, high, low } = snapshot;
  if (!firstClose) return 3;
  const amplitude = ((high - low) / firstClose) * 100;
  if (amplitude > 200) return 1;
  if (amplitude > 100) return 1.5;
  if (amplitude > 50) return 2;
  return 3;
}

export function pickNextAnchor(
  extremes: LocalExtreme[] | undefined,
  afterTime: number,
  minIndex: number
): LocalExtreme | null {
  if (!extremes || extremes.length === 0) return null;
  let best: LocalExtreme | null = null;
  for (const e of extremes) {
    if (e.index < minIndex || !e.time) continue;
    if (e.time <= afterTime) continue;
    if (!best || e.time < best.time) best = e;
  }
  return best;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function pickRandomNonRepeating(
  files: string[],
  previous: string | null
): string | null {
  if (files.length === 0) return null;
  if (files.length === 1 || !previous) {
    return files[Math.floor(Math.random() * files.length)];
  }

  const next = files[Math.floor(Math.random() * files.length)];
  if (next !== previous) return next;

  const alternatives = files.filter((f) => f !== previous);
  return alternatives.length > 0
    ? alternatives[Math.floor(Math.random() * alternatives.length)]
    : next;
}

export function getDynamicCooldownMs(
  snapshot: PriceSnapshot,
  percentChange: number,
  previousPercent: number
): number {
  const amplitudePct =
    snapshot.firstClose > 0
      ? ((snapshot.high - snapshot.low) / snapshot.firstClose) * 100
      : 0;

  const momentumPct = Math.abs(percentChange - previousPercent);
  const volatilityScore = clamp(amplitudePct / 60, 0, 1);
  const momentumScore = clamp(momentumPct / 2.5, 0, 1);
  const hypeScore = Math.max(volatilityScore, momentumScore);

  const cooldown =
    900 - hypeScore * (900 - 280);
  return Math.round(clamp(cooldown, 280, 900));
}

export function pickMagneticAnchor(
  extremes: LocalExtreme[] | undefined,
  fallback: LocalExtreme | null,
  minIndex: number,
  points: number
): LocalExtreme | null {
  if (!fallback) return null;
  if (!extremes || extremes.length === 0) return fallback;

  const band = Math.max(6, Math.floor(points * 0.14));
  let best = fallback;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const e of extremes) {
    if (!e.time || e.index < minIndex) continue;
    const dist = Math.abs(e.index - fallback.index);
    if (dist > band) continue;
    if (dist < bestDist) {
      best = e;
      bestDist = dist;
    }
  }
  return best;
}

export const MEME_CONSTANTS = {
  QUEUE_POLL_MS: 150,
  MIN_MEME_COOLDOWN_MS: 280,
  MAX_MEME_COOLDOWN_MS: 900,
  MAX_QUEUE_SIZE: 2,
} as const;
