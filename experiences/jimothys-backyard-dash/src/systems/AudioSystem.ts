import { AUDIO_PATHS } from '../assets/assetPaths';
import type { RaceEvent } from '../game/types';

export type AudioSettings = {
  master: number;
  music: number;
  effects: number;
  muted: boolean;
};

const STORAGE_KEY = 'jimothy-audio-settings';
const STREAMED_LOOP_GAINS: Record<string, number> = {
  'backyard-music': 1,
  'backyard-ambience': 0.55,
};
const STREAMED_LOOP_KEYS = new Set(Object.keys(STREAMED_LOOP_GAINS));

export class AudioSystem {
  private readonly context: AudioContext | null;
  private readonly masterGain: GainNode | null;
  private readonly musicGain: GainNode | null;
  private readonly effectsGain: GainNode | null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly streamedLoops = new Map<string, HTMLAudioElement>();
  private readonly activeStreamedLoops = new Set<string>();
  private loadPromise: Promise<void> | null = null;
  private unlocked = false;
  private paused = false;
  private settings: AudioSettings = { master: 0.82, music: 0.58, effects: 0.9, muted: false };

  constructor() {
    this.settings = this.readSettings();
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    this.context = AudioContextClass ? new AudioContextClass() : null;
    this.masterGain = this.context?.createGain() ?? null;
    this.musicGain = this.context?.createGain() ?? null;
    this.effectsGain = this.context?.createGain() ?? null;
    if (this.context && this.masterGain && this.musicGain && this.effectsGain) {
      this.musicGain.connect(this.masterGain);
      this.effectsGain.connect(this.masterGain);
      this.masterGain.connect(this.context.destination);
    }
    for (const key of STREAMED_LOOP_KEYS) {
      const media = new Audio(AUDIO_PATHS[key]);
      media.loop = true;
      media.preload = 'metadata';
      this.streamedLoops.set(key, media);
    }
    this.applySettings();
  }

  get audioSettings(): AudioSettings {
    return { ...this.settings };
  }

  get assetCount(): number {
    return this.buffers.size + this.streamedLoops.size;
  }

  get diagnostics(): { contextState: string; loadedBuffers: number; streamedTracks: number; unlocked: boolean; loops: number } {
    return {
      contextState: this.context?.state ?? 'unsupported',
      loadedBuffers: this.buffers.size,
      streamedTracks: this.streamedLoops.size,
      unlocked: this.unlocked,
      loops: this.activeStreamedLoops.size,
    };
  }

  async loadAll(onItem: (key: string, loaded: number, total: number) => void): Promise<void> {
    if (!this.context) return;
    if (this.loadPromise) return this.loadPromise;
    const entries = Object.entries(AUDIO_PATHS).filter(([key]) => !STREAMED_LOOP_KEYS.has(key));
    this.loadPromise = this.loadEffects(entries, onItem);
    return this.loadPromise;
  }

  async unlock(): Promise<void> {
    if (!this.context) return;
    if (this.context.state !== 'running') await this.context.resume();
    this.unlocked = this.context.state === 'running';
  }

  startRaceLoops(): void {
    for (const [key, media] of this.streamedLoops) {
      if (this.activeStreamedLoops.has(key)) continue;
      this.activeStreamedLoops.add(key);
      const playPromise = media.play();
      if (playPromise) void playPromise.catch(() => this.activeStreamedLoops.delete(key));
    }
  }

  stopRaceLoops(): void {
    for (const media of this.streamedLoops.values()) {
      media.pause();
      media.currentTime = 0;
    }
    this.activeStreamedLoops.clear();
  }

  handle(event: RaceEvent): void {
    if (event.type === 'countdown') this.play('countdown-sound', 0.86, 1 + (3 - event.value) * 0.025);
    if (event.type === 'go') this.play('start-sound', 1);
    if (event.type === 'token') this.play('pickup-sound', 0.84, 0.96 + Math.min(0.16, event.combo * 0.012));
    if (event.type === 'powerup') this.play('powerup-sound', 0.95);
    if (event.type === 'boost') this.play('boost-sound', 0.88);
    if (event.type === 'collision') this.play('collision-sound', event.protected ? 0.68 : 0.9);
    if (event.type === 'section' && event.index === 4) this.play('final-section-sound', 0.94);
    if (event.type === 'finish') {
      this.play('finish-sound', 1);
      window.setTimeout(() => this.play('results-sound', 0.8), 1300);
    }
    if (event.type === 'failed') this.play('collision-sound', 0.66, 0.82);
  }

  playStep(index: number): void {
    this.play('paw-step-sound', 0.18, 0.94 + (index % 4) * 0.025);
  }

  setSettings(next: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...next };
    this.applySettings();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings)); } catch { /* storage optional */ }
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.updateStreamedVolumes();
    if (this.masterGain && this.context) {
      const target = paused ? 0.32 : this.settings.muted ? 0 : this.settings.master;
      this.masterGain.gain.setTargetAtTime(target, this.context.currentTime, 0.04);
    }
  }

  dispose(): void {
    this.stopRaceLoops();
    for (const media of this.streamedLoops.values()) {
      media.removeAttribute('src');
      media.load();
    }
    this.streamedLoops.clear();
    void this.context?.close();
    this.buffers.clear();
  }

  private play(key: string, gainValue = 1, rate = 1): void {
    if (!this.context || !this.effectsGain || !this.unlocked) return;
    const buffer = this.buffers.get(key);
    if (!buffer) return;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    gain.gain.value = gainValue;
    source.connect(gain).connect(this.effectsGain);
    source.start();
  }

  private applySettings(): void {
    this.updateStreamedVolumes();
    if (this.context && this.masterGain && this.musicGain && this.effectsGain) {
      const now = this.context.currentTime;
      this.masterGain.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.master, now, 0.02);
      this.musicGain.gain.setTargetAtTime(this.settings.music, now, 0.02);
      this.effectsGain.gain.setTargetAtTime(this.settings.effects, now, 0.02);
    }
  }

  private updateStreamedVolumes(): void {
    const pauseGain = this.paused ? 0.32 : 1;
    const master = this.settings.muted ? 0 : this.settings.master;
    for (const [key, media] of this.streamedLoops) {
      media.volume = Math.min(1, master * this.settings.music * (STREAMED_LOOP_GAINS[key] ?? 1) * pauseGain);
    }
  }

  private async loadEffects(entries: [string, string][], onItem: (key: string, loaded: number, total: number) => void): Promise<void> {
    let nextIndex = 0;
    let completed = 0;
    const worker = async (): Promise<void> => {
      while (nextIndex < entries.length) {
        const [key, path] = entries[nextIndex++];
        try {
          const response = await fetch(path);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const encoded = await response.arrayBuffer();
          this.buffers.set(key, await this.context!.decodeAudioData(encoded));
        } catch (error) {
          console.warn(`Optional audio load failed: ${key}`, error);
        }
        completed += 1;
        onItem(key, completed, entries.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(2, entries.length) }, () => worker()));
  }

  private readSettings(): AudioSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return this.settings;
      const parsed = JSON.parse(raw) as Partial<AudioSettings>;
      return {
        master: typeof parsed.master === 'number' ? parsed.master : this.settings.master,
        music: typeof parsed.music === 'number' ? parsed.music : this.settings.music,
        effects: typeof parsed.effects === 'number' ? parsed.effects : this.settings.effects,
        muted: typeof parsed.muted === 'boolean' ? parsed.muted : this.settings.muted,
      };
    } catch {
      return this.settings;
    }
  }
}
