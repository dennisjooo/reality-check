"use client";

import { useRef } from "react";
import type { AnimPhase } from "@/lib/chart-types";

interface SpeedControlProps {
  speed: number;
  onSpeedChange: (speed: number) => void;
  speedRef: React.MutableRefObject<number>;
  phase: AnimPhase;
  lastMilestoneRef: React.MutableRefObject<number>;
  onTargetMilestoneSet: (milestone: number | undefined) => void;
  onChartKeyBump: () => void;
  onPhaseChange: (phase: AnimPhase) => void;
}

export function SpeedControl({
  speed,
  onSpeedChange,
  speedRef,
  phase,
  lastMilestoneRef,
  onTargetMilestoneSet,
  onChartKeyBump,
  onPhaseChange,
}: SpeedControlProps) {
  const speedBeforeDragRef = useRef(speed);

  return (
    <div className="flex items-center gap-3">
      <label
        htmlFor="speed-slider"
        className="text-sm font-medium text-muted-foreground whitespace-nowrap"
      >
        Speed
      </label>
      <div className="flex items-center gap-2">
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
          className="w-24 sm:w-32 h-1.5 accent-primary cursor-pointer"
        />
        <span className="text-sm text-muted-foreground tabular-nums w-6">
          {speed}s
        </span>
      </div>
    </div>
  );
}
