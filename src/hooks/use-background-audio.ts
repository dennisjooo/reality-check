"use client";

import { useRef, useEffect } from "react";
import type { ControlBus } from "@/lib/control-bus";
import type { PriceSnapshot } from "@/lib/chart-types";
import { audioPlaybackRate } from "@/lib/chart-constants";

interface UseBackgroundAudioOptions {
  phase: string;
  memesEnabled: boolean;
  speed: number;
  chartKey: number;
  controlBus: ControlBus;
  priceSnapshot: PriceSnapshot | null;
  volume: number;
}

export function useBackgroundAudio({
  phase,
  memesEnabled,
  speed,
  chartKey,
  controlBus,
  priceSnapshot,
  volume,
}: UseBackgroundAudioOptions) {
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
      audioRef.current.playbackRate = audioPlaybackRate(speed);
    }
  }, [speed]);

  // Play/pause and volume based on phase, memesEnabled, volume, and progress
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (phase === "animating" && memesEnabled) {
      if (!hasPlayedAudioRef.current) {
        hasPlayedAudioRef.current = true;
        audio.currentTime = 0;
      }

      let progress = 0;
      if (priceSnapshot && priceSnapshot.totalPoints && priceSnapshot.totalPoints > 0) {
        progress = priceSnapshot.points / priceSnapshot.totalPoints;
      }
      progress = Math.min(1, Math.max(0, progress));

      // Base volume scales from 0.5 to 1.0 based on progress
      const baseVol = 0.5 + 0.5 * progress;
      audio.volume = Math.max(0, Math.min(1, baseVol * volume));

      if (audio.paused) {
        audio.play().catch((err) => console.log("Audio playback prevented:", err));
      }
    } else {
      if (!audio.paused) audio.pause();
    }
  }, [phase, memesEnabled, priceSnapshot, volume]);
}
