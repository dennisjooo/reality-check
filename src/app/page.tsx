"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  Play,
  Pause,
  RotateCcw,
  Square,
  Sun,
  Moon,
} from "lucide-react";
import { AssetSearch } from "@/components/asset-search";
import { ZoomChart } from "@/components/zoom-chart";
import { Button } from "@/components/ui/button";

type ChartType = "candlestick" | "line";
type AnimPhase = "idle" | "animating" | "paused" | "complete";

const DEFAULT_SYMBOL = "BTC-USD";
const DEFAULT_SPEED = 6;
const DEFAULT_LINE_COLOR = "#3b82f6";
const LS_KEY = "reality-check-settings";

const LINE_COLORS = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Red", value: "#ef4444" },
  { name: "Purple", value: "#a855f7" },
  { name: "Orange", value: "#f97316" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Pink", value: "#ec4899" },
  { name: "Yellow", value: "#eab308" },
];

function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveSettings(settings: {
  symbol?: string;
  speed?: number;
  chartType?: ChartType;
  lineColor?: string;
}) {
  try {
    const existing = loadSettings();
    localStorage.setItem(LS_KEY, JSON.stringify({ ...existing, ...settings }));
  } catch {}
}

export default function Home() {
  const { resolvedTheme, setTheme } = useTheme();
  const saved = loadSettings();
  const [symbol, setSymbol] = useState(saved.symbol ?? DEFAULT_SYMBOL);
  const [chartKey, setChartKey] = useState(0);
  const [speed, setSpeed] = useState(saved.speed ?? DEFAULT_SPEED);
  const [chartType, setChartType] = useState<ChartType>(
    saved.chartType ?? "candlestick"
  );
  const [lineColor, setLineColor] = useState<string>(
    saved.lineColor ?? DEFAULT_LINE_COLOR
  );
  const [phase, setPhase] = useState<AnimPhase>("idle");
  const continueCounterRef = useRef(0);
  const pauseCounterRef = useRef(0);
  const resetCounterRef = useRef(0);
  const speedRef = useRef(speed);
  const lastMilestoneRef = useRef(0);
  /** When set > 0, chart auto-plays from milestone 0 up to this target */
  const [targetMilestone, setTargetMilestone] = useState<number | undefined>(
    undefined
  );
  const speedBeforeDragRef = useRef(speed);

  useEffect(() => {
    speedRef.current = speed;
    saveSettings({ speed, chartType, lineColor });
  }, [speed, chartType, lineColor]);

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

  const handleChartTypeChange = (type: ChartType) => {
    setChartType(type);
    saveSettings({ chartType: type });
  };

  const handleLineColorChange = (color: string) => {
    setLineColor(color);
    saveSettings({ lineColor: color });
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <div className="flex flex-col h-dvh">
      {/* Header toolbar */}
      <header className="flex items-center gap-3 px-4 py-3.5 border-b border-border shrink-0 overflow-x-auto overflow-y-hidden">
        {/* Group 1: Title + Asset Search */}
        <div className="flex items-center gap-3 shrink-0">
          <h1 className="text-base font-heading font-semibold tracking-tight leading-none">
            Reality Check
          </h1>
          <div className="w-[16rem] sm:w-[18rem] max-w-[60vw] shrink-0">
            <AssetSearch onSelect={handleSelect} defaultValue={symbol} />
          </div>
        </div>

        <div className="w-px h-6 bg-border shrink-0" />

        {/* Group 2: Speed control */}
        <div className="flex items-center gap-2 shrink-0">
          <label
            htmlFor="speed-slider"
            className="text-sm text-muted-foreground shrink-0"
          >
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
            className="w-28 h-1.5 accent-primary cursor-pointer"
          />
          <span className="text-sm text-muted-foreground tabular-nums w-8 shrink-0">
            {speed}s
          </span>
        </div>

        <div className="w-px h-6 bg-border shrink-0" />

        {/* Group 3: Chart type toggle + Line color picker */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center rounded-lg bg-muted p-1 border border-border">
            <button
              onClick={() => handleChartTypeChange("candlestick")}
              className={`h-9 px-3.5 py-2 text-sm rounded-md transition-all ${
                chartType === "candlestick"
                  ? "bg-background text-foreground shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Candles
            </button>
            <button
              onClick={() => handleChartTypeChange("line")}
              className={`h-9 px-3.5 py-2 text-sm rounded-md transition-all ${
                chartType === "line"
                  ? "bg-background text-foreground shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Line
            </button>
          </div>

          {chartType === "line" && (
            <div className="flex items-center gap-1.5 pl-1">
              {LINE_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => handleLineColorChange(c.value)}
                  title={c.name}
                  className={`w-6 h-6 rounded-full transition-all ring-2 ${
                    lineColor === c.value
                      ? "ring-foreground scale-110"
                      : "ring-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-border shrink-0" />

        {/* Group 4: Playback Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {phase === "animating" && (
            <Button
              variant="destructive"
              size="default"
              onClick={handlePause}
              title="Pause"
            >
              <Pause className="size-3.5" />
              Pause
            </Button>
          )}

          {(phase === "paused" || phase === "idle") && (
            <Button
              variant="default"
              size="default"
              onClick={handleContinue}
              title={phase === "idle" ? "Start playback" : "Continue playback"}
            >
              <Play className="size-4" />
              {phase === "idle" ? "Start" : "Continue"}
            </Button>
          )}

          {phase !== "idle" && (
            <>
              {(phase === "paused" || phase === "complete") && (
                <Button
                  variant="secondary"
                  size="default"
                  onClick={handleReplay}
                  title="Replay from last milestone"
                >
                  <RotateCcw className="size-3.5" />
                  Replay
                </Button>
              )}
              <Button
                variant="secondary"
                size="default"
                onClick={handleResetPlay}
                title="Reset to the beginning"
              >
                <Square className="size-3.5" />
                Restart
              </Button>
            </>
          )}
        </div>

        <div className="flex-1 min-w-4" />

        {/* Group 5: Theme toggle */}
        <div className="flex items-center shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {resolvedTheme === "dark" ? (
              <Sun className="size-3.5" />
            ) : (
              <Moon className="size-3.5" />
            )}
          </Button>
        </div>
      </header>

      {/* Chart */}
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
