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

export { computeSafeRange, sanitizeQuotes, shouldUseLogScale } from "./outlier-detection";
