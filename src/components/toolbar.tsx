"use client";

import { useRef, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import type { ChartType, AnimPhase } from "@/lib/chart-types";
import { LINE_COLORS } from "@/lib/chart-constants";

interface ToolbarProps {
  symbol: string;
  speed: number;
  chartType: ChartType;
  lineColor: string;
  phase: AnimPhase;
  speedRef: React.MutableRefObject<number>;
  continueCounterRef: React.MutableRefObject<number>;
  pauseCounterRef: React.MutableRefObject<number>;
  resetCounterRef: React.MutableRefObject<number>;
  lastMilestoneRef: React.MutableRefObject<number>;
  onSymbolSelect: (symbol: string) => void;
  onSpeedChange: (speed: number) => void;
  onChartTypeChange: (type: ChartType) => void;
  onLineColorChange: (color: string) => void;
  onPhaseChange: (phase: AnimPhase) => void;
  onReplay: () => void;
  onChartKeyBump: () => void;
  onTargetMilestoneSet: (milestone: number | undefined) => void;
}

export function Toolbar({
  symbol,
  speed,
  chartType,
  lineColor,
  phase,
  speedRef,
  continueCounterRef,
  pauseCounterRef,
  resetCounterRef,
  lastMilestoneRef,
  onSymbolSelect,
  onSpeedChange,
  onChartTypeChange,
  onLineColorChange,
  onPhaseChange,
  onReplay,
  onChartKeyBump,
  onTargetMilestoneSet,
}: ToolbarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const speedBeforeDragRef = useRef(speed);

  const handleContinue = () => {
    continueCounterRef.current += 1;
    onPhaseChange("animating");
  };

  const handlePause = () => {
    pauseCounterRef.current += 1;
    onPhaseChange("paused");
  };

  const handleResetPlay = () => {
    resetCounterRef.current += 1;
    onPhaseChange("animating");
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  // Sync speedRef when speed prop changes
  useEffect(() => {
    speedRef.current = speed;
  }, [speed, speedRef]);

  return (
    <header className="flex items-center gap-3 px-4 py-3.5 border-b border-border shrink-0 overflow-x-auto overflow-y-hidden">
      {/* Group 1: Title + Asset Search */}
      <div className="flex items-center gap-3 shrink-0">
        <h1 className="text-base font-heading font-semibold tracking-tight leading-none">
          Reality Check
        </h1>
        <div className="w-[16rem] sm:w-[18rem] max-w-[60vw] shrink-0">
          <AssetSearch onSelect={onSymbolSelect} defaultValue={symbol} />
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
            onSpeedChange(newSpeed);
            speedRef.current = newSpeed;
          }}
          onPointerDown={() => {
            speedBeforeDragRef.current = speed;
          }}
          onPointerUp={() => {
            if (
              phase !== "animating" &&
              lastMilestoneRef.current > 0 &&
              speedRef.current !== speedBeforeDragRef.current
            ) {
              onTargetMilestoneSet(lastMilestoneRef.current);
              onChartKeyBump();
              onPhaseChange("animating");
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
            onClick={() => onChartTypeChange("candlestick")}
            className={`h-9 px-3.5 py-2 text-sm rounded-md transition-all ${
              chartType === "candlestick"
                ? "bg-background text-foreground shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Candles
          </button>
          <button
            onClick={() => onChartTypeChange("line")}
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
                onClick={() => onLineColorChange(c.value)}
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
                onClick={onReplay}
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
          title={
            resolvedTheme === "dark"
              ? "Switch to light mode"
              : "Switch to dark mode"
          }
        >
          {resolvedTheme === "dark" ? (
            <Sun className="size-3.5" />
          ) : (
            <Moon className="size-3.5" />
          )}
        </Button>
      </div>
    </header>
  );
}
