"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import type { PriceSnapshot } from "@/lib/chart-types";
import type { StickyMeme, RenderedMeme } from "@/lib/meme-geometry";
import {
  getMemeGeometry as calcMemeGeometry,
  isAnchorTooClose as checkAnchorTooClose,
} from "@/lib/meme-geometry";
import { useMemeAudio } from "@/hooks/use-meme-audio";
import { useMemeTriggers } from "@/hooks/use-meme-triggers";

interface MemeOverlayProps {
  priceSnapshot: PriceSnapshot | null;
  phase: string;
  speed: number;
}

export function MemeOverlay({ priceSnapshot, phase }: MemeOverlayProps) {
  const MEME_LIFETIME_MS = 1800;
  const [memes, setMemes] = useState<StickyMeme[]>([]);
  const [zoomedMeme, setZoomedMeme] = useState<StickyMeme | null>(null);
  const memeLifetimeTimersRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const prevPhaseRef = useRef(phase);
  const prevPointsRef = useRef<number | null>(null);
  const memeFilesRef = useRef<{
    positive: string[];
    negative: string[];
    positiveAudio: string[];
    negativeAudio: string[];
  }>({ positive: [], negative: [], positiveAudio: [], negativeAudio: [] });

  const { playAudio, resetAudio } = useMemeAudio(phase, memeFilesRef);

  const spawnMeme = useCallback(
    (
      type: "positive" | "negative",
      targetTime: number,
      targetPrice: number,
      filename: string
    ) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const newMeme: StickyMeme = {
        type,
        id,
        triggerTime: targetTime,
        triggerPrice: targetPrice,
        filename,
      };
      setMemes(prev => [...prev, newMeme]);

      const lifetimeTimer = setTimeout(() => {
        setMemes(prev => prev.filter(m => m.id !== id));
        memeLifetimeTimersRef.current.delete(lifetimeTimer);
      }, MEME_LIFETIME_MS);
      memeLifetimeTimersRef.current.add(lifetimeTimer);
    },
    [MEME_LIFETIME_MS]
  );

  const getMemeGeometry = useCallback(
    (meme: StickyMeme, overlayWidth: number, overlayHeight: number) => {
      if (!priceSnapshot?.getCoordinate) return null;
      return calcMemeGeometry(
        meme,
        overlayWidth,
        overlayHeight,
        priceSnapshot.getCoordinate
      );
    },
    [priceSnapshot]
  );

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
    memeFilesRef
  );

  const resetMemeState = useCallback(() => {
    for (const timer of memeLifetimeTimersRef.current) {
      clearTimeout(timer);
    }
    memeLifetimeTimersRef.current.clear();
    setMemes([]);
    setZoomedMeme(null);
    resetAudio();
    resetTriggers();
  }, [resetAudio, resetTriggers]);

  useEffect(() => {
    resetMemeState();
    fetch("/api/memes")
      .then(res => res.json())
      .then(data => {
        memeFilesRef.current = data;
      })
      .catch(console.error);

    return () => {
      resetMemeState();
    };
  }, [resetMemeState]);

  // Clear memes on idle (symbol change) or when a fresh animation starts
  // (replay from complete / start from idle). Keep memes when resuming from pause.
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

  // Restart/play-from-beginning keeps phase as "animating" but drops points sharply.
  // Use that signature to wipe prior run memes reliably.
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

  const hasContent = memes.length > 0 && priceSnapshot?.getCoordinate;
  const overlayWidth = overlayRef.current?.clientWidth ?? 0;
  const overlayHeight = overlayRef.current?.clientHeight ?? 0;
  const renderedMemes: RenderedMeme[] =
    hasContent && overlayWidth > 0
      ? memes
          .map(meme => {
            const geometry = getMemeGeometry(
              meme,
              overlayWidth,
              overlayHeight
            );
            if (!geometry) return null;
            return { meme, ...geometry };
          })
          .filter((item): item is RenderedMeme => item !== null)
      : [];

  return (
    <>
      <div
        ref={overlayRef}
        className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      >
        <svg className="absolute inset-0 h-full w-full pointer-events-none z-10">
          {renderedMemes.map(
            ({
              meme,
              showLine,
              lineStartX,
              lineStartY,
              targetX,
              targetY,
            }) => {
              if (!showLine) return null;

              return (
                <line
                  key={`line-${meme.id}`}
                  x1={lineStartX}
                  y1={lineStartY}
                  x2={targetX}
                  y2={targetY}
                  stroke={
                    meme.type === "positive" ? "#34d399" : "#f87171"
                  }
                  strokeWidth="2"
                  strokeDasharray="6,4"
                  className="opacity-60"
                />
              );
            }
          )}
        </svg>

        {renderedMemes.map(({ meme, imgLeft, imgTop }) => {
          return (
            <div
              key={meme.id}
              className="absolute pointer-events-auto cursor-pointer drop-shadow-lg z-20 animate-in fade-in duration-300 transition-transform hover:scale-110 hover:z-30"
              style={{
                left: imgLeft,
                top: imgTop,
                width: 80,
                height: 80,
              }}
              onClick={e => {
                e.stopPropagation();
                handleMemeClick(meme);
              }}
              title="Click to zoom"
            >
              <img
                src={`/img/${meme.type === "positive" ? "positive" : "negative"}/${meme.filename}`}
                alt={`${meme.type} meme`}
                className="h-20 w-20 object-contain rounded-md"
                draggable={false}
              />
            </div>
          );
        })}
      </div>

      {/* Lightbox overlay — rendered via portal so it escapes overflow-hidden */}
      {zoomedMeme &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer"
            onClick={e => {
              e.stopPropagation();
              closeLightbox();
            }}
          >
            <div
              className="relative animate-in zoom-in fade-in duration-200"
              onClick={e => e.stopPropagation()}
            >
              <img
                src={`/img/${zoomedMeme.type === "positive" ? "positive" : "negative"}/${zoomedMeme.filename}`}
                alt={`${zoomedMeme.type} meme zoomed`}
                className="max-h-[70vh] max-w-[70vw] object-contain rounded-xl shadow-2xl"
                draggable={false}
              />
              <button
                className="absolute -top-3 -right-3 bg-foreground/80 text-background rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold hover:bg-foreground transition-colors cursor-pointer"
                onClick={e => {
                  e.stopPropagation();
                  closeLightbox();
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
