"use client";

import { useEffect, useRef, useCallback } from "react";
import type { PriceSnapshot, LocalExtreme } from "@/lib/chart-types";
import type { StickyMeme } from "@/lib/meme-geometry";

function computeStep(snapshot: PriceSnapshot): number {
  const { firstClose, high, low } = snapshot;
  if (!firstClose) return 3;
  const amplitude = ((high - low) / firstClose) * 100;
  if (amplitude > 200) return 1;
  if (amplitude > 100) return 1.5;
  if (amplitude > 50) return 2;
  return 3;
}

function pickNextAnchor(
  extremes: LocalExtreme[] | undefined,
  afterTime: number,
  leftBuffer: number
): LocalExtreme | null {
  if (!extremes || extremes.length === 0) return null;
  let best: LocalExtreme | null = null;
  for (const e of extremes) {
    if (e.index < leftBuffer || !e.time) continue;
    if (e.time <= afterTime) continue;
    if (!best || e.time < best.time) best = e;
  }
  return best;
}

interface QueuedMeme {
  type: "positive" | "negative";
  time: number;
  price: number;
  filename: string;
}

const QUEUE_POLL_MS = 150;
const MIN_MEME_COOLDOWN_MS = 600;
const MAX_QUEUE_SIZE = 2;

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
  isReadyForNext: () => boolean
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
      if (Date.now() - lastSpawnTimeRef.current < MIN_MEME_COOLDOWN_MS) return;

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

    const leftEdge =
      (priceSnapshot.lastLogicalIndex ?? 0) - priceSnapshot.points + 1;
    const leftBuffer = leftEdge + priceSnapshot.points * 0.05;

    if (percentChange >= nextPosMilestoneRef.current) {
      nextPosMilestoneRef.current =
        Math.floor(percentChange / step) * step + step;

      const local = pickNextAnchor(
        priceSnapshot.localPeaks,
        lastPosTimeRef.current,
        leftBuffer
      );

      const targetTime = local?.time ?? priceSnapshot.peakTime;
      const targetPrice = local?.price ?? (priceSnapshot.peakPrice ?? lastClose);
      const targetIdx = local?.index ?? (priceSnapshot.peakIndex ?? 0);

      if (
        !targetTime ||
        targetIdx < leftBuffer ||
        triggeredTimesRef.current.has(targetTime)
      ) {
        return;
      }

      triggeredTimesRef.current.add(targetTime);
      lastPosTimeRef.current = targetTime;

      const files = memeFilesRef.current.positive;
      const filename =
        files.length > 0
          ? files[Math.floor(Math.random() * files.length)]
          : "stonks.webp";

      queueRef.current.push({ type: "positive", time: targetTime, price: targetPrice, filename });
      if (queueRef.current.length > MAX_QUEUE_SIZE) queueRef.current.shift();
      processQueue();
    } else if (percentChange <= nextNegMilestoneRef.current) {
      nextNegMilestoneRef.current =
        Math.ceil(percentChange / step) * step - step;

      const local = pickNextAnchor(
        priceSnapshot.localTroughs,
        lastNegTimeRef.current,
        leftBuffer
      );

      const targetTime = local?.time ?? priceSnapshot.troughTime;
      const targetPrice = local?.price ?? (priceSnapshot.troughPrice ?? lastClose);
      const targetIdx = local?.index ?? (priceSnapshot.troughIndex ?? 0);

      if (
        !targetTime ||
        targetIdx < leftBuffer ||
        triggeredTimesRef.current.has(targetTime)
      ) {
        return;
      }

      triggeredTimesRef.current.add(targetTime);
      lastNegTimeRef.current = targetTime;

      const files = memeFilesRef.current.negative;
      const filename =
        files.length > 0
          ? files[Math.floor(Math.random() * files.length)]
          : "wojak_mcdonalds.webp";

      queueRef.current.push({ type: "negative", time: targetTime, price: targetPrice, filename });
      if (queueRef.current.length > MAX_QUEUE_SIZE) queueRef.current.shift();
      processQueue();
    }
  }, [phase, priceSnapshot, memeFilesRef, processQueue]);

  return { resetTriggers };
}
