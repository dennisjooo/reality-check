"use client";

import { useEffect, useRef, useCallback } from "react";

export function useMemeAudio(
  phase: string,
  memeFilesRef: React.MutableRefObject<{
    positive: string[];
    negative: string[];
    positiveAudio: string[];
    negativeAudio: string[];
  }>,
  volume: number = 1.0,
  speed: number = 1.0
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioFadeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioFadeDelayRef = useRef<NodeJS.Timeout | null>(null);
  const readyForNextRef = useRef<boolean>(true);

  // Sync volume and speed if they change while audio is playing
  useEffect(() => {
    if (audioRef.current && !audioFadeTimerRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, 0.7 * volume));
      audioRef.current.playbackRate = Math.max(0.25, Math.min(speed, 4.0));
    }
  }, [volume, speed]);

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
    readyForNextRef.current = true;
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

      readyForNextRef.current = false;

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
      audio.volume = Math.max(0, Math.min(1, 0.7 * volume));
      audio.playbackRate = Math.max(0.25, Math.min(speed, 4.0));
      audio.play().catch((e) => console.log("Audio play prevented:", e));
      audioRef.current = audio;
    },
    [memeFilesRef, volume, speed]
  );

  /**
   * Returns true when no audio is playing, or current audio has reached
   * at least 80% of its duration (ready for next in queue).
   */
  const isReadyForNext = useCallback((): boolean => {
    if (readyForNextRef.current) return true;
    const audio = audioRef.current;
    if (!audio) { readyForNextRef.current = true; return true; }
    if (audio.paused || audio.ended) { readyForNextRef.current = true; return true; }
    const { duration, currentTime } = audio;
    if (!duration || isNaN(duration)) return true;
    if (currentTime >= duration * 0.9) { readyForNextRef.current = true; return true; }
    return false;
  }, []);

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
      readyForNextRef.current = true;
    }
  }, [phase]);

  return { playAudio, resetAudio, isReadyForNext };
}
