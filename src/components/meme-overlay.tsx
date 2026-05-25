"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { PriceSnapshot } from "@/lib/chart-types";
import type { StickyMeme } from "@/lib/meme";
import { isAnchorTooClose as checkAnchorTooClose } from "@/lib/meme";
import { useMemeAudio } from "@/hooks/use-meme-audio";
import { useMemeTriggers } from "@/hooks/use-meme-triggers";
import { MemeLightbox, MemeRenderer, useMemeLifecycle } from "@/components/meme";

interface MemeOverlayProps {
  priceSnapshot: PriceSnapshot | null;
  phase: string;
  speed: number;
  volume: number;
}

export function MemeOverlay({ priceSnapshot, phase, speed, volume }: MemeOverlayProps) {
  const [zoomedMeme, setZoomedMeme] = useState<StickyMeme | null>(null);
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const prevPhaseRef = useRef(phase);
  const prevPointsRef = useRef<number | null>(null);
  const memeFilesRef = useRef<{
    positive: string[];
    negative: string[];
    positiveAudio: string[];
    negativeAudio: string[];
  }>({ positive: [], negative: [], positiveAudio: [], negativeAudio: [] });

  const { memes, loadedMemeIds, spawnMeme, handleImageLoad, clearAll } = useMemeLifecycle();
  const { playAudio, resetAudio, isReadyForNext } = useMemeAudio(phase, memeFilesRef, volume, speed);

  const isAnchorTooClose = useCallback(
    (targetTime: number, targetPrice: number) => {
      if (!priceSnapshot?.getCoordinate) return false;
      return checkAnchorTooClose(
        targetTime,
        targetPrice,
        memes,
        priceSnapshot.getCoordinate
      );
    },
    [memes, priceSnapshot]
  );

  const { resetTriggers } = useMemeTriggers(
    priceSnapshot,
    phase,
    memes,
    spawnMeme,
    playAudio,
    isAnchorTooClose,
    memeFilesRef,
    isReadyForNext,
    speed
  );

  const resetMemeState = useCallback(() => {
    clearAll();
    setZoomedMeme(null);
    resetAudio();
    resetTriggers();
  }, [clearAll, resetAudio, resetTriggers]);

  useEffect(() => {
    const resetTimer = setTimeout(() => {
      resetMemeState();
    }, 0);
    fetch("/api/memes")
      .then(res => res.json())
      .then(data => {
        memeFilesRef.current = data;
      })
      .catch(console.error);

    return () => {
      clearTimeout(resetTimer);
      resetMemeState();
    };
  }, [resetMemeState]);

  useEffect(() => {
    const overlayEl = overlayRef.current;
    if (!overlayEl) return;

    const syncOverlaySize = () => {
      setOverlaySize({
        width: overlayEl.clientWidth,
        height: overlayEl.clientHeight,
      });
    };

    syncOverlaySize();
    const resizeObserver = new ResizeObserver(syncOverlaySize);
    resizeObserver.observe(overlayEl);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    const isFreshStart =
      phase === "idle" ||
      (phase === "animating" && (prev === "complete" || prev === "idle"));

    if (isFreshStart) {
      resetMemeState();
      prevPointsRef.current = null;
    }
  }, [phase, resetMemeState]);

  useEffect(() => {
    const currentPoints = priceSnapshot?.points;
    if (!currentPoints) return;

    const prevPoints = prevPointsRef.current;
    if (prevPoints !== null && currentPoints < prevPoints - 3) {
      resetMemeState();
    }
    prevPointsRef.current = currentPoints;
  }, [priceSnapshot?.points, resetMemeState]);

  const handleMemeClick = useCallback((meme: StickyMeme) => {
    setZoomedMeme(meme);
  }, []);

  const closeLightbox = useCallback(() => {
    setZoomedMeme(null);
  }, []);

  return (
    <>
      <div
        ref={overlayRef}
        className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      >
        <MemeRenderer
          memes={memes}
          loadedMemeIds={loadedMemeIds}
          priceSnapshot={priceSnapshot}
          overlaySize={overlaySize}
          speed={speed}
          onMemeClick={handleMemeClick}
          onImageLoad={handleImageLoad}
        />
      </div>

      {zoomedMeme && (
        <MemeLightbox meme={zoomedMeme} onClose={closeLightbox} />
      )}
    </>
  );
}
