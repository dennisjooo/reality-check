"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChartType, ChartInterval, AnimPhase } from "@/lib/chart-types";

import { SpeedControl } from "@/components/speed-control";
import { IntervalControl } from "@/components/interval-control";
import { ChartTypeControl } from "@/components/chart-type-control";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  speed: number;
  chartType: ChartType;
  interval: ChartInterval;
  lineColor: string;
  phase: AnimPhase;
  speedRef: React.MutableRefObject<number>;
  onSpeedChange: (speed: number) => void;
  onChartTypeChange: (type: ChartType) => void;
  onIntervalChange: (interval: ChartInterval) => void;
  onLineColorChange: (color: string) => void;
  onPhaseChange: (phase: AnimPhase) => void;
  onChartKeyBump: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  speed,
  chartType,
  interval,
  lineColor,
  phase,
  speedRef,
  onSpeedChange,
  onChartTypeChange,
  onIntervalChange,
  onLineColorChange,
  onPhaseChange,
  onChartKeyBump,
}: SettingsModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`settings-modal-backdrop ${isOpen ? "settings-modal-backdrop--open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        className={`settings-modal-container ${isOpen ? "settings-modal-container--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <div ref={panelRef} className="settings-modal-panel">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4">
            <h2 className="text-base font-heading italic tracking-tight text-foreground/80">
              Settings
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="control-bounce h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </Button>
          </div>

          <div className="mx-6 border-t border-border/40" />

          <div className="flex flex-col gap-6 px-6 py-5">
            <SpeedControl
              speed={speed}
              onSpeedChange={onSpeedChange}
              speedRef={speedRef}
              phase={phase}
              onChartKeyBump={onChartKeyBump}
              onPhaseChange={onPhaseChange}
            />

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                Timeframe
              </span>
              <IntervalControl
                interval={interval}
                onIntervalChange={onIntervalChange}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                Appearance
              </span>
              <ChartTypeControl
                chartType={chartType}
                onChartTypeChange={onChartTypeChange}
                lineColor={lineColor}
                onLineColorChange={onLineColorChange}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
