"use client";

import { useCallback, useRef, useEffect } from "react";
import type { IChartApi } from "lightweight-charts";
import type { ChartData, AnimPhase } from "@/lib/chart-types";
import { MILESTONES } from "@/lib/chart-constants";
import { computeSafeRange } from "@/lib/chart-utils";

interface UseChartAnimationOptions {
  chartRef: React.MutableRefObject<IChartApi | null>;
  seriesRef: React.MutableRefObject<ReturnType<IChartApi["addSeries"]> | null>;
  quotesRef: React.MutableRefObject<ChartData[]>;
  speedRef: React.MutableRefObject<number>;
  continueCounterRef: React.MutableRefObject<number>;
  pauseCounterRef: React.MutableRefObject<number>;
  resetCounterRef: React.MutableRefObject<number>;
  hasMoreDataRef: React.MutableRefObject<boolean>;
  onPhaseChange: (phase: AnimPhase) => void;
  onMilestoneChange?: (milestoneIndex: number) => void;
  fetchOlderData: (
    sym: string,
    seriesRef: React.MutableRefObject<ReturnType<IChartApi["addSeries"]> | null>,
    chartRef: React.MutableRefObject<IChartApi | null>
  ) => Promise<boolean>;
  symbol: string;
}

export function useChartAnimation({
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
}: UseChartAnimationOptions) {
  const animationRef = useRef<number | null>(null);
  const milestoneIndexRef = useRef(0);
  const lastContinueCountRef = useRef(0);
  const lastPauseCountRef = useRef(0);
  const lastResetCountRef = useRef(0);
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
      const isLastMilestone =
        milestoneIdx >= MILESTONES.length - 1 || toBars >= totalBars;

      const fromBars =
        fromBarsOverride ??
        (milestoneIdx === 0
          ? Math.min(5, totalBars)
          : Math.min(MILESTONES[milestoneIdx - 1], totalBars));

      if (resumeProgress === 0) {
        // Set initial logical range (right-aligned, showing fromBars)
        chart.timeScale().setVisibleLogicalRange({
          from: lastBarIndex - fromBars + 1,
          to: lastBarIndex,
        });

        // Apply initial y-axis scale matching the starting visible range
        applyOutlierSafeScale(chart, quotes, lastBarIndex - fromBars + 1, lastBarIndex);
      }

      // Disable user interaction during animation
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

        const durationMs = speedRef.current * 1000;
        if (animStartTime === null) {
          animStartTime = now - resumeProgress * durationMs;
        }

        const elapsed = now - animStartTime;
        const progress = Math.min(elapsed / durationMs, 1);
        currentProgressRef.current = progress;

        // Ease-in-out cubic
        const eased =
          progress < 0.5
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

          // Progressively update y-axis (throttled to every ~2% progress)
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
          if (isLastMilestone) {
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

          if (milestoneIdx + 1 >= MILESTONES.length || toBars >= totalBars) {
            onPhaseChange("complete");
          } else {
            // Automatically proceed to the next milestone without pausing
            animateToNextMilestoneRef.current(chart, quotes);
          }
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
      const idx = milestoneIndexRef.current;
      if (idx >= MILESTONES.length) {
        onPhaseChange("complete");
        return;
      }

      let targetBars = MILESTONES[idx];

      // If we need more bars than currently loaded, fetch older data first
      if (targetBars > totalBars && hasMoreDataRef.current) {
        onPhaseChange("paused");
        fetchOlderData(symbol, seriesRef, chartRef).then((gotMore) => {
          if (gotMore && chartRef.current) {
            resumeAnimationRef.current(chartRef.current, quotesRef.current);
          } else if (!gotMore) {
            targetBars = totalBars;
            runAnimation(chart, quotesRef.current, idx, targetBars, lastBarIndex, undefined, savedProgressRef.current);
          }
        });
        return;
      }

      targetBars = Math.min(targetBars, totalBars);

      animatingRef.current = true;
      onPhaseChange("animating");

      const fromBars =
        idx === 0
          ? Math.min(5, totalBars)
          : Math.min(MILESTONES[idx - 1], totalBars);
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
    ]
  );



  const animateToNextMilestone = useCallback(
    (chart: IChartApi, quotes: ChartData[]) => {
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
        fetchOlderData(symbol, seriesRef, chartRef).then((gotMore) => {
          if (gotMore && chartRef.current) {
            animateToNextMilestoneRef.current(chartRef.current, quotesRef.current);
          } else if (!gotMore) {
            targetBars = totalBars;
            runAnimation(chart, quotesRef.current, idx, targetBars, lastBarIndex);
          }
        });
        return;
      }

      targetBars = Math.min(targetBars, totalBars);

      let fromBars: number;
      if (idx === 0) {
        fromBars = Math.min(5, totalBars);
      } else {
        fromBars = Math.min(MILESTONES[idx - 1], totalBars);
      }

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
    ]
  );

  // Keep the refs in sync
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

  // Watch for play/pause/reset button presses
  const pollButtonPresses = useCallback(() => {
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
  }, [
    animateToNextMilestone,
    chartRef,
    continueCounterRef,
    pauseCounterRef,
    quotesRef,
    resetCounterRef,
    resetPlay,
    resumeAnimation,
    pauseAnimation,
  ]);

  return {
    animationRef,
    animatingRef,
    milestoneIndexRef,
    savedProgressRef,
    currentProgressRef,
    lastContinueCountRef,
    lastPauseCountRef,
    lastResetCountRef,
    applyOutlierSafeScale,
    pauseAnimation,
    resumeAnimation,
    resetPlay,
    animateToNextMilestone,
    runAnimation,
    pollButtonPresses,
  };
}
