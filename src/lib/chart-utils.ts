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
 * Compute outlier-safe min/max for visible data using IQR fencing.
 * Returns a range that excludes extreme wicks/spikes so the y-axis
 * stays useful for the bulk of the data.
 */
export function computeSafeRange(
  quotes: ChartData[],
  startIdx: number,
  endIdx: number
) {
  const slice = quotes.slice(startIdx, endIdx + 1);
  if (slice.length === 0) return null;

  // Collect all price extremes
  const lows = slice.map((q) => q.low).sort((a, b) => a - b);
  const highs = slice.map((q) => q.high).sort((a, b) => a - b);

  const q1 = (arr: number[]) => arr[Math.floor(arr.length * 0.25)];
  const q3 = (arr: number[]) => arr[Math.floor(arr.length * 0.75)];

  const lowQ1 = q1(lows);
  const lowQ3 = q3(lows);
  const highQ1 = q1(highs);
  const highQ3 = q3(highs);

  const lowIQR = lowQ3 - lowQ1;
  const highIQR = highQ3 - highQ1;

  // Use 2.5× IQR fence (wider than the classic 1.5× to avoid over-clipping)
  const safeLow = lowQ1 - 2.5 * lowIQR;
  const safeHigh = highQ3 + 2.5 * highIQR;

  // Actual data min/max (to never expand beyond real data)
  const dataMin = lows[0];
  const dataMax = highs[highs.length - 1];

  // Add 5% padding
  const clampedLow = Math.max(safeLow, dataMin);
  const clampedHigh = Math.min(safeHigh, dataMax);
  const padding = (clampedHigh - clampedLow) * 0.05;

  return {
    min: clampedLow - padding,
    max: clampedHigh + padding,
  };
}
