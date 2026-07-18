"use client";

// Development-only audio inspector, enabled with ?debugAudio=1. Shows the
// live GameAudioManager state and fires the same production playback
// methods gameplay uses (playPutt / playCupDrop / playApplause /
// playHoleComplete / playSinkSequence), so what the buttons trigger is exactly what a putt
// triggers. Compiled out of production builds via the NODE_ENV guard.

import { useMemo, useSyncExternalStore } from "react";
import { getGameAudio } from "@/lib/game-audio";
import { useGameAudioStore } from "@/lib/use-game-audio";
import type { GameAudioDebugState } from "@/lib/game-audio-manager";
import { AUDIO_MANIFEST } from "@/lib/audio-manifest.generated";
import { validateAudioManifest } from "@/lib/audio-manifest";
import { HOLES } from "@/lib/course-data";
import {
  PUTT_MEDIUM_MAX_POWER,
  PUTT_SOFT_MAX_POWER,
} from "@/lib/putt-audio";

// Representative charge levels squarely inside each intensity band.
const SOFT_TEST_POWER = PUTT_SOFT_MAX_POWER / 2;
const MEDIUM_TEST_POWER = (PUTT_SOFT_MAX_POWER + PUTT_MEDIUM_MAX_POWER) / 2;
const HARD_TEST_POWER = (PUTT_MEDIUM_MAX_POWER + 1) / 2;

const noopSubscribe = () => () => {};

function readDebugFlag(): boolean {
  return (
    new URLSearchParams(window.location.search).get("debugAudio") === "1"
  );
}

const selectDebugState = (
  audio: NonNullable<ReturnType<typeof getGameAudio>>,
): GameAudioDebugState => audio.getDebugState();

function shortName(url: string | null): string {
  if (!url) return "—";
  return url.split("/").pop() ?? url;
}

export function AudioDebugPanel({ holeNumber }: { holeNumber: number }) {
  const enabled = useSyncExternalStore(
    noopSubscribe,
    readDebugFlag,
    () => false,
  );
  const state = useGameAudioStore(selectDebugState, null);

  const structuralIssues = useMemo(
    () =>
      validateAudioManifest(
        AUDIO_MANIFEST,
        HOLES.map((hole) => hole.number),
      ),
    [],
  );

  if (process.env.NODE_ENV === "production" || !enabled || !state) {
    return null;
  }

  const loadedUrls = new Set(state.loadedUrls);
  const puttUrls = Object.values(AUDIO_MANIFEST.putt).flat();
  const loadedPutt = puttUrls.filter((url) => loadedUrls.has(url));
  const loadedCup = AUDIO_MANIFEST.cup.filter((url) => loadedUrls.has(url));
  const fire = (
    action: (audio: NonNullable<ReturnType<typeof getGameAudio>>) => void,
  ) => {
    const audio = getGameAudio();
    if (!audio) return;
    void audio.unlock();
    action(audio);
  };

  return (
    <aside className="audio-debug" aria-label="Audio debug panel">
      <span>Audio debug</span>
      <dl>
        <div>
          <dt>Context</dt>
          <dd>
            {state.contextState}
            {state.unlocked ? " · unlocked" : " · locked"}
          </dd>
        </div>
        <div>
          <dt>Master / Effects</dt>
          <dd>
            {state.settings.masterVolume.toFixed(2)} /{" "}
            {state.settings.effectsVolume.toFixed(2)}
          </dd>
        </div>
        <div>
          <dt>Putt buffers</dt>
          <dd>{loadedPutt.length} / 6</dd>
        </div>
        <div>
          <dt>Cup buffers</dt>
          <dd>{loadedCup.length} / 3</dd>
        </div>
        <div>
          <dt>Applause</dt>
          <dd>{state.applauseLoaded ? "loaded" : "loading"}</dd>
        </div>
        <div>
          <dt>Hole</dt>
          <dd>
            {state.currentHole !== null
              ? `hole-${String(state.currentHole).padStart(2, "0")}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Accent</dt>
          <dd>
            {shortName(state.currentHoleAccentUrl)}
            {state.currentHoleAccentUrl
              ? state.currentHoleAccentLoaded
                ? " · loaded"
                : " · loading"
              : ""}
          </dd>
        </div>
        <div>
          <dt>Last event</dt>
          <dd>
            {state.lastEvent
              ? `${state.lastEvent.kind}: ${state.lastEvent.detail}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Last putt take</dt>
          <dd>{shortName(state.lastPuttVariation)}</dd>
        </div>
        <div>
          <dt>Last cup take</dt>
          <dd>{shortName(state.lastCupVariation)}</dd>
        </div>
        <div>
          <dt>Sink guard</dt>
          <dd>{state.sinkSequencePlayed ? "spent" : "armed"}</dd>
        </div>
        <div>
          <dt>Accent scheduled</dt>
          <dd>{state.accentScheduled ? "yes" : "no"}</dd>
        </div>
        <div>
          <dt>Active sources</dt>
          <dd>{state.activeSources}</dd>
        </div>
        <div>
          <dt>Decode failures</dt>
          <dd>
            {state.decodeFailures.length === 0
              ? "none"
              : state.decodeFailures.map(shortName).join(", ")}
          </dd>
        </div>
        <div>
          <dt>Manifest issues</dt>
          <dd>
            {structuralIssues.length === 0
              ? "none"
              : structuralIssues.map((issue) => issue.message).join("; ")}
          </dd>
        </div>
      </dl>
      <div className="audio-debug-buttons">
        <button type="button" onClick={() => fire((a) => a.playPutt(SOFT_TEST_POWER))}>
          Soft putt
        </button>
        <button type="button" onClick={() => fire((a) => a.playPutt(MEDIUM_TEST_POWER))}>
          Medium putt
        </button>
        <button type="button" onClick={() => fire((a) => a.playPutt(HARD_TEST_POWER))}>
          Hard putt
        </button>
        <button type="button" onClick={() => fire((a) => a.playCupDrop())}>
          Cup drop
        </button>
        <button type="button" onClick={() => fire((a) => a.playApplause())}>
          Applause
        </button>
        <button
          type="button"
          onClick={() => fire((a) => a.playHoleComplete(holeNumber))}
        >
          Hole accent
        </button>
        <button
          type="button"
          onClick={() =>
            fire((a) => {
              // Same production path as a real sink, re-armed first so the
              // button can be pressed repeatedly while inspecting.
              a.beginHoleAttempt(holeNumber);
              a.playSinkSequence(holeNumber);
            })
          }
        >
          Sink sequence
        </button>
      </div>
    </aside>
  );
}
