import { mintAudioPaths } from '../assets/mintAssets'
import { useAppStore } from '../state/store'

type AudioCue = 'placement' | 'material' | 'lighting' | 'drawer' | 'cart'

export class AudioSystem {
  private context: AudioContext | null = null
  private ambience: HTMLAudioElement | null = null
  private unsubscribe: (() => void) | null = null

  constructor() {
    window.addEventListener('roomritual:audio', this.onAudioEvent as EventListener)
    this.unsubscribe = useAppStore.subscribe((state, previous) => {
      if (state.ambienceEnabled !== previous.ambienceEnabled || state.audioEnabled !== previous.audioEnabled) {
        this.syncAmbience(state.audioEnabled && state.ambienceEnabled)
      }
    })
  }

  private ensureContext() {
    if (!this.context) this.context = new AudioContext()
    if (this.context.state === 'suspended') void this.context.resume()
    return this.context
  }

  private onAudioEvent = (event: CustomEvent<AudioCue>) => {
    if (!useAppStore.getState().audioEnabled) return
    this.play(event.detail)
  }

  private play(cue: AudioCue) {
    const path = mintAudioPaths[cue]
    if (path) {
      const audio = new Audio(path)
      audio.volume = cue === 'drawer' ? 0.32 : 0.24
      void audio.play().catch(() => this.playSynth(cue))
      return
    }
    this.playSynth(cue)
  }

  private playSynth(cue: AudioCue) {
    const context = this.ensureContext()
    const now = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const frequencies: Record<AudioCue, [number, number]> = {
      placement: [105, 62],
      material: [520, 760],
      lighting: [850, 360],
      drawer: [175, 92],
      cart: [440, 660],
    }
    oscillator.type = cue === 'placement' || cue === 'drawer' ? 'sine' : 'triangle'
    oscillator.frequency.setValueAtTime(frequencies[cue][0], now)
    oscillator.frequency.exponentialRampToValueAtTime(frequencies[cue][1], now + (cue === 'drawer' ? 0.32 : 0.12))
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(cue === 'placement' ? 0.055 : 0.025, now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (cue === 'drawer' ? 0.36 : 0.16))
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + (cue === 'drawer' ? 0.38 : 0.18))
  }

  private syncAmbience(enabled: boolean) {
    if (!enabled) {
      if (this.ambience) {
        this.ambience.pause()
        this.ambience.currentTime = 0
      }
      return
    }
    const path = mintAudioPaths.ambience
    if (!path) return
    if (!this.ambience) {
      this.ambience = new Audio(path)
      this.ambience.loop = true
      this.ambience.volume = 0.16
    }
    void this.ambience.play().catch(() => undefined)
  }

  dispose() {
    window.removeEventListener('roomritual:audio', this.onAudioEvent as EventListener)
    this.unsubscribe?.()
    this.ambience?.pause()
    void this.context?.close()
  }
}
