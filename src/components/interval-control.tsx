"use client";

import type { ChartInterval } from "@/lib/chart-types";
import { INTERVALS } from "@/lib/chart-constants";

interface IntervalControlProps {
  interval: ChartInterval;
  onIntervalChange: (interval: ChartInterval) => void;
}

export function IntervalControl({
  interval,
  onIntervalChange,
}: IntervalControlProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center rounded-lg bg-muted p-1 border border-border">
        {INTERVALS.map((iv) => (
          <button
            key={iv.value}
            onClick={() => onIntervalChange(iv.value)}
            className={`control-bounce h-7 rounded-md px-3 py-1 text-xs transition-all ${
              interval === iv.value
                ? "bg-background text-foreground shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {iv.label}
          </button>
        ))}
      </div>
    </div>
  );
}
