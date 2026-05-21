/**
 * Pure animation math for the chart zoom-out replay.
 *
 * Extracted from use-chart-animation.ts so the speed/growth logic
 * can be tested independently and the hook stays readable.
 */

/**
 * Compute the next visible-bar count given the current state.
 *
 * Uses a hybrid additive + exponential growth model:
 *   - Additive floor ensures visible early motion even at low bar counts.
 *   - Exponential term accelerates as more bars become visible.
 */
export function computeNextVisibleBars(
  currentVisibleBars: number,
  deltaSec: number,
  speed: number,
  totalBars: number,
): number {
  // Additive floor for visible early motion (before exponential kicks in)
  const minBarsPerSec = 1.5 + speed * 1.0;
  const additive = minBarsPerSec * deltaSec;

  // Exponential: speed 1 ~1.33x/s, speed 5 ~1.65x/s, speed 10 ~2.05x/s
  const growthPerSecond = 1.25 + speed * 0.08;
  const multiplicative =
    currentVisibleBars * (Math.pow(growthPerSecond, deltaSec) - 1);

  const next = currentVisibleBars + Math.max(additive, multiplicative);
  return Math.min(next, totalBars);
}

/**
 * Determine the milestone index for a given visible bar count.
 * Returns the index of the first milestone that has NOT yet been reached.
 */
export function getMilestoneIndex(visibleBars: number, milestones: readonly number[]): number {
  let index = 0;
  while (index < milestones.length && visibleBars >= milestones[index]) {
    index += 1;
  }
  return index;
}

/**
 * Build a rolling price snapshot from a slice of quotes.
 * Used during animation for throttled UI updates.
 */
export function buildRollingSnapshot(
  quotes: { close: number; high: number; low: number }[],
  fromIdx: number,
  lastBarIndex: number,
  visibleBars: number,
): { firstClose: number; lastClose: number; high: number; low: number; points: number } | null {
  const firstBar = quotes[fromIdx];
  const lastBar = quotes[lastBarIndex];
  if (!firstBar || !lastBar) return null;
  return {
    firstClose: firstBar.close,
    lastClose: lastBar.close,
    high: lastBar.high,
    low: firstBar.low,
    points: Math.round(visibleBars),
  };
}