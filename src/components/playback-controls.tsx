"use client";

import { Play, Pause, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnimPhase } from "@/lib/chart-types";
import { ControlBus } from "@/lib/control-bus";

interface PlaybackControlsProps {
  phase: AnimPhase;
  controlBus: ControlBus;
  onPhaseChange: (phase: AnimPhase) => void;
}

export function PlaybackControls({
  phase,
  controlBus,
  onPhaseChange,
}: PlaybackControlsProps) {
  const handleContinue = () => {
    controlBus.continue();
    onPhaseChange("animating");
  };

  const handlePause = () => {
    controlBus.pause();
    onPhaseChange("paused");
  };

  const handleResetPlay = () => {
    controlBus.reset();
    onPhaseChange("animating");
  };

  return (
    <div className="flex items-center gap-2 self-start sm:self-auto w-full sm:w-auto overflow-x-auto overflow-y-hidden pb-1 sm:pb-0">
      {phase === "animating" && (
        <Button
          variant="destructive"
          size="sm"
          onClick={handlePause}
          title="Pause"
          className="h-9 px-4 flex-1 sm:flex-none"
        >
          <Pause className="size-3.5 mr-1.5" />
          Pause
        </Button>
      )}

      {(phase === "paused" || phase === "idle") && (
        <Button
          variant="default"
          size="sm"
          onClick={handleContinue}
          title={phase === "idle" ? "Start playback" : "Continue playback"}
          className="h-9 px-4 flex-1 sm:flex-none"
        >
          <Play className="size-3.5 mr-1.5" />
          {phase === "idle" ? "Start" : "Continue"}
        </Button>
      )}

      {phase !== "idle" && (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleResetPlay}
          title="Reset to the beginning"
          className="h-9 px-4 flex-1 sm:flex-none"
        >
          <Square className="size-3.5 mr-1.5" />
          Restart
        </Button>
      )}
    </div>
  );
}
