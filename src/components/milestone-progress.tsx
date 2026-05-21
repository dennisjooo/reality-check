"use client";

import type { AnimPhase } from "@/lib/chart-types";

interface MilestoneProgressProps {
  progress: number;
  phase: AnimPhase;
  lineColor: string;
}

export function MilestoneProgress({
  progress,
  phase,
  lineColor,
}: MilestoneProgressProps) {
  const percent = phase === "complete" ? 100 : Math.min(100, Math.max(0, progress * 100));

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-5 pt-4">
      <div className="relative h-[3px] overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-[width] duration-150 ease-linear"
          style={{
            width: `${percent}%`,
            background: `linear-gradient(90deg, ${lineColor}66 0%, ${lineColor} 100%)`,
          }}
        />
      </div>
    </div>
  );
}
