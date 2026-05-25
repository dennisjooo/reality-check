/**
 * Date parsing and range utilities for the chart API route.
 */

/**
 * Parse a date parameter that may be a unix timestamp (seconds or ms) or an ISO string.
 */
export function parseDateParam(param: string): Date {
  const asNumber = Number(param);
  if (!isNaN(asNumber) && asNumber > 1e12) {
    // Looks like milliseconds
    return new Date(asNumber);
  }
  if (!isNaN(asNumber)) {
    // Looks like unix seconds
    return new Date(asNumber * 1000);
  }
  // Try ISO date string
  return new Date(param);
}

/**
 * Convert a human-readable range string (e.g. "1d", "5d", "1mo", "max")
 * to a start Date.
 */
export function rangeToPeriod1(range: string): Date {
  const now = new Date();
  const ms = now.getTime();
  const DAY = 24 * 60 * 60 * 1000;

  const ranges: Record<string, number> = {
    "1d": 1 * DAY,
    "5d": 5 * DAY,
    "1mo": 30 * DAY,
    "3mo": 90 * DAY,
    "6mo": 180 * DAY,
    "1y": 365 * DAY,
    "2y": 2 * 365 * DAY,
    "5y": 5 * 365 * DAY,
    "10y": 10 * 365 * DAY,
  };

  if (range === "max" || !ranges[range]) return new Date(0);
  return new Date(ms - ranges[range]);
}