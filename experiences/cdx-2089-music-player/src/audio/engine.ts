import { MPEGDecoder } from 'mpg123-decoder'
import { TRACKS } from './tracks'
import { damp } from '../tween'

export interface Bands {
  bass: number
  mid: number
  high: number
  level: number
  /** 1.0 on a detected bass hit, exponential decay */
  pulse: number
}

type EngineEvent = 'track' | 'state' | 'durations' | 'error'

const decoder = new MPEGDecoder()
const decodedTracks = new Map<string, Promise<{
  channelData: Float32Array[]
  samplesDecoded: number
  sampleRate: number
}>>()
let decodeQueue = Promise.resolve()
let decoderDisposed = false

function loadAudioBytes(url: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('GET', url, true)
    request.responseType = 'arraybuffer'
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`Unable to load audio: ${request.status}`))
        return
      }
      resolve(new Uint8Array(request.response as ArrayBuffer))
    }
    request.onerror = () => reject(new Error('Unable to load audio from Mint CDN'))
    request.send()
  })
}

function decodeTrack(url: string) {
  const cached = decodedTracks.get(url)
  if (cached) return cached

  const task = decodeQueue.then(async () => {
    const bytes = await loadAudioBytes(url)
    await decoder.ready
    try {
      return decoder.decode(bytes)
    } finally {
      await decoder.reset()
    }
  })
  decodeQueue = task.then(() => undefined, () => undefined)
  decodedTracks.set(url, task)
  void task.catch(() => decodedTracks.delete(url))
  return task
}

export function disposeAudioRuntime() {
  if (decoderDisposed) return
  decoderDisposed = true
  decodedTracks.clear()
  decoder.free()
}

// One Web Audio graph with a portable MPEG decoder for analysis and playback.
export class AudioEngine {
  ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private gain: GainNode | null = null
  private source: AudioBufferSourceNode | null = null
  private buffer: AudioBuffer | null = null
  private startedAt = 0
  private offset = 0
  private loadToken = 0
  private lastError: string | null = null
  private listeners: Record<string, Array<() => void>> = {}

  readonly freq = new Uint8Array(1024)
  readonly wave = new Uint8Array(1024)
  readonly bands: Bands = { bass: 0, mid: 0, high: 0, level: 0, pulse: 0 }

  trackIndex = 0
  playing = false
  unavailable = new Set<number>()
  durations: number[] = TRACKS.map(() => NaN)

  private bassFast = 0
  private bassSlow = 0
  private beatCooldown = 0

  /** Must be called from a user gesture. */
  unlock() {
    if (this.ctx) {
      void this.ctx.resume()
      return
    }
    this.ctx = new AudioContext()
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 2048
    this.analyser.smoothingTimeConstant = 0.72
    this.gain = this.ctx.createGain()
    this.gain.gain.value = 0.9
    this.analyser.connect(this.gain)
    this.gain.connect(this.ctx.destination)
  }

  load(i: number, autoplay: boolean) {
    const n = TRACKS.length
    this.trackIndex = ((i % n) + n) % n
    const token = ++this.loadToken
    this.stopSource()
    this.buffer = null
    this.offset = 0
    this.lastError = null
    this.setPlaying(false)
    this.emit('track')
    void this.prepareTrack(token, autoplay)
  }

  private async prepareTrack(token: number, autoplay: boolean) {
    if (!this.ctx) return
    const trackIndex = this.trackIndex
    try {
      const decoded = await decodeTrack(TRACKS[trackIndex].file)
      if (token !== this.loadToken || !this.ctx) return
      const buffer = this.ctx.createBuffer(
        decoded.channelData.length,
        decoded.samplesDecoded,
        decoded.sampleRate,
      )
      decoded.channelData.forEach((channel, index) => {
        buffer.copyToChannel(
          new Float32Array(channel.subarray(0, decoded.samplesDecoded)),
          index,
        )
      })
      this.buffer = buffer
      this.durations[trackIndex] = buffer.duration
      this.emit('durations')
      if (autoplay) this.playFromOffset()
    } catch (error) {
      if (token !== this.loadToken) return
      this.lastError = error instanceof Error ? error.message : String(error)
      this.unavailable.add(trackIndex)
      this.emit('error')
      if (this.unavailable.size < TRACKS.length) this.next(true)
      else this.setPlaying(false)
    }
  }

  private playFromOffset() {
    if (!this.ctx || !this.analyser || !this.buffer) return
    void this.ctx.resume()
    this.stopSource()
    const source = this.ctx.createBufferSource()
    source.buffer = this.buffer
    source.connect(this.analyser)
    source.onended = () => {
      if (this.source !== source) return
      this.source = null
      this.offset = this.buffer?.duration ?? 0
      this.setPlaying(false)
      this.next(true)
    }
    this.source = source
    this.offset = Math.min(this.offset, Math.max(0, this.buffer.duration - 0.01))
    this.startedAt = this.ctx.currentTime - this.offset
    source.start(0, this.offset)
    this.setPlaying(true)
  }

  private stopSource() {
    if (!this.source) return
    this.source.onended = null
    this.source.stop()
    this.source.disconnect()
    this.source = null
  }

  toggle() {
    if (this.playing) {
      this.offset = this.time
      this.stopSource()
      this.setPlaying(false)
    } else if (this.buffer) {
      this.playFromOffset()
    } else {
      this.load(this.trackIndex, true)
    }
  }

  next(autoplay = true) {
    let i = this.trackIndex
    for (let step = 0; step < TRACKS.length; step++) {
      i = (i + 1) % TRACKS.length
      if (!this.unavailable.has(i)) break
    }
    this.load(i, autoplay)
  }

  prev() {
    if (this.time > 3) {
      this.seek(0)
      return
    }
    let i = this.trackIndex
    for (let step = 0; step < TRACKS.length; step++) {
      i = (i - 1 + TRACKS.length) % TRACKS.length
      if (!this.unavailable.has(i)) break
    }
    this.load(i, true)
  }

  seek(frac: number) {
    if (!this.buffer) return
    const wasPlaying = this.playing
    this.offset = Math.min(
      this.buffer.duration,
      Math.max(0, frac * this.buffer.duration),
    )
    this.stopSource()
    if (wasPlaying) this.playFromOffset()
  }

  get time() {
    if (this.playing && this.ctx) {
      return Math.min(this.duration, Math.max(0, this.ctx.currentTime - this.startedAt))
    }
    return this.offset
  }

  get duration() {
    return this.buffer?.duration ?? this.durations[this.trackIndex] ?? 0
  }

  get progress() {
    const d = this.duration
    return d > 0 ? this.time / d : 0
  }

  get diagnostics() {
    return {
      backend: 'mpg123-wasm',
      decoded: this.buffer !== null,
      loading: this.buffer === null,
      lastError: this.lastError,
    }
  }

  private setPlaying(v: boolean) {
    if (this.playing === v) return
    this.playing = v
    this.emit('state')
  }

  update(dt: number) {
    const b = this.bands
    if (this.analyser) {
      this.analyser.getByteFrequencyData(this.freq)
      this.analyser.getByteTimeDomainData(this.wave)
      // ~21.5 Hz per bin at 44.1kHz / fftSize 2048
      const avg = (from: number, to: number) => {
        let s = 0
        for (let i = from; i < to; i++) s += this.freq[i]
        return s / ((to - from) * 255)
      }
      const bass = avg(1, 7)
      const mid = avg(18, 90)
      const high = avg(90, 420)
      const atk = 14
      const rel = 4.5
      b.bass = damp(b.bass, bass, bass > b.bass ? atk : rel, dt)
      b.mid = damp(b.mid, mid, mid > b.mid ? atk : rel, dt)
      b.high = damp(b.high, high, high > b.high ? atk : rel, dt)
      b.level = b.bass * 0.5 + b.mid * 0.35 + b.high * 0.15

      this.bassFast = damp(this.bassFast, bass, 20, dt)
      this.bassSlow = damp(this.bassSlow, bass, 1.4, dt)
      this.beatCooldown -= dt
      if (this.playing && this.beatCooldown <= 0 && this.bassFast > this.bassSlow * 1.24 + 0.025) {
        b.pulse = 1
        this.beatCooldown = 0.16
      }
    }
    b.pulse *= Math.exp(-dt * 5.2)
    if (!this.playing) {
      b.bass = damp(b.bass, 0, 2, dt)
      b.mid = damp(b.mid, 0, 2, dt)
      b.high = damp(b.high, 0, 2, dt)
      b.level = damp(b.level, 0, 2, dt)
    }
  }

  on(ev: EngineEvent, cb: () => void) {
    ;(this.listeners[ev] ??= []).push(cb)
  }

  private emit(ev: EngineEvent) {
    for (const cb of this.listeners[ev] ?? []) cb()
  }
}
