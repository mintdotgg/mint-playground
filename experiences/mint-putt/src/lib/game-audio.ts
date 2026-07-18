// Browser singleton for the game audio manager. Stored on window so Fast
// Refresh and remounts reuse the same AudioContext and decoded buffers
// instead of leaking contexts; dispose happens on pagehide.

import { AUDIO_MANIFEST } from "./audio-manifest.generated";
import { fallbackUrlFor } from "./audio-manifest";
import {
  createGameAudioManager,
  type GameAudioManager,
} from "./game-audio-manager";

type AudioWindow = Window & { __GG_GAME_AUDIO__?: GameAudioManager };

export function getGameAudio(): GameAudioManager | null {
  if (typeof window === "undefined") return null;
  const scope = window as AudioWindow;
  if (scope.__GG_GAME_AUDIO__) return scope.__GG_GAME_AUDIO__;
  const useFallbackFormat = !supportsOggOpus();
  const manager = createGameAudioManager({
    manifest: AUDIO_MANIFEST,
    storage: safeLocalStorage(),
    unlockTarget: window.document,
    visibilityTarget: window.document,
    resolveUrl: useFallbackFormat
      ? (url) => fallbackUrlFor(AUDIO_MANIFEST, url)
      : undefined,
  });
  window.addEventListener("pagehide", () => manager.dispose(), { once: true });
  scope.__GG_GAME_AUDIO__ = manager;
  return manager;
}

// Retained for manifests that provide an OGG/Opus primary. The published
// Playground manifest currently points both formats at canonical Mint MP3s.
function supportsOggOpus(): boolean {
  try {
    return (
      window.document
        .createElement("audio")
        .canPlayType('audio/ogg; codecs="opus"') !== ""
    );
  } catch {
    return false;
  }
}

function safeLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
