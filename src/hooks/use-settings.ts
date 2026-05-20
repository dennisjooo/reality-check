"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChartType } from "@/lib/chart-types";
import {
  LS_KEY,
  DEFAULT_SYMBOL,
  DEFAULT_SPEED,
  DEFAULT_LINE_COLOR,
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

export function useSettings() {
  const saved = loadSettings();
  const [symbol, setSymbol] = useState(saved.symbol ?? DEFAULT_SYMBOL);
  const [speed, setSpeed] = useState(saved.speed ?? DEFAULT_SPEED);
  const [chartType, setChartType] = useState<ChartType>(
    saved.chartType ?? "candlestick"
  );
  const [lineColor, setLineColor] = useState<string>(
    saved.lineColor ?? DEFAULT_LINE_COLOR
  );

  useEffect(() => {
    saveSettings({ speed, chartType, lineColor });
  }, [speed, chartType, lineColor]);

  const updateSymbol = useCallback((newSymbol: string) => {
    setSymbol(newSymbol);
    saveSettings({ symbol: newSymbol });
  }, []);

  const updateChartType = useCallback((type: ChartType) => {
    setChartType(type);
    saveSettings({ chartType: type });
  }, []);

  const updateLineColor = useCallback((color: string) => {
    setLineColor(color);
    saveSettings({ lineColor: color });
  }, []);

  return {
    symbol,
    speed,
    chartType,
    lineColor,
    setSpeed,
    updateSymbol,
    updateChartType,
    updateLineColor,
  };
}
