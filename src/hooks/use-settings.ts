"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChartType, ChartInterval } from "@/lib/chart-types";
import {
  LS_KEY,
  DEFAULT_SYMBOL,
  DEFAULT_ASSET_META,
  DEFAULT_SPEED,
  DEFAULT_LINE_COLOR,
  DEFAULT_INTERVAL,
  type PersistedSettings,
} from "@/lib/chart-constants";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.savedAt && Date.now() - parsed.savedAt < ONE_DAY_MS) {
        return parsed;
      }
      localStorage.removeItem(LS_KEY);
    }
  } catch {}
  return {};
}

function saveSettings(settings: PersistedSettings) {
  try {
    const existing = loadSettings();
    localStorage.setItem(LS_KEY, JSON.stringify({ ...existing, ...settings, savedAt: Date.now() }));
  } catch {}
}

export interface SettingsOverrides {
  symbol?: string;
  speed?: number;
  chartType?: ChartType;
  interval?: ChartInterval;
  fromDate?: string;
  toDate?: string;
  memesEnabled?: boolean;
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
  const [memesEnabled, setMemesEnabled] = useState<boolean>(
    overrides?.memesEnabled ?? saved.memesEnabled ?? false
  );
  const isDefault = (overrides?.symbol ?? saved.symbol ?? DEFAULT_SYMBOL) === DEFAULT_SYMBOL;
  const [assetName, setAssetName] = useState<string | undefined>(
    saved.assetName ?? (isDefault ? DEFAULT_ASSET_META.name : undefined)
  );
  const [assetType, setAssetType] = useState<string | undefined>(
    saved.assetType ?? (isDefault ? DEFAULT_ASSET_META.type : undefined)
  );
  const [exchange, setExchange] = useState<string | undefined>(
    saved.exchange ?? (isDefault ? DEFAULT_ASSET_META.exchange : undefined)
  );

  useEffect(() => {
    saveSettings({ speed, chartType, lineColor, interval, fromDate, toDate, memesEnabled });
  }, [speed, chartType, lineColor, interval, fromDate, toDate, memesEnabled]);

  const updateSymbol = useCallback(
    (newSymbol: string, meta?: { name?: string; type?: string; exchange?: string }) => {
      setSymbol(newSymbol);
      setAssetName(meta?.name);
      setAssetType(meta?.type);
      setExchange(meta?.exchange);
      saveSettings({
        symbol: newSymbol,
        assetName: meta?.name,
        assetType: meta?.type,
        exchange: meta?.exchange,
      });
    },
    []
  );

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
    assetName,
    assetType,
    exchange,
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
    memesEnabled,
    setMemesEnabled,
  };
}
