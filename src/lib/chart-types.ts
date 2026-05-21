export interface ChartData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AssetMeta {
  symbol: string;
  name?: string;
  type?: string;
  exchange?: string;
}

export interface PriceSnapshot {
  firstClose: number;
  lastClose: number;
  high: number;
  low: number;
  points: number;
  x?: number;
  y?: number;
  peakIndex?: number;
  peakPrice?: number;
  peakTime?: number;
  troughIndex?: number;
  troughPrice?: number;
  troughTime?: number;
  lastLogicalIndex?: number;
  getCoordinate?: (time: number, price: number) => { x: number; y: number } | null;
}

export type ChartType = "candlestick" | "line";

export type ChartInterval = "1h" | "1d" | "1wk" | "1mo";

export type AnimPhase = "idle" | "animating" | "paused" | "complete";
