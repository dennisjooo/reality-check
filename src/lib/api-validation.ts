/**
 * Shared validation constants and helpers for the chart API route.
 * Extracted for testability and reuse.
 */

export const VALID_SYMBOL_RE = /^[A-Za-z0-9^=.\-]{1,20}$/;

export const VALID_INTERVALS = new Set(["1h", "1d", "1wk", "1mo"]);

export const KNOWN_PARAMS = new Set([
  "symbol",
  "interval",
  "period1",
  "period2",
  "range",
]);

/** Yahoo Finance limits how far back you can fetch per interval (in days). */
export const INTERVAL_MAX_DAYS: Record<string, number> = {
  "1h": 730,
  "1d": Infinity,
  "1wk": Infinity,
  "1mo": Infinity,
};