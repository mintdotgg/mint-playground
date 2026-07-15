import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

import './styles.css'
import { POSTERS, type PosterDef } from './posters'
import { Stage } from './stage'
import { makeDissolvable, setDissolve, type DissolveHandle } from './dissolve'
import { GalleryAudio } from './audio'
import {
  skinChrome,
  chromeExit,
  chromeEnter,
  buildRail,
  setLoaderProgress,
  hideLoader,
  setAutoFill,
  bindSoundToggle,
  reflectSoundState,
  fitMegaTitle,
} from './ui'
import { seg, easeInOutCubic, easeOutCubic, lerp, FireOnce } from './tween'

const PEDESTAL_TOP = 0.36
const AUTO_ADVANCE_S = 9
const TRANSITION_S = 2.3

// ---------------------------------------------------------------- renderer

const canvas = document.getElementById('gl') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping

const stage = new Stage()
const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 120)

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(stage.scene, camera))
const bloomPass = new UnrealBloomPass(new THREE.Vector2(1280, 720), 0.2, 0.5, 0.9)
composer.addPass(bloomPass)
composer.addPass(new OutputPass())

// Some embedded panes report a 0-size viewport at load and never fire resize,
// so poll dimensions each frame instead of trusting resize events.
let lastW = 0
let lastH = 0
function measureViewport(): [number, number] {
  const w = window.innerWidth || document.documentElement.clientWidth || 1280
  const h = window.innerHeight || document.documentElement.clientHeight || 720
  return [Math.max(w, 4), Math.max(h, 4)]
}
function ensureSize() {
  const [w, h] = measureViewport()
  if (w === lastW && h === lastH) return
  lastW = w
  lastH = h
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h, false)
  composer.setSize(w, h)
  fitMegaTitle()
}
ensureSize()

// ---------------------------------------------------------------- state

interface Exhibit {
  pivot: THREE.Group
  dissolve: DissolveHandle[]
}

const exhibits: Exhibit[] = []
const audio = new GalleryAudio()

let current = 0
let pending = -1
let transitionT = -1 // <0 means idle
let transitionStart = 0 // wall-clock ms, so throttled tabs still finish on time
const fires = new FireOnce()
let autoTimer = 0
let spinVel = 0
let dragging = false
let zoom = 1
let zoomTarget = 1
const ZOOM_MIN = 0.4
const ZOOM_MAX = 2.3
let camFrom = { pos: new THREE.Vector3(), target: new THREE.Vector3() }
const camTarget = new THREE.Vector3()
const pointer = new THREE.Vector2()

// ---------------------------------------------------------------- loading

const gltfLoader = new GLTFLoader()
const texLoader = new THREE.TextureLoader()

function normalizeModel(root: THREE.Object3D, def: PosterDef): THREE.Group {
  const pivot = new THREE.Group()
  const holder = new THREE.Group()
  pivot.add(holder)
  holder.add(root)

  const emissive = def.model.emissive ?? 1
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh) {
      mesh.castShadow = true
      mesh.receiveShadow = true
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial
        if (std.emissiveIntensity !== undefined) std.emissiveIntensity *= emissive
      }
    }
  })

  const box = new THREE.Box3().setFromObject(root)
  const size = box.getSize(new THREE.Vector3())
  // fit by largest dimension so long quadrupeds don't overwhelm the stage
  const maxDim = Math.max(size.x, size.y, size.z, 1e-4)
  const scale = def.model.height / maxDim
  root.scale.setScalar(scale)
  box.setFromObject(root)
  const center = box.getCenter(new THREE.Vector3())
  root.position.x -= center.x
  root.position.z -= center.z
  root.position.y += PEDESTAL_TOP - box.min.y + def.model.yOffset
  holder.rotation.y = def.model.rotationY
  return pivot
}

async function loadExhibit(def: PosterDef): Promise<Exhibit> {
  const gltf = await gltfLoader.loadAsync(def.model.url)
  const pivot = normalizeModel(gltf.scene, def)
  const dissolve = makeDissolvable(pivot, def.model.roughFloor ?? 0)
  pivot.visible = false
  stage.scene.add(pivot)
  return { pivot, dissolve }
}

const MATERIALS = {
  floor: {
    map: 'https://cdn.mint.gg/materials/w17dgqb5cd44dtn45wm6x2hmt58af4gr/gallery-concrete-basecolor-ec626b-fe05d0d60bf3258f.png',
    normalMap: 'https://cdn.mint.gg/materials/w17dgqb5cd44dtn45wm6x2hmt58af4gr/gallery-concrete-normal-b8870b-9844d25a4840d93d.png',
    roughnessMap: 'https://cdn.mint.gg/materials/w17dgqb5cd44dtn45wm6x2hmt58af4gr/gallery-concrete-roughness-01d900-0439b2e8ac9c9d72.png',
  },
  pedestal: {
    map: 'https://cdn.mint.gg/materials/w1709vds5bfqjmphw2b8jcqhjs8aeb4w/holo-foil-basecolor-7bec78-79ddef1b989cab3e.png',
    normalMap: 'https://cdn.mint.gg/materials/w1709vds5bfqjmphw2b8jcqhjs8aeb4w/holo-foil-normal-19569b-c6894527d2a1a9f4.png',
    roughnessMap: 'https://cdn.mint.gg/materials/w1709vds5bfqjmphw2b8jcqhjs8aeb4w/holo-foil-roughness-3a3d08-cbdaaacfb0c97d34.png',
  },
} as const

async function loadMaterials() {
  try {
    for (const target of ['floor', 'pedestal'] as const) {
      const entry = MATERIALS[target]
      const maps: { map?: THREE.Texture; normalMap?: THREE.Texture; roughnessMap?: THREE.Texture } = {}
      for (const [slot, url] of Object.entries(entry)) {
        const tex = await texLoader.loadAsync(url)
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping
        tex.repeat.set(target === 'floor' ? 6 : 2, target === 'floor' ? 6 : 1)
        if (slot === 'map') tex.colorSpace = THREE.SRGBColorSpace
        if (slot === 'map' || slot === 'normalMap' || slot === 'roughnessMap') {
          maps[slot] = tex
        }
      }
      stage.applyMaps(target, maps)
    }
  } catch {
    /* untextured fallback is fine */
  }
}

// ---------------------------------------------------------------- transitions

function beginTransition(next: number) {
  if (next === current || transitionT >= 0 || !exhibits[next]) return
  pending = next
  transitionT = 0
  transitionStart = performance.now()
  zoomTarget = 1
  zoom = 1
  fires.reset()
  autoTimer = 0
  audio.play('whoosh', 0.16)
  chromeExit()
  camFrom.pos.copy(camera.position)
  camFrom.target.copy(camTarget)
  rail.setActive(next)
}

function tickTransition() {
  if (transitionT < 0) return
  transitionT = (performance.now() - transitionStart) / 1000
  const t = transitionT
  const from = POSTERS[current]
  const to = POSTERS[pending]
  const exFrom = exhibits[current]
  const exTo = exhibits[pending]

  // outgoing dissolve, burning in the *incoming* accent
  const out = easeInOutCubic(seg(t, 0, 0.85))
  setDissolve(exFrom.dissolve, out, new THREE.Color(to.ui.accent))

  // environment + camera blend
  const env = easeInOutCubic(seg(t, 0.15, 2.0))
  stage.mixEnv(from, to, env)
  camera.position.lerpVectors(
    camFrom.pos,
    new THREE.Vector3(...to.cam.pos),
    env
  )
  camTarget.lerpVectors(camFrom.target, new THREE.Vector3(...to.cam.target), env)
  bloomPass.strength = lerp(from.env.bloom, to.env.bloom, env)
  renderer.toneMappingExposure = lerp(from.env.exposure, to.env.exposure, env)

  // incoming dissolve
  fires.fire('show-in', t >= 0.95, () => {
    exTo.pivot.visible = true
  })
  if (t >= 0.95) {
    const inn = 1 - easeOutCubic(seg(t, 0.95, 1.1))
    setDissolve(exTo.dissolve, inn, new THREE.Color(to.ui.accent))
  }

  fires.fire('hide-out', t >= 0.9, () => {
    exFrom.pivot.visible = false
  })
  fires.fire('reskin', t >= 0.55, () => {
    skinChrome(to)
    chromeEnter()
  })
  fires.fire('impact', t >= 1.9, () => {
    audio.play('impact', 0.28)
    bloomPulse = 0.55
  })

  if (t >= TRANSITION_S) {
    setDissolve(exTo.dissolve, 0)
    stage.mixEnv(to, to, 1)
    current = pending
    pending = -1
    transitionT = -1
  }
}

// ---------------------------------------------------------------- input

function bindInput() {
  window.addEventListener('pointerdown', (e) => {
    audio.unlock()
    reflectSoundState(audio.enabled)
    if ((e.target as HTMLElement).closest('#rail')) return
    dragging = true
  })
  window.addEventListener('pointerup', () => (dragging = false))
  window.addEventListener('pointermove', (e) => {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1)
    if (dragging) {
      spinVel += e.movementX * 0.00028
      autoTimer = 0
    }
  })
  window.addEventListener('keydown', (e) => {
    audio.unlock()
    reflectSoundState(audio.enabled)
    if (e.key === 'ArrowRight') beginTransition((current + 1) % POSTERS.length)
    if (e.key === 'ArrowLeft') beginTransition((current - 1 + POSTERS.length) % POSTERS.length)
  })
  // wheel / trackpad pinch → dolly toward or away from the exhibit
  window.addEventListener(
    'wheel',
    (e) => {
      const t = e.target as HTMLElement | null
      if (t?.closest?.('#rail')) return
      e.preventDefault()
      const speed = e.ctrlKey ? 0.006 : 0.0013 // pinch gestures report smaller deltas
      zoomTarget = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomTarget * Math.exp(e.deltaY * speed)))
      autoTimer = 0
    },
    { passive: false }
  )
}

// ---------------------------------------------------------------- thumbnails

function applyPosterInstant(i: number) {
  const p = POSTERS[i]
  stage.apply(p)
  bloomPass.strength = p.env.bloom
  renderer.toneMappingExposure = p.env.exposure
  exhibits.forEach((ex, j) => (ex.pivot.visible = i === j))
  setDissolve(exhibits[i].dissolve, 0)
  camera.position.set(...p.cam.pos)
  camTarget.set(...p.cam.target)
  camera.lookAt(camTarget)
  camFrom = { pos: camera.position.clone(), target: camTarget.clone() }
}

function snapshotThumbs(canvases: HTMLCanvasElement[]): boolean {
  const W = renderer.domElement.width
  const H = renderer.domElement.height
  if (W < 8 || H < 8) return false
  POSTERS.forEach((p, i) => {
    stage.apply(p)
    bloomPass.strength = p.env.bloom
    renderer.toneMappingExposure = p.env.exposure
    exhibits.forEach((ex, j) => (ex.pivot.visible = i === j))
    camera.position.set(...p.cam.pos)
    camera.lookAt(...p.cam.target)
    composer.render()
    const cv = canvases[i]
    const ctx2d = cv.getContext('2d')!
    const sw = H * (cv.width / cv.height)
    ctx2d.drawImage(renderer.domElement, (W - sw) / 2, 0, sw, H, 0, 0, cv.width, cv.height)
  })
  return true
}

// ---------------------------------------------------------------- boot

const rail = buildRail(
  POSTERS,
  (i) => beginTransition(i),
  () => audio.play('blip', 0.2)
)
bindSoundToggle(() => {
  audio.unlock()
  audio.setEnabled(!audio.enabled)
  return audio.enabled
})
bindInput()

let bloomPulse = 0
let thumbsDirty = false
const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)
  ensureSize()
  if (thumbsDirty && snapshotThumbs(rail.canvases)) {
    thumbsDirty = false
    applyPosterInstant(current)
  }
  const dt = Math.min(clock.getDelta(), 0.05)
  const time = clock.elapsedTime
  const def = POSTERS[transitionT >= 0 ? pending : current]
  const ex = exhibits[transitionT >= 0 ? pending : current]

  // turntable + drag spin + float
  for (const [i, e] of exhibits.entries()) {
    if (!e.pivot.visible) continue
    const d = POSTERS[i]
    e.pivot.rotation.y += (d.turntableSpeed * 0.5 + spinVel * 60) * dt
    e.pivot.position.y = Math.sin(time * 0.7 + i * 2) * d.floatAmp
  }
  spinVel *= Math.pow(0.0015, dt) // exponential damping

  stage.update(dt, time)
  tickTransition()

  // idle camera: parallax + dolly zoom around the poster's base position
  if (transitionT < 0 && ex) {
    const base = def.cam
    zoom = lerp(zoom, zoomTarget, 1 - Math.pow(0.002, dt))
    // dolly along the base view axis; parallax shrinks as you close in
    const dx = base.pos[0] - base.target[0]
    const dy = base.pos[1] - base.target[1]
    const dz = base.pos[2] - base.target[2]
    const px = base.target[0] + dx * zoom + pointer.x * 0.22 * zoom
    const py = base.target[1] + dy * zoom - pointer.y * 0.14 * zoom
    const pz = base.target[2] + dz * zoom
    const k = 1 - Math.pow(0.001, dt)
    camera.position.x = lerp(camera.position.x, px, k)
    camera.position.y = lerp(camera.position.y, py, k)
    camera.position.z = lerp(camera.position.z, pz, k)
    camTarget.set(...base.target)

    // auto-advance pauses while the visitor is zoomed in on details
    if (Math.abs(zoomTarget - 1) > 0.05) {
      autoTimer = 0
      setAutoFill(0)
    } else {
      autoTimer += dt
      setAutoFill(autoTimer / AUTO_ADVANCE_S)
      if (autoTimer >= AUTO_ADVANCE_S) {
        autoTimer = 0
        beginTransition((current + 1) % POSTERS.length)
      }
    }
  } else {
    setAutoFill(0)
  }
  camera.lookAt(camTarget)

  // bloom impact pulse decay
  if (bloomPulse > 0.001) {
    bloomPulse *= Math.pow(0.02, dt)
    bloomPass.strength = POSTERS[current].env.bloom + bloomPulse
  }

  composer.render()
}

async function boot() {
  let done = 0
  const total = POSTERS.length + 2
  const bump = (log: string) => {
    done++
    setLoaderProgress(done / total, log)
  }

  setLoaderProgress(0.02, 'LINK: MINT PIPELINE_')

  const loaded = await Promise.all(
    POSTERS.map(async (p) => {
      const ex = await loadExhibit(p)
      bump(`EXHIBIT ${p.index} ${p.megaTitle} — MESH DOCKED_`)
      return ex
    })
  )
  exhibits.push(...loaded)

  await loadMaterials()
  bump('PBR SURFACES BONDED_')
  await audio.preload()
  bump('AUDIO BUS ONLINE_')

  // thumbnails snapshot on the first frame with a valid viewport
  thumbsDirty = true
  applyPosterInstant(0)
  skinChrome(POSTERS[0])
  chromeEnter()
  rail.setActive(0)

  hideLoader()
  animate()
}

void boot().catch((err: unknown) => {
  console.error('boot failed', err)
  setLoaderProgress(1, `ERR: ${err instanceof Error ? err.message : String(err)}`)
})
