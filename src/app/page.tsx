"use client";

import { useState, useCallback, useRef, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { AnimPhase, ChartInterval } from "@/lib/chart-types";
import { useSettings, type SettingsOverrides } from "@/hooks/use-settings";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { Toolbar } from "@/components/toolbar";
import { Header } from "@/components/header";
import { ZoomChart } from "@/components/zoom-chart";
import { ChartErrorBoundary } from "@/components/chart-error-boundary";
import { ControlBus } from "@/lib/control-bus";

function parseUrlOverrides(searchParams: URLSearchParams): SettingsOverrides {
  const overrides: SettingsOverrides = {};

  const q = searchParams.get("q");
  if (q) overrides.symbol = q;

  const speed = searchParams.get("speed");
  if (speed) {
    const n = Number(speed);
    if (!isNaN(n) && n >= 1 && n <= 10) overrides.speed = n;
  }

  const type = searchParams.get("type");
  if (type === "candlestick" || type === "line") overrides.chartType = type;

  const interval = searchParams.get("interval");
  if (interval && /^(1h|1d|1wk|1mo)$/.test(interval)) overrides.interval = interval as ChartInterval;

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
  interval: string;
  fromDate?: string;
  toDate?: string;
}): string {
  const sp = new URLSearchParams();
  sp.set("q", params.symbol);
  sp.set("speed", String(params.speed));
  sp.set("type", params.chartType);
  sp.set("interval", params.interval);
  if (params.fromDate) sp.set("from", params.fromDate);
  if (params.toDate) sp.set("to", params.toDate);
  return `?${sp.toString()}`;
}

function hasOverrides(overrides: SettingsOverrides): boolean {
  return !!(
    overrides.symbol ||
    overrides.speed ||
    overrides.chartType ||
    overrides.interval ||
    overrides.fromDate ||
    overrides.toDate
  );
}

function HomeContent() {
  const searchParams = useSearchParams();
  const overrides = parseUrlOverrides(searchParams);
  const shouldAutoplay = hasOverrides(overrides);

  const {
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
  } = useSettings(overrides);

  const [chartKey, setChartKey] = useState(0);
  const [phase, setPhase] = useState<AnimPhase>("idle");
  const milestoneRef = useRef(0);
  const speedRef = useRef(speed);
  const searchInputRef = useRef<HTMLButtonElement>(null);

  const controlBus = useMemo(() => new ControlBus(), []);

  useKeyboardShortcuts({
    controlBus,
    phase,
    chartType,
    onChartTypeChange: updateChartType,
    onFocusSearch: () => searchInputRef.current?.focus(),
  });

  useEffect(() => {
    const url = buildSearchURL({
      symbol,
      speed,
      chartType,
      interval,
      fromDate,
      toDate,
    });
    window.history.replaceState(null, "", url);
  }, [symbol, speed, chartType, interval, fromDate, toDate]);

  const handleSymbolSelect = useCallback(
    (newSymbol: string) => {
      updateSymbol(newSymbol);
      milestoneRef.current = 0;
      setChartKey((k) => k + 1);
      setPhase("idle");
    },
    [updateSymbol]
  );

  const handleMilestoneChange = useCallback((milestoneIndex: number) => {
    milestoneRef.current = milestoneIndex;
  }, []);

  const handlePhaseChange = useCallback((newPhase: AnimPhase) => {
    setPhase(newPhase);
  }, []);

  return (
    <div className="min-h-screen md:h-screen md:max-h-screen md:overflow-hidden bg-background text-foreground flex flex-col py-6 px-4 sm:px-8">
      <div className="max-w-7xl w-full mx-auto flex flex-col flex-1 h-full gap-4 min-h-0">
        <div className="shrink-0">
          <Header />
        </div>

        <main className="w-full flex-1 flex flex-col gap-4 min-h-0">
          <div className="w-full flex-1 flex flex-col min-h-[400px] md:min-h-[300px] border border-border/60 rounded-2xl shadow-sm overflow-hidden bg-card/50 relative">
            <ChartErrorBoundary onReset={() => setChartKey((k) => k + 1)}>
              <ZoomChart
                key={chartKey}
                symbol={symbol}
                chartType={chartType}
                interval={interval}
                lineColor={lineColor}
                fromDate={fromDate}
                toDate={toDate}
                autoplay={shouldAutoplay}
                speedRef={speedRef}
                controlBus={controlBus}
                onPhaseChange={handlePhaseChange}
                phase={phase}
                targetMilestone={undefined}
                onMilestoneChange={handleMilestoneChange}
              />
            </ChartErrorBoundary>
          </div>
          
          <div className="shrink-0 pb-2">
            <Toolbar
              symbol={symbol}
              speed={speed}
              chartType={chartType}
              interval={interval}
              lineColor={lineColor}
              phase={phase}
              speedRef={speedRef}
              lastMilestoneRef={milestoneRef}
              controlBus={controlBus}
              searchInputRef={searchInputRef}
              onSymbolSelect={handleSymbolSelect}
              onSpeedChange={setSpeed}
              onChartTypeChange={updateChartType}
              onIntervalChange={updateInterval}
              onLineColorChange={updateLineColor}
              onPhaseChange={handlePhaseChange}
              onChartKeyBump={() => setChartKey((k) => k + 1)}
              onTargetMilestoneSet={(m) => {
                if (m !== undefined) {
                }
              }}
            />
          </div>
        </main>
      </div>
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
