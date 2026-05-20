import type { ChartData } from "./chart-types";

/** Get chart color scheme based on current theme */
export function getChartTheme(isDark: boolean) {
  return {
    textColor: isDark ? "#9ca3af" : "#6b7280",
    gridColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)",
    borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
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
 * Uses a bar-range spike filter instead of IQR fencing. The IQR approach
 * clips legitimate trending data (e.g. a stock dropping 300→60) because
 * the extreme quartiles diverge.  Instead, we:
 *   1. Compute the median single-bar range (high−low).
 *   2. Only trim bars whose individual range exceeds 3× the median
 *      (true flash-crash wicks / data anomalies).
 *   3. Otherwise use the full data min/max so genuine trends are visible.
 *   4. Add adaptive padding (more padding for wider ranges).
 */
export function computeSafeRange(
  quotes: ChartData[],
  startIdx: number,
  endIdx: number
) {
  const slice = quotes.slice(startIdx, endIdx + 1);
  if (slice.length === 0) return null;

  // For very few bars, just use raw min/max — no outlier logic needed
  if (slice.length <= 5) {
    const dataMin = Math.min(...slice.map((q) => q.low));
    const dataMax = Math.max(...slice.map((q) => q.high));
    const range = dataMax - dataMin || dataMax * 0.01 || 1;
    const padding = range * 0.08;
    return { min: dataMin - padding, max: dataMax + padding };
  }

  // Compute per-bar ranges and find the median
  const barRanges = slice.map((q) => q.high - q.low).sort((a, b) => a - b);
  const medianRange = barRanges[Math.floor(barRanges.length / 2)];

  // Threshold: bars with a range > 3× the median range are "spike" bars
  const spikeThreshold = medianRange * 3;

  let safeLow = Infinity;
  let safeHigh = -Infinity;

  for (const q of slice) {
    const range = q.high - q.low;
    if (range > spikeThreshold && medianRange > 0) {
      // For spike bars, use close ± medianRange to dampen extremes
      safeLow = Math.min(safeLow, q.close - medianRange);
      safeHigh = Math.max(safeHigh, q.close + medianRange);
    } else {
      safeLow = Math.min(safeLow, q.low);
      safeHigh = Math.max(safeHigh, q.high);
    }
  }

  // Never exceed actual data bounds
  const dataMin = Math.min(...slice.map((q) => q.low));
  const dataMax = Math.max(...slice.map((q) => q.high));
  safeLow = Math.max(safeLow, dataMin);
  safeHigh = Math.min(safeHigh, dataMax);

  // Adaptive padding: 8% for wide ranges, 5% for tight ones
  const totalRange = safeHigh - safeLow || safeHigh * 0.01 || 1;
  const ratio = totalRange / (dataMax || 1);
  const paddingPct = ratio > 0.5 ? 0.08 : 0.05;
  const padding = totalRange * paddingPct;

  return {
    min: safeLow - padding,
    max: safeHigh + padding,
  };
}
