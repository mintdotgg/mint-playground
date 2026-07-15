export type ShowroomAudioStatus = 'ready' | 'loading' | 'on' | 'off' | 'paused' | 'error'

export interface ShowroomAudioState {
  status: ShowroomAudioStatus
  activated: boolean
  muted: boolean
  ambiencePlaying: boolean
  selectionPlays: number
  contextState: AudioContextState | 'uninitialized'
}

interface ShowroomAudioOptions {
  selectionUrl: string
  ambienceUrl: string
  onStateChange?: (state: ShowroomAudioState) => void
}

export class ShowroomAudio {
  private readonly selectionUrl: string
  private readonly ambienceUrl: string
  private readonly onStateChange?: (state: ShowroomAudioState) => void
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private ambienceGain: GainNode | null = null
  private selectionGain: GainNode | null = null
  private ambienceSource: AudioBufferSourceNode | null = null
  private selectionBuffer: AudioBuffer | null = null
  private ambienceBuffer: AudioBuffer | null = null
  private loadPromise: Promise<void> | null = null
  private activated = false
  private muted = false
  private loading = false
  private failed = false
  private visibilityPaused = false
  private selectionPlays = 0
  private disposed = false

  constructor(options: ShowroomAudioOptions) {
    this.selectionUrl = options.selectionUrl
    this.ambienceUrl = options.ambienceUrl
    this.onStateChange = options.onStateChange
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    this.emitState()
  }

  get hasActivated(): boolean {
    return this.activated
  }

  async activate(): Promise<void> {
    if (this.disposed || this.failed) return

    this.activated = true
    this.loading = !this.selectionBuffer || !this.ambienceBuffer
    const context = this.ensureContext()
    if (context.state === 'suspended') {
      void context.resume().then(() => {
        if (!this.muted && !document.hidden) this.startAmbience()
        this.emitState()
      }).catch(() => this.emitState())
    }
    this.emitState()

    try {
      if (!this.loadPromise) this.loadPromise = this.loadAssets(context)
      await this.loadPromise
      this.loading = false
      if (!this.muted && !document.hidden) this.startAmbience()
      this.setMasterLevel(this.muted ? 0 : 1, .28)
      this.emitState()
    } catch (error) {
      this.loading = false
      this.failed = true
      this.emitState()
      console.error('Showroom audio could not be initialized.', error)
    }
  }

  async playSelection(): Promise<void> {
    if (this.disposed) return
    await this.activate()
    if (!this.context || !this.selectionBuffer || this.muted || this.failed) return

    const source = this.context.createBufferSource()
    source.buffer = this.selectionBuffer
    source.connect(this.selectionGain!)
    source.addEventListener('ended', () => source.disconnect(), { once: true })
    source.start()
    this.selectionPlays += 1
    this.emitState()
  }

  async toggle(): Promise<void> {
    if (this.disposed || this.failed) return

    if (!this.activated) {
      this.muted = false
      await this.activate()
      return
    }

    this.muted = !this.muted
    if (!this.muted) {
      await this.activate()
      this.startAmbience()
    }
    this.setMasterLevel(this.muted ? 0 : 1, .22)
    this.emitState()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    this.ambienceSource?.stop()
    this.ambienceSource?.disconnect()
    this.ambienceSource = null
    this.context?.removeEventListener('statechange', this.onContextStateChange)
    void this.context?.close()
    this.context = null
  }

  private ensureContext(): AudioContext {
    if (this.context) return this.context

    this.context = new AudioContext({ latencyHint: 'interactive' })
    this.context.addEventListener('statechange', this.onContextStateChange)
    this.masterGain = this.context.createGain()
    this.ambienceGain = this.context.createGain()
    this.selectionGain = this.context.createGain()

    this.masterGain.gain.value = 0
    this.ambienceGain.gain.value = .105
    this.selectionGain.gain.value = .38
    this.ambienceGain.connect(this.masterGain)
    this.selectionGain.connect(this.masterGain)
    this.masterGain.connect(this.context.destination)
    return this.context
  }

  private async loadAssets(context: AudioContext): Promise<void> {
    const [selectionData, ambienceData] = await Promise.all([
      this.fetchAudio(this.selectionUrl),
      this.fetchAudio(this.ambienceUrl),
    ])
    const [selectionBuffer, ambienceBuffer] = await Promise.all([
      context.decodeAudioData(selectionData),
      context.decodeAudioData(ambienceData),
    ])
    this.selectionBuffer = selectionBuffer
    this.ambienceBuffer = ambienceBuffer
  }

  private async fetchAudio(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Audio request failed (${response.status}) for ${url}`)
    return response.arrayBuffer()
  }

  private startAmbience(): void {
    if (!this.context || !this.ambienceBuffer || this.ambienceSource || document.hidden) return

    const source = this.context.createBufferSource()
    source.buffer = this.ambienceBuffer
    source.loop = true
    source.connect(this.ambienceGain!)
    source.addEventListener('ended', () => {
      if (this.ambienceSource === source) this.ambienceSource = null
      source.disconnect()
      this.emitState()
    }, { once: true })
    source.start()
    this.ambienceSource = source
    this.ramp(this.ambienceGain!.gain, 0, .105, .8)
  }

  private setMasterLevel(level: number, duration: number): void {
    if (!this.context || !this.masterGain) return
    this.ramp(this.masterGain.gain, this.masterGain.gain.value, level, duration)
  }

  private ramp(parameter: AudioParam, from: number, to: number, duration: number): void {
    if (!this.context) return
    const now = this.context.currentTime
    parameter.cancelScheduledValues(now)
    parameter.setValueAtTime(from, now)
    parameter.linearRampToValueAtTime(to, now + duration)
  }

  private readonly onVisibilityChange = (): void => {
    if (!this.context || !this.activated || this.muted) return

    if (document.hidden) {
      this.visibilityPaused = true
      this.ramp(this.ambienceGain!.gain, this.ambienceGain!.gain.value, 0, .16)
      window.setTimeout(() => {
        if (document.hidden && this.context?.state === 'running') void this.context.suspend().then(() => this.emitState())
      }, 180)
    } else if (this.visibilityPaused) {
      this.visibilityPaused = false
      void this.context.resume().then(() => {
        this.startAmbience()
        this.ramp(this.ambienceGain!.gain, this.ambienceGain!.gain.value, .105, .5)
        this.emitState()
      })
    }
    this.emitState()
  }

  private readonly onContextStateChange = (): void => {
    if (this.context?.state === 'running' && !this.muted && !document.hidden) this.startAmbience()
    this.emitState()
  }

  private emitState(): void {
    let status: ShowroomAudioStatus = 'ready'
    if (this.failed) status = 'error'
    else if (this.loading) status = 'loading'
    else if (this.muted) status = 'off'
    else if (this.visibilityPaused || (this.activated && this.context?.state === 'suspended')) status = 'paused'
    else if (this.activated) status = 'on'

    this.onStateChange?.({
      status,
      activated: this.activated,
      muted: this.muted,
      ambiencePlaying: Boolean(this.ambienceSource) && !this.muted && !this.visibilityPaused,
      selectionPlays: this.selectionPlays,
      contextState: this.context?.state ?? 'uninitialized',
    })
  }
}
