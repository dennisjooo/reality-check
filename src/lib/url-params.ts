import type { ChartInterval } from "@/lib/chart-types";
import type { SettingsOverrides } from "@/hooks/use-settings";
import { VALID_SYMBOL_RE } from "@/lib/api-validation";

/**
 * Parse URL search params into settings overrides for deep-linking.
 */
export function parseUrlOverrides(searchParams: URLSearchParams): SettingsOverrides {
  const overrides: SettingsOverrides = {};

  const q = searchParams.get("q")?.trim();
  if (q && VALID_SYMBOL_RE.test(q)) overrides.symbol = q;

  const speed = searchParams.get("speed");
  if (speed) {
    const n = Number(speed);
    if (!isNaN(n) && n >= 1 && n <= 10) overrides.speed = n;
  }

  const type = searchParams.get("type");
  if (type === "candlestick" || type === "line") overrides.chartType = type;

  const interval = searchParams.get("interval");
  if (interval && /^(1h|1d|1wk|1mo)$/.test(interval)) overrides.interval = interval as ChartInterval;

  const from = searchParams.get("from");
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) overrides.fromDate = from;

  const to = searchParams.get("to");
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) overrides.toDate = to;

  const memes = searchParams.get("memes");
  if (memes === "true" || memes === "1") overrides.memesEnabled = true;
  if (memes === "false" || memes === "0") overrides.memesEnabled = false;

  return overrides;
}

/**
 * Build a shareable URL query string from current settings.
 */
export function buildSearchURL(params: {
  symbol: string;
  speed: number;
  chartType: string;
  interval: string;
  fromDate?: string;
  toDate?: string;
  memesEnabled?: boolean;
}): string {
  const sp = new URLSearchParams();
  sp.set("q", params.symbol);
  sp.set("speed", String(params.speed));
  sp.set("type", params.chartType);
  sp.set("interval", params.interval);
  if (params.fromDate) sp.set("from", params.fromDate);
  if (params.toDate) sp.set("to", params.toDate);
  if (params.memesEnabled) sp.set("memes", "true");
  return `?${sp.toString()}`;
}

/**
 * Check whether any URL overrides are present (used to determine autoplay).
 */
export function hasOverrides(overrides: SettingsOverrides): boolean {
  return !!(
    overrides.symbol ||
    overrides.speed ||
    overrides.chartType ||
    overrides.interval ||
    overrides.fromDate ||
    overrides.toDate ||
    overrides.memesEnabled != null
  );
}