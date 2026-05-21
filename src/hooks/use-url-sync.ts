"use client";

import { useEffect } from "react";
import { buildSearchURL } from "@/lib/url-params";

interface UseUrlSyncOptions {
  symbol: string;
  speed: number;
  chartType: string;
  interval: string;
  fromDate?: string;
  toDate?: string;
  memesEnabled: boolean;
}

export function useUrlSync({ symbol, speed, chartType, interval, fromDate, toDate, memesEnabled }: UseUrlSyncOptions) {
  useEffect(() => {
    const url = buildSearchURL({
      symbol,
      speed,
      chartType,
      interval,
      fromDate,
      toDate,
      memesEnabled,
    });
    window.history.replaceState(null, "", url);
  }, [symbol, speed, chartType, interval, fromDate, toDate, memesEnabled]);
}
