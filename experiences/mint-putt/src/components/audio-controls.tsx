"use client";

// Header cluster for master and effects volume. Audio is always enabled;
// everything routes through the shared
// GameAudioManager, which clamps values and persists them to localStorage.
// Native range inputs keep the controls keyboard accessible.

import { getGameAudio } from "@/lib/game-audio";
import { useGameAudioStore } from "@/lib/use-game-audio";
import {
  DEFAULT_AUDIO_SETTINGS,
  type AudioSettings,
} from "@/lib/audio-settings";

const selectSettings = (audio: NonNullable<ReturnType<typeof getGameAudio>>) =>
  audio.getSettings();

export function AudioControls() {
  const settings: AudioSettings = useGameAudioStore(
    selectSettings,
    DEFAULT_AUDIO_SETTINGS,
  );

  return (
    <div className="audio-controls" role="group" aria-label="Sound settings">
      <label className="audio-slider">
        <span>Master</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.masterVolume}
          aria-label="Master volume"
          onChange={(event) =>
            getGameAudio()?.setMasterVolume(Number(event.target.value))
          }
        />
      </label>
      <label className="audio-slider">
        <span>Effects</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.effectsVolume}
          aria-label="Sound effects volume"
          onChange={(event) =>
            getGameAudio()?.setEffectsVolume(Number(event.target.value))
          }
        />
      </label>
    </div>
  );
}
