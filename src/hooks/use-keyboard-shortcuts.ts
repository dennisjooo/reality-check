"use client";

import { useEffect } from "react";
import type { AnimPhase, ChartType } from "@/lib/chart-types";
import { ControlBus } from "@/lib/control-bus";

interface UseKeyboardShortcutsOptions {
  controlBus: ControlBus;
  phase: AnimPhase;
  chartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
  onFocusSearch: () => void;
}

export function useKeyboardShortcuts({
  controlBus,
  phase,
  chartType,
  onChartTypeChange,
  onFocusSearch,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      const isInput =
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target.isContentEditable;

      if (e.key === "/" && !isInput) {
        e.preventDefault();
        onFocusSearch();
        return;
      }

      if (isInput) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          if (phase === "animating") {
            controlBus.pause();
          } else {
            controlBus.continue();
          }
          break;
        case "r":
        case "R":
          if (phase !== "idle") {
            e.preventDefault();
            controlBus.reset();
          }
          break;
        case "1":
          e.preventDefault();
          if (chartType !== "candlestick") onChartTypeChange("candlestick");
          break;
        case "2":
          e.preventDefault();
          if (chartType !== "line") onChartTypeChange("line");
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [controlBus, phase, chartType, onChartTypeChange, onFocusSearch]);
}
