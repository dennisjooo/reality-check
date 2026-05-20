"use client";

import { useCallback, useRef, useEffect } from "react";
import type { IChartApi } from "lightweight-charts";
import type { ChartData, AnimPhase } from "@/lib/chart-types";
import { MILESTONES } from "@/lib/chart-constants";
import { computeSafeRange } from "@/lib/chart-utils";
import { ControlBus } from "@/lib/control-bus";

/**
 * Build a dynamic milestone list that scales with the total bar count.
 * Uses the fixed MILESTONES as a base, then inserts intermediate steps
 * between the last fixed milestone and totalBars so the final zoom-out
 * is smooth instead of snapping.
 */
function buildMilestones(totalBars: number, hasMoreData: boolean): number[] {
  if (hasMoreData) {
    // Keep all fixed milestones so targets beyond totalBars trigger pagination
    const extended = [...MILESTONES];
    const last = MILESTONES[MILESTONES.length - 1];
    if (totalBars > last) {
      let next = last * 2;
      while (next < totalBars) {
        extended.push(next);
        next = Math.round(next * 1.8);
      }
      extended.push(next);
    }
    return extended;
  }

  const base = MILESTONES.filter((m) => m < totalBars);
  if (base.length === 0) return [totalBars];

  const last = base[base.length - 1];
  if (totalBars <= last) return base;

  const extended = [...base];
  let next = last * 2;
  while (next < totalBars) {
    extended.push(next);
    next = Math.round(next * 1.8);
  }
  extended.push(totalBars);
  return extended;
}

interface UseChartAnimationOptions {
  chartRef: React.MutableRefObject<IChartApi | null>;
  seriesRef: React.MutableRefObject<ReturnType<IChartApi["addSeries"]> | null>;
  volumeSeriesRef: React.MutableRefObject<ReturnType<IChartApi["addSeries"]> | null>;
  quotesRef: React.MutableRefObject<ChartData[]>;
  speedRef: React.MutableRefObject<number>;
  hasMoreDataRef: React.MutableRefObject<boolean>;
  onPhaseChange: (phase: AnimPhase) => void;
  onMilestoneChange?: (milestoneIndex: number) => void;
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
  fetchOlderData,
  symbol,
  controlBus,
}: UseChartAnimationOptions) {
  const animationRef = useRef<number | null>(null);
  const milestoneIndexRef = useRef(0);
  const animatingRef = useRef(false);
  const currentProgressRef = useRef(0);
  const savedProgressRef = useRef(0);
  const animateToNextMilestoneRef = useRef<(chart: IChartApi, quotes: ChartData[]) => void>(() => {});
  const resumeAnimationRef = useRef<(chart: IChartApi, quotes: ChartData[]) => void>(() => {});

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

  const pauseAnimation = useCallback(() => {
    animatingRef.current = false;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    savedProgressRef.current = currentProgressRef.current;
    onPhaseChange("paused");
  }, [onPhaseChange]);

  const runAnimation = useCallback(
    (
      chart: IChartApi,
      quotes: ChartData[],
      milestoneIdx: number,
      toBars: number,
      lastBarIndex: number,
      fromBarsOverride?: number,
      resumeProgress: number = 0
    ) => {
      const totalBars = quotes.length;

      const fromBars =
        fromBarsOverride ??
        (milestoneIdx === 0
          ? Math.min(5, totalBars)
          : Math.max(1, Math.min(totalBars - 1, Math.round(toBars * 0.6))));
      const fromIndex = Math.max(0, lastBarIndex - fromBars + 1);
      const targetFromIndex = Math.max(0, lastBarIndex - toBars + 1);

      if (resumeProgress === 0) {
        chart.timeScale().setVisibleLogicalRange({
          from: fromIndex,
          to: lastBarIndex,
        });

        applyOutlierSafeScale(chart, quotes, fromIndex, lastBarIndex);
      }

      chart.applyOptions({ handleScroll: false, handleScale: false });

      animatingRef.current = true;
      onPhaseChange("animating");

      savedProgressRef.current = 0;
      if (resumeProgress === 0) {
        currentProgressRef.current = 0;
      }

      let animStartTime: number | null = null;
      const logFrom = Math.log(fromBars);
      const logTo = Math.log(toBars);
      let lastRenderedBars = -1;

      function animate(now: number) {
        if (!animatingRef.current) return;

        const durationMs = (11 - speedRef.current) * 1000;
        if (animStartTime === null) {
          animStartTime = now - resumeProgress * durationMs;
        }

        const elapsed = now - animStartTime;
        const progress = Math.min(elapsed / durationMs, 1);
        currentProgressRef.current = progress;

        const eased =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        const currentBars = Math.exp(logFrom + (logTo - logFrom) * eased);

        if (Math.abs(currentBars - lastRenderedBars) > 0.01) {
          lastRenderedBars = currentBars;
          chart.timeScale().setVisibleLogicalRange({
            from: lastBarIndex - currentBars + 1,
            to: lastBarIndex,
          });

          if (Math.floor(progress * 50) > Math.floor((progress - 0.02) * 50)) {
            applyOutlierSafeScale(
              chart,
              quotes,
              Math.max(0, Math.round(lastBarIndex - currentBars + 1)),
              lastBarIndex
            );
          }
        }

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          if (toBars >= totalBars) {
            chart.timeScale().fitContent();
            if (seriesRef.current) {
              seriesRef.current.applyOptions({
                autoscaleInfoProvider: undefined,
              });
            }
          } else {
            chart.timeScale().setVisibleLogicalRange({
              from: lastBarIndex - toBars + 1,
              to: lastBarIndex,
            });
            applyOutlierSafeScale(
              chart,
              quotes,
              lastBarIndex - toBars + 1,
              lastBarIndex
            );
          }

          animatingRef.current = false;
          chart.applyOptions({ handleScroll: true, handleScale: true });

          milestoneIndexRef.current = milestoneIdx + 1;
          onMilestoneChange?.(milestoneIdx + 1);

          animateToNextMilestoneRef.current(chart, quotes);
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    },
    [applyOutlierSafeScale, onPhaseChange, onMilestoneChange, seriesRef, speedRef]
  );

  const resumeAnimation = useCallback(
    (chart: IChartApi, quotes: ChartData[]) => {
      if (quotes.length < 2) return;

      const totalBars = quotes.length;
      const lastBarIndex = totalBars - 1;
      const effectiveMilestones = buildMilestones(totalBars, hasMoreDataRef.current);
      const idx = milestoneIndexRef.current;
      if (idx >= effectiveMilestones.length) {
        onPhaseChange("complete");
        return;
      }

      let targetBars = effectiveMilestones[idx];
      const fromBars =
        idx === 0
          ? Math.min(5, totalBars)
          : Math.min(effectiveMilestones[idx - 1], totalBars);

      if (targetBars > totalBars && hasMoreDataRef.current) {
        // Keep UI in animating state while fetching additional history,
        // otherwise controls briefly flip to "Continue" mid-run.
        fetchOlderData(symbol, seriesRef, chartRef, volumeSeriesRef).then((gotMore) => {
          if (gotMore && chartRef.current) {
            resumeAnimationRef.current(chartRef.current, quotesRef.current);
          } else if (!gotMore) {
            targetBars = totalBars;
            runAnimation(chart, quotesRef.current, idx, targetBars, lastBarIndex, fromBars, savedProgressRef.current);
          }
        });
        return;
      }

      targetBars = Math.min(targetBars, totalBars);

      animatingRef.current = true;
      onPhaseChange("animating");

      runAnimation(chart, quotes, idx, targetBars, lastBarIndex, fromBars, savedProgressRef.current);
    },
    [
      chartRef,
      fetchOlderData,
      hasMoreDataRef,
      onPhaseChange,
      quotesRef,
      runAnimation,
      seriesRef,
      symbol,
      volumeSeriesRef,
    ]
  );

  const animateToNextMilestone = useCallback(
    (chart: IChartApi, quotes: ChartData[]) => {
      if (quotes.length < 2) return;

      const totalBars = quotes.length;
      const lastBarIndex = totalBars - 1;
      const effectiveMilestones = buildMilestones(totalBars, hasMoreDataRef.current);
      const idx = milestoneIndexRef.current;
      if (idx >= effectiveMilestones.length) {
        onPhaseChange("complete");
        return;
      }

      let targetBars = effectiveMilestones[idx];
      const fromBars =
        idx === 0
          ? Math.min(5, totalBars)
          : Math.min(effectiveMilestones[idx - 1], totalBars);

      if (targetBars > totalBars && hasMoreDataRef.current) {
        // Keep UI in animating state while fetching additional history,
        // otherwise controls briefly flip to "Continue" mid-run.
        fetchOlderData(symbol, seriesRef, chartRef, volumeSeriesRef).then((gotMore) => {
          if (gotMore && chartRef.current) {
            animateToNextMilestoneRef.current(chartRef.current, quotesRef.current);
          } else if (!gotMore) {
            targetBars = totalBars;
            runAnimation(chart, quotesRef.current, idx, targetBars, lastBarIndex, fromBars);
          }
        });
        return;
      }

      targetBars = Math.min(targetBars, totalBars);

      runAnimation(chart, quotes, idx, targetBars, lastBarIndex, fromBars);
    },
    [
      chartRef,
      fetchOlderData,
      hasMoreDataRef,
      onPhaseChange,
      quotesRef,
      runAnimation,
      seriesRef,
      symbol,
      volumeSeriesRef,
    ]
  );

  useEffect(() => {
    animateToNextMilestoneRef.current = animateToNextMilestone;
    resumeAnimationRef.current = resumeAnimation;
  }, [animateToNextMilestone, resumeAnimation]);

  const resetPlay = useCallback(
    (chart: IChartApi, quotes: ChartData[]) => {
      animatingRef.current = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      savedProgressRef.current = 0;
      currentProgressRef.current = 0;
      milestoneIndexRef.current = 0;
      onMilestoneChange?.(0);

      const fromBars = Math.min(5, quotes.length);
      chart.timeScale().setVisibleLogicalRange({
        from: quotes.length - 1 - fromBars + 1,
        to: quotes.length - 1,
      });

      animateToNextMilestone(chart, quotes);
    },
    [animateToNextMilestone, onMilestoneChange]
  );

  // Subscribe to control bus events
  useEffect(() => {
    const unsubContinue = controlBus.on("continue", () => {
      if (quotesRef.current.length > 0 && chartRef.current) {
        if (savedProgressRef.current > 0 && savedProgressRef.current < 1) {
          resumeAnimation(chartRef.current, quotesRef.current);
        } else {
          animateToNextMilestone(chartRef.current, quotesRef.current);
        }
      }
    });

    const unsubPause = controlBus.on("pause", () => {
      if (animatingRef.current) {
        pauseAnimation();
      }
    });

    const unsubReset = controlBus.on("reset", () => {
      if (quotesRef.current.length > 0 && chartRef.current) {
        resetPlay(chartRef.current, quotesRef.current);
      }
    });

    return () => {
      unsubContinue();
      unsubPause();
      unsubReset();
    };
  }, [controlBus, chartRef, quotesRef, resumeAnimation, animateToNextMilestone, pauseAnimation, resetPlay]);

  return {
    animationRef,
    animatingRef,
    milestoneIndexRef,
    savedProgressRef,
    currentProgressRef,
    applyOutlierSafeScale,
    pauseAnimation,
    resumeAnimation,
    resetPlay,
    animateToNextMilestone,
    runAnimation,
  };
}
