export interface ChartData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type ChartType = "candlestick" | "line";

export type AnimPhase = "idle" | "animating" | "paused" | "complete";
