import * as THREE from 'three'
import type { AudioEngine } from '../audio/engine'
import { damp } from '../tween'

// The consistent "music is alive" component: a spectrum ring around the disc.
// Per-skin color/radius, same motion language everywhere.

export class SpectrumRing {
  group = new THREE.Group()
  private inst: THREE.InstancedMesh
  private microInst: THREE.InstancedMesh
  private tickInst: THREE.InstancedMesh
  private peakInst: THREE.InstancedMesh
  private bassInst: THREE.InstancedMesh
  private waveInst: THREE.InstancedMesh
  private orbitInst: THREE.InstancedMesh
  private heights: Float32Array
  private microHeights: Float32Array
  private peakHeights: Float32Array
  private count: number
  private microCount: number
  private bassCount = 32
  private waveCount = 192
  private orbitCount = 24
  private radius: number
  private barLen: number
  private mat: THREE.MeshStandardMaterial
  private microMat: THREE.MeshBasicMaterial
  private tickMat: THREE.MeshBasicMaterial
  private peakMat: THREE.MeshBasicMaterial
  private bassMat: THREE.MeshBasicMaterial
  private waveMat: THREE.MeshBasicMaterial
  private orbitMat: THREE.MeshBasicMaterial
  private guideMats: THREE.MeshBasicMaterial[] = []
  private guides: THREE.Mesh[] = []
  private pulseRing: THREE.Mesh
  private dummy = new THREE.Object3D()
  private microDummy = new THREE.Object3D()
  private peakDummy = new THREE.Object3D()
  private bassDummy = new THREE.Object3D()
  private waveDummy = new THREE.Object3D()
  private orbitDummy = new THREE.Object3D()
  private rot = 0
  private arc: number
  private arcStart: number
  private baseOpacity: number
  private additive: boolean

  constructor(opts: {
    radius: number
    count?: number
    barW?: number
    barLen?: number
    color: number
    opacity?: number
    additive?: boolean
    arc?: number // radians of coverage (default full circle)
    arcStart?: number
  }) {
    this.count = opts.count ?? 112
    this.microCount = this.count * 2
    this.radius = opts.radius
    this.barLen = opts.barLen ?? 0.16
    this.arc = opts.arc ?? Math.PI * 2
    this.arcStart = opts.arcStart ?? -Math.PI / 2
    this.baseOpacity = opts.opacity ?? 0.9
    this.additive = Boolean(opts.additive)
    this.heights = new Float32Array(this.count)
    this.microHeights = new Float32Array(this.microCount)
    this.peakHeights = new Float32Array(this.count)
    const barW = opts.barW ?? 0.016
    const geo = new THREE.BoxGeometry(barW, 1, Math.max(0.018, barW * 1.6))
    geo.translate(0, 0.5, 0) // grow outward from base
    this.mat = new THREE.MeshStandardMaterial({
      color: opts.color,
      emissive: opts.color,
      emissiveIntensity: opts.additive ? 0.75 : 0.18,
      metalness: 0.56,
      roughness: 0.24,
      transparent: true,
      opacity: this.baseOpacity,
      depthWrite: false,
      blending: this.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
    this.inst = new THREE.InstancedMesh(geo, this.mat, this.count)
    this.inst.renderOrder = 12

    const microGeo = new THREE.BoxGeometry(barW * 0.36, 1, Math.max(0.01, barW * 0.8))
    microGeo.translate(0, 0.5, 0)
    this.microMat = new THREE.MeshBasicMaterial({
      color: opts.color,
      transparent: true,
      opacity: this.baseOpacity * 0.62,
      depthWrite: false,
      blending: this.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
    this.microInst = new THREE.InstancedMesh(microGeo, this.microMat, this.microCount)
    this.microInst.renderOrder = 13

    const tickGeo = new THREE.BoxGeometry(barW * 0.52, 0.035, Math.max(0.008, barW * 0.55))
    this.tickMat = new THREE.MeshBasicMaterial({
      color: opts.color,
      transparent: true,
      opacity: this.baseOpacity * 0.28,
      depthWrite: false,
    })
    this.tickInst = new THREE.InstancedMesh(tickGeo, this.tickMat, this.microCount)
    this.tickInst.renderOrder = 11
    const tickDummy = new THREE.Object3D()
    for (let i = 0; i < this.microCount; i++) {
      const a = this.arcStart + (i / this.microCount) * this.arc
      const major = i % 12 === 0
      tickDummy.position.set(Math.cos(a) * (this.radius - (major ? 0.09 : 0.06)), Math.sin(a) * (this.radius - (major ? 0.09 : 0.06)), -0.015)
      tickDummy.rotation.z = a - Math.PI / 2
      tickDummy.scale.set(major ? 1.8 : 0.8, major ? 2.2 : 1, 1)
      tickDummy.updateMatrix()
      this.tickInst.setMatrixAt(i, tickDummy.matrix)
    }
    this.tickInst.instanceMatrix.needsUpdate = true

    // Peak-hold caps give the main spectrum a readable memory of transients.
    const peakGeo = new THREE.BoxGeometry(barW * 1.45, 0.026, Math.max(0.012, barW * 1.15))
    this.peakMat = new THREE.MeshBasicMaterial({
      color: opts.color,
      transparent: true,
      opacity: this.baseOpacity * 0.92,
      depthWrite: false,
      blending: this.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
    this.peakInst = new THREE.InstancedMesh(peakGeo, this.peakMat, this.count)
    this.peakInst.renderOrder = 15

    // Thirty-two broad inner pistons carry the low end separately from the
    // fine spectrum, so a kick visibly changes the silhouette of the device.
    const bassGeo = new THREE.BoxGeometry(barW * 2.8, 1, Math.max(0.02, barW * 1.9))
    bassGeo.translate(0, 0.5, 0)
    this.bassMat = new THREE.MeshBasicMaterial({
      color: opts.color,
      transparent: true,
      opacity: this.baseOpacity * 0.46,
      depthWrite: false,
      blending: this.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
    this.bassInst = new THREE.InstancedMesh(bassGeo, this.bassMat, this.bassCount)
    this.bassInst.renderOrder = 10

    // A dotted circular oscilloscope is present on every skin. It preserves
    // individual waveform detail that gets lost in frequency-only bars.
    const waveGeo = new THREE.BoxGeometry(barW * 0.5, barW * 0.5, Math.max(0.012, barW * 0.7))
    this.waveMat = new THREE.MeshBasicMaterial({
      color: opts.color,
      transparent: true,
      opacity: this.baseOpacity * 0.72,
      depthWrite: false,
      blending: this.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
    this.waveInst = new THREE.InstancedMesh(waveGeo, this.waveMat, this.waveCount)
    this.waveInst.renderOrder = 14

    // Sparse orbiting diamonds make high-frequency energy legible at a glance
    // and break the visualizer out of a single flat ring.
    const orbitGeo = new THREE.OctahedronGeometry(barW * 1.35, 0)
    this.orbitMat = new THREE.MeshBasicMaterial({
      color: opts.color,
      transparent: true,
      opacity: this.baseOpacity * 0.82,
      depthWrite: false,
      blending: this.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
    this.orbitInst = new THREE.InstancedMesh(orbitGeo, this.orbitMat, this.orbitCount)
    this.orbitInst.renderOrder = 16

    const guideSpecs: Array<[number, number, number]> = [
      [this.radius - 0.205, this.radius - 0.196, 0.12],
      [this.radius - 0.145, this.radius - 0.138, 0.2],
      [this.radius + 0.105, this.radius + 0.111, 0.13],
    ]
    for (const [inner, outer, alpha] of guideSpecs) {
      const guideMat = new THREE.MeshBasicMaterial({
        color: opts.color,
        transparent: true,
        opacity: this.baseOpacity * alpha,
        depthWrite: false,
      })
      const guide = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 224), guideMat)
      guide.position.z = -0.02
      this.guideMats.push(guideMat)
      this.guides.push(guide)
    }
    const pulseMat = new THREE.MeshBasicMaterial({
      color: opts.color,
      transparent: true,
      opacity: this.baseOpacity * 0.22,
      depthWrite: false,
      blending: this.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
    this.pulseRing = new THREE.Mesh(
      new THREE.RingGeometry(this.radius + 0.132, this.radius + 0.146, 224),
      pulseMat,
    )
    this.pulseRing.position.z = 0.006
    this.guideMats.push(pulseMat)

    this.group.add(
      ...this.guides,
      this.pulseRing,
      this.tickInst,
      this.bassInst,
      this.inst,
      this.peakInst,
      this.microInst,
      this.waveInst,
      this.orbitInst,
    )
  }

  setColor(hex: number) {
    this.mat.color.set(hex)
    this.mat.emissive.set(hex)
    this.microMat.color.set(hex)
    this.tickMat.color.set(hex)
    this.peakMat.color.set(hex)
    this.bassMat.color.set(hex)
    this.waveMat.color.set(hex)
    this.orbitMat.color.set(hex)
    for (const mat of this.guideMats) mat.color.set(hex)
  }

  update(engine: AudioEngine, dt: number) {
    const playing = engine.playing
    const full = this.arc >= Math.PI * 1.99
    const bass = playing ? Math.min(1, engine.bands.bass * 2.8) : 0
    const mid = playing ? Math.min(1, engine.bands.mid * 2.65) : 0
    const high = playing ? Math.min(1, engine.bands.high * 3.4) : 0
    const level = playing ? Math.min(1, engine.bands.level * 2.9) : 0
    const pulse = engine.bands.pulse

    this.rot += dt * (playing ? 0.24 + high * 0.48 : 0.045)
    for (let i = 0; i < this.count; i++) {
      // mirror the spectrum for symmetry on full rings
      const k = full ? (i < this.count / 2 ? i / (this.count / 2) : (this.count - i) / (this.count / 2)) : i / this.count
      // log-ish distribution into the analyser bins
      const bin = Math.min(1023, Math.floor(Math.pow(k, 1.7) * 360) + 2)
      const v = engine.freq[bin] / 255
      const bandEnergy = k < 0.16 ? bass : k < 0.58 ? mid : high
      const spectral = Math.min(1, v * 2.75)
      const idle = 0.075 + 0.035 * Math.sin(this.rot * 3 + i * 0.35)
      const target = playing
        ? 0.11 + Math.pow(Math.max(spectral, bandEnergy * 0.6), 0.72) * 1.28 + pulse * 0.12
        : idle
      this.heights[i] = damp(this.heights[i], target, target > this.heights[i] ? 24 : 8.5, dt)
      this.peakHeights[i] = Math.max(this.heights[i], this.peakHeights[i] - dt * (0.36 + level * 0.2))
    }
    for (let i = 0; i < this.count; i++) {
      const a = this.arcStart + (i / this.count) * this.arc + (full ? this.rot * 0 : 0)
      const len = Math.max(0.035, this.heights[i] * this.barLen * 4.05)
      this.dummy.position.set(Math.cos(a) * this.radius, Math.sin(a) * this.radius, 0.035)
      this.dummy.rotation.z = a - Math.PI / 2
      this.dummy.scale.set(i % 8 === 0 ? 1.32 : 1, len, 1)
      this.dummy.updateMatrix()
      this.inst.setMatrixAt(i, this.dummy.matrix)

      const peakR = this.radius + Math.max(0.035, this.peakHeights[i] * this.barLen * 4.05) + 0.035
      this.peakDummy.position.set(Math.cos(a) * peakR, Math.sin(a) * peakR, 0.05)
      this.peakDummy.rotation.z = a - Math.PI / 2
      this.peakDummy.scale.set(i % 8 === 0 ? 1.45 : 0.82, 1, 1)
      this.peakDummy.updateMatrix()
      this.peakInst.setMatrixAt(i, this.peakDummy.matrix)
    }
    this.inst.instanceMatrix.needsUpdate = true
    this.peakInst.instanceMatrix.needsUpdate = true

    // A denser high-frequency ring moves counter to the peak layer.
    for (let i = 0; i < this.microCount; i++) {
      const k = full
        ? (i < this.microCount / 2 ? i / (this.microCount / 2) : (this.microCount - i) / (this.microCount / 2))
        : i / this.microCount
      const bin = Math.min(1023, 42 + Math.floor(Math.pow(k, 1.35) * 620))
      const v = engine.freq[bin] / 255
      const spectral = Math.min(1, v * 3.15)
      const idle = 0.035 + 0.02 * Math.sin(this.rot * 5 + i * 0.47)
      const target = playing ? 0.055 + Math.pow(Math.max(spectral, high * 0.58), 0.66) * 0.82 : idle
      this.microHeights[i] = damp(this.microHeights[i], target, target > this.microHeights[i] ? 30 : 11, dt)
      const a = this.arcStart + (i / this.microCount) * this.arc - (full ? this.rot * 0.22 : 0)
      this.microDummy.position.set(Math.cos(a) * (this.radius + 0.065), Math.sin(a) * (this.radius + 0.065), 0.018)
      this.microDummy.rotation.z = a - Math.PI / 2
      this.microDummy.scale.set(1, Math.max(0.018, this.microHeights[i] * this.barLen * 3.15), 1)
      this.microDummy.updateMatrix()
      this.microInst.setMatrixAt(i, this.microDummy.matrix)
    }
    this.microInst.instanceMatrix.needsUpdate = true

    // Low-frequency pistons grow into the primary spectrum on every hit.
    for (let i = 0; i < this.bassCount; i++) {
      const a = this.arcStart + (i / this.bassCount) * this.arc + (full ? this.rot * 0.065 : 0)
      const ripple = 0.5 + 0.5 * Math.sin(i * 0.92 - this.rot * 7.5)
      const energy = playing ? 0.2 + bass * (0.8 + ripple * 0.55) + pulse * (0.24 + ripple * 0.38) : 0.12 + ripple * 0.07
      this.bassDummy.position.set(Math.cos(a) * (this.radius - 0.245), Math.sin(a) * (this.radius - 0.245), 0.002)
      this.bassDummy.rotation.z = a - Math.PI / 2
      this.bassDummy.scale.set(i % 4 === 0 ? 1.5 : 0.88, this.barLen * (0.48 + energy * 1.72), 1)
      this.bassDummy.updateMatrix()
      this.bassInst.setMatrixAt(i, this.bassDummy.matrix)
    }
    this.bassInst.instanceMatrix.needsUpdate = true

    // The oscilloscope dots use the raw time-domain waveform, not averaged
    // spectrum data, so fine rhythmic texture remains visible during playback.
    for (let i = 0; i < this.waveCount; i++) {
      const a = this.arcStart + (i / this.waveCount) * this.arc - (full ? this.rot * 0.055 : 0)
      const sample = (engine.wave[Math.floor((i / this.waveCount) * 1024)] - 128) / 128
      const idleWave = Math.sin(i * 0.34 + this.rot * 6) * 0.12
      const wave = playing ? sample : idleWave
      const waveAmp = this.barLen * (0.62 + level * 1.25)
      const r = this.radius - 0.12 + wave * waveAmp
      const scale = 0.58 + Math.abs(wave) * (1.55 + high * 0.9)
      this.waveDummy.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.062)
      this.waveDummy.rotation.z = a - Math.PI / 2
      this.waveDummy.scale.set(scale, scale, 1)
      this.waveDummy.updateMatrix()
      this.waveInst.setMatrixAt(i, this.waveDummy.matrix)
    }
    this.waveInst.instanceMatrix.needsUpdate = true

    for (let i = 0; i < this.orbitCount; i++) {
      const a = this.arcStart + (i / this.orbitCount) * this.arc + (full ? this.rot * 0.62 : 0)
      const flutter = 0.5 + 0.5 * Math.sin(i * 1.73 + this.rot * 9)
      const r = this.radius + 0.17 + this.barLen * (0.32 + high * (0.45 + flutter * 0.4))
      const scale = 0.55 + high * (0.8 + flutter * 0.8) + pulse * (i % 3 === 0 ? 0.9 : 0.22)
      this.orbitDummy.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.07 + flutter * (0.02 + high * 0.06))
      this.orbitDummy.rotation.set(0, 0, a + this.rot * 1.8)
      this.orbitDummy.scale.setScalar(scale)
      this.orbitDummy.updateMatrix()
      this.orbitInst.setMatrixAt(i, this.orbitDummy.matrix)
    }
    this.orbitInst.instanceMatrix.needsUpdate = true

    this.tickInst.rotation.z = full ? -this.rot * 0.095 : 0
    this.bassInst.rotation.z = full ? this.rot * 0.025 : 0
    this.pulseRing.rotation.z = -this.rot * 0.12
    this.pulseRing.scale.setScalar(1 + pulse * 0.09 + bass * 0.012)
    this.guides.forEach((guide, i) => {
      guide.rotation.z = (i % 2 === 0 ? 1 : -1) * this.rot * (0.018 + i * 0.012)
    })
    this.mat.emissiveIntensity = (this.additive ? 0.72 : 0.18) + high * 0.38 + pulse * 0.28
    this.group.scale.setScalar(1 + bass * 0.006 + pulse * 0.012)
  }
}

/** Circular oscilloscope — LACAILLE's waveform emblem. */
export class WaveRing {
  line: THREE.LineLoop
  private geo: THREE.BufferGeometry
  private positions: Float32Array
  private n: number
  private radius: number
  private amp: number

  constructor(opts: { radius: number; amp?: number; color: number; n?: number; opacity?: number }) {
    this.n = opts.n ?? 180
    this.radius = opts.radius
    this.amp = opts.amp ?? 0.12
    this.positions = new Float32Array(this.n * 3)
    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    const mat = new THREE.LineBasicMaterial({
      color: opts.color,
      transparent: true,
      opacity: opts.opacity ?? 0.95,
    })
    this.line = new THREE.LineLoop(this.geo, mat)
    this.line.renderOrder = 12
    this.seed()
  }

  private seed() {
    for (let i = 0; i < this.n; i++) {
      const a = (i / this.n) * Math.PI * 2
      this.positions[i * 3] = Math.cos(a) * this.radius
      this.positions[i * 3 + 1] = Math.sin(a) * this.radius
      this.positions[i * 3 + 2] = 0
    }
    this.geo.attributes.position.needsUpdate = true
  }

  update(engine: AudioEngine) {
    for (let i = 0; i < this.n; i++) {
      const a = (i / this.n) * Math.PI * 2
      const w = (engine.wave[Math.floor((i / this.n) * 1024)] - 128) / 128
      const r = this.radius + w * this.amp * (engine.playing ? 1 : 0.15)
      this.positions[i * 3] = Math.cos(a) * r
      this.positions[i * 3 + 1] = Math.sin(a) * r
    }
    this.geo.attributes.position.needsUpdate = true
  }
}

/** Tiny LED status cluster: power / play / data blink. */
export class LedCluster {
  group = new THREE.Group()
  private leds: THREE.Mesh[] = []
  private mats: THREE.MeshBasicMaterial[] = []
  private t = 0

  constructor(colors: number[], size = 0.03, gap = 0.09) {
    colors.forEach((c, i) => {
      const mat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9 })
      const led = new THREE.Mesh(new THREE.CircleGeometry(size, 24), mat)
      led.position.x = i * gap
      led.renderOrder = 12
      this.group.add(led)
      this.leds.push(led)
      this.mats.push(mat)
    })
  }

  update(engine: AudioEngine, dt: number) {
    this.t += dt
    // 0: power steady, 1: play state, 2: data flicker with the beat
    if (this.mats[0]) this.mats[0].opacity = 0.95
    if (this.mats[1]) this.mats[1].opacity = engine.playing ? 0.55 + 0.45 * Math.sin(this.t * 3.2) : 0.18
    if (this.mats[2]) this.mats[2].opacity = engine.playing ? 0.2 + engine.bands.pulse : 0.12
  }
}
