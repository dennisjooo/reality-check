"use client";

import { useCallback, useRef, useState } from "react";
import type { ChartData } from "@/lib/chart-types";
import type { ChartType } from "@/lib/chart-types";
import { CHUNK_YEARS } from "@/lib/chart-constants";
import type { IChartApi, Time } from "lightweight-charts";

interface UseChartDataOptions {
  chartType: ChartType;
}

export function useChartData({ chartType }: UseChartDataOptions) {
  const quotesRef = useRef<ChartData[]>([]);
  const hasMoreDataRef = useRef(true);
  const oldestTimestampRef = useRef<number | null>(null);
  const [fetchingMore, setFetchingMore] = useState(false);

  const fetchChunk = useCallback(
    async (sym: string, period1: Date, period2: Date): Promise<ChartData[]> => {
      const p1 = Math.floor(period1.getTime() / 1000);
      const p2 = Math.floor(period2.getTime() / 1000);
      const res = await fetch(
        `/api/chart?symbol=${encodeURIComponent(sym)}&period1=${p1}&period2=${p2}&interval=1d`
      );
      if (!res.ok) throw new Error("Failed to fetch chart data");
      const data = await res.json();
      return data.quotes;
    },
    []
  );

  const fetchOlderData = useCallback(
    async (
      sym: string,
      seriesRef: React.MutableRefObject<ReturnType<IChartApi["addSeries"]> | null>,
      chartRef: React.MutableRefObject<IChartApi | null>
    ): Promise<boolean> => {
      if (!hasMoreDataRef.current) return false;

      const oldest = oldestTimestampRef.current;
      if (oldest === null) return false;

      setFetchingMore(true);
      try {
        const period2 = new Date(oldest * 1000);
        const period1 = new Date(
          period2.getTime() - CHUNK_YEARS * 365 * 24 * 60 * 60 * 1000
        );
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
              seriesRef.current.setData(
                quotesRef.current.map((q) => ({
                  time: q.time as Time,
                  open: q.open,
                  high: q.high,
                  low: q.low,
                  close: q.close,
                }))
              );
            } else {
              seriesRef.current.setData(
                quotesRef.current.map((q) => ({
                  time: q.time as Time,
                  value: q.close,
                }))
              );
            }
          }
        } else {
          hasMoreDataRef.current = false;
        }

        setFetchingMore(false);
        return newQuotes.length > 0;
      } catch {
        setFetchingMore(false);
        return false;
      }
    },
    [fetchChunk, chartType]
  );

  const resetData = useCallback((quotes: ChartData[]) => {
    quotesRef.current = quotes;
    hasMoreDataRef.current = true;
    oldestTimestampRef.current = quotes[0]?.time ?? null;
  }, []);

  return {
    quotesRef,
    hasMoreDataRef,
    oldestTimestampRef,
    fetchingMore,
    fetchChunk,
    fetchOlderData,
    resetData,
  };
}
