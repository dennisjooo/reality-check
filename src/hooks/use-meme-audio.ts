"use client";

import { useEffect, useRef, useCallback } from "react";

export function useMemeAudio(
  phase: string,
  memeFilesRef: React.MutableRefObject<{
    positive: string[];
    negative: string[];
    positiveAudio: string[];
    negativeAudio: string[];
  }>
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioFadeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioFadeDelayRef = useRef<NodeJS.Timeout | null>(null);

  const resetAudio = useCallback(() => {
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

  const playAudio = useCallback(
    (type: "positive" | "negative") => {
      if (audioFadeTimerRef.current) {
        clearInterval(audioFadeTimerRef.current);
        audioFadeTimerRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }

      const audioFiles =
        type === "positive"
          ? memeFilesRef.current.positiveAudio
          : memeFilesRef.current.negativeAudio;

      let audioPath = `/audio/${type}.mp3`; // fallback
      if (audioFiles && audioFiles.length > 0) {
        const filename =
          audioFiles[Math.floor(Math.random() * audioFiles.length)];
        audioPath = `/audio/${type}/${filename}`;
      }

      const audio = new Audio(audioPath);
      audio.volume = 0.7;
      audio.play().catch((e) => console.log("Audio play prevented:", e));
      audioRef.current = audio;
    },
    [memeFilesRef]
  );

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
            if (audioFadeTimerRef.current)
              clearInterval(audioFadeTimerRef.current);
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

  // Pause audio on idle
  useEffect(() => {
    if (phase === "idle" && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, [phase]);

  return { playAudio, resetAudio };
}
