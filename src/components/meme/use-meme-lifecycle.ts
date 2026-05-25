"use client";

import { useState, useRef, useCallback } from "react";
import type { StickyMeme } from "@/lib/meme";

const MEME_LIFETIME_MS = 3000;
const MEME_LOAD_TIMEOUT_MS = 2000;

export function useMemeLifecycle() {
  const [memes, setMemes] = useState<StickyMeme[]>([]);
  const [loadedMemeIds, setLoadedMemeIds] = useState<Set<number>>(new Set());
  const memeLifetimeTimersRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const lifetimeStartedRef = useRef<Set<number>>(new Set());

  const startMemeLifetime = useCallback((id: number) => {
    if (lifetimeStartedRef.current.has(id)) return;
    lifetimeStartedRef.current.add(id);

    const lifetimeTimer = setTimeout(() => {
      setMemes(prev => prev.filter(m => m.id !== id));
      setLoadedMemeIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      memeLifetimeTimersRef.current.delete(lifetimeTimer);
    }, MEME_LIFETIME_MS);
    memeLifetimeTimersRef.current.add(lifetimeTimer);
  }, []);

  const spawnMeme = useCallback(
    (type: "positive" | "negative", targetTime: number, targetPrice: number, filename: string) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const newMeme: StickyMeme = {
        type,
        id,
        triggerTime: targetTime,
        triggerPrice: targetPrice,
        filename,
      };
      setMemes(prev => [...prev, newMeme]);

      const fallbackTimer = setTimeout(() => {
        startMemeLifetime(id);
      }, MEME_LOAD_TIMEOUT_MS);
      memeLifetimeTimersRef.current.add(fallbackTimer);
    },
    [startMemeLifetime]
  );

  const handleImageLoad = useCallback((memeId: number) => {
    setLoadedMemeIds(prev => {
      const next = new Set(prev);
      next.add(memeId);
      return next;
    });
    startMemeLifetime(memeId);
  }, [startMemeLifetime]);

  const clearAll = useCallback(() => {
    for (const timer of memeLifetimeTimersRef.current) {
      clearTimeout(timer);
    }
    memeLifetimeTimersRef.current.clear();
    lifetimeStartedRef.current.clear();
    setMemes([]);
    setLoadedMemeIds(new Set());
  }, []);

  return {
    memes,
    setMemes,
    loadedMemeIds,
    spawnMeme,
    handleImageLoad,
    clearAll,
  };
}
