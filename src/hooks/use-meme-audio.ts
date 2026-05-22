"use client";

import { useEffect, useRef, useCallback } from "react";

function pickRandomNonRepeating(
  items: string[],
  previous: string | null
): string {
  if (items.length === 0) return "";
  if (items.length === 1 || !previous) {
    return items[Math.floor(Math.random() * items.length)];
  }

  const next = items[Math.floor(Math.random() * items.length)];
  if (next !== previous) return next;

  const alternatives = items.filter((item) => item !== previous);
  return alternatives.length > 0
    ? alternatives[Math.floor(Math.random() * alternatives.length)]
    : next;
}

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
  const readyForNextRef = useRef<boolean>(true);
  const lastAudioFileRef = useRef<{
    positive: string | null;
    negative: string | null;
  }>({ positive: null, negative: null });

  // Sync volume and speed if they change while audio is playing
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, 0.7 * volume));
      audioRef.current.playbackRate = Math.max(0.25, Math.min(speed, 4.0));
    }
  }, [volume, speed]);

  const resetAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    readyForNextRef.current = true;
    lastAudioFileRef.current = { positive: null, negative: null };
  }, []);

  const playAudio = useCallback(
    (type: "positive" | "negative") => {
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
        const filename = pickRandomNonRepeating(
          audioFiles,
          lastAudioFileRef.current[type]
        );
        lastAudioFileRef.current[type] = filename;
        audioPath = `/audio/${type}/${filename}`;
      }

      const audio = new Audio(audioPath);
      audio.volume = Math.max(0, Math.min(1, 0.7 * volume));
      audio.playbackRate = Math.max(0.25, Math.min(speed, 4.0));
      audio.addEventListener("ended", () => {
        readyForNextRef.current = true;
      });
      audio.play().catch((e) => console.log("Audio play prevented:", e));
      audioRef.current = audio;
    },
    [memeFilesRef, volume, speed]
  );

  /**
   * Returns true when no audio is playing, or current audio has reached
   * at least 98% of its duration (ready for next in queue).
   */
  const isReadyForNext = useCallback((): boolean => {
    if (readyForNextRef.current) return true;
    const audio = audioRef.current;
    if (!audio) { readyForNextRef.current = true; return true; }
    if (audio.paused || audio.ended) { readyForNextRef.current = true; return true; }
    const { duration, currentTime } = audio;
    if (!duration || isNaN(duration)) return false;
    if (currentTime >= duration * 0.98) { readyForNextRef.current = true; return true; }
    return false;
  }, []);

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
