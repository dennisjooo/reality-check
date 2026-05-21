"use client";

import { useEffect, useRef, useCallback } from "react";
import type { PriceSnapshot } from "@/lib/chart-types";
import type { StickyMeme } from "@/lib/meme-geometry";

export function useMemeTriggers(
  priceSnapshot: PriceSnapshot | null,
  phase: string,
  memes: StickyMeme[],
  spawnMeme: (
    type: "positive" | "negative",
    targetTime: number,
    targetPrice: number,
    filename: string
  ) => void,
  playAudio: (type: "positive" | "negative") => void,
  isAnchorTooClose: (targetTime: number, targetPrice: number) => boolean,
  memeFilesRef: React.MutableRefObject<{
    positive: string[];
    negative: string[];
    positiveAudio: string[];
    negativeAudio: string[];
  }>
) {
  const nextPosMilestoneRef = useRef<number>(3);
  const nextNegMilestoneRef = useRef<number>(-3);
  const triggeredTimesRef = useRef<Set<number>>(new Set());

  const resetTriggers = useCallback(() => {
    nextPosMilestoneRef.current = 3;
    nextNegMilestoneRef.current = -3;
    triggeredTimesRef.current.clear();
  }, []);

  // Milestone-based trigger logic
  useEffect(() => {
    if (!priceSnapshot || phase !== "animating") return;

    const { firstClose, lastClose, points } = priceSnapshot;
    if (!firstClose || !points || points < 30) return;

    const percentChange = ((lastClose - firstClose) / firstClose) * 100;

    // Skip memes anchored to the leftmost 20% of visible range — that data
    // was just revealed by the zoom-out and feels "not yet traversed".
    const leftEdge =
      (priceSnapshot.lastLogicalIndex ?? 0) - priceSnapshot.points + 1;
    const leftBuffer = leftEdge + priceSnapshot.points * 0.2;

    if (percentChange >= nextPosMilestoneRef.current) {
      const targetIdx = priceSnapshot.peakIndex ?? 0;
      const targetTime = priceSnapshot.peakTime;
      const targetPrice =
        priceSnapshot.peakPrice ?? priceSnapshot.lastClose;
      nextPosMilestoneRef.current =
        Math.floor(percentChange / 3) * 3 + 3;

      if (
        targetTime &&
        targetIdx >= leftBuffer &&
        !triggeredTimesRef.current.has(targetTime)
      ) {
        if (isAnchorTooClose(targetTime, targetPrice)) {
          // Mark this anchor as handled so future milestones don't keep spawning
          // at nearly the same chart point.
          triggeredTimesRef.current.add(targetTime);
          return;
        }
        triggeredTimesRef.current.add(targetTime);
        playAudio("positive");
        const files = memeFilesRef.current.positive;
        const filename =
          files.length > 0
            ? files[Math.floor(Math.random() * files.length)]
            : "stonks.webp";
        spawnMeme("positive", targetTime, targetPrice, filename);
      }
    } else if (percentChange <= nextNegMilestoneRef.current) {
      const targetIdx = priceSnapshot.troughIndex ?? 0;
      const targetTime = priceSnapshot.troughTime;
      const targetPrice =
        priceSnapshot.troughPrice ?? priceSnapshot.lastClose;
      nextNegMilestoneRef.current =
        Math.ceil(percentChange / 3) * 3 - 3;

      if (
        targetTime &&
        targetIdx >= leftBuffer &&
        !triggeredTimesRef.current.has(targetTime)
      ) {
        if (isAnchorTooClose(targetTime, targetPrice)) {
          triggeredTimesRef.current.add(targetTime);
          return;
        }
        triggeredTimesRef.current.add(targetTime);
        playAudio("negative");
        const files = memeFilesRef.current.negative;
        const filename =
          files.length > 0
            ? files[Math.floor(Math.random() * files.length)]
            : "wojak_mcdonalds.webp";
        spawnMeme("negative", targetTime, targetPrice, filename);
      }
    }
  }, [isAnchorTooClose, phase, priceSnapshot, spawnMeme]);

  return { resetTriggers };
}
