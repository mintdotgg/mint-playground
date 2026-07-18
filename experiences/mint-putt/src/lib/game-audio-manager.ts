// Centralized Web Audio manager for all gameplay sound effects.
//
// One AudioContext feeds a master effects bus. Buffers are fetched and decoded
// once and cached, so a putt at the moment of impact only wires cached nodes
// (no fetch, no decode). Every dependency (context construction, fetching,
// timers, storage, randomness, event targets) is injectable so the full
// behavior is testable in Node without a browser.
//
// Playback is deliberately non-positional: the game had no spatial audio
// before this feature, and in putt mode the camera is always within a few
// meters of the ball and cup, so plain playback avoids introducing a
// fragile second 3D audio system (see README).

import {
  allManifestUrls,
  holeAudioId,
  PUTT_INTENSITIES,
  type AudioManifest,
  type PuttIntensity,
} from "./audio-manifest";
import {
  gainJitter,
  pickVariation,
  pitchJitter,
  puttIntensityForPower,
} from "./putt-audio";
import {
  loadAudioSettings,
  saveAudioSettings,
  clampVolume,
  type AudioSettings,
  type StorageLike,
} from "./audio-settings";

// Relative family levels: the cup drop reads slightly more prominent than
// the putt impact, and the completion accent rewards without overpowering
// the physical cup sound.
const FAMILY_GAIN = {
  putt: 0.85,
  cup: 1.0,
  hole: 0.78,
  applause: 0.22,
} as const;
// Uncontrolled node creation guard: more simultaneous one-shots than this
// get skipped instead of stacking.
const MAX_ACTIVE_SOURCES = 16;

type AudioParamLike = { value: number };

export type GainNodeLike = {
  gain: AudioParamLike;
  connect(target: unknown): unknown;
  disconnect(): void;
};

export type BufferSourceLike = {
  buffer: unknown;
  playbackRate: AudioParamLike;
  onended: (() => void) | null;
  connect(target: unknown): unknown;
  start(when?: number): void;
  stop(when?: number): void;
  disconnect(): void;
};

export type AudioContextLike = {
  state: "suspended" | "running" | "closed";
  destination: unknown;
  currentTime: number;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;
  createGain(): GainNodeLike;
  createBufferSource(): BufferSourceLike;
  decodeAudioData(data: ArrayBuffer): Promise<unknown>;
};

export type EventTargetLike = {
  addEventListener(type: string, listener: () => void, options?: unknown): void;
  removeEventListener(
    type: string,
    listener: () => void,
    options?: unknown,
  ): void;
};

export type GameAudioEvent = {
  kind:
    | "putt"
    | "cup"
    | "applause"
    | "hole-complete"
    | "suppressed-duplicate-sink"
    | "skipped";
  detail: string;
  at: number;
};

export type GameAudioDebugState = {
  contextState: "unavailable" | "suspended" | "running" | "closed";
  unlocked: boolean;
  settings: AudioSettings;
  loadedUrls: string[];
  decodeFailures: string[];
  currentHole: number | null;
  currentHoleAccentUrl: string | null;
  currentHoleAccentLoaded: boolean;
  applauseLoaded: boolean;
  lastEvent: GameAudioEvent | null;
  lastPuttVariation: string | null;
  lastCupVariation: string | null;
  sinkSequencePlayed: boolean;
  accentScheduled: boolean;
  activeSources: number;
  manifestIssueCount: number;
};

export type GameAudioManagerOptions = {
  manifest: AudioManifest;
  createContext?: (() => AudioContextLike) | null;
  fetchAudioData?: (url: string) => Promise<ArrayBuffer>;
  /**
   * Maps a canonical manifest URL to the URL actually fetched — used to
   * swap in the fallback format on browsers that cannot decode the primary
   * one. Buffers stay cached under the canonical URL.
   */
  resolveUrl?: (url: string) => string;
  storage?: StorageLike | null;
  random?: () => number;
  unlockTarget?: EventTargetLike | null;
  visibilityTarget?: (EventTargetLike & { hidden?: boolean }) | null;
  setTimeoutFn?: (handler: () => void, ms: number) => unknown;
  clearTimeoutFn?: (handle: unknown) => void;
  isDev?: boolean;
  log?: (level: "warn" | "error", message: string) => void;
};

export type GameAudioManager = ReturnType<typeof createGameAudioManager>;

export function createGameAudioManager(options: GameAudioManagerOptions) {
  const manifest = options.manifest;
  const random = options.random ?? Math.random;
  const storage = options.storage ?? null;
  const resolveUrl = options.resolveUrl ?? ((url: string) => url);
  const fetchAudioData =
    options.fetchAudioData ??
    (async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return response.arrayBuffer();
    });
  const createContext =
    options.createContext === undefined
      ? defaultContextFactory()
      : options.createContext;
  const scheduleTimeout =
    options.setTimeoutFn ??
    ((handler: () => void, ms: number) => setTimeout(handler, ms));
  const cancelTimeout =
    options.clearTimeoutFn ??
    ((handle: unknown) => clearTimeout(handle as number));
  const isDev = options.isDev ?? process.env.NODE_ENV !== "production";
  const log =
    options.log ??
    ((level: "warn" | "error", message: string) => {
      if (!isDev) return;
      if (level === "error") console.error(`[GameAudio] ${message}`);
      else console.warn(`[GameAudio] ${message}`);
    });

  let context: AudioContextLike | null = null;
  let masterGain: GainNodeLike | null = null;
  let effectsGain: GainNodeLike | null = null;
  let initialized = false;
  let disposed = false;
  let unlocked = false;
  let settings = loadAudioSettings(storage);

  const buffers = new Map<string, unknown>();
  const pendingLoads = new Map<string, Promise<unknown | null>>();
  const decodeFailures = new Set<string>();
  const reportedMissing = new Set<string>();

  let currentHole: number | null = null;
  let sinkSequencePlayed = false;
  let accentTimer: unknown = null;
  let accentToken = 0;
  let activeSources = 0;
  let lastEvent: GameAudioEvent | null = null;
  const lastVariation: Record<string, number | null> = {};
  let lastPuttVariation: string | null = null;
  let lastCupVariation: string | null = null;

  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  const unlockListener = () => {
    void unlockContext();
  };

  /** Resumes the AudioContext; detaches the gesture listeners once running. */
  async function unlockContext(): Promise<boolean> {
    if (disposed || !ensureContext() || !context) return false;
    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        return false;
      }
    }
    unlocked = context.state === "running";
    if (unlocked && options.unlockTarget) {
      options.unlockTarget.removeEventListener("pointerdown", unlockListener, {
        capture: true,
      });
      options.unlockTarget.removeEventListener("keydown", unlockListener, {
        capture: true,
      });
    }
    notify();
    return unlocked;
  }
  const visibilityListener = () => {
    const target = options.visibilityTarget;
    if (!target) return;
    if (target.hidden) {
      cancelScheduledAccent("tab hidden");
      if (context && context.state === "running") void context.suspend();
    } else if (context && unlocked && context.state === "suspended") {
      void context.resume();
    }
    notify();
  };

  function defaultContextFactory(): (() => AudioContextLike) | null {
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    return () => new Ctor() as unknown as AudioContextLike;
  }

  function applyGains() {
    if (masterGain) {
      masterGain.gain.value = settings.masterVolume;
    }
    if (effectsGain) effectsGain.gain.value = settings.effectsVolume;
  }

  function persist() {
    saveAudioSettings(storage, settings);
  }

  function ensureContext(): boolean {
    if (context || !createContext) return context !== null;
    try {
      context = createContext();
      masterGain = context.createGain();
      effectsGain = context.createGain();
      effectsGain.connect(masterGain);
      masterGain.connect(context.destination);
      applyGains();
      if (context.state === "running") unlocked = true;
    } catch (error) {
      log("warn", `AudioContext unavailable: ${String(error)}`);
      context = null;
      return false;
    }
    return true;
  }

  async function loadBuffer(url: string): Promise<unknown | null> {
    if (disposed) return null;
    const cached = buffers.get(url);
    if (cached) return cached;
    const pending = pendingLoads.get(url);
    if (pending) return pending;
    if (!ensureContext() || !context) return null;
    const load = (async () => {
      try {
        const data = await fetchAudioData(resolveUrl(url));
        const buffer = await context.decodeAudioData(data);
        buffers.set(url, buffer);
        decodeFailures.delete(url);
        return buffer;
      } catch (error) {
        decodeFailures.add(url);
        if (!reportedMissing.has(url)) {
          reportedMissing.add(url);
          log("error", `Failed to load/decode audio ${url}: ${String(error)}`);
        }
        return null;
      } finally {
        pendingLoads.delete(url);
        notify();
      }
    })();
    pendingLoads.set(url, load);
    return load;
  }

  function playBuffer(
    url: string,
    family: keyof typeof FAMILY_GAIN,
    jitter: boolean,
  ): boolean {
    if (disposed || !context || !effectsGain) return false;
    const buffer = buffers.get(url);
    if (!buffer) {
      if (!reportedMissing.has(url)) {
        reportedMissing.add(url);
        log("warn", `Audio not ready or missing, skipping: ${url}`);
      }
      return false;
    }
    if (activeSources >= MAX_ACTIVE_SOURCES) {
      log("warn", "Too many concurrent sounds; skipping one-shot.");
      return false;
    }
    try {
      const source = context.createBufferSource();
      source.buffer = buffer;
      if (jitter) source.playbackRate.value = pitchJitter(random);
      const shotGain = context.createGain();
      shotGain.gain.value =
        FAMILY_GAIN[family] * (jitter ? gainJitter(random) : 1);
      source.connect(shotGain);
      shotGain.connect(effectsGain);
      activeSources += 1;
      source.onended = () => {
        activeSources = Math.max(0, activeSources - 1);
        try {
          source.disconnect();
          shotGain.disconnect();
        } catch {
          /* already disconnected */
        }
        notify();
      };
      source.start();
      return true;
    } catch (error) {
      log("warn", `Playback failed for ${url}: ${String(error)}`);
      return false;
    }
  }

  function setEvent(kind: GameAudioEvent["kind"], detail: string) {
    lastEvent = { kind, detail, at: Date.now() };
    notify();
  }

  function cancelScheduledAccent(reason: string) {
    accentToken += 1;
    if (accentTimer !== null) {
      cancelTimeout(accentTimer);
      accentTimer = null;
      if (isDev) log("warn", `Scheduled completion accent cancelled: ${reason}`);
    }
  }

  function holeAccentUrl(holeNumber: number | null): string | null {
    if (holeNumber === null) return null;
    try {
      return manifest.holes[holeAudioId(holeNumber)]?.complete ?? null;
    } catch {
      return null;
    }
  }

  function playCupDropNow(): { delayMs: number } {
    const fallbackDelay = 450;
    const cupIndex = pickVariation(
      manifest.cup.length,
      lastVariation.cup ?? null,
      random,
    );
    if (cupIndex < 0) {
      setEvent("skipped", "cup (no variants)");
      return { delayMs: fallbackDelay };
    }
    lastVariation.cup = cupIndex;
    const cupUrl = manifest.cup[cupIndex];
    lastCupVariation = cupUrl;
    const played = playBuffer(cupUrl, "cup", true);
    setEvent(
      played ? "cup" : "skipped",
      `cup #${cupIndex + 1}${played ? "" : " not played"}`,
    );
    return { delayMs: manifest.cupAccentDelayMs[cupIndex] ?? fallbackDelay };
  }

  function playHoleCompleteNow(holeNumber: number): boolean {
    const accentUrl = holeAccentUrl(holeNumber);
    if (!accentUrl) {
      log("warn", `Hole ${holeNumber} has no completion accent; skipping.`);
      setEvent("skipped", `hole ${holeNumber} accent missing`);
      return false;
    }
    const played = playBuffer(accentUrl, "hole", false);
    setEvent(
      played ? "hole-complete" : "skipped",
      `${holeAudioId(holeNumber)}${played ? "" : " accent not played"}`,
    );
    return played;
  }

  function playApplauseNow(): boolean {
    const played = playBuffer(manifest.applause, "applause", false);
    setEvent(
      played ? "applause" : "skipped",
      `score applause${played ? "" : " not played"}`,
    );
    return played;
  }

  return {
    /** Idempotent. Safe before any user gesture: nothing audible plays. */
    initialize() {
      if (initialized || disposed) return;
      initialized = true;
      settings = loadAudioSettings(storage);
      ensureContext();
      applyGains();
      options.unlockTarget?.addEventListener("pointerdown", unlockListener, {
        capture: true,
      });
      options.unlockTarget?.addEventListener("keydown", unlockListener, {
        capture: true,
      });
      options.visibilityTarget?.addEventListener(
        "visibilitychange",
        visibilityListener,
      );
      void this.preloadCoreSounds();
      notify();
    },

    /**
     * Resumes the AudioContext. Call from a genuine user gesture; also wired
     * automatically to the first pointerdown/keydown via initialize().
     */
    unlock() {
      return unlockContext();
    },

    /** Fetch + decode applause and every core gameplay effect. */
    async preloadCoreSounds() {
      const urls = [
        manifest.applause,
        ...PUTT_INTENSITIES.flatMap((intensity) => manifest.putt[intensity]),
        ...manifest.cup,
      ];
      const results = await Promise.all(urls.map((url) => loadBuffer(url)));
      const failed = urls.filter((_, index) => !results[index]);
      if (failed.length) {
        log(
          "error",
          `Core audio failed to load: ${failed.join(", ")}. Gameplay feedback will be missing until it loads.`,
        );
      }
      return failed.length === 0;
    },

    /** Loads the hole's completion accent (and warms the next hole's). */
    async loadHoleSounds(holeNumber: number, nextHoleNumber?: number) {
      currentHole = holeNumber;
      cancelScheduledAccent("hole changed");
      notify();
      const url = holeAccentUrl(holeNumber);
      if (!url) {
        log("warn", `No completion accent mapped for hole ${holeNumber}.`);
        return false;
      }
      const buffer = await loadBuffer(url);
      if (nextHoleNumber !== undefined) {
        const nextUrl = holeAccentUrl(nextHoleNumber);
        if (nextUrl) void loadBuffer(nextUrl);
      }
      return buffer !== null;
    },

    /**
     * Marks the start of a fresh hole attempt (new hole, restart, or play
     * again) — the only paths that re-arm the sink sequence.
     */
    beginHoleAttempt(holeNumber: number) {
      currentHole = holeNumber;
      sinkSequencePlayed = false;
      cancelScheduledAccent("new attempt");
      notify();
    },

    /**
     * One confirmed stroke → one impact sound. Call at the exact moment the
     * stroke impulse is applied to the ball.
     */
    playPutt(power: number) {
      const intensity: PuttIntensity = puttIntensityForPower(power);
      const variants = manifest.putt[intensity];
      const index = pickVariation(
        variants.length,
        lastVariation[`putt-${intensity}`] ?? null,
        random,
      );
      if (index < 0) {
        setEvent("skipped", `putt ${intensity} (no variants)`);
        return null;
      }
      lastVariation[`putt-${intensity}`] = index;
      const url = variants[index];
      const played = playBuffer(url, "putt", true);
      lastPuttVariation = url;
      setEvent(
        played ? "putt" : "skipped",
        `${intensity} #${index + 1} (power ${power.toFixed(2)})${played ? "" : " not played"}`,
      );
      return played ? { intensity, index, url } : null;
    },

    /**
     * One physical ball-into-cup sound. Returns the accent delay matched to
     * the chosen cup take so a follow-up accent lands as it settles.
     */
    playCupDrop(): { delayMs: number } {
      return playCupDropNow();
    },

    /** The hole's completion accent, immediately. */
    playHoleComplete(holeNumber: number) {
      return playHoleCompleteNow(holeNumber);
    },

    /** Restrained crowd response for a confirmed score. */
    playApplause() {
      return playApplauseNow();
    },

    /**
     * The confirmed-sink sequence: one physical cup drop now, then that
     * hole's completion accent after a delay matched to the cup take.
     * Guarded to fire exactly once per hole attempt no matter how many
     * times the caller reports the sink.
     */
    playSinkSequence(holeNumber: number) {
      if (sinkSequencePlayed) {
        setEvent("suppressed-duplicate-sink", `hole ${holeNumber}`);
        return false;
      }
      sinkSequencePlayed = true;
      currentHole = holeNumber;

      const { delayMs } = playCupDropNow();
      playApplauseNow();

      const token = ++accentToken;
      if (!holeAccentUrl(holeNumber)) {
        log("warn", `Hole ${holeNumber} has no completion accent; skipping.`);
        return true;
      }
      accentTimer = scheduleTimeout(() => {
        accentTimer = null;
        if (disposed || token !== accentToken) return;
        playHoleCompleteNow(holeNumber);
      }, delayMs);
      notify();
      return true;
    },

    cancelScheduledSounds() {
      cancelScheduledAccent("explicit cancel");
      notify();
    },

    setMasterVolume(value: number) {
      settings.masterVolume = clampVolume(value, settings.masterVolume);
      applyGains();
      persist();
      notify();
    },

    setEffectsVolume(value: number) {
      settings.effectsVolume = clampVolume(value, settings.effectsVolume);
      applyGains();
      persist();
      notify();
    },

    getSettings(): AudioSettings {
      return { ...settings };
    },

    pause() {
      cancelScheduledAccent("paused");
      if (context && context.state === "running") void context.suspend();
      notify();
    },

    resume() {
      if (context && unlocked && context.state === "suspended") {
        void context.resume();
      }
      notify();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      cancelScheduledAccent("disposed");
      options.unlockTarget?.removeEventListener("pointerdown", unlockListener, {
        capture: true,
      });
      options.unlockTarget?.removeEventListener("keydown", unlockListener, {
        capture: true,
      });
      options.visibilityTarget?.removeEventListener(
        "visibilitychange",
        visibilityListener,
      );
      buffers.clear();
      pendingLoads.clear();
      listeners.clear();
      if (context && context.state !== "closed") void context.close();
      context = null;
      masterGain = null;
      effectsGain = null;
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getDebugState(): GameAudioDebugState {
      const accentUrl = holeAccentUrl(currentHole);
      return {
        contextState: context ? context.state : "unavailable",
        unlocked,
        settings: { ...settings },
        loadedUrls: [...buffers.keys()],
        decodeFailures: [...decodeFailures],
        currentHole,
        currentHoleAccentUrl: accentUrl,
        currentHoleAccentLoaded: accentUrl !== null && buffers.has(accentUrl),
        applauseLoaded: buffers.has(manifest.applause),
        lastEvent,
        lastPuttVariation,
        lastCupVariation,
        sinkSequencePlayed,
        accentScheduled: accentTimer !== null,
        activeSources,
        manifestIssueCount: allManifestUrls(manifest).filter(
          (url) => decodeFailures.has(url),
        ).length,
      };
    },
  };
}
