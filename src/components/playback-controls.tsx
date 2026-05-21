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
    <div className="flex items-center gap-1.5">
      {phase === "animating" && (
        <Button
          variant="destructive"
          size="icon"
          onClick={handlePause}
          title="Pause playback"
          className="control-bounce size-9 rounded-full"
        >
          <Pause className="size-4" />
        </Button>
      )}

      {(phase === "paused" || phase === "idle") && (
        <Button
          variant="default"
          size="icon"
          onClick={handleContinue}
          title={phase === "idle" ? "Start playback" : "Continue playback"}
          className="control-bounce size-9 rounded-full"
        >
          <Play className="size-4 translate-x-[1px]" />
        </Button>
      )}

      {phase !== "idle" && (
        <Button
          variant="secondary"
          size="icon"
          onClick={handleResetPlay}
          title="Reset to the beginning"
          className="control-bounce size-9 rounded-full"
        >
          <Square className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
