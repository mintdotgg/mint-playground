// Audio preferences persisted in localStorage. Values are validated and
// clamped on read so a corrupted or hand-edited entry can never produce NaN
// gains or out-of-range volumes.

export type AudioSettings = {
  masterVolume: number;
  effectsVolume: number;
};

export const AUDIO_SETTINGS_STORAGE_KEY = "genesis-grove-audio-v1";

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 0.9,
  effectsVolume: 1,
};

export function clampVolume(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(1, Math.max(0, numeric));
}

export function sanitizeAudioSettings(raw: unknown): AudioSettings {
  const source = (raw ?? {}) as Partial<Record<keyof AudioSettings, unknown>>;
  return {
    masterVolume: clampVolume(
      source.masterVolume,
      DEFAULT_AUDIO_SETTINGS.masterVolume,
    ),
    effectsVolume: clampVolume(
      source.effectsVolume,
      DEFAULT_AUDIO_SETTINGS.effectsVolume,
    ),
  };
}

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function loadAudioSettings(storage: StorageLike | null): AudioSettings {
  if (!storage) return { ...DEFAULT_AUDIO_SETTINGS };
  try {
    const raw = storage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
    return sanitizeAudioSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function saveAudioSettings(
  storage: StorageLike | null,
  settings: AudioSettings,
): void {
  if (!storage) return;
  try {
    storage.setItem(
      AUDIO_SETTINGS_STORAGE_KEY,
      JSON.stringify(sanitizeAudioSettings(settings)),
    );
  } catch {
    // Storage may be unavailable (private browsing quotas); settings simply
    // stay session-local in that case.
  }
}
