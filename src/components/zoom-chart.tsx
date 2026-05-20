"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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

interface ChartData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type ChartType = "candlestick" | "line";
type AnimPhase = "idle" | "animating" | "paused" | "complete";

// Milestones: absolute bar counts to reveal at each pause point
const MILESTONES = [50, 200, 500, 1500, 5000];

// Size of each pagination chunk in years
const CHUNK_YEARS = 2;

/**
 * Compute outlier-safe min/max for visible data using IQR fencing.
 * Returns a range that excludes extreme wicks/spikes so the y-axis
 * stays useful for the bulk of the data.
 */
function computeSafeRange(quotes: ChartData[], startIdx: number, endIdx: number) {
  const slice = quotes.slice(startIdx, endIdx + 1);
  if (slice.length === 0) return null;

  // Collect all price extremes
  const lows = slice.map((q) => q.low).sort((a, b) => a - b);
  const highs = slice.map((q) => q.high).sort((a, b) => a - b);

  const q1 = (arr: number[]) => arr[Math.floor(arr.length * 0.25)];
  const q3 = (arr: number[]) => arr[Math.floor(arr.length * 0.75)];

  const lowQ1 = q1(lows);
  const lowQ3 = q3(lows);
  const highQ1 = q1(highs);
  const highQ3 = q3(highs);

  const lowIQR = lowQ3 - lowQ1;
  const highIQR = highQ3 - highQ1;

  // Use 2.5× IQR fence (wider than the classic 1.5× to avoid over-clipping)
  const safeLow = lowQ1 - 2.5 * lowIQR;
  const safeHigh = highQ3 + 2.5 * highIQR;

  // Actual data min/max (to never expand beyond real data)
  const dataMin = lows[0];
  const dataMax = highs[highs.length - 1];

  // Add 5% padding
  const clampedLow = Math.max(safeLow, dataMin);
  const clampedHigh = Math.min(safeHigh, dataMax);
  const padding = (clampedHigh - clampedLow) * 0.05;

  return {
    min: clampedLow - padding,
    max: clampedHigh + padding,
  };
}

interface ZoomChartProps {
  symbol: string;
  chartType?: ChartType;
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
  const animationRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const quotesRef = useRef<ChartData[]>([]);
  const seriesRef = useRef<ReturnType<IChartApi['addSeries']> | null>(null);
  const milestoneIndexRef = useRef(0);
  const lastContinueCountRef = useRef(0);
  const lastPauseCountRef = useRef(0);
  const lastResetCountRef = useRef(0);
  const animatingRef = useRef(false);
  const currentProgressRef = useRef(0);
  const savedProgressRef = useRef(0);
  const targetMilestoneRef = useRef(targetMilestone);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchingMore, setFetchingMore] = useState(false);
  const hasMoreDataRef = useRef(true);
  const oldestTimestampRef = useRef<number | null>(null);

  const fetchChunk = useCallback(async (sym: string, period1: Date, period2: Date): Promise<ChartData[]> => {
    const p1 = Math.floor(period1.getTime() / 1000);
    const p2 = Math.floor(period2.getTime() / 1000);
    const res = await fetch(`/api/chart?symbol=${encodeURIComponent(sym)}&period1=${p1}&period2=${p2}&interval=1d`);
    if (!res.ok) throw new Error("Failed to fetch chart data");
    const data = await res.json();
    return data.quotes;
  }, []);

  const fetchOlderData = useCallback(async (sym: string): Promise<boolean> => {
    if (!hasMoreDataRef.current) return false;

    const oldest = oldestTimestampRef.current;
    if (oldest === null) return false;

    setFetchingMore(true);
    try {
      // Fetch the next chunk going further back in time
      const period2 = new Date(oldest * 1000);
      const period1 = new Date(period2.getTime() - CHUNK_YEARS * 365 * 24 * 60 * 60 * 1000);
      const olderQuotes = await fetchChunk(sym, period1, period2);

      if (olderQuotes.length === 0) {
        hasMoreDataRef.current = false;
        setFetchingMore(false);
        return false;
      }

      // Merge: prepend older bars that don't already exist
      const existingTimes = new Set(quotesRef.current.map((q) => q.time));
      const newQuotes = olderQuotes.filter((q) => !existingTimes.has(q.time));

      if (newQuotes.length > 0) {
        newQuotes.sort((a, b) => a.time - b.time);
        quotesRef.current = [...newQuotes, ...quotesRef.current];
        oldestTimestampRef.current = newQuotes[0].time;

        // Update the chart series with merged data
        if (seriesRef.current && chartRef.current) {
          if (chartType === "candlestick") {
            (seriesRef.current as ReturnType<IChartApi['addSeries']>).setData(
              quotesRef.current.map((q) => ({
                time: q.time as Time,
                open: q.open,
                high: q.high,
                low: q.low,
                close: q.close,
              }))
            );
          } else {
            (seriesRef.current as ReturnType<IChartApi['addSeries']>).setData(
              quotesRef.current.map((q) => ({
                time: q.time as Time,
                value: q.close,
              }))
            );
          }
        }
      } else {
        // All quotes were duplicates — we've reached the beginning of available data
        hasMoreDataRef.current = false;
      }

      setFetchingMore(false);
      return newQuotes.length > 0;
    } catch {
      setFetchingMore(false);
      return false;
    }
  }, [fetchChunk, chartType]);

  // Watch for play/pause/reset button presses
  useEffect(() => {
    const interval = setInterval(() => {
      if (continueCounterRef.current > lastContinueCountRef.current) {
        lastContinueCountRef.current = continueCounterRef.current;
        if (quotesRef.current.length > 0 && chartRef.current) {
          if (savedProgressRef.current > 0 && savedProgressRef.current < 1) {
            resumeAnimation(chartRef.current, quotesRef.current);
          } else {
            animateToNextMilestone(chartRef.current, quotesRef.current);
          }
        }
      }
      if (pauseCounterRef.current > lastPauseCountRef.current) {
        lastPauseCountRef.current = pauseCounterRef.current;
        if (animatingRef.current) {
          pauseAnimation();
        }
      }
      if (resetCounterRef.current > lastResetCountRef.current) {
        lastResetCountRef.current = resetCounterRef.current;
        if (quotesRef.current.length > 0 && chartRef.current) {
          resetPlay(chartRef.current, quotesRef.current);
        }
      }
    }, 50);
    return () => clearInterval(interval);
  }, [continueCounterRef, pauseCounterRef, resetCounterRef]);

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
        const period1 = new Date(now.getTime() - CHUNK_YEARS * 365 * 24 * 60 * 60 * 1000);
        const quotes = await fetchChunk(symbol, period1, now);
        if (cancelled) return;

        if (quotes.length === 0) {
          setError("No data available for this symbol");
          setLoading(false);
          return;
        }

        quotesRef.current = quotes;
        hasMoreDataRef.current = true;
        oldestTimestampRef.current = quotes[0]?.time ?? null;

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

        const chart = createChart(container, {
          layout: {
            background: { type: ColorType.Solid, color: "transparent" },
            textColor: "#9ca3af",
            fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
          },
          grid: {
            vertLines: { color: "rgba(255,255,255,0.04)" },
            horzLines: { color: "rgba(255,255,255,0.04)" },
          },
          crosshair: {
            mode: 0,
          },
          rightPriceScale: {
            borderColor: "rgba(255,255,255,0.1)",
          },
          timeScale: {
            borderColor: "rgba(255,255,255,0.1)",
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
            upColor: "#22c55e",
            downColor: "#ef4444",
            borderDownColor: "#ef4444",
            borderUpColor: "#22c55e",
            wickDownColor: "#ef4444",
            wickUpColor: "#22c55e",
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
            color: "#3b82f6",
            lineWidth: 2,
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

        // If targetMilestone is set, auto-start a single smooth animation (replay/speed change)
        if (targetMilestone !== undefined && targetMilestone > 0) {
          onPhaseChange("animating");
          // Compute the final target bar count for the target milestone
          const replayTargetBars = Math.min(
            MILESTONES[Math.min(targetMilestone - 1, MILESTONES.length - 1)],
            quotes.length
          );
          // Kick off one smooth animation on next tick so chart is fully rendered
          setTimeout(() => {
            if (chartRef.current) {
              const finalMilestoneIdx = Math.min(targetMilestone - 1, MILESTONES.length - 1);
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
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderDownColor: "#ef4444",
        borderUpColor: "#22c55e",
        wickDownColor: "#ef4444",
        wickUpColor: "#22c55e",
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
        color: "#3b82f6",
        lineWidth: 2,
      });
      series.setData(
        quotes.map((q) => ({
          time: q.time as Time,
          value: q.close,
        }))
      );
      seriesRef.current = series;
    }
  }, [chartType]);

  function applyOutlierSafeScale(chart: IChartApi, quotes: ChartData[], fromBarIdx: number, toBarIdx: number) {
    const range = computeSafeRange(quotes, Math.max(0, fromBarIdx), Math.min(quotes.length - 1, toBarIdx));
    if (range && seriesRef.current) {
      (seriesRef.current as ReturnType<IChartApi['addSeries']>).applyOptions({
        autoscaleInfoProvider: () => ({
          priceRange: {
            minValue: range.min,
            maxValue: range.max,
          },
        }),
      });
    }
  }

  function pauseAnimation() {
    animatingRef.current = false;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    savedProgressRef.current = currentProgressRef.current;
    onPhaseChange("paused");
  }

  function resumeAnimation(chart: IChartApi, quotes: ChartData[]) {
    if (quotes.length < 2) return;

    const totalBars = quotes.length;
    const lastBarIndex = totalBars - 1;
    const idx = milestoneIndexRef.current;
    if (idx >= MILESTONES.length) {
      onPhaseChange("complete");
      return;
    }

    let targetBars = MILESTONES[idx];

    // If we need more bars than currently loaded, fetch older data first
    if (targetBars > totalBars && hasMoreDataRef.current) {
      onPhaseChange("paused");
      fetchOlderData(symbol).then((gotMore) => {
        if (gotMore && chartRef.current) {
          resumeAnimation(chartRef.current, quotesRef.current);
        } else if (!gotMore) {
          targetBars = totalBars;
          runAnimation(chart, quotesRef.current, idx, targetBars, lastBarIndex);
        }
      });
      return;
    }

    targetBars = Math.min(targetBars, totalBars);

    animatingRef.current = true;
    onPhaseChange("animating");

    const fromBars = idx === 0 ? Math.min(5, totalBars) : Math.min(MILESTONES[idx - 1], totalBars);
    runAnimation(chart, quotes, idx, targetBars, lastBarIndex, fromBars);
  }

  function resetPlay(chart: IChartApi, quotes: ChartData[]) {
    animatingRef.current = false;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    savedProgressRef.current = 0;
    currentProgressRef.current = 0;
    milestoneIndexRef.current = 0;
    onMilestoneChange?.(0);

    // Initial logical range reset (right-aligned, showing first milestone's fromBars which is 5)
    const fromBars = Math.min(5, quotes.length);
    chart.timeScale().setVisibleLogicalRange({
      from: quotes.length - 1 - fromBars + 1,
      to: quotes.length - 1,
    });

    animateToNextMilestone(chart, quotes);
  }

  function animateToNextMilestone(chart: IChartApi, quotes: ChartData[]) {
    if (quotes.length < 2) return;

    const totalBars = quotes.length;
    const lastBarIndex = totalBars - 1;

    // Current milestone index
    const idx = milestoneIndexRef.current;
    if (idx >= MILESTONES.length) {
      onPhaseChange("complete");
      return;
    }

    let targetBars = MILESTONES[idx];

    // If we need more bars than currently loaded, fetch older data first
    if (targetBars > totalBars && hasMoreDataRef.current) {
      // Pause animation state, fetch older data, then retry
      onPhaseChange("paused");
      fetchOlderData(symbol).then((gotMore) => {
        if (gotMore && chartRef.current) {
          // Retry with updated data
          animateToNextMilestone(chartRef.current, quotesRef.current);
        } else if (!gotMore) {
          // No more data available, cap at current total
          targetBars = totalBars;
          runAnimation(chart, quotesRef.current, idx, targetBars, lastBarIndex);
        }
      });
      return;
    }

    // Cap targetBars at actual loaded data
    targetBars = Math.min(targetBars, totalBars);

    // Calculate fromBars (where we start the zoom from)
    let fromBars: number;
    if (idx === 0) {
      fromBars = Math.min(5, totalBars);
    } else {
      fromBars = Math.min(MILESTONES[idx - 1], totalBars);
    }

    runAnimation(chart, quotes, idx, targetBars, lastBarIndex, fromBars);
  }

  function runAnimation(
    chart: IChartApi,
    quotes: ChartData[],
    milestoneIdx: number,
    toBars: number,
    lastBarIndex: number,
    fromBarsOverride?: number
  ) {
    const totalBars = quotes.length;
    const isLastMilestone = milestoneIdx >= MILESTONES.length - 1 || toBars >= totalBars;

    const fromBars = fromBarsOverride ?? (milestoneIdx === 0 ? Math.min(5, totalBars) : Math.min(MILESTONES[milestoneIdx - 1], totalBars));

    // Set initial logical range (right-aligned, showing fromBars)
    chart.timeScale().setVisibleLogicalRange({
      from: lastBarIndex - fromBars + 1,
      to: lastBarIndex,
    });

    // Apply initial y-axis scale matching the starting visible range (not the final range)
    applyOutlierSafeScale(chart, quotes, lastBarIndex - fromBars + 1, lastBarIndex);

    // Disable user interaction during animation
    chart.applyOptions({ handleScroll: false, handleScale: false });

    animatingRef.current = true;
    onPhaseChange("animating");

    savedProgressRef.current = 0;
    currentProgressRef.current = 0;

    const animStartTime = performance.now();
    const logFrom = Math.log(fromBars);
    const logTo = Math.log(toBars);
    let lastRenderedBars = -1;

    function animate(now: number) {
      if (!animatingRef.current) return;

      const elapsed = now - animStartTime;
      const durationMs = speedRef.current * 1000;
      const progress = Math.min(elapsed / durationMs, 1);
      currentProgressRef.current = progress;

      // Ease-in-out cubic
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      // Interpolate in log space for perceptually uniform zoom
      const currentBars = Math.exp(logFrom + (logTo - logFrom) * eased);

      if (Math.abs(currentBars - lastRenderedBars) > 0.01) {
        lastRenderedBars = currentBars;
        chart.timeScale().setVisibleLogicalRange({
          from: lastBarIndex - currentBars + 1,
          to: lastBarIndex,
        });

        // Progressively update y-axis to match the currently visible range
        // (throttled to every ~2% progress to avoid excessive recomputation)
        if (Math.floor(progress * 50) > Math.floor((progress - 0.02) * 50)) {
          applyOutlierSafeScale(chart, quotes, Math.max(0, Math.round(lastBarIndex - currentBars + 1)), lastBarIndex);
        }
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        if (isLastMilestone) {
          chart.timeScale().fitContent();
          if (seriesRef.current) {
            (seriesRef.current as ReturnType<IChartApi['addSeries']>).applyOptions({
              autoscaleInfoProvider: undefined,
            });
          }
        } else {
          chart.timeScale().setVisibleLogicalRange({
            from: lastBarIndex - toBars + 1,
            to: lastBarIndex,
          });
          applyOutlierSafeScale(chart, quotes, lastBarIndex - toBars + 1, lastBarIndex);
        }

        animatingRef.current = false;
        chart.applyOptions({ handleScroll: true, handleScale: true });

        milestoneIndexRef.current = milestoneIdx + 1;
        onMilestoneChange?.(milestoneIdx + 1);

        if (milestoneIdx + 1 >= MILESTONES.length || toBars >= totalBars) {
          onPhaseChange("complete");
        } else {
          onPhaseChange("paused");
        }
      }
    }

    animationRef.current = requestAnimationFrame(animate);
  }

  return (
    <div className="relative flex-1 min-h-0 h-full w-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <span className="text-sm text-muted-foreground">Loading chart...</span>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}
      {phase === "idle" && !loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/30 backdrop-blur-[2px] z-10 transition-all duration-300">
          <button
            onClick={() => {
              continueCounterRef.current += 1;
              onPhaseChange("animating");
            }}
            className="flex flex-col items-center gap-4 px-8 py-6 rounded-2xl bg-background/80 border border-white/10 backdrop-blur-md shadow-2xl hover:bg-background/90 hover:scale-105 transition-all duration-300 group"
          >
            <div className="h-16 w-16 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg group-hover:bg-primary/90 transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-8 h-8 translate-x-0.5"
              >
                <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="text-base font-semibold tracking-tight text-foreground">
                Start Reality Check
              </span>
              <span className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                Click to begin replaying historical candlestick data.
              </span>
            </div>
          </button>
        </div>
      )}
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}