"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChartType, ChartInterval } from "@/lib/chart-types";
import {
  LS_KEY,
  DEFAULT_SYMBOL,
  DEFAULT_SPEED,
  DEFAULT_LINE_COLOR,
  DEFAULT_INTERVAL,
  type PersistedSettings,
} from "@/lib/chart-constants";

function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveSettings(settings: PersistedSettings) {
  try {
    const existing = loadSettings();
    localStorage.setItem(LS_KEY, JSON.stringify({ ...existing, ...settings }));
  } catch {}
}

export interface SettingsOverrides {
  symbol?: string;
  speed?: number;
  chartType?: ChartType;
  interval?: ChartInterval;
  fromDate?: string;
  toDate?: string;
}

export function useSettings(overrides?: SettingsOverrides) {
  const saved = loadSettings();

  const [symbol, setSymbol] = useState(
    overrides?.symbol ?? saved.symbol ?? DEFAULT_SYMBOL
  );
  const [speed, setSpeed] = useState(
    overrides?.speed ?? saved.speed ?? DEFAULT_SPEED
  );
  const [chartType, setChartType] = useState<ChartType>(
    overrides?.chartType ?? saved.chartType ?? "candlestick"
  );
  const [interval, setInterval] = useState<ChartInterval>(
    overrides?.interval ?? saved.interval ?? DEFAULT_INTERVAL
  );
  const [lineColor, setLineColor] = useState<string>(
    saved.lineColor ?? DEFAULT_LINE_COLOR
  );
  const [fromDate, setFromDate] = useState<string | undefined>(
    overrides?.fromDate ?? saved.fromDate
  );
  const [toDate, setToDate] = useState<string | undefined>(
    overrides?.toDate ?? saved.toDate
  );

  useEffect(() => {
    saveSettings({ speed, chartType, lineColor, interval, fromDate, toDate });
  }, [speed, chartType, lineColor, interval, fromDate, toDate]);

  const updateSymbol = useCallback((newSymbol: string) => {
    setSymbol(newSymbol);
    saveSettings({ symbol: newSymbol });
  }, []);

  const updateChartType = useCallback((type: ChartType) => {
    setChartType(type);
    saveSettings({ chartType: type });
  }, []);

  const updateInterval = useCallback((newInterval: ChartInterval) => {
    setInterval(newInterval);
    saveSettings({ interval: newInterval });
  }, []);

  const updateLineColor = useCallback((color: string) => {
    setLineColor(color);
    saveSettings({ lineColor: color });
  }, []);

  const updateFromDate = useCallback((date: string | undefined) => {
    setFromDate(date);
    saveSettings({ fromDate: date });
  }, []);

  const updateToDate = useCallback((date: string | undefined) => {
    setToDate(date);
    saveSettings({ toDate: date });
  }, []);

  return {
    symbol,
    speed,
    chartType,
    interval,
    lineColor,
    fromDate,
    toDate,
    setSpeed,
    updateSymbol,
    updateChartType,
    updateInterval,
    updateLineColor,
    updateFromDate,
    updateToDate,
  };
}
