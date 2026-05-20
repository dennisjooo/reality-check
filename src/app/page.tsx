"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { AssetSearch } from "@/components/asset-search";
import { ZoomChart } from "@/components/zoom-chart";

type ChartType = "candlestick" | "line";
type AnimPhase = "idle" | "animating" | "paused" | "complete";

const DEFAULT_SYMBOL = "BTC-USD";
const DEFAULT_SPEED = 6;
const LS_KEY = "reality-check-settings";

function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveSettings(settings: { symbol?: string; speed?: number; chartType?: ChartType }) {
  try {
    const existing = loadSettings();
    localStorage.setItem(LS_KEY, JSON.stringify({ ...existing, ...settings }));
  } catch {}
}

export default function Home() {
  const saved = loadSettings();
  const [symbol, setSymbol] = useState(saved.symbol ?? DEFAULT_SYMBOL);
  const [chartKey, setChartKey] = useState(0);
  const [speed, setSpeed] = useState(saved.speed ?? DEFAULT_SPEED);
  const [chartType, setChartType] = useState<ChartType>(saved.chartType ?? "candlestick");
  const [phase, setPhase] = useState<AnimPhase>("idle");
  const continueCounterRef = useRef(0);
  const pauseCounterRef = useRef(0);
  const resetCounterRef = useRef(0);
  const speedRef = useRef(speed);
  const lastMilestoneRef = useRef(0);
  /** When set > 0, chart auto-plays from milestone 0 up to this target */
  const [targetMilestone, setTargetMilestone] = useState<number | undefined>(undefined);
  const speedBeforeDragRef = useRef(speed);

  useEffect(() => {
    speedRef.current = speed;
    saveSettings({ speed, chartType });
  }, [speed, chartType]);

  const handleSelect = (newSymbol: string) => {
    setSymbol(newSymbol);
    lastMilestoneRef.current = 0;
    setTargetMilestone(undefined);
    setChartKey((k) => k + 1);
    setPhase("idle");
    saveSettings({ symbol: newSymbol });
  };

  const handleContinue = () => {
    continueCounterRef.current += 1;
    setPhase("animating");
  };

  const handlePause = () => {
    pauseCounterRef.current += 1;
    setPhase("paused");
  };

  const handleResetPlay = () => {
    resetCounterRef.current += 1;
    setPhase("animating");
  };

  const handleReplay = () => {
    // Replay from the start, auto-play through all milestones up to the last one reached
    setTargetMilestone(lastMilestoneRef.current);
    setChartKey((k) => k + 1);
    setPhase("animating");
  };

  const handleMilestoneChange = useCallback((milestoneIndex: number) => {
    lastMilestoneRef.current = milestoneIndex;
  }, []);

  const handlePhaseChange = useCallback((newPhase: AnimPhase) => {
    setPhase(newPhase);
  }, []);

  return (
    <div className="flex flex-col h-dvh">
      {/* Header toolbar */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-border shrink-0">
        <h1 className="text-lg font-heading font-semibold tracking-tight shrink-0">
          Reality Check
        </h1>

        <AssetSearch onSelect={handleSelect} defaultValue={symbol} />

        <div className="flex-1" />

        {/* Speed control */}
        <div className="flex items-center gap-2">
          <label htmlFor="speed-slider" className="text-xs text-muted-foreground shrink-0">
            Speed
          </label>
          <input
            id="speed-slider"
            type="range"
            min={2}
            max={20}
            step={1}
            value={speed}
            onChange={(e) => {
              const newSpeed = Number(e.target.value);
              setSpeed(newSpeed);
              speedRef.current = newSpeed;
            }}
            onPointerDown={() => {
              speedBeforeDragRef.current = speed;
            }}
            onPointerUp={() => {
              // Only replay when not animating and speed actually changed
              if (
                phase !== "animating" &&
                lastMilestoneRef.current > 0 &&
                speedRef.current !== speedBeforeDragRef.current
              ) {
                setTargetMilestone(lastMilestoneRef.current);
                setChartKey((k) => k + 1);
                setPhase("animating");
              }
            }}
            className="w-20 h-1 accent-primary cursor-pointer"
          />
          <span className="text-xs text-muted-foreground tabular-nums w-7 shrink-0">{speed}s</span>
        </div>

        {/* Chart type toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => { setChartType("candlestick"); saveSettings({ chartType: "candlestick" }); }}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
              chartType === "candlestick"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            Candles
          </button>
          <button
            onClick={() => { setChartType("line"); saveSettings({ chartType: "line" }); }}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
              chartType === "line"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            Line
          </button>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          {phase === "animating" && (
            <button
              onClick={handlePause}
              className="px-3 py-1.5 text-xs rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors font-medium flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clipRule="evenodd" /></svg>
              Pause
            </button>
          )}

          {(phase === "paused" || phase === "idle") && (
            <button
              onClick={handleContinue}
              className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" /></svg>
              {phase === "idle" ? "Start" : "Continue"}
            </button>
          )}

          {phase !== "idle" && (
            <>
              {(phase === "paused" || phase === "complete") && (
                <button
                  onClick={handleReplay}
                  className="px-3 py-1.5 text-xs rounded-md bg-accent text-accent-foreground hover:bg-accent/80 transition-colors font-medium flex items-center gap-1.5"
                  title="Replay from last milestone"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                  Replay
                </button>
              )}
              <button
                onClick={handleResetPlay}
                className="px-3 py-1.5 text-xs rounded-md bg-accent text-accent-foreground hover:bg-accent/80 transition-colors font-medium flex items-center gap-1.5"
                title="Reset to the beginning"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" /></svg>
                Reset
              </button>
            </>
          )}
        </div>
      </header>

      {/* Chart */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <ZoomChart
          key={chartKey}
          symbol={symbol}
          chartType={chartType}
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