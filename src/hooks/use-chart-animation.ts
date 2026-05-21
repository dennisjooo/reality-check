"use client";

import { useCallback, useRef, useEffect } from "react";
import type { IChartApi } from "lightweight-charts";
import type { ChartData, AnimPhase, PriceSnapshot } from "@/lib/chart-types";
import { MILESTONES } from "@/lib/chart-constants";
import { computeSafeRange } from "@/lib/chart-utils";
import { computeNextVisibleBars, getMilestoneIndex, buildRollingSnapshot } from "@/lib/animation-math";
import { ControlBus } from "@/lib/control-bus";
import { useControlBusSubscription } from "@/hooks/use-control-bus-subscription";

interface UseChartAnimationOptions {
  chartRef: React.MutableRefObject<IChartApi | null>;
  seriesRef: React.MutableRefObject<ReturnType<IChartApi["addSeries"]> | null>;
  volumeSeriesRef: React.MutableRefObject<ReturnType<IChartApi["addSeries"]> | null>;
  quotesRef: React.MutableRefObject<ChartData[]>;
  speedRef: React.MutableRefObject<number>;
  hasMoreDataRef: React.MutableRefObject<boolean>;
  onPhaseChange: (phase: AnimPhase) => void;
  onMilestoneChange?: (milestoneIndex: number) => void;
  onPriceSnapshotChange?: (snapshot: PriceSnapshot) => void;
  fetchOlderData: (
    sym: string,
    seriesRef: React.MutableRefObject<ReturnType<IChartApi["addSeries"]> | null>,
    chartRef: React.MutableRefObject<IChartApi | null>,
    volumeSeriesRef?: React.MutableRefObject<ReturnType<IChartApi["addSeries"]> | null>
  ) => Promise<boolean>;
  symbol: string;
  controlBus: ControlBus;
}

export function useChartAnimation({
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
}: UseChartAnimationOptions) {
  const animationRef = useRef<number | null>(null);
  const milestoneIndexRef = useRef(0);
  const animatingRef = useRef(false);
  const currentVisibleBarsRef = useRef(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  const lastScaleUpdateRef = useRef(0);
  const lastSnapshotUpdateRef = useRef(0);
  const isFetchingOlderRef = useRef(false);
  const manualTargetBarsRef = useRef<number | null>(null);
  const stepAnimationRef = useRef<(now: number) => void>(() => {});

  const applyOutlierSafeScale = useCallback(
    (chart: IChartApi, quotes: ChartData[], fromBarIdx: number, toBarIdx: number) => {
      const range = computeSafeRange(
        quotes,
        Math.max(0, fromBarIdx),
        Math.min(quotes.length - 1, toBarIdx)
      );
      if (range && seriesRef.current) {
        seriesRef.current.applyOptions({
          autoscaleInfoProvider: () => ({
            priceRange: {
              minValue: range.min,
              maxValue: range.max,
            },
          }),
        });
      }
    },
    [seriesRef]
  );

  const cancelCurrentAnimationFrame = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const updateMilestoneProgress = useCallback(
    (visibleBars: number) => {
      const index = getMilestoneIndex(visibleBars, MILESTONES);
      if (index !== milestoneIndexRef.current) {
        milestoneIndexRef.current = index;
        onMilestoneChange?.(index);
      }
    },
    [onMilestoneChange]
  );

  const finishAnimation = useCallback(
    (chart: IChartApi) => {
      animatingRef.current = false;
      manualTargetBarsRef.current = null;
      cancelCurrentAnimationFrame();

      // Install a dynamic provider BEFORE fitContent so the chart always
      // computes an outlier-safe Y range for whatever bars are visible —
      // both for the initial full-view render and for later user zoom/scroll.
      const quotes = quotesRef.current;
      if (seriesRef.current && quotes.length > 0) {
        seriesRef.current.applyOptions({
          autoscaleInfoProvider: () => {
            const vr = chart.timeScale().getVisibleLogicalRange();
            if (!vr) return null;
            const from = Math.max(0, Math.floor(vr.from));
            const to = Math.min(quotes.length - 1, Math.ceil(vr.to));
            const range = computeSafeRange(quotes, from, to);
            if (!range) return null;
            return { priceRange: { minValue: range.min, maxValue: range.max } };
          },
        });
      }

      chart.timeScale().fitContent();
      chart.applyOptions({ handleScroll: true, handleScale: true });

      milestoneIndexRef.current = MILESTONES.length;
      onMilestoneChange?.(MILESTONES.length);

      if (onPriceSnapshotChange && quotes.length > 0) {
        const snapshot = buildRollingSnapshot(quotes, 0, quotes.length - 1, quotes.length);
        if (snapshot) {
          snapshot.lastLogicalIndex = quotes.length - 1;
          if (seriesRef.current) {
            snapshot.getCoordinate = (barTime: number, p: number) => {
              if (!chartRef.current || !seriesRef.current) return null;
              const ts = chartRef.current.timeScale();
              const cx = ts.timeToCoordinate(barTime as any);
              const cy = seriesRef.current.priceToCoordinate(p);
              if (cx !== null && cy !== null) return { x: cx, y: cy };
              return null;
            };
          }
          onPriceSnapshotChange(snapshot);
        }
      }

      onPhaseChange("complete");
    },
    [cancelCurrentAnimationFrame, chartRef, onMilestoneChange, onPhaseChange, onPriceSnapshotChange, quotesRef, seriesRef]
  );

  const stepAnimation = useCallback(
    (now: number) => {
      const chart = chartRef.current;
      const quotes = quotesRef.current;

      if (!animatingRef.current || !chart || quotes.length < 2) {
        return;
      }

      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = now;
      }

      const deltaSec = Math.max(0.001, (now - lastFrameTimeRef.current) / 1000);
      lastFrameTimeRef.current = now;

      if (currentVisibleBarsRef.current <= 1) {
        const visibleRange = chart.timeScale().getVisibleLogicalRange();
        currentVisibleBarsRef.current = visibleRange
          ? Math.max(2, visibleRange.to - visibleRange.from + 1)
          : Math.min(5, quotes.length);
      }

      const totalBars = quotes.length;

      currentVisibleBarsRef.current = computeNextVisibleBars(
        currentVisibleBarsRef.current,
        deltaSec,
        speedRef.current,
        totalBars,
      );

      const lastBarIndex = totalBars - 1;
      const fromFloat = Math.max(
        0,
        lastBarIndex - currentVisibleBarsRef.current + 1
      );

      // Fractional range for sub-bar smooth scrolling
      chart.timeScale().setVisibleLogicalRange({
        from: fromFloat,
        to: lastBarIndex,
      });

      // Integer indices for the outlier-safe Y-axis scaling
      if (now - lastScaleUpdateRef.current >= 120) {
        applyOutlierSafeScale(chart, quotes, Math.floor(fromFloat), lastBarIndex);
        lastScaleUpdateRef.current = now;
      }

      updateMilestoneProgress(currentVisibleBarsRef.current);

      // Rolling price snapshot from visible range, throttled to ~80ms
      if (onPriceSnapshotChange && now - lastSnapshotUpdateRef.current >= 80) {
        lastSnapshotUpdateRef.current = now;
        const fromIdx = Math.max(0, Math.floor(fromFloat));
        const snapshot = buildRollingSnapshot(quotes, fromIdx, lastBarIndex, currentVisibleBarsRef.current);
        if (snapshot) {
          if (seriesRef.current) {
            const timeScale = chart.timeScale();
            // Lightweight charts types sometimes need 'any' for time casting
            const time = quotes[lastBarIndex].time as any;
            const x = timeScale.timeToCoordinate(time);
            const y = seriesRef.current.priceToCoordinate(quotes[lastBarIndex].close);
            if (x !== null && y !== null) {
              snapshot.x = x;
              snapshot.y = y;
            }
            snapshot.lastLogicalIndex = lastBarIndex;
            snapshot.getCoordinate = (barTime: number, p: number) => {
              if (!chartRef.current || !seriesRef.current) return null;
              const ts = chartRef.current.timeScale();
              const cx = ts.timeToCoordinate(barTime as any);
              const cy = seriesRef.current.priceToCoordinate(p);
              if (cx !== null && cy !== null) return { x: cx, y: cy };
              return null;
            };
          }
          onPriceSnapshotChange(snapshot);
        }
      }

      if (
        hasMoreDataRef.current &&
        !isFetchingOlderRef.current &&
        currentVisibleBarsRef.current >= totalBars * 0.9
      ) {
        isFetchingOlderRef.current = true;
        fetchOlderData(symbol, seriesRef, chartRef, volumeSeriesRef).finally(() => {
          isFetchingOlderRef.current = false;
        });
      }

      if (
        manualTargetBarsRef.current !== null &&
        currentVisibleBarsRef.current >= manualTargetBarsRef.current
      ) {
        animatingRef.current = false;
        manualTargetBarsRef.current = null;
        cancelCurrentAnimationFrame();
        chart.applyOptions({ handleScroll: true, handleScale: true });
        onPhaseChange("paused");
        return;
      }

      if (!hasMoreDataRef.current && currentVisibleBarsRef.current >= totalBars - 0.5) {
        finishAnimation(chart);
        return;
      }

      animationRef.current = requestAnimationFrame((nextNow) => {
        stepAnimationRef.current(nextNow);
      });
    },
    [
      applyOutlierSafeScale,
      cancelCurrentAnimationFrame,
      chartRef,
      fetchOlderData,
      finishAnimation,
      hasMoreDataRef,
      onPhaseChange,
      onPriceSnapshotChange,
      quotesRef,
      seriesRef,
      speedRef,
      symbol,
      updateMilestoneProgress,
      volumeSeriesRef,
    ]
  );

  const startContinuousAnimation = useCallback(
    (
      chart: IChartApi,
      quotes: ChartData[],
      options?: { fromBars?: number; targetBars?: number }
    ) => {
      if (quotes.length < 2) return;

      cancelCurrentAnimationFrame();
      animatingRef.current = true;
      onPhaseChange("animating");
      chart.applyOptions({ handleScroll: false, handleScale: false });

      if (options?.fromBars) {
        const fromBars = Math.max(2, Math.min(options.fromBars, quotes.length));
        currentVisibleBarsRef.current = fromBars;

        const lastBarIndex = quotes.length - 1;
        const fromIndex = Math.max(0, lastBarIndex - fromBars + 1);
        chart.timeScale().setVisibleLogicalRange({ from: fromIndex, to: lastBarIndex });
        applyOutlierSafeScale(chart, quotes, fromIndex, lastBarIndex);
      }

      manualTargetBarsRef.current =
        options?.targetBars !== undefined
          ? Math.max(2, Math.min(options.targetBars, quotes.length))
          : null;

      lastFrameTimeRef.current = null;
      lastScaleUpdateRef.current = 0;
      animationRef.current = requestAnimationFrame((nextNow) => {
        stepAnimationRef.current(nextNow);
      });
    },
    [applyOutlierSafeScale, cancelCurrentAnimationFrame, onPhaseChange]
  );

  useEffect(() => {
    stepAnimationRef.current = stepAnimation;
  }, [stepAnimation]);

  const pauseAnimation = useCallback(() => {
    if (!animatingRef.current) return;

    animatingRef.current = false;
    cancelCurrentAnimationFrame();

    if (chartRef.current) {
      chartRef.current.applyOptions({ handleScroll: true, handleScale: true });
    }

    onPhaseChange("paused");
  }, [cancelCurrentAnimationFrame, chartRef, onPhaseChange]);

  const runAnimation = useCallback(
    (
      chart: IChartApi,
      quotes: ChartData[],
      milestoneIdx: number,
      toBars: number,
      _lastBarIndex: number,
      fromBarsOverride?: number
    ) => {
      milestoneIndexRef.current = milestoneIdx;
      onMilestoneChange?.(milestoneIdx);
      startContinuousAnimation(chart, quotes, {
        fromBars: fromBarsOverride ?? Math.min(5, quotes.length),
        targetBars: toBars,
      });
    },
    [onMilestoneChange, startContinuousAnimation]
  );

  const resumeAnimation = useCallback(
    (chart: IChartApi, quotes: ChartData[]) => {
      startContinuousAnimation(chart, quotes);
    },
    [startContinuousAnimation]
  );

  const animateToNextMilestone = useCallback(
    (chart: IChartApi, quotes: ChartData[]) => {
      startContinuousAnimation(chart, quotes);
    },
    [startContinuousAnimation]
  );

  const resetPlay = useCallback(
    (chart: IChartApi, quotes: ChartData[]) => {
      if (quotes.length < 2) return;

      animatingRef.current = false;
      manualTargetBarsRef.current = null;
      cancelCurrentAnimationFrame();

      milestoneIndexRef.current = 0;
      onMilestoneChange?.(0);
      currentVisibleBarsRef.current = Math.min(5, quotes.length);

      const lastBarIndex = quotes.length - 1;
      const fromIndex = Math.max(0, lastBarIndex - currentVisibleBarsRef.current + 1);
      chart.timeScale().setVisibleLogicalRange({ from: fromIndex, to: lastBarIndex });
      applyOutlierSafeScale(chart, quotes, fromIndex, lastBarIndex);

      lastSnapshotUpdateRef.current = 0;
      if (onPriceSnapshotChange && quotes.length > 0) {
        const snapshot = buildRollingSnapshot(quotes, fromIndex, lastBarIndex, currentVisibleBarsRef.current);
        if (snapshot) {
          onPriceSnapshotChange(snapshot);
        }
      }

      startContinuousAnimation(chart, quotes);
    },
    [
      applyOutlierSafeScale,
      cancelCurrentAnimationFrame,
      onMilestoneChange,
      onPriceSnapshotChange,
      startContinuousAnimation,
    ]
  );

  useControlBusSubscription({
    controlBus,
    chartRef,
    quotesRef,
    resumeAnimation,
    pauseAnimation,
    resetPlay,
    animatingRef,
  });

  useEffect(() => {
    return () => {
      cancelCurrentAnimationFrame();
    };
  }, [cancelCurrentAnimationFrame]);

  return {
    animationRef,
    animatingRef,
    milestoneIndexRef,
    applyOutlierSafeScale,
    pauseAnimation,
    resumeAnimation,
    resetPlay,
    animateToNextMilestone,
    runAnimation,
  };
}
