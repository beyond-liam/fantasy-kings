"use client";

import { useEffect } from "react";

const SOUND_SOURCES = [
  "/sound-draft-pick.mp3",
  "/sound-youre-up.mp3",
] as const;

let unlocked = false;
const pool = new Map<string, HTMLAudioElement>();

function getAudio(src: string): HTMLAudioElement {
  let audio = pool.get(src);
  if (!audio) {
    audio = new Audio(src);
    audio.preload = "auto";
    pool.set(src, audio);
  }
  return audio;
}

/** Prime audio elements after the first user gesture (Safari autoplay policy). */
export function unlockDraftSounds() {
  if (unlocked || typeof window === "undefined") {
    return;
  }
  unlocked = true;

  for (const src of SOUND_SOURCES) {
    const audio = getAudio(src);
    const volume = audio.volume;
    audio.volume = 0.001;
    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = volume;
      })
      .catch(() => {
        audio.volume = volume;
      });
  }
}

export function playDraftSound(src: string) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const audio = getAudio(src);
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Autoplay blocked until unlockDraftSounds runs.
    });
  } catch {
    // Ignore missing file failures.
  }
}

export function useDraftSoundUnlock() {
  useEffect(() => {
    const unlock = () => unlockDraftSounds();
    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
}
