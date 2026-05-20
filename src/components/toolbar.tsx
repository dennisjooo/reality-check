"use client";

import { useEffect, useState, useRef } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Settings } from "lucide-react";
import { AssetSearch } from "@/components/asset-search";
import { Button } from "@/components/ui/button";
import type { ChartType, ChartInterval, AnimPhase } from "@/lib/chart-types";
import { ControlBus } from "@/lib/control-bus";

import { PlaybackControls } from "@/components/playback-controls";
import { SpeedControl } from "@/components/speed-control";
import { IntervalControl } from "@/components/interval-control";
import { ChartTypeControl } from "@/components/chart-type-control";
import { ShareButton } from "@/components/share-button";

interface ToolbarProps {
  symbol: string;
  speed: number;
  chartType: ChartType;
  interval: ChartInterval;
  lineColor: string;
  phase: AnimPhase;
  speedRef: React.MutableRefObject<number>;
  lastMilestoneRef: React.MutableRefObject<number>;
  controlBus: ControlBus;
  searchInputRef: React.RefObject<HTMLButtonElement | null>;
  onSymbolSelect: (symbol: string) => void;
  onSpeedChange: (speed: number) => void;
  onChartTypeChange: (type: ChartType) => void;
  onIntervalChange: (interval: ChartInterval) => void;
  onLineColorChange: (color: string) => void;
  onPhaseChange: (phase: AnimPhase) => void;
  onChartKeyBump: () => void;
  onTargetMilestoneSet: (milestone: number | undefined) => void;
}

export function Toolbar({
  symbol,
  speed,
  chartType,
  interval,
  lineColor,
  phase,
  speedRef,
  lastMilestoneRef,
  controlBus,
  searchInputRef,
  onSymbolSelect,
  onSpeedChange,
  onChartTypeChange,
  onIntervalChange,
  onLineColorChange,
  onPhaseChange,
  onChartKeyBump,
  onTargetMilestoneSet,
}: ToolbarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSettingsOpen && settingsRef.current) {
      setTimeout(() => {
        settingsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    }
  }, [isSettingsOpen]);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  useEffect(() => {
    speedRef.current = speed;
  }, [speed, speedRef]);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5 border border-border/60 rounded-xl bg-card shadow-sm w-full">
      {/* Top Row: Primary Actions (Search & Playback) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="w-full sm:max-w-md shrink-0">
          <AssetSearch ref={searchInputRef} onSelect={onSymbolSelect} defaultValue={symbol} />
        </div>

        {/* Playback Controls */}
        <PlaybackControls
          phase={phase}
          controlBus={controlBus}
          onPhaseChange={onPhaseChange}
        />
      </div>

      <hr className="border-border/50" />

      {/* Mobile Settings Toggle & Utilities */}
      <div className="md:hidden flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 flex items-center justify-center gap-2 text-muted-foreground"
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
        >
          <Settings className="size-4" />
          {isSettingsOpen ? "Hide Settings" : "Show Settings"}
        </Button>
        
        <div className="flex items-center gap-1.5 shrink-0">
          <ShareButton />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            title={
              resolvedTheme === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
            suppressHydrationWarning
            className="h-9 w-9"
          >
            {resolvedTheme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Bottom Row: Settings & Utilities */}
      <div 
        ref={settingsRef}
        className={`${isSettingsOpen ? 'flex' : 'hidden'} md:flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-4 
          pt-4 border-t border-border/50 md:pt-0 md:border-none 
          animate-in slide-in-from-top-2 fade-in duration-200 md:animate-none`}
      >
        {/* Settings Group */}
        <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-4 sm:gap-x-6 w-full md:w-auto">
          {/* Speed Control */}
          <div className="w-full md:w-auto">
            <SpeedControl
              speed={speed}
              onSpeedChange={onSpeedChange}
              speedRef={speedRef}
              phase={phase}
              lastMilestoneRef={lastMilestoneRef}
              onTargetMilestoneSet={onTargetMilestoneSet}
              onChartKeyBump={onChartKeyBump}
              onPhaseChange={onPhaseChange}
            />
          </div>

          <div className="hidden md:block w-px h-5 bg-border" />

          {/* Interval Control */}
          <div className="w-full md:w-auto flex justify-between items-center md:block">
            <span className="md:hidden text-sm font-medium text-muted-foreground">Timeframe</span>
            <IntervalControl
              interval={interval}
              onIntervalChange={onIntervalChange}
            />
          </div>

          <div className="hidden md:block w-px h-5 bg-border" />

          {/* Chart Type Control */}
          <div className="w-full md:w-auto flex justify-between items-center md:block">
            <span className="md:hidden text-sm font-medium text-muted-foreground">Appearance</span>
            <ChartTypeControl
              chartType={chartType}
              onChartTypeChange={onChartTypeChange}
              lineColor={lineColor}
              onLineColorChange={onLineColorChange}
            />
          </div>
        </div>

        {/* Utilities (Desktop) */}
        <div className="hidden md:flex items-center justify-end gap-1.5 shrink-0">
          <ShareButton />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            title={
              resolvedTheme === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
            suppressHydrationWarning
            className="h-9 w-9"
          >
            {resolvedTheme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
