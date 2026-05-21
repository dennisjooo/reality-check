"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  Suspense,
} from "react";
import { useSearchParams } from "next/navigation";
import type { AnimPhase, PriceSnapshot } from "@/lib/chart-types";
import { useSettings } from "@/hooks/use-settings";
import { parseUrlOverrides } from "@/lib/url-params";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useBackgroundAudio } from "@/hooks/use-background-audio";
import { useUrlSync } from "@/hooks/use-url-sync";
import { Header } from "@/components/header";
import { ActionBar } from "@/components/action-bar";
import { SettingsModal } from "@/components/settings-modal";
import { ZoomChart } from "@/components/zoom-chart";
import { ChartErrorBoundary } from "@/components/chart-error-boundary";
import { CompletionOverlay } from "@/components/completion-overlay";
import { StartOverlay } from "@/components/start-overlay";
import { MemeOverlay } from "@/components/meme-overlay";
import type { SearchResult } from "@/components/asset-search";
import { ControlBus } from "@/lib/control-bus";

function HomeContent() {
  const searchParams = useSearchParams();
  const overrides = parseUrlOverrides(searchParams);

  const {
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
  } = useSettings(overrides);

  const [chartKey, setChartKey] = useState(0);
  const [phase, setPhase] = useState<AnimPhase>("idle");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [priceSnapshot, setPriceSnapshot] = useState<PriceSnapshot | null>(null);
  const speedRef = useRef(speed);
  const searchInputRef = useRef<HTMLButtonElement>(null);

  const controlBus = useMemo(() => new ControlBus(), []);

  useBackgroundAudio({ phase, memesEnabled, speed, chartKey, controlBus });

  useUrlSync({ symbol, speed, chartType, interval, fromDate, toDate, memesEnabled });

  useKeyboardShortcuts({
    controlBus,
    phase,
    chartType,
    onChartTypeChange: updateChartType,
    onFocusSearch: () => searchInputRef.current?.focus(),
  });

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const handleSymbolSelect = useCallback(
    (newSymbol: string, result?: SearchResult) => {
      updateSymbol(newSymbol, {
        name: result?.name,
        type: result?.type,
        exchange: result?.exchange,
      });
      setPriceSnapshot(null);
      setChartKey((k) => k + 1);
      setPhase("idle");
    },
    [updateSymbol]
  );

  const handleDateChange = useCallback(
    (from: string | undefined, to: string | undefined) => {
      updateFromDate(from);
      updateToDate(to);
      setChartKey((k) => k + 1);
      setPhase("idle");
      setPriceSnapshot(null);
    },
    [updateFromDate, updateToDate]
  );

  const handlePhaseChange = useCallback((newPhase: AnimPhase) => {
    setPhase(newPhase);
  }, []);

  return (
    <div className="h-dvh max-h-dvh overflow-hidden bg-background text-foreground flex flex-col px-3 sm:px-6 py-3">
      <div className="shrink-0">
        <Header
          symbol={symbol}
          assetName={assetName}
          assetType={assetType}
          exchange={exchange}
          priceSnapshot={priceSnapshot}
        />
      </div>

      <main className={`flex-1 min-h-0 my-2 transition-all duration-300 ${isSettingsOpen ? "pointer-events-none scale-[0.98] blur-sm opacity-60" : ""}`}>
        <div
          className="ambient-card relative h-full w-full overflow-hidden rounded-3xl"
        >
          <ChartErrorBoundary onReset={() => setChartKey((k) => k + 1)}>
            <ZoomChart
              key={chartKey}
              symbol={symbol}
              chartType={chartType}
              interval={interval}
              lineColor={lineColor}
              fromDate={fromDate}
              toDate={toDate}
              autoplay={false}
              speedRef={speedRef}
              controlBus={controlBus}
              onPhaseChange={handlePhaseChange}
              phase={phase}
              targetMilestone={undefined}
              onPriceSnapshotChange={setPriceSnapshot}
            />
          </ChartErrorBoundary>
          {memesEnabled && (
            <MemeOverlay priceSnapshot={priceSnapshot} phase={phase} speed={speed} />
          )}
          <CompletionOverlay visible={phase === "complete"} />
          {phase === "idle" && (
            <StartOverlay
              onStart={() => {
                controlBus.continue();
                handlePhaseChange("animating");
              }}
            />
          )}
        </div>
      </main>

      <div className={`relative z-50 shrink-0 pb-1 pt-1 transition-all duration-300 ${isSettingsOpen ? "pointer-events-none scale-[0.98] blur-sm opacity-60" : ""}`}>
        <ActionBar
          symbol={symbol}
          phase={phase}
          controlBus={controlBus}
          searchInputRef={searchInputRef}
          fromDate={fromDate}
          toDate={toDate}
          onSymbolSelect={handleSymbolSelect}
          onPhaseChange={handlePhaseChange}
          onDateChange={handleDateChange}
          onSettingsOpen={() => setIsSettingsOpen(true)}
        />
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        speed={speed}
        chartType={chartType}
        interval={interval}
        lineColor={lineColor}
        phase={phase}
        speedRef={speedRef}
        onSpeedChange={setSpeed}
        onChartTypeChange={updateChartType}
        onIntervalChange={updateInterval}
        onLineColorChange={updateLineColor}
        onPhaseChange={handlePhaseChange}
        onChartKeyBump={() => setChartKey((k) => k + 1)}
        memesEnabled={memesEnabled}
        onMemesEnabledChange={setMemesEnabled}
      />
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
