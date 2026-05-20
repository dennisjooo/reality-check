"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  type IChartApi,
  type CandlestickData,
  type LineData,
  type Time,
  ColorType,
  CandlestickSeries,
  LineSeries,
} from "lightweight-charts";
import type { ChartData, ChartType, AnimPhase } from "@/lib/chart-types";
import {
  MILESTONES,
  CHUNK_YEARS,
  CANDLESTICK_COLORS,
  LINE_SERIES_OPTIONS,
} from "@/lib/chart-constants";
import { getChartTheme } from "@/lib/chart-utils";
import { useChartData } from "@/hooks/use-chart-data";
import { useChartAnimation } from "@/hooks/use-chart-animation";
import { StartOverlay } from "@/components/start-overlay";

interface ZoomChartProps {
  symbol: string;
  chartType?: ChartType;
  lineColor?: string;
  speedRef: React.MutableRefObject<number>;
  continueCounterRef: React.MutableRefObject<number>;
  pauseCounterRef: React.MutableRefObject<number>;
  resetCounterRef: React.MutableRefObject<number>;
  onPhaseChange: (phase: AnimPhase) => void;
  phase: AnimPhase;
  /** When set, auto-play from milestone 0 up to this milestone index without pausing */
  targetMilestone?: number;
  /** Callback to report the current milestone index so parent can track it */
  onMilestoneChange?: (milestoneIndex: number) => void;
}

export function ZoomChart({
  symbol,
  chartType = "candlestick",
  lineColor = "#3b82f6",
  speedRef,
  continueCounterRef,
  pauseCounterRef,
  resetCounterRef,
  onPhaseChange,
  phase,
  targetMilestone,
  onMilestoneChange,
}: ZoomChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ReturnType<IChartApi["addSeries"]> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const targetMilestoneRef = useRef(targetMilestone);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    quotesRef,
    hasMoreDataRef,
    oldestTimestampRef,
    fetchChunk,
    fetchOlderData,
    resetData,
  } = useChartData({ chartType });

  const {
    animationRef,
    animatingRef,
    milestoneIndexRef,
    savedProgressRef,
    lastContinueCountRef,
    applyOutlierSafeScale,
    resumeAnimation,
    resetPlay,
    animateToNextMilestone,
    runAnimation,
    pollButtonPresses,
  } = useChartAnimation({
    chartRef,
    seriesRef,
    quotesRef,
    speedRef,
    continueCounterRef,
    pauseCounterRef,
    resetCounterRef,
    hasMoreDataRef,
    onPhaseChange,
    onMilestoneChange,
    fetchOlderData,
    symbol,
  });

  // Watch for play/pause/reset button presses
  useEffect(() => {
    return pollButtonPresses();
  }, [pollButtonPresses]);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    async function initChart() {
      try {
        setLoading(true);
        setError(null);

        // Fetch initial chunk: last CHUNK_YEARS years
        const now = new Date();
        const period1 = new Date(
          now.getTime() - CHUNK_YEARS * 365 * 24 * 60 * 60 * 1000
        );
        const quotes = await fetchChunk(symbol, period1, now);
        if (cancelled) return;

        if (quotes.length === 0) {
          setError("No data available for this symbol");
          setLoading(false);
          return;
        }

        resetData(quotes);

        // Clean up previous chart
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

        // Set initial size from container
        chart.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight,
        });

        // Add series
        if (chartType === "candlestick") {
          const series = chart.addSeries(CandlestickSeries, {
            ...CANDLESTICK_COLORS,
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
            ...LINE_SERIES_OPTIONS,
          });
          const lineData: LineData[] = quotes.map((q) => ({
            time: q.time as Time,
            value: q.close,
          }));
          series.setData(lineData);
          seriesRef.current = series;
        }

        // Resize observer
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

        // Initialize milestone and continue counts
        milestoneIndexRef.current = 0;
        targetMilestoneRef.current = targetMilestone;
        lastContinueCountRef.current = continueCounterRef.current;

        // Set initial view state — always start zoomed in at 5 bars
        const initialFromBars = Math.min(5, quotes.length);

        const startIdx = quotes.length - 1 - initialFromBars + 1;
        const endIdx = quotes.length - 1;

        chart.timeScale().setVisibleLogicalRange({
          from: startIdx,
          to: endIdx,
        });

        applyOutlierSafeScale(chart, quotes, startIdx, endIdx);

        // If targetMilestone is set, auto-start a single smooth animation
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
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
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
  }, [symbol, fetchChunk, targetMilestone]);

  // Handle chart type changes in-place (swap series without re-fetching data)
  const prevChartTypeRef = useRef(chartType);
  useEffect(() => {
    if (chartType === prevChartTypeRef.current) return;
    prevChartTypeRef.current = chartType;

    const chart = chartRef.current;
    const quotes = quotesRef.current;
    if (!chart || quotes.length === 0) return;

    // Remove old series
    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    // Add new series with existing data
    if (chartType === "candlestick") {
      const series = chart.addSeries(CandlestickSeries, {
        ...CANDLESTICK_COLORS,
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
        ...LINE_SERIES_OPTIONS,
      });
      series.setData(
        quotes.map((q) => ({
          time: q.time as Time,
          value: q.close,
        }))
      );
      seriesRef.current = series;
    }
  }, [chartType, lineColor]);

  // Observe theme changes and update chart colors accordingly
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

  // Update line color when it changes (without swapping series)
  useEffect(() => {
    if (chartType !== "line" || !seriesRef.current) return;
    seriesRef.current.applyOptions({
      color: lineColor,
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
            continueCounterRef.current += 1;
            onPhaseChange("animating");
          }}
        />
      )}
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}
