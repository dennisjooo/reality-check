"use client";

import { useEffect, useRef, useState } from "react";
import type { IChartApi } from "lightweight-charts";
import type {
  ChartType,
  ChartInterval,
  AnimPhase,
  PriceSnapshot,
} from "@/lib/chart-types";
import {
  MILESTONES,
  CHUNK_YEARS,
} from "@/lib/chart-constants";
import { getPriceFormat, getPriceSnapshot } from "@/lib/chart-utils";
import { addPriceSeries, toVolumeData } from "@/lib/chart-series";
import { createChartInstance } from "@/lib/chart-factory";
import { useChartData } from "@/hooks/use-chart-data";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import { useChartTheme } from "@/hooks/use-chart-theme";
import { StartOverlay } from "@/components/start-overlay";
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

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    async function initChart() {
      try {
        setLoading(true);
        setError(null);

        const now = new Date();
        const period2 = toDate ? new Date(toDate + "T00:00:00Z") : now;
        const period1 = fromDate
          ? new Date(fromDate + "T00:00:00Z")
          : new Date(period2.getTime() - CHUNK_YEARS * 365 * 24 * 60 * 60 * 1000);
        const quotes = await fetchChunk(symbol, period1, period2);
        if (cancelled) return;

        if (quotes.length === 0) {
          setError("No data available for this symbol");
          setLoading(false);
          onPriceSnapshotChange?.(null);
          return;
        }

        resetData(quotes);

        if (fromDate) {
          hasMoreDataRef.current = false;
        } else {
          prefetchOlderData(symbol);
        }

        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
          resizeObserverRef.current = null;
        }

        const container = containerRef.current!;

        const { chart, series, volumeSeries } = createChartInstance(container, quotes, {
          chartType,
          lineColor,
        });
        chartRef.current = chart;
        seriesRef.current = series;
        volumeSeriesRef.current = volumeSeries;

        const observer = new ResizeObserver(() => {
          if (chartRef.current && containerRef.current) {
            chartRef.current.applyOptions({
              width: containerRef.current.clientWidth,
              height: containerRef.current.clientHeight,
            });
          }
        });
        observer.observe(container);
        resizeObserverRef.current = observer;

        milestoneIndexRef.current = 0;
        targetMilestoneRef.current = targetMilestone;

        const initialFromBars = Math.min(5, quotes.length);

        const startIdx = quotes.length - 1 - initialFromBars + 1;
        const endIdx = quotes.length - 1;

        chart.timeScale().setVisibleLogicalRange({
          from: startIdx,
          to: endIdx,
        });

        applyOutlierSafeScale(chart, quotes, startIdx, endIdx);

        if (targetMilestone !== undefined && targetMilestone > 0) {
          onPhaseChange("animating");
          const replayTargetBars = Math.min(
            MILESTONES[Math.min(targetMilestone - 1, MILESTONES.length - 1)],
            quotes.length
          );
          setTimeout(() => {
            if (chartRef.current) {
              const finalMilestoneIdx = Math.min(
                targetMilestone - 1,
                MILESTONES.length - 1
              );
              runAnimation(
                chartRef.current,
                quotesRef.current,
                finalMilestoneIdx,
                replayTargetBars,
                quotesRef.current.length - 1,
                initialFromBars
              );
            }
          }, 50);
        } else if (autoplay) {
          onPhaseChange("animating");
          controlBus.continue();
        } else {
          onPhaseChange("idle");
        }

        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load chart");
          setLoading(false);
          onPriceSnapshotChange?.(null);
        }
      }
    }

    initChart();

    return () => {
      cancelled = true;
      animatingRef.current = false;
      // eslint-disable-next-line react-hooks/exhaustive-deps -- capturing current animation frame ID at cleanup time
      const animId = animationRef.current;
      if (animId) {
        cancelAnimationFrame(animId);
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ref values are stable; re-init only on symbol/interval/date changes
  }, [
    symbol,
    interval,
    fetchChunk,
    prefetchOlderData,
    targetMilestone,
    fromDate,
    toDate,
    onPriceSnapshotChange,
  ]);

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
      {phase === "idle" && !loading && !error && (
        <StartOverlay
          onStart={() => {
            controlBus.continue();
            onPhaseChange("animating");
          }}
        />
      )}
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}
