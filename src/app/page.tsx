"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { AnimPhase } from "@/lib/chart-types";
import { useSettings, type SettingsOverrides } from "@/hooks/use-settings";
import { Toolbar } from "@/components/toolbar";
import { ZoomChart } from "@/components/zoom-chart";

function parseUrlOverrides(searchParams: URLSearchParams): SettingsOverrides {
  const overrides: SettingsOverrides = {};

  const q = searchParams.get("q");
  if (q) overrides.symbol = q;

  const speed = searchParams.get("speed");
  if (speed) {
    const n = Number(speed);
    if (!isNaN(n) && n >= 2 && n <= 20) overrides.speed = n;
  }

  const type = searchParams.get("type");
  if (type === "candlestick" || type === "line") overrides.chartType = type;

  const from = searchParams.get("from");
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) overrides.fromDate = from;

  const to = searchParams.get("to");
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) overrides.toDate = to;

  return overrides;
}

function buildSearchURL(params: {
  symbol: string;
  speed: number;
  chartType: string;
  fromDate?: string;
  toDate?: string;
}): string {
  const sp = new URLSearchParams();
  sp.set("q", params.symbol);
  sp.set("speed", String(params.speed));
  sp.set("type", params.chartType);
  if (params.fromDate) sp.set("from", params.fromDate);
  if (params.toDate) sp.set("to", params.toDate);
  return `?${sp.toString()}`;
}

function HomeContent() {
  const searchParams = useSearchParams();
  const overrides = parseUrlOverrides(searchParams);

  const {
    symbol,
    speed,
    chartType,
    lineColor,
    fromDate,
    toDate,
    setSpeed,
    updateSymbol,
    updateChartType,
    updateLineColor,
    updateFromDate,
    updateToDate,
  } = useSettings(overrides);

  const [chartKey, setChartKey] = useState(0);
  const [phase, setPhase] = useState<AnimPhase>("idle");
  const continueCounterRef = useRef(0);
  const pauseCounterRef = useRef(0);
  const resetCounterRef = useRef(0);
  const speedRef = useRef(speed);
  const lastMilestoneRef = useRef(0);
  const [targetMilestone, setTargetMilestone] = useState<number | undefined>(
    undefined
  );

  // Sync URL with current settings (replace, no reload)
  useEffect(() => {
    const url = buildSearchURL({
      symbol,
      speed,
      chartType,
      fromDate,
      toDate,
    });
    window.history.replaceState(null, "", url);
  }, [symbol, speed, chartType, fromDate, toDate]);

  const handleSymbolSelect = useCallback(
    (newSymbol: string) => {
      updateSymbol(newSymbol);
      lastMilestoneRef.current = 0;
      setTargetMilestone(undefined);
      setChartKey((k) => k + 1);
      setPhase("idle");
    },
    [updateSymbol]
  );

  const handleReplay = useCallback(() => {
    setTargetMilestone(lastMilestoneRef.current);
    setChartKey((k) => k + 1);
    setPhase("animating");
  }, []);

  const handleMilestoneChange = useCallback((milestoneIndex: number) => {
    lastMilestoneRef.current = milestoneIndex;
  }, []);

  const handlePhaseChange = useCallback((newPhase: AnimPhase) => {
    setPhase(newPhase);
  }, []);

  return (
    <div className="flex flex-col h-dvh">
      <Toolbar
        symbol={symbol}
        speed={speed}
        chartType={chartType}
        lineColor={lineColor}
        phase={phase}
        speedRef={speedRef}
        continueCounterRef={continueCounterRef}
        pauseCounterRef={pauseCounterRef}
        resetCounterRef={resetCounterRef}
        lastMilestoneRef={lastMilestoneRef}
        onSymbolSelect={handleSymbolSelect}
        onSpeedChange={setSpeed}
        onChartTypeChange={updateChartType}
        onLineColorChange={updateLineColor}
        onPhaseChange={handlePhaseChange}
        onReplay={handleReplay}
        onChartKeyBump={() => setChartKey((k) => k + 1)}
        onTargetMilestoneSet={setTargetMilestone}
      />

      <main className="flex-1 min-h-0 overflow-hidden">
        <ZoomChart
          key={chartKey}
          symbol={symbol}
          chartType={chartType}
          lineColor={lineColor}
          fromDate={fromDate}
          toDate={toDate}
          speedRef={speedRef}
          continueCounterRef={continueCounterRef}
          pauseCounterRef={pauseCounterRef}
          resetCounterRef={resetCounterRef}
          onPhaseChange={handlePhaseChange}
          phase={phase}
          targetMilestone={targetMilestone}
          onMilestoneChange={handleMilestoneChange}
        />
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}