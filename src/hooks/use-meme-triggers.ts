"use client";

import { useEffect, useRef, useCallback } from "react";
import type { PriceSnapshot } from "@/lib/chart-types";
import type { StickyMeme } from "@/lib/meme-geometry";

/**
 * Compute a dynamic milestone step based on visible data amplitude.
 * High-volatility data (BTC, meme stocks) gets a smaller step so memes
 * fire more frequently. Calm data keeps the default 1% step.
 */
function computeStep(snapshot: PriceSnapshot): number {
  const { firstClose, high, low } = snapshot;
  if (!firstClose) return 1;
  const amplitude = ((high - low) / firstClose) * 100;
  if (amplitude > 100) return 0.25;
  if (amplitude > 50) return 0.5;
  if (amplitude > 20) return 0.75;
  return 1;
}

const MAX_CATCHUP_PER_FRAME = 3;

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
  const nextPosMilestoneRef = useRef<number>(1);
  const nextNegMilestoneRef = useRef<number>(-1);
  const triggeredTimesRef = useRef<Set<number>>(new Set());
  const stepRef = useRef<number>(1);

  const resetTriggers = useCallback(() => {
    nextPosMilestoneRef.current = 1;
    nextNegMilestoneRef.current = -1;
    triggeredTimesRef.current.clear();
    stepRef.current = 1;
  }, []);

  useEffect(() => {
    if (!priceSnapshot || phase !== "animating") return;

    const { firstClose, lastClose, points } = priceSnapshot;
    if (!firstClose || !points || points < 30) return;

    const step = computeStep(priceSnapshot);
    stepRef.current = step;

    const percentChange = ((lastClose - firstClose) / firstClose) * 100;

    const leftEdge =
      (priceSnapshot.lastLogicalIndex ?? 0) - priceSnapshot.points + 1;
    const leftBuffer = leftEdge + priceSnapshot.points * 0.2;

    if (percentChange >= nextPosMilestoneRef.current) {
      const milestonesToCover = Math.floor(
        (percentChange - nextPosMilestoneRef.current) / step
      ) + 1;
      const spawns = Math.min(milestonesToCover, MAX_CATCHUP_PER_FRAME);

      nextPosMilestoneRef.current =
        Math.floor(percentChange / step) * step + step;

      for (let i = 0; i < spawns; i++) {
        const usePeak = i === 0;
        const targetIdx = usePeak
          ? (priceSnapshot.peakIndex ?? 0)
          : (priceSnapshot.lastLogicalIndex ?? 0);
        const targetTime = usePeak
          ? priceSnapshot.peakTime
          : priceSnapshot.lastTime;
        const targetPrice = usePeak
          ? (priceSnapshot.peakPrice ?? lastClose)
          : lastClose;

        if (
          !targetTime ||
          targetIdx < leftBuffer ||
          triggeredTimesRef.current.has(targetTime + i)
        ) {
          continue;
        }

        if (isAnchorTooClose(targetTime, targetPrice)) {
          triggeredTimesRef.current.add(targetTime + i);
          continue;
        }

        triggeredTimesRef.current.add(targetTime + i);
        playAudio("positive");
        const files = memeFilesRef.current.positive;
        const filename =
          files.length > 0
            ? files[Math.floor(Math.random() * files.length)]
            : "stonks.webp";
        spawnMeme("positive", targetTime, targetPrice, filename);
      }
    } else if (percentChange <= nextNegMilestoneRef.current) {
      const milestonesToCover = Math.floor(
        (nextNegMilestoneRef.current - percentChange) / step
      ) + 1;
      const spawns = Math.min(milestonesToCover, MAX_CATCHUP_PER_FRAME);

      nextNegMilestoneRef.current =
        Math.ceil(percentChange / step) * step - step;

      for (let i = 0; i < spawns; i++) {
        const useTrough = i === 0;
        const targetIdx = useTrough
          ? (priceSnapshot.troughIndex ?? 0)
          : (priceSnapshot.lastLogicalIndex ?? 0);
        const targetTime = useTrough
          ? priceSnapshot.troughTime
          : priceSnapshot.lastTime;
        const targetPrice = useTrough
          ? (priceSnapshot.troughPrice ?? lastClose)
          : lastClose;

        if (
          !targetTime ||
          targetIdx < leftBuffer ||
          triggeredTimesRef.current.has(targetTime + i)
        ) {
          continue;
        }

        if (isAnchorTooClose(targetTime, targetPrice)) {
          triggeredTimesRef.current.add(targetTime + i);
          continue;
        }

        triggeredTimesRef.current.add(targetTime + i);
        playAudio("negative");
        const files = memeFilesRef.current.negative;
        const filename =
          files.length > 0
            ? files[Math.floor(Math.random() * files.length)]
            : "wojak_mcdonalds.webp";
        spawnMeme("negative", targetTime, targetPrice, filename);
      }
    }
  }, [isAnchorTooClose, phase, priceSnapshot, spawnMeme, playAudio, memeFilesRef]);

  return { resetTriggers };
}
