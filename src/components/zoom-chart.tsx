"use client";

import { useEffect, useRef, useState } from "react";
import type { IChartApi } from "lightweight-charts";
import type {
  ChartType,
  ChartInterval,
  AnimPhase,
  PriceSnapshot,
} from "@/lib/chart-types";
import { getPriceFormat, getPriceSnapshot } from "@/lib/chart-utils";
import { addPriceSeries, toVolumeData } from "@/lib/chart-series";
import { useChartData } from "@/hooks/use-chart-data";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import { useChartTheme } from "@/hooks/use-chart-theme";
import { useChartInit } from "@/hooks/use-chart-init";
import { ControlBus } from "@/lib/control-bus";

interface ZoomChartProps {
  symbol: string;
  chartType?: ChartType;
  interval?: ChartInterval;
  lineColor?: string;
  fromDate?: string;
  toDate?: string;
  autoplay?: boolean;
  speedRef: React.MutableRefObject<number>;
  controlBus: ControlBus;
  onPhaseChange: (phase: AnimPhase) => void;
  phase: AnimPhase;
  targetMilestone?: number;
  onMilestoneChange?: (milestoneIndex: number) => void;
  onPriceSnapshotChange?: (snapshot: PriceSnapshot | null) => void;
  onLoadingChange?: (loading: boolean) => void;
}

export function ZoomChart({
  symbol,
  chartType = "candlestick",
  interval = "1d",
  lineColor = "#3b82f6",
  fromDate,
  toDate,
  autoplay = false,
  speedRef,
  controlBus,
  onPhaseChange,
  phase,
  targetMilestone,
  onMilestoneChange,
  onPriceSnapshotChange,
  onLoadingChange,
}: ZoomChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ReturnType<IChartApi["addSeries"]> | null>(null);
  const volumeSeriesRef = useRef<ReturnType<IChartApi["addSeries"]> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const targetMilestoneRef = useRef(targetMilestone);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    quotesRef,
    hasMoreDataRef,
    fetchChunk,
    prefetchOlderData,
    fetchOlderData,
    resetData,
  } = useChartData({
    chartType,
    interval,
    onDataChange: (quotes) => onPriceSnapshotChange?.(getPriceSnapshot(quotes)),
  });

  const {
    animationRef,
    animatingRef,
    milestoneIndexRef,
    applyOutlierSafeScale,
    runAnimation,
  } = useChartAnimation({
    chartRef,
    seriesRef,
    volumeSeriesRef,
    quotesRef,
    speedRef,
    hasMoreDataRef,
    onPhaseChange,
    onMilestoneChange,
    onPriceSnapshotChange,
    fetchOlderData,
    symbol,
    controlBus,
  });

  useChartInit({
    containerRef,
    chartRef,
    seriesRef,
    volumeSeriesRef,
    resizeObserverRef,
    targetMilestoneRef,
    milestoneIndexRef,
    symbol,
    chartType,
    lineColor,
    interval,
    fromDate,
    toDate,
    targetMilestone,
    autoplay,
    fetchChunk,
    prefetchOlderData,
    resetData,
    hasMoreDataRef,
    quotesRef,
    applyOutlierSafeScale,
    runAnimation,
    controlBus,
    animationRef,
    animatingRef,
    onPhaseChange,
    onPriceSnapshotChange,
    setLoading,
    setError,
  });

  const prevChartTypeRef = useRef(chartType);
  useEffect(() => {
    if (chartType === prevChartTypeRef.current) return;
    prevChartTypeRef.current = chartType;

    const chart = chartRef.current;
    const quotes = quotesRef.current;
    if (!chart || quotes.length === 0) return;

    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    const priceFormat = getPriceFormat(quotes);
    const series = addPriceSeries(chart, chartType, quotes, priceFormat, lineColor);
    seriesRef.current = series;

    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(toVolumeData(quotes));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- quotesRef is stable
  }, [chartType, lineColor]);

  useChartTheme(chartRef);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  useEffect(() => {
    if (chartType !== "line" || !seriesRef.current) return;
    seriesRef.current.applyOptions({
      color: lineColor,
      priceLineColor: lineColor,
      crosshairMarkerBackgroundColor: lineColor,
    });
  }, [chartType, lineColor]);

  return (
    <div
      className="relative flex-1 min-h-0 h-full w-full transition-opacity duration-300"
      data-phase={phase}
    >
      <div ref={containerRef} className="absolute inset-0" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <span className="text-sm text-muted-foreground">
              Loading chart...
            </span>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}
    </div>
  );
}
