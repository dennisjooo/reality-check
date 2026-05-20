import type { ChartType, ChartInterval } from "./chart-types";

// Milestones: absolute bar counts to reveal at each pause point
export const MILESTONES = [50, 200, 500, 1500, 5000];

// Size of each pagination chunk in years
export const CHUNK_YEARS = 2;

export const DEFAULT_SYMBOL = "BTC-USD";
export const DEFAULT_SPEED = 6;
export const DEFAULT_LINE_COLOR = "#3b82f6";
export const DEFAULT_INTERVAL: ChartInterval = "1d";

export const INTERVALS: { value: ChartInterval; label: string }[] = [
  { value: "1h", label: "1H" },
  { value: "1d", label: "1D" },
  { value: "1wk", label: "1W" },
  { value: "1mo", label: "1M" },
];

export const LS_KEY = "reality-check-settings";

export const LINE_COLORS = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Red", value: "#ef4444" },
  { name: "Purple", value: "#a855f7" },
  { name: "Orange", value: "#f97316" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Pink", value: "#ec4899" },
  { name: "Yellow", value: "#eab308" },
];

export const CANDLESTICK_COLORS = {
  upColor: "#22c55e",
  downColor: "#ef4444",
  borderDownColor: "#ef4444",
  borderUpColor: "#22c55e",
  wickDownColor: "#ef4444",
  wickUpColor: "#22c55e",
} as const;

export const LINE_SERIES_OPTIONS = {
  lineWidth: 2,
} as const;

export const VOLUME_COLORS = {
  upColor: "rgba(34, 197, 94, 0.45)",
  downColor: "rgba(239, 68, 68, 0.45)",
} as const;

export interface PersistedSettings {
  symbol?: string;
  speed?: number;
  chartType?: ChartType;
  lineColor?: string;
  interval?: ChartInterval;
  fromDate?: string; // ISO date string YYYY-MM-DD
  toDate?: string; // ISO date string YYYY-MM-DD
}
