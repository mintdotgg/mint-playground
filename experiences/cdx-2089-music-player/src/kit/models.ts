import * as THREE from 'three'
import { mintGltfLoader } from '../assets/gltf-runtime'
import { MINT_ASSET_URLS } from '../assets/runtime'

export type AnchorAlign = 'puckZ' | 'barX' | 'none'

export interface AnchorSet {
  chassis: THREE.Object3D | null
  chassisMonolith: THREE.Object3D | null
  chassisOrbital: THREE.Object3D | null
  chassisAcrylic: THREE.Object3D | null
  hub: THREE.Object3D | null
  knob: THREE.Object3D | null
  rail: THREE.Object3D | null
}

/**
 * Load a generated GLB anchor, recenter it, orient it by heuristic and scale
 * it to a known size. Returns null on 404 so skins fall back to procedural.
 */
export async function loadAnchor(
  url: string,
  opts: { size: number; align: AnchorAlign },
): Promise<THREE.Object3D | null> {
  try {
    const gltf = await mintGltfLoader.loadAsync(url)
    const scene = gltf.scene
    const wrapper = new THREE.Group()
    wrapper.add(scene)

    // center
    let box = new THREE.Box3().setFromObject(scene)
    const center = box.getCenter(new THREE.Vector3())
    scene.position.sub(center)

    // orient
    const size = box.getSize(new THREE.Vector3())
    if (opts.align === 'puckZ') {
      // a puck's axis is its smallest extent — rotate that axis onto +Z
      if (size.y <= size.x && size.y <= size.z) scene.rotateX(-Math.PI / 2)
      else if (size.x <= size.y && size.x <= size.z) scene.rotateY(Math.PI / 2)
    } else if (opts.align === 'barX') {
      // a bar's length is its largest extent — rotate it onto X
      if (size.y >= size.x && size.y >= size.z) scene.rotateZ(-Math.PI / 2)
      else if (size.z >= size.x && size.z >= size.y) scene.rotateY(-Math.PI / 2)
    }

    // rescale to target size
    box = new THREE.Box3().setFromObject(wrapper)
    const s2 = box.getSize(new THREE.Vector3())
    const major =
      opts.align === 'puckZ' ? Math.max(s2.x, s2.y) : opts.align === 'barX' ? s2.x : Math.max(s2.x, s2.y, s2.z)
    if (major > 0) wrapper.scale.setScalar(opts.size / major)

    wrapper.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const m of mats) {
          const std = m as THREE.MeshStandardMaterial
          if (std.isMeshStandardMaterial) {
            std.envMapIntensity = 0.9
          }
        }
      }
    })
    return wrapper
  } catch {
    return null
  }
}

export async function loadAnchors(): Promise<AnchorSet> {
  const [chassisMonolith, chassisOrbital, chassisAcrylic, knob, rail] = await Promise.all([
    loadAnchor(MINT_ASSET_URLS.models.chassisMonolith, { size: 5.15, align: 'puckZ' }),
    loadAnchor(MINT_ASSET_URLS.models.chassisOrbital, { size: 4.95, align: 'puckZ' }),
    loadAnchor(MINT_ASSET_URLS.models.chassisAcrylic, { size: 4.8, align: 'puckZ' }),
    loadAnchor(MINT_ASSET_URLS.models.rotaryKnob, { size: 0.34, align: 'puckZ' }),
    loadAnchor(MINT_ASSET_URLS.models.gripRail, { size: 1.5, align: 'barX' }),
  ])
  return {
    chassis: null,
    chassisMonolith,
    chassisOrbital,
    chassisAcrylic,
    hub: null,
    knob,
    rail,
  }
}

/** Clone an anchor template for placement (geometry/material shared). */
export function placeAnchor(
  template: THREE.Object3D | null,
  fallback: () => THREE.Object3D,
  opts: { pos?: [number, number, number]; scale?: number; rotZ?: number } = {},
): THREE.Object3D {
  const obj = template ? template.clone(true) : fallback()
  // anchors animate by scale (not material fade) and share template
  // geometry/materials — they must never be disposed with a skin
  obj.userData.anchor = true
  obj.traverse((o) => {
    o.userData.shared = true
  })
  if (opts.pos) obj.position.set(...opts.pos)
  if (opts.scale) obj.scale.multiplyScalar(opts.scale)
  if (opts.rotZ) obj.rotation.z = opts.rotZ
  return obj
}

// ------------------------------------------------ procedural fallbacks

export function fallbackKnob(): THREE.Object3D {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.17, 0.1, 32),
    new THREE.MeshStandardMaterial({ color: 0x1c1e22, metalness: 0.3, roughness: 0.75 }),
  )
  body.rotation.x = Math.PI / 2
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.02, 32),
    new THREE.MeshStandardMaterial({ color: 0x2b2e34, metalness: 0.75, roughness: 0.35 }),
  )
  cap.rotation.x = Math.PI / 2
  cap.position.z = 0.06
  const tick = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.1, 0.012),
    new THREE.MeshBasicMaterial({ color: 0xe8eaed }),
  )
  tick.position.set(0, 0.075, 0.068)
  // knurling
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    const ridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.012, 0.09),
      new THREE.MeshStandardMaterial({ color: 0x121417, roughness: 0.9 }),
    )
    ridge.position.set(Math.cos(a) * 0.165, Math.sin(a) * 0.165, 0)
    ridge.rotation.z = a
    g.add(ridge)
  }
  g.add(body, cap, tick)
  return g
}

export function fallbackRail(): THREE.Object3D {
  const g = new THREE.Group()
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.24, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x17181c, metalness: 0.4, roughness: 0.7 }),
  )
  g.add(base)
  const finMat = new THREE.MeshStandardMaterial({ color: 0x24262c, metalness: 0.45, roughness: 0.6 })
  for (let i = 0; i < 12; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.14), finMat)
    fin.position.x = -0.66 + i * 0.12
    g.add(fin)
  }
  return g
}
