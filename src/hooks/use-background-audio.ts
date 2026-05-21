"use client";

import { useRef, useEffect } from "react";
import type { ControlBus } from "@/lib/control-bus";

interface UseBackgroundAudioOptions {
  phase: string;
  memesEnabled: boolean;
  speed: number;
  chartKey: number;
  controlBus: ControlBus;
}

export function useBackgroundAudio({ phase, memesEnabled, speed, chartKey, controlBus }: UseBackgroundAudioOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasPlayedAudioRef = useRef(false);

  // Reset on chart key change
  useEffect(() => {
    hasPlayedAudioRef.current = false;
  }, [chartKey]);

  // Initialize audio element
  useEffect(() => {
    if (typeof window !== "undefined") {
      audioRef.current = new Audio('/audio/audio.mp3');
      audioRef.current.loop = true;
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };
  }, []);

  // Reset on control bus reset
  useEffect(() => {
    return controlBus.on("reset", () => {
      hasPlayedAudioRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    });
  }, [controlBus]);

  // Sync playback rate with speed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = Math.max(0.25, Math.min(speed, 4.0));
    }
  }, [speed]);

  // Play/pause based on phase and memesEnabled
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (phase === "animating" && memesEnabled) {
      if (!hasPlayedAudioRef.current) {
        hasPlayedAudioRef.current = true;
        audio.currentTime = 0;
      }

      audio.volume = 0.6;
      if (audio.paused) {
        audio.play().catch((err) => console.log("Audio playback prevented:", err));
      }
    } else {
      if (!audio.paused) audio.pause();
    }
  }, [phase, memesEnabled]);
}
