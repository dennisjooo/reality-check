import type { ChartData, PriceSnapshot } from "./chart-types";

/**
 * Compute a price snapshot from an array of quotes.
 * Returns null for empty arrays.
 */
export function getPriceSnapshot(quotes: ChartData[]): PriceSnapshot | null {
  if (quotes.length === 0) return null;

  const firstClose = quotes[0].close;
  const lastClose = quotes[quotes.length - 1].close;
  const high = Math.max(...quotes.map((q) => q.high));
  const low = Math.min(...quotes.map((q) => q.low));

  return {
    firstClose,
    lastClose,
    high,
    low,
    points: quotes.length,
  };
}

/** Get chart color scheme based on current theme */
export function getChartTheme(isDark: boolean) {
  return {
    textColor: isDark ? "#9ca3af" : "#6b7280",
    gridColor: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.06)",
    borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.1)",
  };
}

/**
 * Compute price format (precision + minMove) based on the price range.
 * Ensures low-priced assets show enough decimal places on the y-axis.
 */
export function getPriceFormat(quotes: ChartData[]) {
  if (quotes.length === 0) {
    return { type: "price" as const, precision: 2, minMove: 0.01 };
  }

  const maxPrice = Math.max(...quotes.map((q) => q.high));

  if (maxPrice < 0.001) {
    return { type: "price" as const, precision: 6, minMove: 0.000001 };
  }
  if (maxPrice < 0.01) {
    return { type: "price" as const, precision: 5, minMove: 0.00001 };
  }
  if (maxPrice < 0.1) {
    return { type: "price" as const, precision: 4, minMove: 0.0001 };
  }
  if (maxPrice < 1) {
    return { type: "price" as const, precision: 3, minMove: 0.001 };
  }
  return { type: "price" as const, precision: 2, minMove: 0.01 };
}

/**
 * Compute outlier-safe min/max for visible data.
 *
 * Two-tier approach:
 *   Tier 1 — Price-level outlier detection (handles bad data / wrong magnitude):
 *     Uses IQR on close prices with a generous 4× fence. This catches bars
 *     whose entire price level is orders of magnitude away from the bulk of
 *     the data (e.g. IDR/USD showing 1.0 when the real value is 0.000057).
 *     The 4× multiplier is lenient enough to preserve legitimate trends.
 *
 *   Tier 2 — Bar-range spike filter (handles flash-crash wicks):
 *     Among the remaining "good" bars, dampens individual bars whose
 *     high-low range exceeds 3× the median bar range.
 *
 *   Finally, adds adaptive padding.
 */
export function computeSafeRange(
  quotes: ChartData[],
  startIdx: number,
  endIdx: number
) {
  const slice = quotes.slice(startIdx, endIdx + 1);
  if (slice.length === 0) return null;

  if (slice.length <= 5) {
    const dataMin = Math.min(...slice.map((q) => q.low));
    const dataMax = Math.max(...slice.map((q) => q.high));
    const range = dataMax - dataMin || dataMax * 0.01 || 1;
    const padding = range * 0.08;
    return { min: dataMin - padding, max: dataMax + padding };
  }

  // --- Tier 1: Price-level outlier exclusion via IQR on closes ---
  const closes = slice.map((q) => q.close).sort((a, b) => a - b);
  const q1 = closes[Math.floor(closes.length * 0.25)];
  const q3 = closes[Math.floor(closes.length * 0.75)];
  const iqr = q3 - q1;

  const lowerFence = q1 - 4 * iqr;
  const upperFence = q3 + 4 * iqr;

  // Only apply level-filtering when the raw max/min ratio is extreme (>50×)
  // to avoid clipping legitimate trending data like a stock dropping 300→60.
  const rawMin = closes[0];
  const rawMax = closes[closes.length - 1];
  const magnitudeRatio = rawMin > 0 ? rawMax / rawMin : 0;

  const filtered =
    magnitudeRatio > 50 && iqr > 0
      ? slice.filter((q) => q.close >= lowerFence && q.close <= upperFence)
      : slice;

  // If filtering removed everything, fall back to full slice
  const working = filtered.length > 0 ? filtered : slice;

  // --- Tier 2: Bar-range spike filter on surviving bars ---
  const barRanges = working.map((q) => q.high - q.low).sort((a, b) => a - b);
  const medianRange = barRanges[Math.floor(barRanges.length / 2)];
  const spikeThreshold = medianRange * 3;

  let safeLow = Infinity;
  let safeHigh = -Infinity;

  for (const q of working) {
    const range = q.high - q.low;
    if (range > spikeThreshold && medianRange > 0) {
      safeLow = Math.min(safeLow, q.close - medianRange);
      safeHigh = Math.max(safeHigh, q.close + medianRange);
    } else {
      safeLow = Math.min(safeLow, q.low);
      safeHigh = Math.max(safeHigh, q.high);
    }
  }

  // Clamp to working-set bounds
  const workMin = Math.min(...working.map((q) => q.low));
  const workMax = Math.max(...working.map((q) => q.high));
  safeLow = Math.max(safeLow, workMin);
  safeHigh = Math.min(safeHigh, workMax);

  // Adaptive padding
  const totalRange = safeHigh - safeLow || safeHigh * 0.01 || 1;
  const visibleRatio = totalRange / (workMax || 1);
  const paddingPct = visibleRatio > 0.5 ? 0.08 : 0.05;
  const padding = totalRange * paddingPct;

  return {
    min: safeLow - padding,
    max: safeHigh + padding,
  };
}

/**
 * Determine if the dataset would benefit from logarithmic price scale.
 * Returns true when the non-outlier price range spans more than 20× —
 * a strong signal that linear scale will squish smaller values.
 */
export function shouldUseLogScale(quotes: ChartData[]): boolean {
  if (quotes.length < 10) return false;

  const closes = quotes.map((q) => q.close).filter((c) => c > 0).sort((a, b) => a - b);
  if (closes.length < 10) return false;

  // Use 5th and 95th percentile to ignore extreme outliers
  const p5 = closes[Math.floor(closes.length * 0.05)];
  const p95 = closes[Math.floor(closes.length * 0.95)];

  return p5 > 0 && p95 / p5 > 20;
}
