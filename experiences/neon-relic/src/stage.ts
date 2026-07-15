import * as THREE from 'three'
import type { PosterDef } from './posters'
import { lerp } from './tween'

/** Soft round sprite so dust motes don't render as hard squares under bloom. */
function makeDotSprite(): THREE.Texture {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 64
  const ctx = cv.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * Owns the shared exhibition set: floor, backdrop, pedestal, light rig,
 * particles. Poster changes retarget every parameter; `mix()` blends the rig
 * between two poster environments.
 */
export class Stage {
  readonly scene = new THREE.Scene()
  readonly key: THREE.DirectionalLight
  readonly rim: THREE.SpotLight
  readonly accentA: THREE.PointLight
  readonly accentB: THREE.PointLight
  readonly hemi: THREE.HemisphereLight
  readonly floorMat: THREE.MeshStandardMaterial
  readonly backdropMat: THREE.MeshStandardMaterial
  readonly pedestalMat: THREE.MeshStandardMaterial
  readonly pedestalTopMat: THREE.MeshStandardMaterial
  readonly particles: THREE.Points
  private particleMat: THREE.PointsMaterial
  private particleBase: Float32Array

  constructor() {
    this.scene.fog = new THREE.FogExp2('#cfd1cd', 0.03)

    this.key = new THREE.DirectionalLight('#ffffff', 3)
    this.key.castShadow = true
    this.key.shadow.mapSize.set(2048, 2048)
    this.key.shadow.camera.left = -6
    this.key.shadow.camera.right = 6
    this.key.shadow.camera.top = 6
    this.key.shadow.camera.bottom = -6
    this.key.shadow.bias = -0.0004
    this.key.shadow.radius = 5
    this.scene.add(this.key, this.key.target)

    this.rim = new THREE.SpotLight('#ffffff', 3, 40, Math.PI / 5, 0.5, 1.2)
    this.scene.add(this.rim, this.rim.target)

    this.accentA = new THREE.PointLight('#c8ff00', 10, 18, 1.8)
    this.accentB = new THREE.PointLight('#ffffff', 8, 18, 1.8)
    this.scene.add(this.accentA, this.accentB)

    this.hemi = new THREE.HemisphereLight('#ffffff', '#888888', 0.8)
    this.scene.add(this.hemi)

    // Floor
    this.floorMat = new THREE.MeshStandardMaterial({ color: '#c4c6c2', roughness: 0.95 })
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), this.floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)

    // Backdrop cyc wall (slightly curved via cylinder segment)
    this.backdropMat = new THREE.MeshStandardMaterial({ color: '#d8dad6', roughness: 0.98 })
    const backdrop = new THREE.Mesh(
      new THREE.CylinderGeometry(14, 14, 18, 48, 1, true, Math.PI * 0.6, Math.PI * 0.8),
      this.backdropMat
    )
    backdrop.position.set(0, 8, 0)
    backdrop.scale.x = -1 // face inward
    this.scene.add(backdrop)

    // Pedestal
    this.pedestalMat = new THREE.MeshStandardMaterial({ color: '#b8bab6', roughness: 0.7 })
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.85, 0.34, 64), this.pedestalMat)
    pedestal.position.y = 0.17
    pedestal.castShadow = true
    pedestal.receiveShadow = true
    this.scene.add(pedestal)

    this.pedestalTopMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.35,
      metalness: 0.75,
    })
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.68, 1.68, 0.02, 64), this.pedestalTopMat)
    top.position.y = 0.35
    top.receiveShadow = true
    this.scene.add(top)

    // Accent ring around pedestal base
    const ringMat = new THREE.MeshBasicMaterial({ color: '#c8ff00' })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.015, 12, 96), ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.02
    ring.name = 'accentRing'
    this.scene.add(ring)

    // Dust motes
    const COUNT = 340
    const pos = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      const r = 1.5 + Math.random() * 6
      const a = Math.random() * Math.PI * 2
      pos[i * 3] = Math.cos(a) * r
      pos[i * 3 + 1] = Math.random() * 5
      pos[i * 3 + 2] = Math.sin(a) * r
    }
    this.particleBase = pos.slice()
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.particleMat = new THREE.PointsMaterial({
      color: '#ffffff',
      size: 0.03,
      map: makeDotSprite(),
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
    this.particles = new THREE.Points(geo, this.particleMat)
    this.scene.add(this.particles)
  }

  get accentRing(): THREE.Mesh {
    return this.scene.getObjectByName('accentRing') as THREE.Mesh
  }

  applyMaps(target: 'floor' | 'pedestal', maps: { map?: THREE.Texture; normalMap?: THREE.Texture; roughnessMap?: THREE.Texture }) {
    const mats =
      target === 'floor' ? [this.floorMat, this.backdropMat] : [this.pedestalMat, this.pedestalTopMat]
    for (const m of mats) {
      if (maps.map) m.map = maps.map
      if (maps.normalMap) m.normalMap = maps.normalMap
      if (maps.roughnessMap) m.roughnessMap = maps.roughnessMap
      m.needsUpdate = true
    }
  }

  /** Instantly set the rig to a poster's environment. */
  apply(p: PosterDef) {
    this.mixEnv(p, p, 1)
  }

  /** Blend rig between poster a and b, t in [0,1]. */
  mixEnv(a: PosterDef, b: PosterDef, t: number) {
    const ea = a.env
    const eb = b.env
    const c = (x: string, y: string) =>
      new THREE.Color(x).lerp(new THREE.Color(y), t)
    const v = (x: [number, number, number], y: [number, number, number]) =>
      new THREE.Vector3(lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t))

    const bg = c(ea.bg, eb.bg)
    this.scene.background = bg
    const fog = this.scene.fog as THREE.FogExp2
    fog.color.copy(c(ea.fog, eb.fog))
    fog.density = lerp(ea.fogDensity, eb.fogDensity, t)

    this.key.color.copy(c(ea.key.color, eb.key.color))
    this.key.intensity = lerp(ea.key.intensity, eb.key.intensity, t)
    this.key.position.copy(v(ea.key.pos, eb.key.pos))

    this.rim.color.copy(c(ea.rim.color, eb.rim.color))
    this.rim.intensity = lerp(ea.rim.intensity, eb.rim.intensity, t) * 14
    this.rim.position.copy(v(ea.rim.pos, eb.rim.pos))
    this.rim.target.position.set(0, 1.2, 0)

    this.accentA.color.copy(c(ea.accentA.color, eb.accentA.color))
    this.accentA.intensity = lerp(ea.accentA.intensity, eb.accentA.intensity, t)
    this.accentA.position.copy(v(ea.accentA.pos, eb.accentA.pos))

    this.accentB.color.copy(c(ea.accentB.color, eb.accentB.color))
    this.accentB.intensity = lerp(ea.accentB.intensity, eb.accentB.intensity, t)
    this.accentB.position.copy(v(ea.accentB.pos, eb.accentB.pos))

    this.hemi.color.copy(c(ea.hemiSky, eb.hemiSky))
    this.hemi.groundColor.copy(c(ea.hemiGround, eb.hemiGround))
    this.hemi.intensity = lerp(ea.hemiIntensity, eb.hemiIntensity, t)

    this.floorMat.color.copy(c(ea.floor, eb.floor))
    this.backdropMat.color.copy(c(ea.backdrop, eb.backdrop))
    this.pedestalMat.color.copy(c(ea.pedestal, eb.pedestal))

    this.particleMat.color.copy(c(ea.particles, eb.particles))
    ;(this.accentRing.material as THREE.MeshBasicMaterial).color.copy(
      c(a.ui.accent, b.ui.accent)
    )
  }

  update(dt: number, time: number) {
    const posAttr = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = posAttr.array as Float32Array
    for (let i = 0; i < arr.length / 3; i++) {
      const base = this.particleBase
      arr[i * 3 + 1] = (base[i * 3 + 1] + time * 0.08 + i * 0.01) % 5
      arr[i * 3] = base[i * 3] + Math.sin(time * 0.4 + i) * 0.06
      arr[i * 3 + 2] = base[i * 3 + 2] + Math.cos(time * 0.3 + i * 1.7) * 0.06
    }
    posAttr.needsUpdate = true
    this.particles.rotation.y += dt * 0.01
  }
}
