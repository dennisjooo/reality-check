"use client";

import { useRef } from "react";
import type { AnimPhase } from "@/lib/chart-types";
import {
  formatSpeed,
  sliderToSpeed,
  speedToSlider,
} from "@/lib/chart-constants";

interface SpeedControlProps {
  speed: number;
  onSpeedChange: (speed: number) => void;
  speedRef: React.MutableRefObject<number>;
  phase: AnimPhase;
  onChartKeyBump: () => void;
  onPhaseChange: (phase: AnimPhase) => void;
}

export function SpeedControl({
  speed,
  onSpeedChange,
  speedRef,
  phase,
  onChartKeyBump,
  onPhaseChange,
}: SpeedControlProps) {
  const speedBeforeDragRef = useRef(speed);
  const sliderPos = Math.round(speedToSlider(speed));

  return (
    <div className="flex items-center justify-between md:justify-start gap-3 w-full md:w-auto">
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
          min={0}
          max={100}
          step={1}
          value={sliderPos}
          onChange={(e) => {
            const newSpeed = sliderToSpeed(Number(e.target.value));
            onSpeedChange(newSpeed);
            speedRef.current = newSpeed;
          }}
          onPointerDown={() => {
            speedBeforeDragRef.current = speed;
          }}
          onPointerUp={() => {
            if (
              phase === "paused" &&
              speedRef.current !== speedBeforeDragRef.current
            ) {
              onChartKeyBump();
              onPhaseChange("animating");
            }
          }}
          className="w-24 sm:w-32 h-1.5 accent-primary cursor-pointer"
        />
        <span className="text-sm text-muted-foreground tabular-nums w-10">
          {formatSpeed(speed)}
        </span>
      </div>
    </div>
  );
}
