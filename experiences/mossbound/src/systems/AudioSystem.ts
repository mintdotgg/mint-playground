import { AUDIO_KEYS, MINT_AUDIO_URLS, type AudioKey } from '../assets/assetCatalog';

export class AudioSystem {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private readonly buffers = new Map<AudioKey, AudioBuffer>();
  private musicSource: AudioBufferSourceNode | null = null;
  private currentMusic: AudioKey | null = null;
  private muted = false;
  private duck = 1;

  async prepare(onProgress: (loaded: number, total: number, key: AudioKey) => void): Promise<void> {
    this.ensureContext();
    if (!this.context) throw new Error('Web Audio is not supported in this browser.');
    const missing = AUDIO_KEYS.filter((key) => !MINT_AUDIO_URLS[key]);
    if (missing.length > 0) throw new Error(`Mint audio paths are not ready: ${missing.join(', ')}`);

    let cursor = 0;
    let loaded = 0;
    const worker = async () => {
      while (cursor < AUDIO_KEYS.length) {
        const index = cursor;
        cursor += 1;
        const key = AUDIO_KEYS[index];
        const response = await fetch(MINT_AUDIO_URLS[key]);
        if (!response.ok) throw new Error(`Could not load ${key} (${response.status}).`);
        const buffer = await this.context!.decodeAudioData(await response.arrayBuffer());
        this.buffers.set(key, buffer);
        loaded += 1;
        onProgress(loaded, AUDIO_KEYS.length, key);
      }
    };
    await Promise.all(Array.from({ length: 3 }, () => worker()));
  }

  unlock(): void {
    this.ensureContext();
    if (this.context?.state === 'suspended') {
      void this.context.resume().catch(() => undefined);
    }
  }

  play(key: AudioKey, random: () => number, volume = 1, pitchVariance = .06): void {
    if (!this.context || !this.sfxGain || this.context.state !== 'running' || this.muted) return;
    const buffer = this.buffers.get(key);
    if (!buffer) return;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = 1 + (random() - .5) * pitchVariance * 2;
    gain.gain.value = volume;
    source.connect(gain).connect(this.sfxGain);
    source.start();
  }

  playMusic(key: 'forestLoop' | 'bossLoop'): void {
    if (!this.context || !this.musicGain || this.currentMusic === key) return;
    this.musicSource?.stop();
    const buffer = this.buffers.get(key);
    if (!buffer) return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.musicGain);
    source.start();
    this.musicSource = source;
    this.currentMusic = key;
  }

  setDuck(value: number): void {
    if (!this.musicGain || !this.context) return;
    const next = Math.max(0, Math.min(1, value));
    if (Math.abs(next - this.duck) < .001) return;
    this.duck = next;
    this.musicGain.gain.setTargetAtTime(this.muted ? 0 : .42 * next, this.context.currentTime, .04);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.context.currentTime, .03);
    return this.muted;
  }

  dispose(): void {
    this.musicSource?.stop();
    void this.context?.close();
    this.context = null;
    this.buffers.clear();
  }

  private ensureContext(): void {
    if (this.context) return;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    this.context = new AudioContextClass();
    this.master = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.sfxGain = this.context.createGain();
    this.musicGain.gain.value = .42;
    this.sfxGain.gain.value = .84;
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.master.connect(this.context.destination);
  }
}
