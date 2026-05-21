import type { ChartType, ChartInterval } from "./chart-types";

// Milestones: absolute bar counts to reveal at each pause point
export const MILESTONES = [50, 200, 500, 1500, 5000];

// Size of each pagination chunk in years
export const CHUNK_YEARS = 2;

export const DEFAULT_SYMBOL = "BTC-USD";
export const DEFAULT_ASSET_META = {
  name: "Bitcoin USD",
  type: "CRYPTOCURRENCY",
  exchange: "CCC",
} as const;
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
  { name: "Green", value: "#34d399" },
  { name: "Red", value: "#f87171" },
  { name: "Purple", value: "#a855f7" },
  { name: "Orange", value: "#f97316" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Pink", value: "#ec4899" },
  { name: "Yellow", value: "#eab308" },
];

export const CANDLESTICK_COLORS = {
  upColor: "#34d399",
  downColor: "#f87171",
  borderDownColor: "#f87171",
  borderUpColor: "#34d399",
  wickDownColor: "#f87171",
  wickUpColor: "#34d399",
} as const;

export const LINE_SERIES_OPTIONS = {
  lineWidth: 2,
} as const;

export const VOLUME_COLORS = {
  upColor: "rgba(52, 211, 153, 0.42)",
  downColor: "rgba(248, 113, 113, 0.42)",
} as const;

export interface PersistedSettings {
  symbol?: string;
  assetName?: string;
  assetType?: string;
  exchange?: string;
  speed?: number;
  chartType?: ChartType;
  lineColor?: string;
  interval?: ChartInterval;
  fromDate?: string;
  toDate?: string;
  savedAt?: number;
}
