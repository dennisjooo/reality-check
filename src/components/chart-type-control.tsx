"use client";

import { useState, useRef, useEffect } from "react";
import { Palette } from "lucide-react";
import type { ChartType } from "@/lib/chart-types";
import { LINE_COLORS } from "@/lib/chart-constants";

interface ChartTypeControlProps {
  chartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
  lineColor: string;
  onLineColorChange: (color: string) => void;
}

export function ChartTypeControl({
  chartType,
  onChartTypeChange,
  lineColor,
  onLineColorChange,
}: ChartTypeControlProps) {
  const [showColors, setShowColors] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColors(false);
      }
    }
    if (showColors) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showColors]);

  return (
    <div className="flex items-center gap-2 relative" ref={colorPickerRef}>
      <div className="inline-flex items-center rounded-lg bg-muted p-1 border border-border">
        <button
          onClick={() => onChartTypeChange("candlestick")}
          className={`control-bounce h-7 rounded-md px-3 py-1 text-xs transition-all ${
            chartType === "candlestick"
              ? "bg-background text-foreground shadow-sm font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Candles
        </button>
        <button
          onClick={() => onChartTypeChange("line")}
          className={`control-bounce h-7 rounded-md px-3 py-1 text-xs transition-all ${
            chartType === "line"
              ? "bg-background text-foreground shadow-sm font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Line
        </button>
      </div>

      {/* Floating Popover Color Picker */}
      {chartType === "line" && (
        <>
          <button
            onClick={() => setShowColors(!showColors)}
            title="Toggle line colors"
            className="control-bounce ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <Palette className="w-4 h-4 text-foreground" style={{ color: lineColor }} />
          </button>

          {showColors && (
            <div className="absolute top-full right-0 m-2 p-2 bg-card border border-white/[0.08] rounded-xl shadow-[0_18px_42px_-24px_rgba(0,0,0,0.75)] z-50 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-1.5">
                {LINE_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => {
                      onLineColorChange(c.value);
                      setShowColors(false);
                    }}
                    title={c.name}
                    className={`w-6 h-6 rounded-full transition-all ring-2 ring-offset-2 ring-offset-popover ${
                      lineColor === c.value
                        ? "ring-foreground scale-110"
                        : "ring-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
