"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import type { PriceSnapshot } from "@/lib/chart-types";

interface MemeOverlayProps {
  priceSnapshot: PriceSnapshot | null;
  phase: string;
  speed: number;
}

interface StickyMeme {
  type: "positive" | "negative";
  id: number;
  triggerTime: number;
  triggerPrice: number;
  filename: string;
}

interface RenderedMeme {
  meme: StickyMeme;
  targetX: number;
  targetY: number;
  imgLeft: number;
  imgTop: number;
  lineStartX: number;
  lineStartY: number;
  showLine: boolean;
}

export function MemeOverlay({ priceSnapshot, phase }: MemeOverlayProps) {
  const MEME_LIFETIME_MS = 1800;
  const [memes, setMemes] = useState<StickyMeme[]>([]);
  const [zoomedMeme, setZoomedMeme] = useState<StickyMeme | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioFadeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioFadeDelayRef = useRef<NodeJS.Timeout | null>(null);
  const memeLifetimeTimersRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const nextPosMilestoneRef = useRef<number>(3);
  const nextNegMilestoneRef = useRef<number>(-3);
  const triggeredTimesRef = useRef<Set<number>>(new Set());
  const prevPhaseRef = useRef(phase);
  const prevPointsRef = useRef<number | null>(null);
  const memeFilesRef = useRef<{
    positive: string[];
    negative: string[];
    positiveAudio: string[];
    negativeAudio: string[];
  }>({ positive: [], negative: [], positiveAudio: [], negativeAudio: [] });

  const resetMemeState = useCallback(() => {
    for (const timer of memeLifetimeTimersRef.current) {
      clearTimeout(timer);
    }
    memeLifetimeTimersRef.current.clear();
    setMemes([]);
    setZoomedMeme(null);
    nextPosMilestoneRef.current = 3;
    nextNegMilestoneRef.current = -3;
    triggeredTimesRef.current.clear();
    if (audioFadeDelayRef.current) {
      clearTimeout(audioFadeDelayRef.current);
      audioFadeDelayRef.current = null;
    }
    if (audioFadeTimerRef.current) {
      clearInterval(audioFadeTimerRef.current);
      audioFadeTimerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  }, []);

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
      const coords = priceSnapshot.getCoordinate(meme.triggerTime, meme.triggerPrice);
      if (!coords) return null;

      const targetX = coords.x;
      const targetY = coords.y;
      const halfImg = 40;
      const imgOffsetX = targetX < overlayWidth * 0.33 ? 46 : -46;
      const imgOffsetY = meme.type === "positive" ? -45 : 40;
      const minConnector = 40;
      const maxConnector = 88;

      const minX = halfImg + 6;
      const maxX = Math.max(minX, overlayWidth - halfImg - 6);
      const minY = halfImg + 6;
      const maxY = Math.max(minY, overlayHeight - halfImg - 6);

      let imgCenterX = Math.max(minX, Math.min(targetX + imgOffsetX, maxX));
      let imgCenterY = Math.max(minY, Math.min(targetY + imgOffsetY, maxY));

      let dx = targetX - imgCenterX;
      let dy = targetY - imgCenterY;
      let dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minConnector || dist > maxConnector) {
        const fallbackDx = meme.type === "positive" ? 0.7 : 0.4;
        const fallbackDy = meme.type === "positive" ? 0.7 : -0.9;
        const unitX = dist > 0 ? dx / dist : fallbackDx;
        const unitY = dist > 0 ? dy / dist : fallbackDy;
        const targetDist = Math.min(maxConnector, Math.max(minConnector, dist || minConnector));

        imgCenterX = targetX - unitX * targetDist;
        imgCenterY = targetY - unitY * targetDist;

        imgCenterX = Math.max(minX, Math.min(imgCenterX, maxX));
        imgCenterY = Math.max(minY, Math.min(imgCenterY, maxY));

        dx = targetX - imgCenterX;
        dy = targetY - imgCenterY;
        dist = Math.sqrt(dx * dx + dy * dy);
      }

      const minVisibleConnector = 24;
      const unitX = dist > 0 ? dx / dist : 0;
      const unitY = dist > 0 ? dy / dist : 0;
      const lineRadius = Math.max(8, Math.min(halfImg - 2, dist - minVisibleConnector));
      const lineStartX = imgCenterX + unitX * lineRadius;
      const lineStartY = imgCenterY + unitY * lineRadius;
      const showLine = dist > 10;

      return {
        targetX,
        targetY,
        imgLeft: imgCenterX - halfImg,
        imgTop: imgCenterY - halfImg,
        lineStartX,
        lineStartY,
        showLine,
      };
    },
    [priceSnapshot]
  );

  const isAnchorTooClose = useCallback(
    (targetTime: number, targetPrice: number) => {
      if (!priceSnapshot?.getCoordinate) return false;
      const target = priceSnapshot.getCoordinate(targetTime, targetPrice);
      if (!target) return false;

      const minAnchorDistance = 90;
      const minAnchorDistanceSq = minAnchorDistance * minAnchorDistance;

      for (const existing of memes) {
        const existingCoords = priceSnapshot.getCoordinate(existing.triggerTime, existing.triggerPrice);
        if (!existingCoords) continue;
        const dx = existingCoords.x - target.x;
        const dy = existingCoords.y - target.y;
        if (dx * dx + dy * dy < minAnchorDistanceSq) {
          return true;
        }
      }
      return false;
    },
    [memes, priceSnapshot]
  );

  useEffect(() => {
    resetMemeState();
    fetch('/api/memes')
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

    const isFreshStart = phase === "idle" ||
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

  // Milestone-based trigger logic
  useEffect(() => {
    if (!priceSnapshot || phase !== "animating") return;

    const { firstClose, lastClose, points } = priceSnapshot;
    if (!firstClose || !points || points < 30) return;

    const percentChange = ((lastClose - firstClose) / firstClose) * 100;

    // Skip memes anchored to the leftmost 20% of visible range — that data
    // was just revealed by the zoom-out and feels "not yet traversed".
    const leftEdge = (priceSnapshot.lastLogicalIndex ?? 0) - priceSnapshot.points + 1;
    const leftBuffer = leftEdge + priceSnapshot.points * 0.2;

    if (percentChange >= nextPosMilestoneRef.current) {
      const targetIdx = priceSnapshot.peakIndex ?? 0;
      const targetTime = priceSnapshot.peakTime;
      const targetPrice = priceSnapshot.peakPrice ?? priceSnapshot.lastClose;
      nextPosMilestoneRef.current = Math.floor(percentChange / 3) * 3 + 3;

      if (targetTime && targetIdx >= leftBuffer && !triggeredTimesRef.current.has(targetTime)) {
        if (isAnchorTooClose(targetTime, targetPrice)) {
          // Mark this anchor as handled so future milestones don't keep spawning
          // at nearly the same chart point.
          triggeredTimesRef.current.add(targetTime);
          return;
        }
        triggeredTimesRef.current.add(targetTime);
        playAudio("positive");
        const files = memeFilesRef.current.positive;
        const filename = files.length > 0 ? files[Math.floor(Math.random() * files.length)] : "stonks.webp";
        spawnMeme("positive", targetTime, targetPrice, filename);
      }
    } else if (percentChange <= nextNegMilestoneRef.current) {
      const targetIdx = priceSnapshot.troughIndex ?? 0;
      const targetTime = priceSnapshot.troughTime;
      const targetPrice = priceSnapshot.troughPrice ?? priceSnapshot.lastClose;
      nextNegMilestoneRef.current = Math.ceil(percentChange / 3) * 3 - 3;

      if (targetTime && targetIdx >= leftBuffer && !triggeredTimesRef.current.has(targetTime)) {
        if (isAnchorTooClose(targetTime, targetPrice)) {
          triggeredTimesRef.current.add(targetTime);
          return;
        }
        triggeredTimesRef.current.add(targetTime);
        playAudio("negative");
        const files = memeFilesRef.current.negative;
        const filename = files.length > 0 ? files[Math.floor(Math.random() * files.length)] : "wojak_mcdonalds.webp";
        spawnMeme("negative", targetTime, targetPrice, filename);
      }
    }
  }, [isAnchorTooClose, phase, priceSnapshot, spawnMeme]);

  // Audio fade-out after each trigger (audio is ephemeral, images are not)
  useEffect(() => {
    if (!audioRef.current) return;
    audioFadeDelayRef.current = setTimeout(() => {
      if (!audioRef.current) return;
      audioFadeTimerRef.current = setInterval(() => {
        if (audioRef.current) {
          if (audioRef.current.volume > 0.05) {
            audioRef.current.volume -= 0.05;
          } else {
            audioRef.current.volume = 0;
            audioRef.current.pause();
            if (audioFadeTimerRef.current) clearInterval(audioFadeTimerRef.current);
            audioFadeTimerRef.current = null;
          }
        }
      }, 50);
    }, 1500);
    return () => {
      if (audioFadeDelayRef.current) {
        clearTimeout(audioFadeDelayRef.current);
        audioFadeDelayRef.current = null;
      }
    };
  });

  const playAudio = (type: "positive" | "negative") => {
    if (audioFadeTimerRef.current) {
      clearInterval(audioFadeTimerRef.current);
      audioFadeTimerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audioFiles = type === "positive" ? memeFilesRef.current.positiveAudio : memeFilesRef.current.negativeAudio;

    let audioPath = `/audio/${type}.mp3`; // fallback
    if (audioFiles && audioFiles.length > 0) {
      const filename = audioFiles[Math.floor(Math.random() * audioFiles.length)];
      audioPath = `/audio/${type}/${filename}`;
    }

    const audio = new Audio(audioPath);
    audio.volume = 0.7;
    audio.play().catch(e => console.log("Audio play prevented:", e));
    audioRef.current = audio;
  };

  useEffect(() => {
    if (phase === "idle" && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, [phase]);

  const handleMemeClick = useCallback((meme: StickyMeme) => {
    setZoomedMeme(meme);
  }, []);

  const closeLightbox = useCallback(() => {
    setZoomedMeme(null);
  }, []);

  const hasContent = memes.length > 0 && priceSnapshot?.getCoordinate;
  const overlayWidth = overlayRef.current?.clientWidth ?? 0;
  const overlayHeight = overlayRef.current?.clientHeight ?? 0;
  const renderedMemes: RenderedMeme[] = hasContent && overlayWidth > 0
    ? memes
        .map((meme) => {
          const geometry = getMemeGeometry(meme, overlayWidth, overlayHeight);
          if (!geometry) return null;
          return { meme, ...geometry };
        })
        .filter((item): item is RenderedMeme => item !== null)
    : [];

  return (
    <>
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        <svg className="absolute inset-0 h-full w-full pointer-events-none z-10">
          {renderedMemes.map(({ meme, showLine, lineStartX, lineStartY, targetX, targetY }) => {
            if (!showLine) return null;

            return (
              <line
                key={`line-${meme.id}`}
                x1={lineStartX}
                y1={lineStartY}
                x2={targetX}
                y2={targetY}
                stroke={meme.type === "positive" ? "#34d399" : "#f87171"}
                strokeWidth="2"
                strokeDasharray="6,4"
                className="opacity-60"
              />
            );
          })}
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
              onClick={(e) => { e.stopPropagation(); handleMemeClick(meme); }}
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
      {zoomedMeme && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer"
          onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
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
              onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
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
