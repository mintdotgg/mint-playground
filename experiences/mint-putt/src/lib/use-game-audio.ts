"use client";

// React binding for the GameAudioManager singleton: subscribes to its
// change notifications through useSyncExternalStore and serves a cached
// snapshot (so React sees a stable reference between changes). The
// selector runs only inside subscription callbacks — never during render —
// which keeps SSR/hydration deterministic: both the server render and the
// first client render see `serverFallback`, and the live value arrives
// with the post-mount notification.

import { useCallback, useRef, useSyncExternalStore } from "react";
import { getGameAudio } from "./game-audio";
import type { GameAudioManager } from "./game-audio-manager";

export function useGameAudioStore<T>(
  select: (audio: GameAudioManager) => T,
  serverFallback: T,
): T {
  const cacheRef = useRef<T>(serverFallback);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const audio = getGameAudio();
      if (!audio) return () => {};
      cacheRef.current = select(audio);
      onStoreChange();
      return audio.subscribe(() => {
        cacheRef.current = select(audio);
        onStoreChange();
      });
    },
    [select],
  );

  return useSyncExternalStore(
    subscribe,
    () => cacheRef.current,
    () => serverFallback,
  );
}
