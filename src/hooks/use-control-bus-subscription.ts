"use client";

import { useEffect } from "react";
import type { IChartApi } from "lightweight-charts";
import type { ChartData } from "@/lib/chart-types";
import { ControlBus } from "@/lib/control-bus";

interface UseControlBusSubscriptionOptions {
  controlBus: ControlBus;
  chartRef: React.MutableRefObject<IChartApi | null>;
  quotesRef: React.MutableRefObject<ChartData[]>;
  resumeAnimation: (chart: IChartApi, quotes: ChartData[]) => void;
  pauseAnimation: () => void;
  resetPlay: (chart: IChartApi, quotes: ChartData[]) => void;
  animatingRef: React.MutableRefObject<boolean>;
}

/**
 * Subscribe to ControlBus events (continue / pause / reset) and wire them
 * to the animation callbacks.  Unsubscribes on cleanup.
 */
export function useControlBusSubscription({
  controlBus,
  chartRef,
  quotesRef,
  resumeAnimation,
  pauseAnimation,
  resetPlay,
  animatingRef,
}: UseControlBusSubscriptionOptions) {
  useEffect(() => {
    const unsubContinue = controlBus.on("continue", () => {
      if (quotesRef.current.length > 0 && chartRef.current) {
        resumeAnimation(chartRef.current, quotesRef.current);
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
  }, [controlBus, chartRef, quotesRef, resumeAnimation, pauseAnimation, resetPlay, animatingRef]);
}