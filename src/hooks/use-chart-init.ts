"use client";

import { useEffect } from "react";
import type { IChartApi } from "lightweight-charts";
import type { ChartData, ChartType, AnimPhase, PriceSnapshot } from "@/lib/chart-types";
import { CHUNK_YEARS, MILESTONES } from "@/lib/chart-constants";
import { createChartInstance } from "@/lib/chart-factory";
import type { ControlBus } from "@/lib/control-bus";

interface UseChartInitOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  chartRef: React.MutableRefObject<IChartApi | null>;
  seriesRef: React.MutableRefObject<ReturnType<IChartApi["addSeries"]> | null>;
  volumeSeriesRef: React.MutableRefObject<ReturnType<IChartApi["addSeries"]> | null>;
  resizeObserverRef: React.MutableRefObject<ResizeObserver | null>;
  targetMilestoneRef: React.MutableRefObject<number | undefined>;
  milestoneIndexRef: React.MutableRefObject<number>;
  symbol: string;
  chartType: ChartType;
  lineColor: string;
  interval: string;
  fromDate?: string;
  toDate?: string;
  targetMilestone?: number;
  autoplay: boolean;
  fetchChunk: (symbol: string, period1: Date, period2: Date) => Promise<ChartData[]>;
  prefetchOlderData: (symbol: string) => void;
  resetData: (quotes: ChartData[]) => void;
  hasMoreDataRef: React.MutableRefObject<boolean>;
  quotesRef: React.MutableRefObject<ChartData[]>;
  applyOutlierSafeScale: (chart: IChartApi, quotes: ChartData[], fromBarIdx: number, toBarIdx: number) => void;
  runAnimation: (chart: IChartApi, quotes: ChartData[], milestoneIdx: number, toBars: number, lastBarIndex: number, fromBarsOverride?: number) => void;
  controlBus: ControlBus;
  animationRef: React.MutableRefObject<number | null>;
  animatingRef: React.MutableRefObject<boolean>;
  onPhaseChange: (phase: AnimPhase) => void;
  onPriceSnapshotChange?: (snapshot: PriceSnapshot | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export function useChartInit(options: UseChartInitOptions) {
  const {
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
  } = options;

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
}
