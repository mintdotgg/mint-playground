import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { Vehicle } from './fleet'

type ShowroomOptions = {
  container: HTMLElement
  fleet: readonly Vehicle[]
  onProgress: (loaded: number, total: number, label: string) => void
  onThumbnail: (index: number, dataUrl: string) => void
}

type Transition = {
  from: number
  to: number
  direction: number
  startedAt: number
  duration: number
  resolve: () => void
}

type OrbitState = {
  yaw: number
  pitch: number
}

type OrbitGesture = {
  pointerId: number
  vehicleIndex: number
  lastX: number
  lastY: number
}

type Diagnostics = {
  calls: number
  triangles: number
  geometries: number
  textures: number
  materials: number
  fps: number
  frameMs: number
  dpr: number
  postPasses: number
  shadowMap: number
  selected: number
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))
const easeOutQuint = (value: number): number => 1 - Math.pow(1 - value, 5)
const easeInCubic = (value: number): number => value * value * value

export class VehicleShowroom {
  private readonly container: HTMLElement
  private readonly fleet: readonly Vehicle[]
  private readonly onProgress: ShowroomOptions['onProgress']
  private readonly onThumbnail: ShowroomOptions['onThumbnail']
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 90)
  private readonly renderer: THREE.WebGLRenderer
  private readonly composer: EffectComposer
  private readonly bloomPass: UnrealBloomPass
  private readonly loader = new GLTFLoader()
  private readonly clock = new THREE.Clock()
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointerNdc = new THREE.Vector2()
  private readonly models: THREE.Group[] = []
  private readonly orbitStates: OrbitState[]
  private readonly architecture = new THREE.Group()
  private readonly animatedRings: THREE.Mesh[] = []
  private readonly stageBoundObjects: THREE.Object3D[] = []
  private readonly accentMaterials: THREE.Material[] = []
  private readonly secondaryAccentMaterials: THREE.Material[] = []
  private readonly accentLights: THREE.Light[] = []
  private readonly currentAccent = new THREE.Color()
  private readonly targetAccent = new THREE.Color()
  private readonly currentSecondary = new THREE.Color()
  private readonly targetSecondary = new THREE.Color()
  private readonly currentSceneColor = new THREE.Color()
  private readonly targetSceneColor = new THREE.Color()
  private readonly neutralLight = new THREE.Color(0xffffff)
  private readonly zoomStates: number[]
  private keyLight: THREE.DirectionalLight | null = null
  private fillLight: THREE.DirectionalLight | null = null
  private rearLight: THREE.DirectionalLight | null = null
  private reflector: Reflector | null = null
  private animationFrame = 0
  private selectedIndex = 0
  private transition: Transition | null = null
  private orbitGesture: OrbitGesture | null = null
  private currentZoom = 0
  private cameraTransitionOffset = 0
  private disposed = false
  private materialCount = 0
  private frameAccumulator = 0
  private frameSamples = 0
  private lastDiagnosticAt = 0
  private readonly postEnabled = new URLSearchParams(window.location.search).get('post') === '1'

  constructor(options: ShowroomOptions) {
    this.container = options.container
    this.fleet = options.fleet
    this.onProgress = options.onProgress
    this.onThumbnail = options.onThumbnail
    this.orbitStates = options.fleet.map(() => ({ yaw: 0, pitch: 0 }))
    this.zoomStates = options.fleet.map(() => 0)
    this.currentAccent.set(options.fleet[0].accent)
    this.targetAccent.copy(this.currentAccent)
    this.currentSecondary.set(options.fleet[0].secondary)
    this.targetSecondary.copy(this.currentSecondary)
    this.currentSceneColor.set(options.fleet[0].sceneColor)
    this.targetSceneColor.copy(this.currentSceneColor)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.64
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.info.autoReset = false
    this.renderer.setClearColor(this.currentSceneColor, 1)
    this.container.appendChild(this.renderer.domElement)

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.08, 0.24, 0.96)
    this.composer.addPass(this.bloomPass)

    this.setupScene()
    this.resize()
    window.addEventListener('resize', this.resize)
  }

  async initialize(): Promise<void> {
    this.animationFrame = requestAnimationFrame(this.animate)
    let loaded = 0

    const loadTasks = this.fleet.map(async (vehicle, index) => {
      const model = await this.loadVehicle(vehicle, index)
      this.models[index] = model
      loaded += 1
      this.onProgress(loaded, this.fleet.length, vehicle.name)
      return model
    })

    await Promise.all(loadTasks)
    this.models.forEach((model, index) => {
      model.visible = index === 0
      this.scene.add(model)
    })
    this.materialCount = this.countMaterials()
    await this.captureThumbnails()
    this.onProgress(this.fleet.length, this.fleet.length, 'Fleet ready')
  }

  select(index: number, direction: number): Promise<void> {
    if (index === this.selectedIndex || !this.models[index]) return Promise.resolve()
    if (this.transition) this.finishTransition()
    this.orbitGesture = null

    const from = this.selectedIndex
    this.selectedIndex = index
    this.container.dataset.zoom = String(Math.round((this.zoomStates[index] ?? 0) * 100))
    this.targetAccent.set(this.fleet[index].accent)
    this.targetSecondary.set(this.fleet[index].secondary)
    this.targetSceneColor.set(this.fleet[index].sceneColor)

    const incoming = this.models[index]
    incoming.visible = true
    incoming.position.set(this.stageX() + direction * 6.4, this.stageY(index) + 0.34, -0.8)
    incoming.rotation.set(this.orbitPitch(index) + 0.02, this.presentationYaw(index) - direction * 0.46, -direction * 0.025)
    incoming.scale.setScalar(0.54)

    return new Promise<void>((resolve) => {
      this.transition = {
        from,
        to: index,
        direction,
        startedAt: performance.now(),
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 40 : 760,
        resolve,
      }
    })
  }

  hitTestActiveModel(clientX: number, clientY: number): boolean {
    const active = this.models[this.selectedIndex]
    if (!active?.visible) return false
    const rect = this.renderer.domElement.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return false

    this.pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.scene.updateMatrixWorld(true)
    this.camera.updateMatrixWorld(true)
    this.raycaster.setFromCamera(this.pointerNdc, this.camera)
    return this.raycaster.intersectObject(active, true).length > 0
  }

  beginOrbit(clientX: number, clientY: number, pointerId: number): boolean {
    if (!this.hitTestActiveModel(clientX, clientY)) return false
    if (this.transition) this.finishTransition()
    this.orbitGesture = {
      pointerId,
      vehicleIndex: this.selectedIndex,
      lastX: clientX,
      lastY: clientY,
    }
    return true
  }

  adjustZoom(amount: number): boolean {
    const current = this.zoomStates[this.selectedIndex] ?? 0
    const next = THREE.MathUtils.clamp(current + amount, 0, 1)
    if (Math.abs(next - current) < 0.0001) return false
    this.zoomStates[this.selectedIndex] = next
    this.container.dataset.zoom = String(Math.round(next * 100))
    return true
  }

  resetZoom(): void {
    this.zoomStates[this.selectedIndex] = 0
    this.container.dataset.zoom = '0'
  }

  updateOrbit(clientX: number, clientY: number, pointerId: number): boolean {
    const gesture = this.orbitGesture
    if (!gesture || gesture.pointerId !== pointerId || gesture.vehicleIndex !== this.selectedIndex) return false
    const state = this.orbitStates[gesture.vehicleIndex]
    const deltaX = clientX - gesture.lastX
    const deltaY = clientY - gesture.lastY
    state.yaw += deltaX * 0.0085
    state.pitch = THREE.MathUtils.clamp(state.pitch + deltaY * 0.0055, -0.34, 0.28)
    gesture.lastX = clientX
    gesture.lastY = clientY
    return true
  }

  endOrbit(pointerId: number): boolean {
    if (!this.orbitGesture || this.orbitGesture.pointerId !== pointerId) return false
    this.orbitGesture = null
    return true
  }

  cancelOrbit(pointerId?: number): void {
    if (pointerId === undefined || this.orbitGesture?.pointerId === pointerId) this.orbitGesture = null
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.animationFrame)
    window.removeEventListener('resize', this.resize)
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Points) && !(object instanceof THREE.Line)) return
      object.geometry?.dispose()
      const material = object.material
      const materials = Array.isArray(material) ? material : [material]
      materials.forEach((entry) => {
        Object.values(entry).forEach((value) => {
          if (value instanceof THREE.Texture) value.dispose()
        })
        entry.dispose()
      })
    })
    this.composer.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private setupScene(): void {
    this.scene.background = this.currentSceneColor
    this.scene.fog = new THREE.Fog(this.currentSceneColor, 14, 34)

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.02).texture
    this.scene.environment = environment
    pmrem.dispose()

    this.camera.position.set(this.cameraX(), 3.05, 10.4)
    this.lookAtStage()

    this.buildReflectiveFloor()
    this.buildArchitecture()

    const hemisphere = new THREE.HemisphereLight(0xffffff, 0x405760, 0.62)
    this.scene.add(hemisphere)

    const key = new THREE.DirectionalLight(0xffffff, 3.15)
    key.position.set(-3.8, 8.5, 5.8)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = -6
    key.shadow.camera.right = 6
    key.shadow.camera.top = 5
    key.shadow.camera.bottom = -3
    key.shadow.camera.near = 0.5
    key.shadow.camera.far = 24
    key.shadow.bias = -0.00025
    key.shadow.normalBias = 0.018
    this.scene.add(key)
    this.keyLight = key

    const fill = new THREE.DirectionalLight(0xbde8f7, 0.58)
    fill.position.set(5.4, 3.8, 5.2)
    this.scene.add(fill)
    this.fillLight = fill

    const rear = new THREE.DirectionalLight(0xe5f8ff, 1.65)
    rear.position.set(0, 5, -6)
    this.scene.add(rear)
    this.rearLight = rear

    const accent = new THREE.PointLight(this.currentAccent, 22, 14, 1.65)
    accent.position.set(this.stageX() - 2.7, 1.15, -0.5)
    this.scene.add(accent)
    this.accentLights.push(accent)

    const accentRight = new THREE.PointLight(this.currentSecondary, 15, 12, 1.75)
    accentRight.position.set(this.stageX() + 3.1, 2.5, -1.5)
    this.scene.add(accentRight)
    this.accentLights.push(accentRight)
  }

  private buildReflectiveFloor(): void {
    const underlay = new THREE.Mesh(
      new THREE.PlaneGeometry(42, 42),
      new THREE.MeshPhysicalMaterial({ color: 0xcbd5d8, metalness: 0.2, roughness: 0.09, clearcoat: 1, clearcoatRoughness: 0.06 }),
    )
    underlay.rotation.x = -Math.PI / 2
    underlay.position.y = -0.035
    underlay.receiveShadow = true
    this.scene.add(underlay)

    const reflector = new Reflector(new THREE.PlaneGeometry(36, 36), {
      color: 0xb6c3c8,
      textureWidth: 1024,
      textureHeight: 1024,
      clipBias: 0.001,
    })
    reflector.rotation.x = -Math.PI / 2
    reflector.position.y = -0.018
    const reflectorMaterials = Array.isArray(reflector.material) ? reflector.material : [reflector.material]
    reflectorMaterials.forEach((material) => {
      material.transparent = true
      material.opacity = 0.27
    })
    const renderReflection = reflector.onBeforeRender.bind(reflector)
    let lastReflectionUpdate = Number.NEGATIVE_INFINITY
    reflector.onBeforeRender = (...args: Parameters<THREE.Object3D['onBeforeRender']>) => {
      const now = performance.now()
      if (now - lastReflectionUpdate < 1000 / 12) return
      lastReflectionUpdate = now
      renderReflection(...args)
    }
    this.scene.add(reflector)
    this.reflector = reflector

    const shadowCatcher = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 18),
      new THREE.ShadowMaterial({ color: 0x26363d, opacity: 0.26 }),
    )
    shadowCatcher.rotation.x = -Math.PI / 2
    shadowCatcher.position.y = 0.016
    shadowCatcher.receiveShadow = true
    shadowCatcher.renderOrder = 2
    this.scene.add(shadowCatcher)

    const shadowCanvas = document.createElement('canvas')
    shadowCanvas.width = 256
    shadowCanvas.height = 128
    const shadowContext = shadowCanvas.getContext('2d')
    if (shadowContext) {
      const gradient = shadowContext.createRadialGradient(128, 64, 4, 128, 64, 118)
      gradient.addColorStop(0, 'rgba(26, 43, 50, .48)')
      gradient.addColorStop(0.46, 'rgba(37, 56, 64, .2)')
      gradient.addColorStop(1, 'rgba(45, 62, 69, 0)')
      shadowContext.fillStyle = gradient
      shadowContext.fillRect(0, 0, 256, 128)
      const shadowTexture = new THREE.CanvasTexture(shadowCanvas)
      const contactShadow = new THREE.Mesh(
        new THREE.PlaneGeometry(6.6, 3.4),
        new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.7, depthWrite: false }),
      )
      contactShadow.rotation.x = -Math.PI / 2
      contactShadow.position.set(this.stageX(), 0.023, 0.32)
      contactShadow.renderOrder = 3
      this.architecture.add(contactShadow)
      this.stageBoundObjects.push(contactShadow)
    }

    const gridMaterial = new THREE.MeshBasicMaterial({ color: 0x6d838c, transparent: true, opacity: 0.27 })
    for (let index = -10; index <= 10; index += 1) {
      const xLine = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 30), gridMaterial)
      xLine.rotation.x = -Math.PI / 2
      xLine.position.set(index * 1.45, 0.004, -2)
      this.scene.add(xLine)

      const zLine = new THREE.Mesh(new THREE.PlaneGeometry(30, 0.012), gridMaterial)
      zLine.rotation.x = -Math.PI / 2
      zLine.position.set(0, 0.004, index * 1.45 - 2)
      this.scene.add(zLine)
    }

    const contact = new THREE.Mesh(
      new THREE.CircleGeometry(3.25, 96),
      new THREE.MeshBasicMaterial({ color: 0x62727a, transparent: true, opacity: 0.035, depthWrite: false }),
    )
    contact.rotation.x = -Math.PI / 2
    contact.position.set(this.stageX(), 0.012, 0)
    this.architecture.add(contact)
    this.stageBoundObjects.push(contact)
  }

  private buildArchitecture(): void {
    this.architecture.position.x = 0
    this.scene.add(this.architecture)

    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 13),
      new THREE.MeshStandardMaterial({ color: 0xa7b7bd, roughness: 0.38, metalness: 0.12 }),
    )
    wall.position.set(0, 5.7, -7.2)
    this.scene.add(wall)

    const ribMaterial = new THREE.MeshStandardMaterial({ color: 0x8fa3ab, roughness: 0.3, metalness: 0.38 })
    const recessMaterial = new THREE.MeshStandardMaterial({ color: 0xd9e2e5, roughness: 0.24, metalness: 0.16 })
    for (let index = -8; index <= 8; index += 1) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.035, 11.5, 0.08), index % 4 === 0 ? ribMaterial : recessMaterial)
      rib.position.set(index * 1.8, 5.55, -7.05)
      this.scene.add(rib)
    }

    const haloMaterial = new THREE.MeshBasicMaterial({ color: this.currentAccent, transparent: true, opacity: 0.34, depthWrite: false })
    const haloOuterMaterial = new THREE.MeshBasicMaterial({ color: this.currentSecondary, transparent: true, opacity: 0.24, depthWrite: false })
    this.accentMaterials.push(haloMaterial)
    this.secondaryAccentMaterials.push(haloOuterMaterial)
    for (const [radius, material, tube] of [
      [3.4, haloOuterMaterial, 0.012],
      [2.85, haloMaterial, 0.017],
      [2.25, haloOuterMaterial, 0.01],
    ] as const) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 6, 160, Math.PI * 1.68), material)
      ring.position.set(this.stageX(), 2.85, -5.6)
      ring.rotation.z = Math.PI * 0.66
      this.scene.add(ring)
      this.animatedRings.push(ring)
    }

    const railMaterial = new THREE.MeshStandardMaterial({ color: 0x8fa0a7, metalness: 0.72, roughness: 0.2 })
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 12), railMaterial)
      rail.position.set(this.stageX() + side * 4.25, 0.035, 0)
      this.scene.add(rail)
    }

    const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
    for (const x of [-5.4, -1.8, 1.8, 5.4]) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.045, 6.5), lightMaterial)
      light.position.set(x, 6.7, -0.4)
      this.scene.add(light)
    }

    const stageRingMaterial = new THREE.MeshBasicMaterial({ color: this.currentAccent, transparent: true, opacity: 0.5 })
    this.accentMaterials.push(stageRingMaterial)
    const stageRing = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.013, 6, 160), stageRingMaterial)
    stageRing.rotation.x = Math.PI / 2
    stageRing.position.set(this.stageX(), 0.03, 0)
    this.scene.add(stageRing)
    this.animatedRings.push(stageRing)
  }

  private async loadVehicle(vehicle: Vehicle, index: number): Promise<THREE.Group> {
    const gltf = await this.loader.loadAsync(vehicle.model)
    const canonical = gltf.scene
    canonical.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(canonical)
    const center = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    const largestAxis = Math.max(size.x, size.y, size.z)
    if (!Number.isFinite(largestAxis) || largestAxis <= 0.001) throw new Error(`${vehicle.name} has invalid model bounds.`)

    const normalized = new THREE.Group()
    const presentationScale = (4.55 * vehicle.displayScale) / largestAxis
    normalized.scale.setScalar(presentationScale)
    normalized.position.set(-center.x * presentationScale, -bounds.min.y * presentationScale, -center.z * presentationScale)
    normalized.add(canonical)

    canonical.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.castShadow = true
      object.receiveShadow = true
      object.frustumCulled = true
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => {
        if ('envMapIntensity' in material) material.envMapIntensity = 0.7
        material.needsUpdate = true
      })
    })

    const root = new THREE.Group()
    root.name = vehicle.name
    root.add(normalized)
    root.position.set(this.stageX(), this.stageY(index), 0)
    root.rotation.y = this.presentationYaw(index)
    root.visible = index === 0
    root.userData.canonicalBounds = {
      width: Number(size.x.toFixed(3)),
      height: Number(size.y.toFixed(3)),
      depth: Number(size.z.toFixed(3)),
      presentationScale: Number(presentationScale.toFixed(4)),
      clips: gltf.animations.length,
    }
    return root
  }

  private async captureThumbnails(): Promise<void> {
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' })
    renderer.setSize(360, 220, false)
    renderer.setPixelRatio(1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.78
    renderer.setClearColor(0xd2dde0, 1)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xd2dde0)
    scene.environment = this.scene.environment
    scene.add(new THREE.HemisphereLight(0xffffff, 0x71838b, 2.1))

    const key = new THREE.DirectionalLight(0xffffff, 3.8)
    key.position.set(-3, 6, 5)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xc9efff, 1.7)
    fill.position.set(4, 2.5, 4)
    scene.add(fill)

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 15),
      new THREE.MeshStandardMaterial({ color: 0xe5ebed, metalness: 0.2, roughness: 0.2 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = 0
    scene.add(floor)

    const camera = new THREE.PerspectiveCamera(29, 360 / 220, 0.1, 40)
    camera.position.set(3.8, 2.8, 8.7)
    camera.lookAt(0, 1.25, 0)

    for (let index = 0; index < this.models.length; index += 1) {
      const clone = cloneSkeleton(this.models[index])
      clone.visible = true
      clone.position.set(0, this.stageY(index), 0)
      clone.rotation.set(this.orbitPitch(index), this.presentationYaw(index), 0)
      clone.scale.setScalar(1)
      scene.add(clone)
      renderer.render(scene, camera)
      this.onThumbnail(index, renderer.domElement.toDataURL('image/webp', 0.88))
      scene.remove(clone)
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    }

    floor.geometry.dispose()
    ;(floor.material as THREE.Material).dispose()
    renderer.dispose()
  }

  private readonly animate = (): void => {
    if (this.disposed) return
    this.animationFrame = requestAnimationFrame(this.animate)

    const rawDelta = this.clock.getDelta()
    const delta = Math.min(rawDelta, 0.05)
    const elapsed = this.clock.elapsedTime
    const zoomTarget = this.zoomStates[this.selectedIndex] ?? 0
    this.currentZoom = THREE.MathUtils.lerp(this.currentZoom, zoomTarget, 1 - Math.exp(-delta * 12))
    this.cameraTransitionOffset = 0

    if (this.transition) this.updateTransition(performance.now())
    else if (this.models[this.selectedIndex]) {
      const active = this.models[this.selectedIndex]
      active.position.set(this.stageX(), this.stageY(this.selectedIndex) + Math.sin(elapsed * 0.65) * 0.018, 0)
      active.rotation.y = this.presentationYaw(this.selectedIndex) + Math.sin(elapsed * 0.34) * 0.028
      active.rotation.x = this.orbitPitch(this.selectedIndex) + Math.sin(elapsed * 0.41) * 0.004
    }
    this.applyCameraPose(this.cameraTransitionOffset)

    this.animatedRings.forEach((ring, index) => {
      ring.rotation.z += delta * (index % 2 === 0 ? 0.018 : -0.012)
    })

    const colorEase = 1 - Math.exp(-delta * 7.5)
    this.currentAccent.lerp(this.targetAccent, colorEase)
    this.currentSecondary.lerp(this.targetSecondary, colorEase)
    this.currentSceneColor.lerp(this.targetSceneColor, colorEase * .72)
    this.applyAccent()

    const frameMs = rawDelta * 1000
    this.frameAccumulator += frameMs
    this.frameSamples += 1
    const usePost = this.postEnabled && window.innerWidth >= 720
    this.renderer.info.reset()
    if (usePost) this.composer.render()
    else this.renderer.render(this.scene, this.camera)

    if (elapsed - this.lastDiagnosticAt > 0.55) {
      this.publishDiagnostics(usePost)
      this.lastDiagnosticAt = elapsed
    }
  }

  private updateTransition(now: number): void {
    const transition = this.transition
    if (!transition) return
    const progress = clamp01((now - transition.startedAt) / transition.duration)
    const outgoingProgress = easeInCubic(clamp01(progress / 0.58))
    const incomingProgress = easeOutQuint(clamp01((progress - 0.035) / 0.82))
    const outgoing = this.models[transition.from]
    const incoming = this.models[transition.to]
    const stageX = this.stageX()

    outgoing.position.x = THREE.MathUtils.lerp(stageX, stageX - transition.direction * 5.7, outgoingProgress)
    outgoing.position.y = THREE.MathUtils.lerp(this.stageY(transition.from), this.stageY(transition.from) + 0.36, outgoingProgress)
    outgoing.position.z = THREE.MathUtils.lerp(0, -1.25, outgoingProgress)
    outgoing.rotation.x = this.orbitPitch(transition.from)
    outgoing.rotation.y = this.presentationYaw(transition.from) + transition.direction * 0.38 * outgoingProgress
    outgoing.rotation.z = transition.direction * 0.035 * outgoingProgress
    outgoing.scale.setScalar(THREE.MathUtils.lerp(1, 0.42, outgoingProgress))

    incoming.position.x = THREE.MathUtils.lerp(stageX + transition.direction * 6.4, stageX, incomingProgress)
    incoming.position.y = THREE.MathUtils.lerp(this.stageY(transition.to) + 0.34, this.stageY(transition.to), incomingProgress)
    incoming.position.z = THREE.MathUtils.lerp(-0.8, 0, incomingProgress)
    incoming.rotation.x = this.orbitPitch(transition.to)
    incoming.rotation.y = THREE.MathUtils.lerp(this.presentationYaw(transition.to) - transition.direction * 0.46, this.presentationYaw(transition.to), incomingProgress)
    incoming.rotation.z = THREE.MathUtils.lerp(-transition.direction * 0.025, 0, incomingProgress)
    incoming.scale.setScalar(THREE.MathUtils.lerp(0.54, 1, incomingProgress))

    this.cameraTransitionOffset = Math.sin(progress * Math.PI) * transition.direction * 0.12

    if (progress >= 1) this.finishTransition()
  }

  private finishTransition(): void {
    const transition = this.transition
    if (!transition) return
    const outgoing = this.models[transition.from]
    const incoming = this.models[transition.to]
    outgoing.visible = false
    outgoing.position.set(this.stageX(), this.stageY(transition.from), 0)
    outgoing.rotation.set(this.orbitPitch(transition.from), this.presentationYaw(transition.from), 0)
    outgoing.scale.setScalar(1)
    incoming.visible = true
    incoming.position.set(this.stageX(), this.stageY(transition.to), 0)
    incoming.rotation.set(this.orbitPitch(transition.to), this.presentationYaw(transition.to), 0)
    incoming.scale.setScalar(1)
    this.cameraTransitionOffset = 0
    this.transition = null
    transition.resolve()
  }

  private applyAccent(): void {
    this.accentMaterials.forEach((material) => {
      if ('color' in material && material.color instanceof THREE.Color) material.color.copy(this.currentAccent)
    })
    this.secondaryAccentMaterials.forEach((material) => {
      if ('color' in material && material.color instanceof THREE.Color) material.color.copy(this.currentSecondary)
    })
    this.accentLights[0]?.color.copy(this.currentAccent)
    this.accentLights[1]?.color.copy(this.currentSecondary)
    this.keyLight?.color.copy(this.neutralLight).lerp(this.currentAccent, .09)
    this.fillLight?.color.copy(this.currentSecondary).lerp(this.neutralLight, .64)
    this.rearLight?.color.copy(this.currentAccent).lerp(this.neutralLight, .56)
    if (this.scene.fog) this.scene.fog.color.copy(this.currentSceneColor)
  }

  private readonly resize = (): void => {
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    const mobile = width < 720
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.35 : 1.75)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(width, height, false)
    this.composer.setPixelRatio(dpr)
    this.composer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.fov = mobile ? 37 : 30
    this.camera.updateProjectionMatrix()
    this.models.forEach((model) => {
      if (!this.transition) model.position.x = this.stageX()
    })
    this.stageBoundObjects.forEach((object) => { object.position.x = this.stageX() })
    this.animatedRings.forEach((ring) => {
      if (ring.position.z < -5 || Math.abs(ring.rotation.x - Math.PI / 2) < 0.01) ring.position.x = this.stageX()
    })
    this.accentLights.forEach((light, index) => {
      light.position.x = this.stageX() + (index === 0 ? -2.7 : 3.1)
    })
    if (this.keyLight) {
      const shadowSize = mobile ? 1024 : 2048
      if (this.keyLight.shadow.mapSize.x !== shadowSize) {
        this.keyLight.shadow.map?.dispose()
        this.keyLight.shadow.map = null
        this.keyLight.shadow.mapSize.set(shadowSize, shadowSize)
      }
    }
    if (this.reflector) this.reflector.visible = width >= 650
    this.applyCameraPose()
  }

  private stageX(): number { return window.innerWidth < 920 ? 0 : 1.15 }
  private cameraX(): number { return window.innerWidth < 920 ? 1.25 : 2.15 }
  private baseYaw(index: number): number { return this.fleet[index]?.yaw ?? 0 }
  private stageY(index: number): number { return this.fleet[index]?.lift ?? 0.2 }
  private presentationYaw(index: number): number { return this.baseYaw(index) + (this.orbitStates[index]?.yaw ?? 0) }
  private orbitPitch(index: number): number { return this.orbitStates[index]?.pitch ?? 0 }

  private applyCameraPose(offsetX = 0): void {
    const mobile = window.innerWidth < 720
    const targetX = this.stageX()
    const targetY = mobile ? 1.42 : 1.32
    const targetZ = -0.05
    const baseY = mobile ? 3.1 : 3.05
    const baseZ = mobile ? 11.6 : 10.4
    const minimumDistance = mobile ? .68 : .56
    const distanceFactor = THREE.MathUtils.lerp(1, minimumDistance, this.currentZoom)
    this.camera.position.set(
      targetX + (this.cameraX() - targetX) * distanceFactor + offsetX,
      targetY + (baseY - targetY) * distanceFactor,
      targetZ + (baseZ - targetZ) * distanceFactor,
    )
    this.lookAtStage()
  }

  private lookAtStage(): void {
    this.camera.lookAt(this.stageX(), window.innerWidth < 720 ? 1.42 : 1.32, -0.05)
  }

  private countMaterials(): number {
    const materials = new Set<THREE.Material>()
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Points) && !(object instanceof THREE.Line)) return
      const list = Array.isArray(object.material) ? object.material : [object.material]
      list.forEach((material) => materials.add(material))
    })
    return materials.size
  }

  private publishDiagnostics(postEnabled: boolean): void {
    const info = this.renderer.info
    const averageFrameMs = this.frameSamples > 0 ? this.frameAccumulator / this.frameSamples : 0
    const diagnostics: Diagnostics = {
      calls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      materials: this.materialCount,
      fps: averageFrameMs > 0 ? Math.round(1000 / averageFrameMs) : 0,
      frameMs: Number(averageFrameMs.toFixed(2)),
      dpr: this.renderer.getPixelRatio(),
      postPasses: postEnabled ? 1 : 0,
      shadowMap: window.innerWidth < 720 ? 1024 : 2048,
      selected: this.selectedIndex,
    }
    const diagnosticWindow = window as Window & {
      __HELIOS_DIAGNOSTICS__?: Diagnostics
      __THREE_APP_DIAGNOSTICS__?: {
        renderer: { calls: number; triangles: number; geometries: number; textures: number }
        state: Record<string, unknown>
        performance: { fps: number; frameMs: number; dpr: number; postPasses: number; shadowMap: number }
      }
    }
    diagnosticWindow.__HELIOS_DIAGNOSTICS__ = diagnostics
    diagnosticWindow.__THREE_APP_DIAGNOSTICS__ = {
      renderer: {
        calls: diagnostics.calls,
        triangles: diagnostics.triangles,
        geometries: diagnostics.geometries,
        textures: diagnostics.textures,
      },
      state: {
        selected: this.fleet[this.selectedIndex].id,
        materials: diagnostics.materials,
        orbitYaw: Number((this.orbitStates[this.selectedIndex]?.yaw ?? 0).toFixed(3)),
        orbitPitch: Number((this.orbitStates[this.selectedIndex]?.pitch ?? 0).toFixed(3)),
      },
      performance: {
        fps: diagnostics.fps,
        frameMs: diagnostics.frameMs,
        dpr: diagnostics.dpr,
        postPasses: diagnostics.postPasses,
        shadowMap: diagnostics.shadowMap,
      },
    }
    this.container.dataset.fps = String(diagnostics.fps)
    this.container.dataset.frameMs = String(diagnostics.frameMs)
    this.container.dataset.calls = String(diagnostics.calls)
    this.container.dataset.orbitYaw = String(Number((this.orbitStates[this.selectedIndex]?.yaw ?? 0).toFixed(3)))
    this.container.dataset.orbitPitch = String(Number((this.orbitStates[this.selectedIndex]?.pitch ?? 0).toFixed(3)))
    this.frameAccumulator = 0
    this.frameSamples = 0
  }
}
