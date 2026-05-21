import type { ChartData } from "./chart-types";

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

  // Apply level-filtering when any OHLC field is wildly out of range (>50×
  // the median close). Checks all fields so bogus open/high values trigger
  // filtering even when close is normal. Only removes a small minority (<10%).
  const medianClose = closes[Math.floor(closes.length * 0.5)];
  let maxOHLC = 0;
  for (const q of slice) {
    maxOHLC = Math.max(maxOHLC, q.open, q.high, q.close);
  }
  const magnitudeRatio = medianClose > 0 ? maxOHLC / medianClose : 0;

  let working = slice;
  if (magnitudeRatio > 50 && iqr > 0) {
    const filtered = slice.filter(
      (q) => q.close >= lowerFence && q.close <= upperFence
    );
    const removedPct = 1 - filtered.length / slice.length;
    if (filtered.length > 0 && removedPct < 0.1) {
      working = filtered;
    }
  }

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
 * Clamp extreme outlier bars in the dataset so the chart never sees values
 * that are orders of magnitude away from the bulk of the data.
 *
 * Builds IQR fences from close prices (the most reliable field), then checks
 * whether any bar's OHLC values breach those fences. The gate triggers when
 * the max of ANY OHLC field relative to the median close exceeds 50× — this
 * catches Yahoo Finance glitches where open/high are bogus (e.g. 0.11111111)
 * even when close is perfectly normal.
 *
 * Returns a new array (or the original reference when nothing changed).
 */
export function sanitizeQuotes(quotes: ChartData[]): ChartData[] {
  if (quotes.length < 20) return quotes;

  const closes = quotes.map((q) => q.close).sort((a, b) => a - b);
  const q1 = closes[Math.floor(closes.length * 0.25)];
  const q3 = closes[Math.floor(closes.length * 0.75)];
  const iqr = q3 - q1;
  if (iqr <= 0) return quotes;

  const medianClose = closes[Math.floor(closes.length * 0.5)];

  // Check if ANY OHLC field has values wildly out of range compared to median
  // close. This catches glitches where open/high are bogus but close is fine.
  let maxOHLC = 0;
  for (const q of quotes) {
    maxOHLC = Math.max(maxOHLC, q.open, q.high, q.close);
  }
  const magnitudeRatio = medianClose > 0 ? maxOHLC / medianClose : 0;
  if (magnitudeRatio <= 50) return quotes;

  const lo = q1 - 4 * iqr;
  const hi = q3 + 4 * iqr;

  // Compute the median bar range from non-outlier bars so we can reconstruct
  // glitched bars with a realistic spread around their (correct) close.
  const normalRanges = quotes
    .filter((q) => q.high <= hi && q.low >= lo && q.open <= hi && q.open >= lo)
    .map((q) => q.high - q.low)
    .sort((a, b) => a - b);
  const medianBarRange =
    normalRanges.length > 0 ? normalRanges[Math.floor(normalRanges.length / 2)] : iqr * 0.1;

  const outlierCount = quotes.filter(
    (q) => q.close < lo || q.close > hi || q.high > hi || q.low < lo || q.open > hi || q.open < lo
  ).length;
  if (outlierCount === 0) return quotes;
  if (outlierCount / quotes.length >= 0.1) return quotes;

  let changed = false;
  const result = quotes.map((q) => {
    const needsClamp =
      q.close < lo || q.close > hi || q.high > hi || q.low < lo || q.open > hi || q.open < lo;
    if (!needsClamp) return q;
    changed = true;
    // Reconstruct the bar around the (usually correct) close price using
    // the median bar range, so bogus spikes become normal-looking bars.
    const safeClose = Math.max(lo, Math.min(q.close, hi));
    const safeOpen = q.open > hi || q.open < lo ? safeClose : q.open;
    return {
      ...q,
      open: safeOpen,
      high: Math.max(safeClose, safeOpen) + medianBarRange * 0.5,
      low: Math.min(safeClose, safeOpen) - medianBarRange * 0.5,
      close: safeClose,
    };
  });

  return changed ? result : quotes;
}

/**
 * Determine if the dataset would benefit from logarithmic price scale.
 * Returns true only for extreme cases (>100× range between p10 and p90)
 * where linear scale completely flattens smaller values.
 * Normal growth stocks (e.g. AAPL $1→$300) stay linear; this only
 * triggers for things like penny stocks or bad-data currency pairs.
 */
export function shouldUseLogScale(quotes: ChartData[]): boolean {
  if (quotes.length < 20) return false;

  const closes = quotes.map((q) => q.close).filter((c) => c > 0).sort((a, b) => a - b);
  if (closes.length < 20) return false;

  const p10 = closes[Math.floor(closes.length * 0.1)];
  const p90 = closes[Math.floor(closes.length * 0.9)];

  return p10 > 0 && p90 / p10 > 100;
}
