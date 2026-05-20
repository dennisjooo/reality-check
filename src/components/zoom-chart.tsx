"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  type IChartApi,
  type CandlestickData,
  type LineData,
  type HistogramData,
  type Time,
  ColorType,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
} from "lightweight-charts";
import type { ChartType, ChartInterval, AnimPhase } from "@/lib/chart-types";
import {
  MILESTONES,
  CHUNK_YEARS,
  CANDLESTICK_COLORS,
  LINE_SERIES_OPTIONS,
  VOLUME_COLORS,
} from "@/lib/chart-constants";
import { getChartTheme, getPriceFormat } from "@/lib/chart-utils";
import { useChartData } from "@/hooks/use-chart-data";
import { useChartAnimation } from "@/hooks/use-chart-animation";
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
  } = useChartData({ chartType, interval });

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
          return;
        }

        resetData(quotes);
        prefetchOlderData(symbol);

        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
          resizeObserverRef.current = null;
        }

        const container = containerRef.current!;

        const isDark = document.documentElement.classList.contains("dark");
        const theme = getChartTheme(isDark);

        const chart = createChart(container, {
          layout: {
            background: { type: ColorType.Solid, color: "transparent" },
            textColor: theme.textColor,
            fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
          },
          grid: {
            vertLines: { color: theme.gridColor },
            horzLines: { color: theme.gridColor },
          },
          crosshair: {
            mode: 0,
          },
          rightPriceScale: {
            borderColor: theme.borderColor,
          },
          timeScale: {
            borderColor: theme.borderColor,
            timeVisible: true,
            secondsVisible: false,
            minBarSpacing: 0.01,
          },
        });

        chartRef.current = chart;

        chart.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight,
        });

        const priceFormat = getPriceFormat(quotes);

        if (chartType === "candlestick") {
          const series = chart.addSeries(CandlestickSeries, {
            ...CANDLESTICK_COLORS,
            priceFormat,
          });
          const candleData: CandlestickData[] = quotes.map((q) => ({
            time: q.time as Time,
            open: q.open,
            high: q.high,
            low: q.low,
            close: q.close,
          }));
          series.setData(candleData);
          seriesRef.current = series;
        } else {
          const series = chart.addSeries(LineSeries, {
            color: lineColor,
            priceLineColor: lineColor,
            crosshairMarkerBackgroundColor: lineColor,
            ...LINE_SERIES_OPTIONS,
            priceFormat,
          });
          const lineData: LineData[] = quotes.map((q) => ({
            time: q.time as Time,
            value: q.close,
          }));
          series.setData(lineData);
          seriesRef.current = series;
        }

        const volumeSeries = chart.addSeries(HistogramSeries, {
          ...VOLUME_COLORS,
          priceFormat: { type: "volume" as const },
          priceScaleId: "volume",
        });
        chart.priceScale("volume").applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });
        const volumeData: HistogramData[] = quotes.map((q) => ({
          time: q.time as Time,
          value: q.volume,
          color: q.close >= q.open ? VOLUME_COLORS.upColor : VOLUME_COLORS.downColor,
        }));
        volumeSeries.setData(volumeData);
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
  }, [symbol, interval, fetchChunk, prefetchOlderData, targetMilestone, fromDate, toDate]);

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

    if (chartType === "candlestick") {
      const series = chart.addSeries(CandlestickSeries, {
        ...CANDLESTICK_COLORS,
        priceFormat,
      });
      series.setData(
        quotes.map((q) => ({
          time: q.time as Time,
          open: q.open,
          high: q.high,
          low: q.low,
          close: q.close,
        }))
      );
      seriesRef.current = series;
    } else {
      const series = chart.addSeries(LineSeries, {
        color: lineColor,
        priceLineColor: lineColor,
        crosshairMarkerBackgroundColor: lineColor,
        ...LINE_SERIES_OPTIONS,
        priceFormat,
      });
      series.setData(
        quotes.map((q) => ({
          time: q.time as Time,
          value: q.close,
        }))
      );
      seriesRef.current = series;
    }

    if (volumeSeriesRef.current) {
      const volumeData: HistogramData[] = quotes.map((q) => ({
        time: q.time as Time,
        value: q.volume,
        color: q.close >= q.open ? VOLUME_COLORS.upColor : VOLUME_COLORS.downColor,
      }));
      volumeSeriesRef.current.setData(volumeData);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- quotesRef is stable
  }, [chartType, lineColor]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const chart = chartRef.current;
      if (!chart) return;

      const isDark = document.documentElement.classList.contains("dark");
      const theme = getChartTheme(isDark);

      chart.applyOptions({
        layout: {
          textColor: theme.textColor,
        },
        grid: {
          vertLines: { color: theme.gridColor },
          horzLines: { color: theme.gridColor },
        },
        rightPriceScale: {
          borderColor: theme.borderColor,
        },
        timeScale: {
          borderColor: theme.borderColor,
        },
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (chartType !== "line" || !seriesRef.current) return;
    seriesRef.current.applyOptions({
      color: lineColor,
      priceLineColor: lineColor,
      crosshairMarkerBackgroundColor: lineColor,
    });
  }, [chartType, lineColor]);

  return (
    <div className="relative flex-1 min-h-0 h-full w-full">
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
