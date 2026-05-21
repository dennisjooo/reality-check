"use client";

import { useCallback, useRef } from "react";
import type { ChartData, ChartInterval } from "@/lib/chart-types";
import type { ChartType } from "@/lib/chart-types";
import { CHUNK_YEARS } from "@/lib/chart-constants";
import { toCandlestickData, toLineData, toVolumeData } from "@/lib/chart-series";
import { sanitizeQuotes } from "@/lib/chart-utils";
import type { IChartApi } from "lightweight-charts";

interface UseChartDataOptions {
  chartType: ChartType;
  interval: ChartInterval;
  onDataChange?: (quotes: ChartData[]) => void;
}

export function useChartData({ chartType, interval, onDataChange }: UseChartDataOptions) {
  const quotesRef = useRef<ChartData[]>([]);
  const hasMoreDataRef = useRef(true);
  const oldestTimestampRef = useRef<number | null>(null);
  const prefetchedChunkRef = useRef<ChartData[] | null>(null);
  const prefetchPromiseRef = useRef<Promise<ChartData[] | null> | null>(null);
  const prefetchForOldestRef = useRef<number | null>(null);

  const markNoMoreHistory = useCallback(() => {
    hasMoreDataRef.current = false;
    prefetchedChunkRef.current = null;
    prefetchForOldestRef.current = null;
    prefetchPromiseRef.current = null;
  }, []);

  const fetchChunk = useCallback(
    async (sym: string, period1: Date, period2: Date): Promise<ChartData[]> => {
      const p1 = Math.floor(period1.getTime() / 1000);
      const p2 = Math.floor(period2.getTime() / 1000);
      const res = await fetch(
        `/api/chart?symbol=${encodeURIComponent(sym)}&period1=${p1}&period2=${p2}&interval=${interval}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          typeof data.error === "string" ? data.error : "Failed to fetch chart data";
        const error = new Error(message) as Error & { status?: number };
        error.status = res.status;
        throw error;
      }
      return data.quotes;
    },
    [interval]
  );

  const fetchOlderChunk = useCallback(
    async (sym: string, oldest: number): Promise<ChartData[]> => {
      const period2 = new Date(oldest * 1000);
      const period1 = new Date(
        period2.getTime() - CHUNK_YEARS * 365 * 24 * 60 * 60 * 1000
      );
      return fetchChunk(sym, period1, period2);
    },
    [fetchChunk]
  );

  const prefetchOlderData = useCallback(
    (sym: string) => {
      if (!hasMoreDataRef.current) return;
      const oldest = oldestTimestampRef.current;
      if (oldest === null) return;

      // Avoid duplicate prefetches for the same pagination boundary.
      if (prefetchForOldestRef.current === oldest) return;

      prefetchForOldestRef.current = oldest;
      prefetchPromiseRef.current = fetchOlderChunk(sym, oldest)
        .then((olderQuotes) => {
          // Ignore stale responses from older datasets/ranges.
          if (oldestTimestampRef.current !== oldest) return null;

          if (olderQuotes.length === 0) {
            hasMoreDataRef.current = false;
            prefetchedChunkRef.current = null;
            return [];
          }

          prefetchedChunkRef.current = olderQuotes;
          return olderQuotes;
        })
        .catch((error: Error & { status?: number }) => {
          // Yahoo has no history before listing — stop paginating instead of retrying forever.
          if (error.status === 404 || error.status === 400) {
            markNoMoreHistory();
          }
          return null;
        })
        .finally(() => {
          prefetchPromiseRef.current = null;
        });
    },
    [fetchOlderChunk, markNoMoreHistory]
  );

  const fetchOlderData = useCallback(
    async (
      sym: string,
      seriesRef: React.MutableRefObject<ReturnType<IChartApi["addSeries"]> | null>,
      chartRef: React.MutableRefObject<IChartApi | null>,
      volumeSeriesRef?: React.MutableRefObject<ReturnType<IChartApi["addSeries"]> | null>
    ): Promise<boolean> => {
      if (!hasMoreDataRef.current) return false;

      const oldest = oldestTimestampRef.current;
      if (oldest === null) return false;

      try {
        let olderQuotes: ChartData[] = [];
        if (prefetchForOldestRef.current === oldest) {
          if (prefetchedChunkRef.current) {
            olderQuotes = prefetchedChunkRef.current;
          } else if (prefetchPromiseRef.current) {
            const prefetched = await prefetchPromiseRef.current;
            olderQuotes = prefetched ?? [];
          }
          prefetchedChunkRef.current = null;
          prefetchForOldestRef.current = null;
        }

        if (olderQuotes.length === 0 && hasMoreDataRef.current) {
          olderQuotes = await fetchOlderChunk(sym, oldest);
        }

        if (olderQuotes.length === 0) {
          hasMoreDataRef.current = false;
          return false;
        }

        const existingTimes = new Set(quotesRef.current.map((q) => q.time));
        const newQuotes = olderQuotes.filter((q) => !existingTimes.has(q.time));

        if (newQuotes.length > 0) {
          newQuotes.sort((a, b) => a.time - b.time);
          quotesRef.current = sanitizeQuotes([...newQuotes, ...quotesRef.current]);
          oldestTimestampRef.current = quotesRef.current[0].time;
          onDataChange?.(quotesRef.current);

          if (seriesRef.current && chartRef.current) {
            const visibleRange = chartRef.current.timeScale().getVisibleLogicalRange();
            const allQuotes = quotesRef.current;
            seriesRef.current.setData(
              chartType === "candlestick" ? toCandlestickData(allQuotes) : toLineData(allQuotes)
            );
            if (visibleRange) {
              const rangeShift = newQuotes.length;
              chartRef.current.timeScale().setVisibleLogicalRange({
                from: visibleRange.from + rangeShift,
                to: visibleRange.to + rangeShift,
              });
            }
          }

          if (volumeSeriesRef?.current) {
            volumeSeriesRef.current.setData(toVolumeData(quotesRef.current));
          }
        } else {
          hasMoreDataRef.current = false;
        }

        if (newQuotes.length > 0) {
          prefetchOlderData(sym);
        }

        return newQuotes.length > 0;
      } catch (error) {
        const status = (error as Error & { status?: number }).status;
        if (status === 404 || status === 400 || status === 429 || status === 500) {
          markNoMoreHistory();
        }
        return false;
      }
    },
    [chartType, fetchOlderChunk, markNoMoreHistory, onDataChange, prefetchOlderData]
  );

  const resetData = useCallback((quotes: ChartData[]) => {
    quotesRef.current = sanitizeQuotes(quotes);
    hasMoreDataRef.current = true;
    oldestTimestampRef.current = quotes[0]?.time ?? null;
    prefetchedChunkRef.current = null;
    prefetchPromiseRef.current = null;
    prefetchForOldestRef.current = null;
    onDataChange?.(quotesRef.current);
  }, [onDataChange]);

  return {
    quotesRef,
    hasMoreDataRef,
    oldestTimestampRef,
    fetchChunk,
    prefetchOlderData,
    fetchOlderData,
    resetData,
  };
}
