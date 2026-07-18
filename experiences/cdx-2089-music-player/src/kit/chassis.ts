import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

import type { AudioEngine } from '../audio/engine'
import type { SkinDef } from '../skins/types'
import type { AnchorSet } from './models'
import { damp } from '../tween'

type MaterialRole = {
  body: THREE.MeshStandardMaterial
  secondary: THREE.MeshStandardMaterial
  trim: THREE.MeshStandardMaterial
  accent: THREE.MeshStandardMaterial
  glass: THREE.MeshPhysicalMaterial
}

function materialKit(def: SkinDef): MaterialRole {
  const schemes: Record<string, { body: number; secondary: number; trim: number; accent: number; glass: number }> = {
    monolith: { body: 0x0c0e12, secondary: 0x1b1e24, trim: 0x555c66, accent: 0xdbe3ea, glass: 0x738291 },
    atlas: { body: 0x9da3a6, secondary: 0x111318, trim: 0x3d4249, accent: 0xff5a2a, glass: 0xaeb9bf },
    lacaille: { body: 0xe0d9ca, secondary: 0x121317, trim: 0x5e5a52, accent: 0xe8551e, glass: 0xc7b28e },
    prism: { body: 0x0a0b0f, secondary: 0x27302b, trim: 0x9baaa1, accent: 0xb6ff2e, glass: 0x8aff58 },
    bootleg: { body: 0x151821, secondary: 0x2a37ea, trim: 0xa6a9b6, accent: 0xd8261b, glass: 0x6d78ff },
  }
  const c = schemes[def.id] ?? schemes.monolith
  return {
    body: new THREE.MeshStandardMaterial({ color: c.body, roughness: 0.38, metalness: 0.48 }),
    secondary: new THREE.MeshStandardMaterial({ color: c.secondary, roughness: 0.48, metalness: 0.32 }),
    trim: new THREE.MeshStandardMaterial({ color: c.trim, roughness: 0.24, metalness: 0.86 }),
    accent: new THREE.MeshStandardMaterial({
      color: c.accent,
      emissive: c.accent,
      emissiveIntensity: 0.24,
      roughness: 0.28,
      metalness: 0.55,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: c.glass,
      transparent: true,
      opacity: 0.22,
      transmission: 0.2,
      thickness: 0.1,
      roughness: 0.16,
      metalness: 0.06,
      clearcoat: 1,
      depthWrite: false,
    }),
  }
}

function roundedBlock(
  w: number,
  h: number,
  d: number,
  radius: number,
  material: THREE.Material,
  pos: [number, number, number],
): THREE.Mesh {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 5, radius), material)
  mesh.position.set(...pos)
  return mesh
}

function drum(radius: number, depth: number, material: THREE.Material, pos: [number, number, number]): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(radius, radius, depth, 128, 2, false)
  geo.rotateX(Math.PI / 2)
  const mesh = new THREE.Mesh(geo, material)
  mesh.position.set(...pos)
  return mesh
}

function annularBlock(
  rIn: number,
  rOut: number,
  start: number,
  length: number,
  depth: number,
  material: THREE.Material,
): THREE.Mesh {
  const n = Math.max(16, Math.ceil(72 * length / (Math.PI * 2)))
  const shape = new THREE.Shape()
  for (let i = 0; i <= n; i++) {
    const a = start + (i / n) * length
    const x = Math.cos(a) * rOut
    const y = Math.sin(a) * rOut
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  for (let i = n; i >= 0; i--) {
    const a = start + (i / n) * length
    shape.lineTo(Math.cos(a) * rIn, Math.sin(a) * rIn)
  }
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: Math.min(0.035, (rOut - rIn) * 0.12),
    bevelThickness: 0.025,
  })
  geo.translate(0, 0, -depth * 0.5)
  return new THREE.Mesh(geo, material)
}

function ventBank(
  cols: number,
  rows: number,
  size: [number, number, number],
  gap: [number, number],
  material: THREE.Material,
  pos: [number, number, number],
  rotation = 0,
): THREE.InstancedMesh {
  const count = cols * rows
  const inst = new THREE.InstancedMesh(new RoundedBoxGeometry(...size, 2, Math.min(size[0], size[1]) * 0.28), material, count)
  const dummy = new THREE.Object3D()
  let k = 0
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      dummy.position.set(
        pos[0] + (x - (cols - 1) / 2) * gap[0],
        pos[1] + (y - (rows - 1) / 2) * gap[1],
        pos[2],
      )
      dummy.rotation.z = rotation
      dummy.updateMatrix()
      inst.setMatrixAt(k++, dummy.matrix)
    }
  }
  inst.instanceMatrix.needsUpdate = true
  return inst
}

function radialRibs(
  radius: number,
  start: number,
  length: number,
  count: number,
  material: THREE.Material,
  center: [number, number],
  z: number,
): THREE.InstancedMesh {
  const geo = new RoundedBoxGeometry(0.035, 0.17, 0.075, 2, 0.012)
  const inst = new THREE.InstancedMesh(geo, material, count)
  const dummy = new THREE.Object3D()
  for (let i = 0; i < count; i++) {
    const a = start + (i / Math.max(1, count - 1)) * length
    dummy.position.set(center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius, z)
    dummy.rotation.z = a - Math.PI / 2
    dummy.updateMatrix()
    inst.setMatrixAt(i, dummy.matrix)
  }
  inst.instanceMatrix.needsUpdate = true
  return inst
}

function boltRing(radius: number, count: number, material: THREE.Material, center: [number, number], z: number): THREE.InstancedMesh {
  const geo = new THREE.CylinderGeometry(0.038, 0.043, 0.032, 16)
  geo.rotateX(Math.PI / 2)
  const inst = new THREE.InstancedMesh(geo, material, count)
  const dummy = new THREE.Object3D()
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.18
    dummy.position.set(center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius, z)
    dummy.rotation.z = a * 1.7
    dummy.updateMatrix()
    inst.setMatrixAt(i, dummy.matrix)
  }
  inst.instanceMatrix.needsUpdate = true
  return inst
}

/**
 * The compact manufactured object behind every skin. Existing skin graphics
 * become printed faces and screens attached to this deeper shared hardware.
 */
export class DeviceChassis {
  readonly group = new THREE.Group()
  private signalMats: THREE.MeshStandardMaterial[] = []
  private moving: THREE.Object3D[] = []
  private pulse = 0

  constructor(private def: SkinDef, private engine: AudioEngine, anchors: AnchorSet) {
    this.group.name = `device-chassis-${def.id}`
    const kit = materialKit(def)
    const [cx, cy] = def.disc.pos

    if (def.id === 'monolith') this.buildMonolith(kit, cx, cy)
    else if (def.id === 'atlas' || def.id === 'lacaille') this.buildRadial(kit, cx, cy)
    else this.buildSquare(kit, cx, cy)

    this.mountGeneratedFrame(kit, anchors)

    // A consistent inner well makes the disc feel physically seated rather
    // than composited on top of the interface.
    const well = drum(1.52 * def.disc.scale, 0.2, kit.secondary, [cx, cy, -0.28])
    const wellCut = drum(1.34 * def.disc.scale, 0.225, kit.body, [cx, cy, -0.15])
    const trim = new THREE.Mesh(
      new THREE.TorusGeometry(1.39 * def.disc.scale, 0.035, 10, 128),
      kit.trim,
    )
    trim.position.set(cx, cy, -0.025)
    this.group.add(well, wellCut, trim)

    this.group.add(boltRing(1.47 * def.disc.scale, 12, kit.trim, [cx, cy], 0.015))

    // Live signal capsules around the well: physical, low-profile and subtle.
    const signalMat = kit.accent.clone()
    this.signalMats.push(signalMat)
    const signalGeo = new RoundedBoxGeometry(0.028, 0.11, 0.026, 2, 0.009)
    const signals = new THREE.InstancedMesh(signalGeo, signalMat, 24)
    const dummy = new THREE.Object3D()
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      dummy.position.set(cx + Math.cos(a) * 1.6 * def.disc.scale, cy + Math.sin(a) * 1.6 * def.disc.scale, -0.005)
      dummy.rotation.z = a - Math.PI / 2
      dummy.scale.y = i % 6 === 0 ? 1.8 : 0.7
      dummy.updateMatrix()
      signals.setMatrixAt(i, dummy.matrix)
    }
    signals.instanceMatrix.needsUpdate = true
    this.group.add(signals)
  }

  private mountGeneratedFrame(kit: MaterialRole, anchors: AnchorSet) {
    const source = this.def.id === 'monolith'
      ? anchors.chassisMonolith
      : this.def.id === 'atlas' || this.def.id === 'lacaille'
        ? anchors.chassisOrbital
        : anchors.chassisAcrylic
    if (!source) return

    const frame = source.clone(true)
    frame.name = `mint-frame-${this.def.id}`
    frame.position.set(0, 0, -0.34)
    // Image-to-model relief is intentionally compressed into a product-frame
    // depth. The authored disc, controls and screens remain the front-most
    // application state instead of being baked into the imported model.
    frame.scale.z *= 0.24

    frame.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.userData.sharedGeometry = true
      if (this.def.id === 'prism') {
        const sourceMat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial
        const mat = sourceMat.clone()
        mat.transparent = true
        mat.opacity = 0.34
        mat.depthWrite = false
        mat.roughness = 0.3
        mat.metalness = 0.12
        mesh.material = mat
      } else {
        const base = this.def.id === 'atlas' ? kit.body : this.def.id === 'bootleg' ? kit.secondary : kit.secondary
        mesh.material = new THREE.MeshStandardMaterial({
          color: base.color,
          roughness: this.def.id === 'monolith' ? 0.34 : 0.46,
          metalness: this.def.id === 'monolith' ? 0.62 : 0.38,
        })
      }
    })
    this.group.add(frame)
  }

  private buildMonolith(kit: MaterialRole, cx: number, cy: number) {
    const roundBack = drum(2.05, 0.34, kit.body, [cx, cy, -0.48])
    const tower = roundedBlock(2.25, 4.0, 0.38, 0.18, kit.body, [-1.52, 0, -0.43])
    const towerStep = roundedBlock(2.02, 3.74, 0.13, 0.12, kit.secondary, [-1.48, 0, -0.18])
    this.group.add(roundBack, tower, towerStep)

    const guards: Array<[number, number]> = [
      [0.15, 0.62],
      [1.02, 0.48],
      [-0.93, 0.5],
    ]
    for (const [a, len] of guards) {
      const guard = annularBlock(1.76, 2.08, a, len, 0.23, kit.secondary)
      guard.position.set(cx, cy, -0.15)
      this.group.add(guard)
      this.group.add(radialRibs(1.92, a + 0.08, Math.max(0.08, len - 0.16), 11, kit.trim, [cx, cy], 0.01))
    }

    this.group.add(
      ventBank(7, 2, [0.095, 0.045, 0.07], [0.125, 0.085], kit.trim, [-2.0, 1.35, -0.12]),
      ventBank(7, 2, [0.095, 0.045, 0.07], [0.125, 0.085], kit.trim, [-2.0, -1.35, -0.12]),
    )
    const sideRail = roundedBlock(0.23, 3.62, 0.18, 0.08, kit.trim, [-2.72, 0, -0.1])
    this.group.add(sideRail)
  }

  private buildRadial(kit: MaterialRole, cx: number, cy: number) {
    const outer = drum(2.24, 0.34, this.def.id === 'atlas' ? kit.body : kit.secondary, [cx, cy, -0.48])
    const inner = drum(2.02, 0.16, kit.secondary, [cx, cy, -0.23])
    this.group.add(outer, inner)

    const spans: Array<[number, number, number]> = this.def.id === 'atlas'
      ? [[0.1, 0.58, 2.36], [0.88, 0.46, 2.48], [1.62, 0.6, 2.34], [2.54, 0.48, 2.44], [3.42, 0.62, 2.36], [4.58, 0.5, 2.45], [5.36, 0.48, 2.35]]
      : [[0.05, 0.72, 2.3], [0.98, 0.52, 2.5], [1.72, 0.72, 2.36], [2.72, 0.62, 2.5], [3.68, 0.48, 2.32], [4.48, 0.8, 2.44], [5.55, 0.46, 2.34]]
    for (const [a, len, r] of spans) {
      const guard = annularBlock(2.02, r, a, len, 0.19, kit.secondary)
      guard.position.set(cx, cy, -0.11)
      this.group.add(guard)
      if (len > 0.55) this.group.add(radialRibs((2.02 + r) * 0.5, a + 0.07, len - 0.14, 9, kit.trim, [cx, cy], 0.035))
    }

    const podAngles = [0.48, 1.44, 2.5, 3.42, 4.35, 5.48]
    for (const [i, a] of podAngles.entries()) {
      const pod = roundedBlock(0.48, 0.28, 0.2, 0.07, i % 2 ? kit.body : kit.secondary, [
        cx + Math.cos(a) * 2.32,
        cy + Math.sin(a) * 2.32,
        -0.03,
      ])
      pod.rotation.z = a - Math.PI / 2
      this.group.add(pod)
    }
  }

  private buildSquare(kit: MaterialRole, cx: number, cy: number) {
    const frameColor = this.def.id === 'bootleg' ? kit.secondary : kit.body
    const core = roundedBlock(4.75, 4.18, 0.34, 0.2, frameColor, [0.1, 0, -0.5])
    const inset = roundedBlock(4.46, 3.9, 0.14, 0.15, kit.body, [0.1, 0, -0.22])
    this.group.add(core, inset)

    const cornerData: Array<[number, number, number]> = [
      [-2.22, 1.86, 0.06],
      [2.37, 1.86, -0.04],
      [-2.22, -1.86, -0.03],
      [2.37, -1.86, 0.05],
    ]
    for (const [i, [x, y, rz]] of cornerData.entries()) {
      const bracket = roundedBlock(1.05, 0.48, 0.19, 0.1, i % 2 ? kit.glass : kit.secondary, [x, y, -0.03])
      bracket.rotation.z = rz
      this.group.add(bracket)
      this.group.add(ventBank(6, 1, [0.055, 0.09, 0.045], [0.12, 0], kit.trim, [x, y, 0.085], rz))
    }

    const railTop = roundedBlock(3.15, 0.11, 0.12, 0.04, kit.trim, [0.3, 2.12, -0.04])
    const railRight = roundedBlock(0.11, 2.62, 0.12, 0.04, kit.trim, [2.53, -0.15, -0.04])
    this.group.add(railTop, railRight)

    const lowerVent = ventBank(12, 1, [0.075, 0.08, 0.055], [0.14, 0], kit.trim, [-0.7, -2.03, 0.02])
    this.group.add(lowerVent)

    // The acrylic skin gets an extra floating clear protective shell, but it
    // remains physically bolted to the same compact chassis silhouette.
    if (this.def.id === 'prism') {
      const glassTop = roundedBlock(2.15, 0.72, 0.16, 0.12, kit.glass, [1.18, 1.72, 0.08])
      const glassLeft = roundedBlock(0.74, 1.65, 0.16, 0.12, kit.glass, [-2.05, -0.38, 0.11])
      this.group.add(glassTop, glassLeft)
      this.moving.push(glassTop, glassLeft)
    }

    void cx
    void cy
  }

  update(dt: number, t: number) {
    this.pulse = damp(this.pulse, this.engine.bands.pulse, 12, dt)
    for (const mat of this.signalMats) mat.emissiveIntensity = 0.16 + this.engine.bands.high * 0.55 + this.pulse * 0.9
    this.moving.forEach((part, i) => {
      part.rotation.z = Math.sin(t * (0.22 + i * 0.05) + i) * 0.006
      part.position.z = 0.08 + Math.sin(t * 0.45 + i) * 0.018
    })
  }
}
