import {
  type IChartApi,
  type CandlestickData,
  type LineData,
  type HistogramData,
  type Time,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
} from "lightweight-charts";
import type { ChartData, ChartType } from "@/lib/chart-types";
import { CANDLESTICK_COLORS, LINE_SERIES_OPTIONS, VOLUME_COLORS } from "@/lib/chart-constants";

/**
 * Map quotes to candlestick series data.
 */
export function toCandlestickData(quotes: ChartData[]): CandlestickData[] {
  return quotes.map((q) => ({
    time: q.time as Time,
    open: q.open,
    high: q.high,
    low: q.low,
    close: q.close,
  }));
}

/**
 * Map quotes to line series data.
 */
export function toLineData(quotes: ChartData[]): LineData[] {
  return quotes.map((q) => ({
    time: q.time as Time,
    value: q.close,
  }));
}

/**
 * Map quotes to volume histogram data.
 */
export function toVolumeData(quotes: ChartData[]): HistogramData[] {
  return quotes.map((q) => ({
    time: q.time as Time,
    value: q.volume,
    color: q.close >= q.open ? VOLUME_COLORS.upColor : VOLUME_COLORS.downColor,
  }));
}

/**
 * Add the main price series (candlestick or line) to a chart and return it.
 */
export function addPriceSeries(
  chart: IChartApi,
  chartType: ChartType,
  quotes: ChartData[],
  priceFormat: { type: "price"; precision: number; minMove: number },
  lineColor: string,
) {
  if (chartType === "candlestick") {
    const series = chart.addSeries(CandlestickSeries, {
      ...CANDLESTICK_COLORS,
      priceFormat,
    });
    series.setData(toCandlestickData(quotes));
    return series;
  }

  const series = chart.addSeries(LineSeries, {
    color: lineColor,
    priceLineColor: lineColor,
    crosshairMarkerBackgroundColor: lineColor,
    ...LINE_SERIES_OPTIONS,
    priceFormat,
  });
  series.setData(toLineData(quotes));
  return series;
}

/**
 * Add the volume histogram series to a chart and return it.
 */
export function addVolumeSeries(chart: IChartApi, quotes: ChartData[]) {
  const volumeSeries = chart.addSeries(HistogramSeries, {
    ...VOLUME_COLORS,
    priceFormat: { type: "volume" as const },
    priceScaleId: "volume",
  });
  chart.priceScale("volume").applyOptions({
    scaleMargins: { top: 0.8, bottom: 0 },
  });
  volumeSeries.setData(toVolumeData(quotes));
  return volumeSeries;
}