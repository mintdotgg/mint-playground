import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { AudioEngine } from './audio/engine'
import { TRACKS } from './audio/tracks'
import { DiscRig } from './kit/disc'
import { loadAnchors, type AnchorSet } from './kit/models'
import { SkinManager } from './skins/manager'
import { SKINS } from './skins/index'
import type { SkinCtx, SkinDef } from './skins/types'
import { Backdrop } from './backdrop'
import { DanceFloor } from './dance/danceFloor'
import { tweens, damp, easings } from './tween'
import { MINT_ASSET_URLS } from './assets/runtime'

export type ExperienceMode = 'cd' | 'entering' | 'floor' | 'exiting'

type StagedLayer = {
  skin: THREE.Group
  object: THREE.Object3D
  wrapper: THREE.Group
  originalPosition: THREE.Vector3
  originalQuaternion: THREE.Quaternion
  originalScale: THREE.Vector3
  basePosition: THREE.Vector3
}

export class App {
  readonly engine = new AudioEngine()
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly controls: OrbitControls
  private composer: EffectComposer
  private bloom: UnrealBloomPass
  private accentLight: THREE.PointLight
  private root = new THREE.Group()
  private skinHost = new THREE.Group()
  private disc: DiscRig
  private danceFloor: DanceFloor
  private backdrop = new Backdrop()
  private skinMgr: SkinManager
  private interactives: THREE.Object3D[] = []
  private raycaster = new THREE.Raycaster()
  private ndc = new THREE.Vector2()
  private downAt: [number, number] | null = null
  private clock = new THREE.Clock()
  private time = 0
  private fitScale = 1
  private diagTime = 0
  private diagFrames = 0
  private lastRenderCalls = 0
  private lastRenderTriangles = 0
  private powered = false
  private mode: ExperienceMode = 'cd'
  private floorScale = 1.35
  private stagedLayers: StagedLayer[] = []
  onSkinChange: (def: SkinDef) => void = () => undefined
  onModeChange: (mode: ExperienceMode) => void = () => undefined

  private constructor(
    private container: HTMLElement,
    anchors: AnchorSet,
    holoTex: THREE.Texture | null,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.info.autoReset = false
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(31, 1, 0.1, 60)
    this.camera.position.set(0.16, -0.04, 8.35)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(0, 0.08, 0)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.075
    this.controls.enablePan = true
    this.controls.screenSpacePanning = true
    this.controls.panSpeed = 0.72
    this.controls.enableZoom = true
    this.controls.zoomToCursor = true
    this.controls.rotateSpeed = 0.62
    this.controls.zoomSpeed = 0.8
    this.controls.minDistance = 4.2
    this.controls.maxDistance = 15
    // Near-full polar freedom plus unlimited azimuth enables views from above,
    // below and directly behind without letting the camera hit the singularity.
    this.controls.minPolarAngle = 0.02
    this.controls.maxPolarAngle = Math.PI - 0.02
    this.controls.minAzimuthAngle = -Infinity
    this.controls.maxAzimuthAngle = Infinity
    this.controls.update()
    this.controls.saveState()

    // environment for the PBR anchors
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

    // lights
    const key = new THREE.DirectionalLight(0xffffff, 2.1)
    key.position.set(-2.6, 3.8, 5.4)
    const fill = new THREE.DirectionalLight(0x91a7c3, 0.7)
    fill.position.set(3.4, -1.6, 3.2)
    const rim = new THREE.DirectionalLight(0xdce8ff, 1.35)
    rim.position.set(4.8, 2.4, -1.2)
    this.accentLight = new THREE.PointLight(SKINS[0].palette.accent, 2.2, 7, 2)
    this.accentLight.position.set(-2.1, -1.4, 3.2)
    this.scene.add(new THREE.HemisphereLight(0xd8e2ef, 0x101116, 0.62), key, fill, rim, this.accentLight)

    this.scene.add(this.backdrop.mesh)
    this.scene.add(this.root)
    this.root.rotation.set(0.035, -0.055, -0.01)
    this.root.add(this.skinHost)

    this.disc = new DiscRig(holoTex)
    if (anchors.hub) this.disc.setHub(anchors.hub)
    this.disc.portalHitTarget.userData.onTap = () => this.enterDanceFloor()
    this.root.add(this.disc.group)
    this.danceFloor = new DanceFloor(this.engine)
    this.disc.group.add(this.danceFloor.group)

    const ctx: SkinCtx = {
      engine: this.engine,
      anchors,
      holoTex,
      addInteractive: (m) => this.interactives.push(m),
    }
    this.skinMgr = new SkinManager(this.skinHost, ctx, this.disc, {
      onSkin: (def) => {
        this.backdrop.setPalette(def.palette)
        this.danceFloor.setSkin(def)
        this.disc.setPortalAccent(def.palette.accent)
        this.accentLight.color.set(def.palette.accent)
        this.accentLight.intensity = def.id === 'prism' ? 1.05 : 1.75
        // Keep manufactured surfaces crisp. Only the deliberately holographic
        // PRISM skin earns the expensive full-scene bloom treatment.
        this.bloom.enabled = def.id === 'prism'
        const fromS = this.bloom.strength
        const fromT = this.bloom.threshold
        tweens.add({
          duration: 0.7,
          onUpdate: (v) => {
            this.bloom.strength = fromS + (def.bloom.strength - fromS) * v
            this.bloom.threshold = fromT + (def.bloom.threshold - fromT) * v
          },
        })
        this.onSkinChange(def)
      },
      resetInteractives: () => {
        this.interactives.length = 0
      },
    })

    // composer
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), SKINS[0].bloom.strength, 0.55, SKINS[0].bloom.threshold)
    this.bloom.enabled = SKINS[0].id === 'prism'
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())

    this.bindEvents()
    this.resize()

    // art follows the current track everywhere
    const applyArt = () => {
      const t = TRACKS[this.engine.trackIndex]
      this.disc.setArt(t.art, t.accent)
    }
    this.engine.on('track', applyArt)
    applyArt()

    this.skinMgr.switchTo(SKINS[0].id, true)
    this.renderer.setAnimationLoop(() => this.frame())
  }

  static async create(container: HTMLElement): Promise<App> {
    const [anchors, holoTex] = await Promise.all([
      loadAnchors(),
      new THREE.TextureLoader()
        .loadAsync(MINT_ASSET_URLS.holoFoil)
        .then((t) => {
          t.colorSpace = THREE.SRGBColorSpace
          t.wrapS = t.wrapT = THREE.RepeatWrapping
          t.anisotropy = 4
          return t
        })
        .catch(() => null),
    ])
    return new App(container, anchors, holoTex)
  }

  powerOn() {
    this.powered = true
    this.disc.setPortalVisible(this.mode === 'cd')
    this.engine.unlock()
    this.engine.load(0, true)
  }

  setSkin(id: string) {
    if (this.mode === 'entering' || this.mode === 'exiting' || id === this.skinMgr.def.id) return
    if (this.mode === 'floor') {
      // The outgoing skin and its centered portal wrappers retire together.
      // Build the replacement without a frontal intro, then immediately stage
      // its stable authored transforms around the active floor.
      this.stagedLayers = []
      this.skinMgr.switchTo(id, true)
      this.stageSkinElements(true)
      return
    }
    this.skinMgr.switchTo(id)
  }
  skinNext(dir: 1 | -1) {
    if (this.mode === 'entering' || this.mode === 'exiting') return
    const i = SKINS.findIndex((skin) => skin.id === this.skinMgr.def.id)
    this.setSkin(SKINS[(i + dir + SKINS.length) % SKINS.length].id)
  }

  resetView() {
    if (this.mode === 'floor') {
      const pose = this.getFloorPose()
      this.camera.position.copy(pose.camera)
      this.controls.target.copy(pose.target)
      this.controls.update()
      return
    }
    this.controls.reset()
    this.controls.update()
  }

  enterDanceFloor() {
    if (this.mode !== 'cd') return
    this.mode = 'entering'
    this.disc.setPortalVisible(false)
    this.onModeChange(this.mode)
    this.controls.enabled = false
    this.disc.setDanceMode(true)
    this.stageSkinElements()
    this.danceFloor.show()

    const fromRootPos = this.root.position.clone()
    const fromRootQuat = this.root.quaternion.clone()
    const fromRootScale = this.root.scale.clone()
    const targetRootPos = new THREE.Vector3(0, -1.15, 0.16)
    const targetRootQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
    this.floorScale = this.getTargetFloorScale()
    const targetRootScale = new THREE.Vector3().setScalar(this.floorScale)
    const pose = this.getFloorPose(targetRootPos, targetRootQuat, this.floorScale)

    this.animateCamera(pose.camera, pose.target, 1.35)
    tweens.add({
      duration: 1.35,
      ease: easings.inOutCubic,
      onUpdate: (v) => {
        this.root.position.lerpVectors(fromRootPos, targetRootPos, v)
        this.root.quaternion.slerpQuaternions(fromRootQuat, targetRootQuat, v)
        this.root.scale.lerpVectors(fromRootScale, targetRootScale, v)
      },
      onComplete: () => {
        this.mode = 'floor'
        this.controls.enabled = true
        // Allow the camera to cross inside the arena tiers and move among the
        // dancers. CD mode restores its safer product-view distance on exit.
        this.controls.minDistance = 0.75
        this.controls.maxDistance = 15
        this.onModeChange(this.mode)
      },
    })
  }

  exitDanceFloor() {
    if (this.mode !== 'floor') return
    this.mode = 'exiting'
    this.onModeChange(this.mode)
    this.controls.enabled = false
    this.danceFloor.hide()
    this.restoreSkinElements()

    const fromRootPos = this.root.position.clone()
    const fromRootQuat = this.root.quaternion.clone()
    const fromRootScale = this.root.scale.clone()
    const targetRootPos = new THREE.Vector3(0, 0.08, 0)
    const targetRootQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.035, -0.055, -0.01))
    const targetRootScale = new THREE.Vector3().setScalar(this.fitScale)
    const cdCamera = new THREE.Vector3(0.16, -0.04, 8.35)
    const cdTarget = new THREE.Vector3(0, 0.08, 0)

    this.animateCamera(cdCamera, cdTarget, 1.25)
    tweens.add({
      duration: 1.25,
      ease: easings.inOutCubic,
      onUpdate: (v) => {
        this.root.position.lerpVectors(fromRootPos, targetRootPos, v)
        this.root.quaternion.slerpQuaternions(fromRootQuat, targetRootQuat, v)
        this.root.scale.lerpVectors(fromRootScale, targetRootScale, v)
      },
      onComplete: () => {
        this.mode = 'cd'
        this.disc.setDanceMode(false)
        this.disc.setPortalVisible(this.powered)
        this.controls.enabled = true
        this.controls.minDistance = 4.2
        this.controls.maxDistance = 15
        this.onModeChange(this.mode)
      },
    })
  }

  // ------------------------------------------------------------- internals

  private bindEvents() {
    window.addEventListener('resize', () => this.resize())
    const el = this.renderer.domElement

    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect()
      this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      // hover cursor
      this.raycaster.setFromCamera(this.ndc, this.camera)
      const hit = this.getInteractiveHit()
      this.disc.setPortalHovered(hit?.object === this.disc.portalHitTarget)
      el.style.cursor = hit?.object.userData.cursor ?? 'grab'
    })

    el.addEventListener('pointerdown', (e) => {
      this.downAt = [e.clientX, e.clientY]
      el.style.cursor = 'grabbing'
    })
    el.addEventListener('pointerup', (e) => {
      if (!this.downAt) {
        el.style.cursor = 'grab'
        return
      }
      const dx = e.clientX - this.downAt[0]
      const dy = e.clientY - this.downAt[1]
      this.downAt = null
      if (dx * dx + dy * dy > 64) {
        el.style.cursor = 'grab'
        return
      }
      const r = el.getBoundingClientRect()
      this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      this.raycaster.setFromCamera(this.ndc, this.camera)
      const hit = this.getInteractiveHit()
      if (hit?.object.userData.onTap && hit.uv) {
        hit.object.userData.onTap(hit.uv)
      }
      this.disc.setPortalHovered(hit?.object === this.disc.portalHitTarget)
      el.style.cursor = hit?.object.userData.cursor ?? 'grab'
    })
    el.addEventListener('pointercancel', () => {
      this.downAt = null
      this.disc.setPortalHovered(false)
      el.style.cursor = 'grab'
    })
    el.addEventListener('pointerleave', () => {
      this.disc.setPortalHovered(false)
      el.style.cursor = 'grab'
    })
    window.addEventListener('blur', () => {
      this.downAt = null
      this.disc.setPortalHovered(false)
      el.style.cursor = 'grab'
    })

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return
      if (e.code === 'Space') {
        e.preventDefault()
        this.engine.toggle()
      } else if (e.code === 'ArrowRight') this.engine.next()
      else if (e.code === 'ArrowLeft') this.engine.prev()
      else if (e.code === 'BracketRight') this.skinNext(1)
      else if (e.code === 'BracketLeft') this.skinNext(-1)
      else if (e.code === 'KeyR' || e.code === 'Digit0') this.resetView()
      else if (e.code === 'KeyE') {
        if (this.mode === 'cd') this.enterDanceFloor()
        else if (this.mode === 'floor') this.exitDanceFloor()
      }
      else if (/^Digit[1-5]$/.test(e.code) || /^[1-5]$/.test(e.key)) {
        const i = /^[1-5]$/.test(e.key) ? Number(e.key) - 1 : Number(e.code.slice(5)) - 1
        if (SKINS[i]) this.setSkin(SKINS[i].id)
      }
    })
  }

  private resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.renderer.setSize(w, h)
    this.composer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    // fit the 6.2 × 5.0 design box
    // Use the authored design distance, not the live camera Z: a resize while
    // viewing the back must never invert or rescale the player.
    const dist = 8.35
    const visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
    const visW = visH * this.camera.aspect
    // Keep the player as one compact hero object with intentional negative
    // space around it, matching the attached product-object references.
    this.fitScale = Math.min(visW / 6.55, visH / 5.42) * 0.8
    if (this.mode === 'cd') {
      this.root.scale.setScalar(this.fitScale)
      this.root.position.y = 0.08
    } else if (this.mode === 'floor') {
      this.floorScale = this.getTargetFloorScale()
      this.root.scale.setScalar(this.floorScale)
    }
  }

  private frame() {
    const dt = Math.min(0.05, this.clock.getDelta())
    this.time += dt
    const t = this.time

    this.engine.update(dt)
    this.disc.update(dt, this.engine.bands, this.engine.playing, t)
    if (this.mode === 'cd') this.skinMgr.update(dt, t)
    this.danceFloor.update(dt, t)
    tweens.update(dt)

    if (this.mode === 'cd' || this.mode === 'floor') {
      const baseScale = this.mode === 'floor' ? this.floorScale : this.fitScale
      const breath = this.mode === 'floor' ? 0.008 : 0.004
      const target = baseScale * (1 + this.engine.bands.pulse * breath)
      this.root.scale.setScalar(damp(this.root.scale.x, target, 10, dt))
    }
    this.controls.update(dt)

    this.composer.render()
    this.lastRenderCalls = this.renderer.info.render.calls
    this.lastRenderTriangles = this.renderer.info.render.triangles
    this.renderer.info.reset()

    // Lightweight live diagnostics for visual QA without a debug overlay.
    this.diagTime += dt
    this.diagFrames++
    if (this.diagTime >= 1) {
      const info = this.renderer.info
      this.renderer.domElement.dataset.renderInfo = JSON.stringify({
        fps: Math.round(this.diagFrames / this.diagTime),
        calls: this.lastRenderCalls,
        triangles: this.lastRenderTriangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        dpr: this.renderer.getPixelRatio(),
        audio: {
          playing: this.engine.playing,
          trackIndex: this.engine.trackIndex,
          time: Number(this.engine.time.toFixed(2)),
          duration: Number(this.engine.duration.toFixed(2)),
          unavailable: [...this.engine.unavailable],
          contextState: this.engine.ctx?.state ?? 'locked',
          media: this.engine.diagnostics,
        },
      })
      this.diagTime = 0
      this.diagFrames = 0
    }

  }

  private getInteractiveHit() {
    let hit = this.raycaster.intersectObjects(this.interactives, false)[0]
    if (this.powered && this.mode === 'cd') {
      const portalHit = this.raycaster.intersectObject(this.disc.portalHitTarget, false)[0]
      if (portalHit && (!hit || portalHit.distance < hit.distance)) hit = portalHit
    }
    return hit
  }

  private animateCamera(toPosition: THREE.Vector3, toTarget: THREE.Vector3, duration: number) {
    const fromPosition = this.camera.position.clone()
    const fromTarget = this.controls.target.clone()
    tweens.add({
      duration,
      ease: easings.inOutCubic,
      onUpdate: (v) => {
        this.camera.position.lerpVectors(fromPosition, toPosition, v)
        this.controls.target.lerpVectors(fromTarget, toTarget, v)
        this.controls.update()
      },
    })
  }

  private getFloorPose(
    rootPosition = this.root.position,
    rootQuaternion = this.root.quaternion,
    rootScale = this.floorScale,
  ) {
    const center = this.disc.group.position
      .clone()
      .multiplyScalar(rootScale)
      .applyQuaternion(rootQuaternion)
      .add(rootPosition)
    const target = center.clone().add(new THREE.Vector3(0, 0.18, 0))
    const camera = center.clone().add(new THREE.Vector3(5.0, 4.45, 8.05))
    return { center, target, camera }
  }

  private getTargetFloorScale() {
    // Preserve the responsive floor sizing rule, then enlarge the complete
    // platform by exactly 25% for a more immersive arena presentation.
    return Math.max(1.08, this.fitScale * 1.32) * 1.25
  }

  private stageSkinElements(instant = false) {
    const skin = this.skinMgr.current?.group
    if (!skin) return
    this.stagedLayers = []
    const [cx, cy] = this.skinMgr.def.disc.pos
    const children = [...skin.children].filter((child) => child.userData.portalLayerRig !== true)
    skin.updateWorldMatrix(true, true)

    children.forEach((object, i) => {
      const bounds = new THREE.Box3().setFromObject(object)
      const worldCenter = bounds.isEmpty()
        ? object.getWorldPosition(new THREE.Vector3())
        : bounds.getCenter(new THREE.Vector3())
      const visualCenter = skin.worldToLocal(worldCenter.clone())
      const originalPosition = object.position.clone()
      const originalQuaternion = object.quaternion.clone()
      const originalScale = object.scale.clone()

      // All choreography happens on a wrapper whose origin is the visible
      // bounds center. Provider/model pivots can now be arbitrarily offset
      // without swinging the actual surface out below the amphitheater.
      const wrapper = new THREE.Group()
      wrapper.name = `portal-layer-rig-${i}`
      wrapper.userData.portalLayerRig = true
      wrapper.position.copy(visualCenter)
      skin.add(wrapper)
      skin.updateWorldMatrix(true, false)
      wrapper.attach(object)

      const record: StagedLayer = {
        skin,
        object,
        wrapper,
        originalPosition,
        originalQuaternion,
        originalScale,
        basePosition: visualCenter.clone(),
      }
      this.stagedLayers.push(record)

      // Frontal skin layers do not share a canonical local forward/up basis:
      // some are plates, some are rings, some are imported hardware groups.
      // Re-orienting those arbitrary children produces rolled labels and
      // detached knobs. Floor mode therefore retires the authored hardware and
      // hands presentation to DanceFloor's purpose-built radial panels/bars.
      const targetPosition = visualCenter.clone().lerp(
        new THREE.Vector3(cx, cy, visualCenter.z),
        0.24,
      )
      const targetQuaternion = new THREE.Quaternion()
      const targetScale = new THREE.Vector3().setScalar(0.001)

      if (instant) {
        wrapper.position.copy(targetPosition)
        wrapper.quaternion.copy(targetQuaternion)
        wrapper.scale.copy(targetScale)
        wrapper.visible = false
        return
      }

      const fromPosition = wrapper.position.clone()
      const fromQuaternion = wrapper.quaternion.clone()
      const fromScale = wrapper.scale.clone()
      tweens.add({
        duration: 1.05,
        delay: 0.08 + i * 0.012,
        ease: easings.inOutCubic,
        onUpdate: (v) => {
          wrapper.position.lerpVectors(fromPosition, targetPosition, v)
          wrapper.quaternion.slerpQuaternions(fromQuaternion, targetQuaternion, v)
          wrapper.scale.lerpVectors(fromScale, targetScale, v)
        },
        onComplete: () => {
          wrapper.visible = false
        },
      })
    })
  }

  private restoreSkinElements() {
    const records = [...this.stagedLayers]
    let remaining = records.length
    records.forEach((record, i) => {
      record.wrapper.visible = true
      const fromPosition = record.wrapper.position.clone()
      const fromQuaternion = record.wrapper.quaternion.clone()
      const fromScale = record.wrapper.scale.clone()
      const identityQuaternion = new THREE.Quaternion()
      const unitScale = new THREE.Vector3(1, 1, 1)
      tweens.add({
        duration: 0.95,
        delay: (records.length - i - 1) * 0.008,
        ease: easings.inOutCubic,
        onUpdate: (v) => {
          record.wrapper.position.lerpVectors(fromPosition, record.basePosition, v)
          record.wrapper.quaternion.slerpQuaternions(fromQuaternion, identityQuaternion, v)
          record.wrapper.scale.lerpVectors(fromScale, unitScale, v)
        },
        onComplete: () => {
          if (record.wrapper.parent === record.skin) {
            record.skin.attach(record.object)
            record.object.position.copy(record.originalPosition)
            record.object.quaternion.copy(record.originalQuaternion)
            record.object.scale.copy(record.originalScale)
            record.skin.remove(record.wrapper)
          }
          remaining--
          if (remaining === 0) this.stagedLayers = []
        },
      })
    })
  }

}
