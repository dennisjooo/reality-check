"use client";

import { useEffect } from "react";
import type { IChartApi } from "lightweight-charts";
import { getChartTheme } from "@/lib/chart-utils";

/**
 * Subscribe to dark/light theme changes and apply them to the chart.
 * Returns nothing — runs as a side-effect hook.
 */
export function useChartTheme(chartRef: React.MutableRefObject<IChartApi | null>) {
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
  }, [chartRef]);
}