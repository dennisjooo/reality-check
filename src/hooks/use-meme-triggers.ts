"use client";

import { useEffect, useRef, useCallback } from "react";
import type { PriceSnapshot, LocalExtreme } from "@/lib/chart-types";
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

/**
 * Pick an anchor from localPeaks/localTroughs, cycling through segments
 * to spread memes across the entire visible range (including older data).
 */
function pickLocalAnchor(
  extremes: LocalExtreme[] | undefined,
  counter: number,
  leftBuffer: number
): { time: number; price: number; index: number } | null {
  if (!extremes || extremes.length === 0) return null;
  const idx = counter % extremes.length;
  const e = extremes[idx];
  if (e.index < leftBuffer || !e.time) return null;
  return { time: e.time, price: e.price, index: e.index };
}

const MAX_CATCHUP_PER_FRAME = 3;
const CATCHUP_STAGGER_MS = 350;

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
  const pendingTimersRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const spawnCounterRef = useRef(0);

  const resetTriggers = useCallback(() => {
    nextPosMilestoneRef.current = 1;
    nextNegMilestoneRef.current = -1;
    triggeredTimesRef.current.clear();
    stepRef.current = 1;
    spawnCounterRef.current = 0;
    for (const t of pendingTimersRef.current) clearTimeout(t);
    pendingTimersRef.current.clear();
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
    const leftBuffer = leftEdge + priceSnapshot.points * 0.05;

    if (percentChange >= nextPosMilestoneRef.current) {
      const milestonesToCover = Math.floor(
        (percentChange - nextPosMilestoneRef.current) / step
      ) + 1;
      const spawns = Math.min(milestonesToCover, MAX_CATCHUP_PER_FRAME);

      nextPosMilestoneRef.current =
        Math.floor(percentChange / step) * step + step;

      for (let i = 0; i < spawns; i++) {
        let targetTime: number | undefined;
        let targetPrice: number;
        let targetIdx: number;

        if (i === 0) {
          targetIdx = priceSnapshot.peakIndex ?? 0;
          targetTime = priceSnapshot.peakTime;
          targetPrice = priceSnapshot.peakPrice ?? lastClose;
        } else {
          const local = pickLocalAnchor(
            priceSnapshot.localPeaks,
            spawnCounterRef.current + i,
            leftBuffer
          );
          if (local) {
            targetIdx = local.index;
            targetTime = local.time;
            targetPrice = local.price;
          } else {
            targetIdx = priceSnapshot.lastLogicalIndex ?? 0;
            targetTime = priceSnapshot.lastTime;
            targetPrice = lastClose;
          }
        }

        if (
          !targetTime ||
          targetIdx < leftBuffer ||
          triggeredTimesRef.current.has(targetTime)
        ) {
          continue;
        }

        triggeredTimesRef.current.add(targetTime);
        spawnCounterRef.current++;

        if (i === 0) {
          if (isAnchorTooClose(targetTime, targetPrice)) continue;
          playAudio("positive");
          const files = memeFilesRef.current.positive;
          const filename =
            files.length > 0
              ? files[Math.floor(Math.random() * files.length)]
              : "stonks.webp";
          spawnMeme("positive", targetTime, targetPrice, filename);
        } else {
          const delay = i * CATCHUP_STAGGER_MS;
          const capturedTime = targetTime;
          const capturedPrice = targetPrice;
          const timer = setTimeout(() => {
            pendingTimersRef.current.delete(timer);
            if (isAnchorTooClose(capturedTime, capturedPrice)) return;
            playAudio("positive");
            const files = memeFilesRef.current.positive;
            const filename =
              files.length > 0
                ? files[Math.floor(Math.random() * files.length)]
                : "stonks.webp";
            spawnMeme("positive", capturedTime, capturedPrice, filename);
          }, delay);
          pendingTimersRef.current.add(timer);
        }
      }
    } else if (percentChange <= nextNegMilestoneRef.current) {
      const milestonesToCover = Math.floor(
        (nextNegMilestoneRef.current - percentChange) / step
      ) + 1;
      const spawns = Math.min(milestonesToCover, MAX_CATCHUP_PER_FRAME);

      nextNegMilestoneRef.current =
        Math.ceil(percentChange / step) * step - step;

      for (let i = 0; i < spawns; i++) {
        let targetTime: number | undefined;
        let targetPrice: number;
        let targetIdx: number;

        if (i === 0) {
          targetIdx = priceSnapshot.troughIndex ?? 0;
          targetTime = priceSnapshot.troughTime;
          targetPrice = priceSnapshot.troughPrice ?? lastClose;
        } else {
          const local = pickLocalAnchor(
            priceSnapshot.localTroughs,
            spawnCounterRef.current + i,
            leftBuffer
          );
          if (local) {
            targetIdx = local.index;
            targetTime = local.time;
            targetPrice = local.price;
          } else {
            targetIdx = priceSnapshot.lastLogicalIndex ?? 0;
            targetTime = priceSnapshot.lastTime;
            targetPrice = lastClose;
          }
        }

        if (
          !targetTime ||
          targetIdx < leftBuffer ||
          triggeredTimesRef.current.has(targetTime)
        ) {
          continue;
        }

        triggeredTimesRef.current.add(targetTime);
        spawnCounterRef.current++;

        if (i === 0) {
          if (isAnchorTooClose(targetTime, targetPrice)) continue;
          playAudio("negative");
          const files = memeFilesRef.current.negative;
          const filename =
            files.length > 0
              ? files[Math.floor(Math.random() * files.length)]
              : "wojak_mcdonalds.webp";
          spawnMeme("negative", targetTime, targetPrice, filename);
        } else {
          const delay = i * CATCHUP_STAGGER_MS;
          const capturedTime = targetTime;
          const capturedPrice = targetPrice;
          const timer = setTimeout(() => {
            pendingTimersRef.current.delete(timer);
            if (isAnchorTooClose(capturedTime, capturedPrice)) return;
            playAudio("negative");
            const files = memeFilesRef.current.negative;
            const filename =
              files.length > 0
                ? files[Math.floor(Math.random() * files.length)]
                : "wojak_mcdonalds.webp";
            spawnMeme("negative", capturedTime, capturedPrice, filename);
          }, delay);
          pendingTimersRef.current.add(timer);
        }
      }
    }
  }, [isAnchorTooClose, phase, priceSnapshot, spawnMeme, playAudio, memeFilesRef]);

  return { resetTriggers };
}
