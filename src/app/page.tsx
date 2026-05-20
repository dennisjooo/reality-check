"use client";

import { useState, useCallback, useRef } from "react";
import type { AnimPhase } from "@/lib/chart-types";
import { useSettings } from "@/hooks/use-settings";
import { Toolbar } from "@/components/toolbar";
import { ZoomChart } from "@/components/zoom-chart";

export default function Home() {
  const {
    symbol,
    speed,
    chartType,
    lineColor,
    setSpeed,
    updateSymbol,
    updateChartType,
    updateLineColor,
  } = useSettings();

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
