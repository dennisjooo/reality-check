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

interface LocalExtreme {
  index: number;
  price: number;
  time: number;
}

/**
 * Find the peak/trough within a sub-range of quotes.
 */
function findSegmentExtremes(
  quotes: { close: number; time?: number }[],
  from: number,
  to: number
): { peak: LocalExtreme; trough: LocalExtreme } {
  let peakIdx = from;
  let troughIdx = from;
  let peakVal = quotes[from].close;
  let troughVal = quotes[from].close;
  for (let i = from + 1; i <= to; i++) {
    const c = quotes[i].close;
    if (c > peakVal) { peakVal = c; peakIdx = i; }
    if (c < troughVal) { troughVal = c; troughIdx = i; }
  }
  return {
    peak: { index: peakIdx, price: peakVal, time: quotes[peakIdx]?.time ?? 0 },
    trough: { index: troughIdx, price: troughVal, time: quotes[troughIdx]?.time ?? 0 },
  };
}

const NUM_SEGMENTS = 4;

/**
 * Build a rolling price snapshot from a slice of quotes.
 * Used during animation for throttled UI updates.
 */
export function buildRollingSnapshot(
  quotes: { close: number; high: number; low: number; time?: number }[],
  fromIdx: number,
  lastBarIndex: number,
  visibleBars: number,
  totalBars?: number,
): { 
  firstClose: number; 
  lastClose: number; 
  high: number; 
  low: number; 
  points: number; 
  totalPoints?: number;
  x?: number; 
  y?: number; 
  peakIndex?: number;
  peakPrice?: number;
  peakTime?: number;
  troughIndex?: number;
  troughPrice?: number;
  troughTime?: number;
  lastTime?: number;
  lastLogicalIndex?: number;
  localPeaks?: LocalExtreme[];
  localTroughs?: LocalExtreme[];
  getCoordinate?: (time: number, p: number) => {x: number, y: number} | null 
} | null {
  const firstBar = quotes[fromIdx];
  const lastBar = quotes[lastBarIndex];
  if (!firstBar || !lastBar) return null;

  let peakIndex = fromIdx;
  let troughIndex = fromIdx;
  let peakClose = firstBar.close;
  let troughClose = firstBar.close;
  for (let i = fromIdx + 1; i <= lastBarIndex; i++) {
    const c = quotes[i].close;
    if (c > peakClose) { peakClose = c; peakIndex = i; }
    if (c < troughClose) { troughClose = c; troughIndex = i; }
  }

  // Compute local peaks/troughs across segments for spreading memes over
  // the full visible range (including older data on the left).
  let localPeaks: LocalExtreme[] | undefined;
  let localTroughs: LocalExtreme[] | undefined;
  const range = lastBarIndex - fromIdx;
  if (range >= NUM_SEGMENTS * 10) {
    const segSize = Math.floor(range / NUM_SEGMENTS);
    localPeaks = [];
    localTroughs = [];
    for (let s = 0; s < NUM_SEGMENTS; s++) {
      const segFrom = fromIdx + s * segSize;
      const segTo = s === NUM_SEGMENTS - 1 ? lastBarIndex : segFrom + segSize - 1;
      const { peak, trough } = findSegmentExtremes(quotes, segFrom, segTo);
      localPeaks.push(peak);
      localTroughs.push(trough);
    }
  }

  return {
    firstClose: firstBar.close,
    lastClose: lastBar.close,
    high: lastBar.high,
    low: firstBar.low,
    points: Math.round(visibleBars),
    totalPoints: totalBars,
    peakIndex,
    peakPrice: peakClose,
    peakTime: quotes[peakIndex]?.time,
    troughIndex,
    troughPrice: troughClose,
    troughTime: quotes[troughIndex]?.time,
    lastTime: lastBar.time,
    localPeaks,
    localTroughs,
  };
}