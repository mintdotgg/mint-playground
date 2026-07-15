/**
 * WebAudio manager for the gallery. All clips stream from Mint CDN.
 * Ambience loops at low gain; SFX are one-shots.
 */
export class GalleryAudio {
  private ctx: AudioContext | null = null
  private buffers = new Map<string, AudioBuffer>()
  private master: GainNode | null = null
  private ambienceSrc: AudioBufferSourceNode | null = null
  private ambienceGain: GainNode | null = null
  enabled = false
  private unlocked = false

  private urls: Record<string, string> = {
    ambience: 'https://cdn.mint.gg/audio/xd750qfgsraw01bsjbrycmwzj58afpgc/gallery-ambience-loop-c552ef-5681ab77a067f358.mp3',
    whoosh: 'https://cdn.mint.gg/audio/xd7dz4qg74v3g890dszzxxkxjx8aevhw/morph-whoosh-c87983-dfdf120f7758586b.mp3',
    blip: 'https://cdn.mint.gg/audio/xd7dkf29c4ye1vj7w1ftfb8gc98afhfz/ui-hover-blip-52e78f-d7d8ebc35bd25023.mp3',
    impact: 'https://cdn.mint.gg/audio/xd747atsw07zgt3zjsz6s0eprh8afr14/poster-lock-impact-4ae1d3-820e92c3f1b02b08.mp3',
  }

  /** Fetches and decodes everything that exists; missing files are skipped. */
  async preload(): Promise<void> {
    const ctx = this.ensureCtx()
    await Promise.all(
      Object.entries(this.urls).map(async ([key, url]) => {
        try {
          const res = await fetch(url)
          if (!res.ok) return
          const buf = await ctx.decodeAudioData(await res.arrayBuffer())
          this.buffers.set(key, buf)
        } catch {
          /* asset optional — gallery works silent */
        }
      })
    )
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.45
      this.master.connect(this.ctx.destination)
    }
    return this.ctx
  }

  /**
   * Call from the first user gesture. Only resumes the context — the gallery
   * starts muted and stays silent until the user opts in via the SND toggle.
   */
  unlock() {
    if (this.unlocked) return
    this.unlocked = true
    const ctx = this.ensureCtx()
    if (ctx.state === 'suspended') void ctx.resume()
  }

  setEnabled(on: boolean) {
    this.enabled = on
    if (on) {
      this.startAmbience()
    } else {
      this.stopAmbience()
    }
  }

  private startAmbience() {
    const ctx = this.ctx
    const buf = this.buffers.get('ambience')
    if (!ctx || !buf || !this.master || this.ambienceSrc) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 2.5)
    src.connect(gain).connect(this.master)
    src.start()
    this.ambienceSrc = src
    this.ambienceGain = gain
  }

  private stopAmbience() {
    const ctx = this.ctx
    if (!ctx || !this.ambienceSrc || !this.ambienceGain) return
    const src = this.ambienceSrc
    this.ambienceGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4)
    setTimeout(() => src.stop(), 500)
    this.ambienceSrc = null
    this.ambienceGain = null
  }

  play(key: 'whoosh' | 'blip' | 'impact', gain = 1) {
    if (!this.enabled) return
    const ctx = this.ctx
    const buf = this.buffers.get(key)
    if (!ctx || !buf || !this.master) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    const g = ctx.createGain()
    g.gain.value = gain
    src.connect(g).connect(this.master)
    src.start()
  }
}
