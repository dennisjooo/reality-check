"use client";

import { useEffect, useRef, useCallback } from "react";
import type { PriceSnapshot, LocalExtreme } from "@/lib/chart-types";
import type { StickyMeme } from "@/lib/meme";
import {
  computeStep,
  pickNextAnchor,
  pickRandomNonRepeating,
  getDynamicCooldownMs,
  pickMagneticAnchor,
  MEME_CONSTANTS,
} from "@/lib/meme/meme-trigger-math";
import {
  memeRecentWindowStart,
  memeSpawnCooldownMs,
} from "@/lib/chart-constants";

const { QUEUE_POLL_MS, MAX_QUEUE_SIZE } = MEME_CONSTANTS;

interface QueuedMeme {
  type: "positive" | "negative";
  time: number;
  price: number;
  filename: string;
}

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
  }>,
  isReadyForNext: () => boolean,
  speed: number
) {
  const nextPosMilestoneRef = useRef<number>(3);
  const nextNegMilestoneRef = useRef<number>(-3);
  const triggeredTimesRef = useRef<Set<number>>(new Set());
  const lastPosTimeRef = useRef<number>(0);
  const lastNegTimeRef = useRef<number>(0);
  const queueRef = useRef<QueuedMeme[]>([]);
  const processingRef = useRef(false);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpawnTimeRef = useRef<number>(0);
  const dynamicCooldownMsRef = useRef<number>(600);
  const prevPercentRef = useRef<number>(0);
  const lastImageFileRef = useRef<{
    positive: string | null;
    negative: string | null;
  }>({ positive: null, negative: null });
  const speedRef = useRef(speed);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const playAudioRef = useRef(playAudio);
  useEffect(() => {
    playAudioRef.current = playAudio;
  }, [playAudio]);

  const stopProcessing = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    processingRef.current = false;
    queueRef.current = [];
  }, []);

  const processQueue = useCallback(() => {
    if (processingRef.current) return;
    processingRef.current = true;

    pollTimerRef.current = setInterval(() => {
      if (queueRef.current.length === 0) {
        stopProcessing();
        return;
      }
      if (!isReadyForNext()) return;
      const cooldown = memeSpawnCooldownMs(
        dynamicCooldownMsRef.current,
        speedRef.current
      );
      if (Date.now() - lastSpawnTimeRef.current < cooldown) return;

      const item = queueRef.current.shift()!;
      if (isAnchorTooClose(item.time, item.price)) return;

      playAudioRef.current(item.type);
      spawnMeme(item.type, item.time, item.price, item.filename);
      lastSpawnTimeRef.current = Date.now();
    }, QUEUE_POLL_MS);
  }, [isReadyForNext, isAnchorTooClose, spawnMeme, stopProcessing]);

  const resetTriggers = useCallback(() => {
    nextPosMilestoneRef.current = 3;
    nextNegMilestoneRef.current = -3;
    triggeredTimesRef.current.clear();
    lastPosTimeRef.current = 0;
    lastNegTimeRef.current = 0;
    lastSpawnTimeRef.current = 0;
    dynamicCooldownMsRef.current = 600;
    prevPercentRef.current = 0;
    lastImageFileRef.current = { positive: null, negative: null };
    stopProcessing();
  }, [stopProcessing]);

  // Drop queue when animation ends
  useEffect(() => {
    if (phase !== "animating") {
      stopProcessing();
    }
  }, [phase, stopProcessing]);

  // Milestone detection — enqueue rather than immediately spawn
  useEffect(() => {
    if (!priceSnapshot || phase !== "animating") return;

    const { firstClose, lastClose, points } = priceSnapshot;
    if (!firstClose || !points || points < 30) return;

    const step = computeStep(priceSnapshot);
    const percentChange = ((lastClose - firstClose) / firstClose) * 100;
    dynamicCooldownMsRef.current = getDynamicCooldownMs(
      priceSnapshot,
      percentChange,
      prevPercentRef.current
    );
    prevPercentRef.current = percentChange;

    const leftEdge =
      (priceSnapshot.lastLogicalIndex ?? 0) - priceSnapshot.points + 1;
    const recentWindowStartFrac = memeRecentWindowStart(speed);
    const recentWindowMinIndex =
      leftEdge + priceSnapshot.points * recentWindowStartFrac;
    const minAnchorIndex = Math.max(
      leftEdge + priceSnapshot.points * 0.05,
      recentWindowMinIndex
    );

    if (percentChange >= nextPosMilestoneRef.current) {
      nextPosMilestoneRef.current =
        Math.floor(percentChange / step) * step + step;

      const local = pickNextAnchor(
        priceSnapshot.localPeaks,
        lastPosTimeRef.current,
        minAnchorIndex
      );
      const fallbackPeak: LocalExtreme | null =
        local ??
        (priceSnapshot.peakTime && priceSnapshot.peakPrice != null
          ? {
              time: priceSnapshot.peakTime,
              price: priceSnapshot.peakPrice,
              index: priceSnapshot.peakIndex ?? 0,
            }
          : null);
      const magneticPeak = pickMagneticAnchor(
        priceSnapshot.localPeaks,
        fallbackPeak,
        minAnchorIndex,
        priceSnapshot.points
      );
      const targetTime = magneticPeak?.time;
      const targetPrice = magneticPeak?.price ?? lastClose;
      const targetIdx = magneticPeak?.index ?? 0;

      if (
        !targetTime ||
        targetIdx < minAnchorIndex ||
        triggeredTimesRef.current.has(targetTime)
      ) {
        return;
      }

      triggeredTimesRef.current.add(targetTime);
      lastPosTimeRef.current = targetTime;

      const files = memeFilesRef.current.positive;
      const filename = pickRandomNonRepeating(
        files,
        lastImageFileRef.current.positive
      ) ?? "stonks.webp";
      lastImageFileRef.current.positive = filename;

      queueRef.current.push({ type: "positive", time: targetTime, price: targetPrice, filename });
      if (queueRef.current.length > MAX_QUEUE_SIZE) queueRef.current.shift();
      processQueue();
    } else if (percentChange <= nextNegMilestoneRef.current) {
      nextNegMilestoneRef.current =
        Math.ceil(percentChange / step) * step - step;

      const local = pickNextAnchor(
        priceSnapshot.localTroughs,
        lastNegTimeRef.current,
        minAnchorIndex
      );
      const fallbackTrough: LocalExtreme | null =
        local ??
        (priceSnapshot.troughTime && priceSnapshot.troughPrice != null
          ? {
              time: priceSnapshot.troughTime,
              price: priceSnapshot.troughPrice,
              index: priceSnapshot.troughIndex ?? 0,
            }
          : null);
      const magneticTrough = pickMagneticAnchor(
        priceSnapshot.localTroughs,
        fallbackTrough,
        minAnchorIndex,
        priceSnapshot.points
      );
      const targetTime = magneticTrough?.time;
      const targetPrice = magneticTrough?.price ?? lastClose;
      const targetIdx = magneticTrough?.index ?? 0;

      if (
        !targetTime ||
        targetIdx < minAnchorIndex ||
        triggeredTimesRef.current.has(targetTime)
      ) {
        return;
      }

      triggeredTimesRef.current.add(targetTime);
      lastNegTimeRef.current = targetTime;

      const files = memeFilesRef.current.negative;
      const filename = pickRandomNonRepeating(
        files,
        lastImageFileRef.current.negative
      ) ?? "wojak_mcdonalds.webp";
      lastImageFileRef.current.negative = filename;

      queueRef.current.push({ type: "negative", time: targetTime, price: targetPrice, filename });
      if (queueRef.current.length > MAX_QUEUE_SIZE) queueRef.current.shift();
      processQueue();
    }
  }, [phase, priceSnapshot, memeFilesRef, processQueue, speed]);

  return { resetTriggers };
}
