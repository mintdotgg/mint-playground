const AUDIO_PATHS = {
  ambience: 'https://cdn.mint.gg/audio/xd71spsm66tvd6bcqknzyzz4ph8ahek8/dynasty-index-arena-vault-ambience-6f3b2a-e3f0e5052990cb58.mp3',
  selection: 'https://cdn.mint.gg/audio/xd7fbggyavddvewxtan92pxheh8ahy5s/dynasty-index-card-selection-a4cb75-38886e4ae05d1a44.mp3',
  foil: 'https://cdn.mint.gg/audio/xd77e4ymzk1nty9670qek47g858agpqb/dynasty-index-foil-shimmer-f7a4c0-acbc4454ab52bbb5.mp3',
} as const;

export class AudioDirector {
  private readonly ambience = new Audio(AUDIO_PATHS.ambience);
  private readonly selection = new Audio(AUDIO_PATHS.selection);
  private readonly foil = new Audio(AUDIO_PATHS.foil);
  private unlocked = false;
  private muted = false;

  constructor() {
    this.ambience.loop = true;
    this.ambience.volume = 0.13;
    this.ambience.preload = 'auto';
    this.selection.volume = 0.38;
    this.selection.preload = 'auto';
    this.foil.volume = 0.24;
    this.foil.preload = 'auto';
  }

  async unlock(): Promise<void> {
    if (this.unlocked) return;
    this.unlocked = true;
    if (!this.muted) {
      try {
        await this.ambience.play();
      } catch {
        this.unlocked = false;
      }
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.ambience.muted = muted;
    this.selection.muted = muted;
    this.foil.muted = muted;
    if (!muted && this.unlocked && this.ambience.paused) void this.ambience.play();
  }

  playSelection(): void {
    if (!this.unlocked || this.muted) return;
    this.selection.currentTime = 0;
    void this.selection.play();
  }

  playFoil(): void {
    if (!this.unlocked || this.muted) return;
    this.foil.currentTime = 0;
    void this.foil.play();
  }

  setPageVisible(visible: boolean): void {
    if (!this.unlocked || this.muted) return;
    if (visible) void this.ambience.play();
    else this.ambience.pause();
  }

  dispose(): void {
    for (const audio of [this.ambience, this.selection, this.foil]) {
      audio.pause();
      audio.src = '';
    }
  }
}
