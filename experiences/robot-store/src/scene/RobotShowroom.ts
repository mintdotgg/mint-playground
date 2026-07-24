import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import mintRegistryJson from '../../mint-assets.json'
import { catalog } from '../catalog'
import { themeForRobot, type RobotTheme } from '../theme'
import type {
  AssetDisplayStatus,
  CatalogRobot,
  MintArtifact,
  MintAssetRecord,
  MintRegistry,
} from '../types'
import { EditorialLayers } from './EditorialLayers'
import { createTemporarySilhouette, disposeObject } from './placeholder'
import { ReferenceImageLayers } from './ReferenceImageLayers'
import { StudioEnvironment } from './StudioEnvironment'
import { StudioPostProcessing } from './StudioPostProcessing'
import { applySpatialPose, SpatialMotionController } from './SpatialMotion'
import { WatchVideoLayer } from './WatchVideoLayer'

type StatusListener = (status: AssetDisplayStatus) => void

const registry = mintRegistryJson as unknown as MintRegistry
const MOBILE_VIEWPORT_QUERY = '(max-width: 767px)'

const stageShadowVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const stageShadowFragmentShader = `
  varying vec2 vUv;
  uniform vec3 uColor;

  void main() {
    vec2 centered = (vUv - 0.5) * 2.0;
    float distanceFromCenter = length(centered);
    float softEdge = 1.0 - smoothstep(0.32, 1.0, distanceFromCenter);
    float contact = 1.0 - smoothstep(0.0, 0.68, distanceFromCenter);
    float alpha = softEdge * 0.13 + contact * 0.16;

    gl_FragColor = vec4(uColor, alpha);
  }
`

function canonicalArtifact(record: MintAssetRecord | undefined): MintArtifact | null {
  if (!record || record.mode !== 'remote_url') return null
  return (
    Object.values(record.artifacts).find((artifact) => artifact.role === 'canonical_model') ??
    Object.values(record.artifacts).find((artifact) => artifact.format === 'glb') ??
    null
  )
}

function expectedHeight(robot: CatalogRobot): number {
  const height = robot.specs.dimensions.height_m
  if (typeof height === 'number') return height
  if (height && typeof height === 'object') return height.max
  return robot.market.locomotion === 'wheeled' ? 1.45 : 1.7
}

function selectionDirection(previous: CatalogRobot | null, next: CatalogRobot): -1 | 0 | 1 {
  if (!previous || previous.id === next.id) return 0
  const previousIndex = catalog.robots.findIndex((robot) => robot.id === previous.id)
  const nextIndex = catalog.robots.findIndex((robot) => robot.id === next.id)
  let delta = nextIndex - previousIndex
  const half = catalog.robots.length / 2
  if (delta > half) delta -= catalog.robots.length
  if (delta < -half) delta += catalog.robots.length
  return delta > 0 ? 1 : -1
}

export class RobotShowroom {
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(29, 1, 0.05, 100)
  private readonly renderer: THREE.WebGLRenderer
  private readonly postProcessing: StudioPostProcessing
  private readonly controls: OrbitControls
  private readonly timer = new THREE.Timer()
  private readonly gltfLoader = new GLTFLoader()
  private readonly dracoLoader = new DRACOLoader()
  private readonly editorial: EditorialLayers
  private readonly references: ReferenceImageLayers
  private readonly watchVideo: WatchVideoLayer
  private readonly studio: StudioEnvironment
  private readonly displayMotion = new SpatialMotionController()
  private readonly activeDisplays = new Set<THREE.Group>()
  private readonly statusListeners = new Set<StatusListener>()
  private readonly stageShadowColor = new THREE.Color('#171817')
  private readonly stageShadowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: this.stageShadowColor },
    },
    vertexShader: stageShadowVertexShader,
    fragmentShader: stageShadowFragmentShader,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
  private currentDisplay: THREE.Group | null = null
  private currentRobot: CatalogRobot | null = null
  private modelRequest: AbortController | null = null
  private selectionToken = 0
  private frameId = 0
  private autoMotion = true
  private readonly mobileViewport = window.matchMedia(MOBILE_VIEWPORT_QUERY).matches
  private readonly maxPixelRatio = this.mobileViewport ? 1.25 : 2
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private readonly resizeObserver: ResizeObserver

  constructor(private readonly host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.mobileViewport,
      alpha: false,
      powerPreference: this.mobileViewport ? 'default' : 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.maxPixelRatio))
    this.renderer.setSize(host.clientWidth, host.clientHeight, false)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.08
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.domElement.setAttribute('aria-label', 'Interactive 3D robot editorial')
    host.append(this.renderer.domElement)

    this.dracoLoader.setDecoderPath('https://cdn.mint.gg/runtime/draco/gltf/three-0.184.0/')
    this.gltfLoader.setDRACOLoader(this.dracoLoader)
    this.postProcessing = new StudioPostProcessing(this.renderer, this.scene, this.camera)

    this.camera.position.set(0, 1.25, 5.9)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.06
    this.controls.enablePan = true
    this.controls.screenSpacePanning = true
    this.controls.panSpeed = 0.7
    this.controls.minPolarAngle = Math.PI * 0.08
    this.controls.maxPolarAngle = Math.PI * 0.495
    this.controls.minAzimuthAngle = -Infinity
    this.controls.maxAzimuthAngle = Infinity
    this.controls.minDistance = 1.25
    this.controls.maxDistance = 10
    this.controls.autoRotate = false
    this.controls.autoRotateSpeed = 1.3
    this.controls.target.set(0, 0.85, 0)

    this.timer.connect(document)
    this.studio = new StudioEnvironment(this.scene)
    this.createEnvironment()
    this.editorial = new EditorialLayers(this.scene)
    this.references = new ReferenceImageLayers(this.scene)
    this.watchVideo = new WatchVideoLayer(host)
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(host)
    this.frameId = requestAnimationFrame(this.animate)
  }

  subscribeToAssetStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  async setRobot(robot: CatalogRobot): Promise<void> {
    const direction = selectionDirection(this.currentRobot, robot)
    const animateTransition = direction !== 0 && !this.reducedMotion && !this.mobileViewport
    this.currentRobot = robot
    const token = ++this.selectionToken
    this.modelRequest?.abort()
    const modelRequest = new AbortController()
    this.modelRequest = modelRequest
    const theme = themeForRobot(robot)
    const height = expectedHeight(robot)
    this.applyTheme(theme)
    this.editorial.update(robot, theme, height, direction, animateTransition)
    this.references.update(robot, theme, height, direction, animateTransition)
    this.watchVideo.update(robot, theme, height, direction, animateTransition)
    this.emitStatus({ kind: 'loading', message: `Indexing ${robot.display_name}` })
    if (this.currentDisplay && animateTransition) this.transitionDisplayOut(this.currentDisplay, direction)
    else this.clearCurrentDisplay()
    this.currentDisplay = null

    const record = registry.assets[robot.id]
    const artifact = canonicalArtifact(record)
    if (!artifact) {
      this.showTemporarySilhouette(robot, theme, direction, animateTransition)
      return
    }

    try {
      const response = await fetch(artifact.runtimeUrl, { signal: modelRequest.signal })
      if (!response.ok) {
        throw new Error(`Model request failed with status ${response.status}.`)
      }
      const buffer = await response.arrayBuffer()
      if (modelRequest.signal.aborted) return
      const gltf = await this.gltfLoader.parseAsync(
        buffer,
        new URL('.', artifact.runtimeUrl).toString(),
      )
      if (token !== this.selectionToken) {
        disposeObject(gltf.scene)
        return
      }
      const presentation = this.prepareImportedModel(gltf.scene, robot, record)
      presentation.userData.baseRotationY = presentation.rotation.y
      this.attachDisplay(presentation, robot, direction, animateTransition)
      this.emitStatus({ kind: 'mint-model', message: 'Mint digital twin / online' })
    } catch (error) {
      if (modelRequest.signal.aborted) return
      console.error(`Unable to load model for ${robot.id}`, error)
      if (token !== this.selectionToken) return
      this.showTemporarySilhouette(robot, theme, direction, animateTransition)
      this.emitStatus({ kind: 'error', message: 'Twin unavailable / calibration proxy active' })
    } finally {
      if (this.modelRequest === modelRequest) this.modelRequest = null
    }
  }

  resetCamera(): void {
    if (this.currentRobot) this.frameRobot(this.currentRobot)
  }

  toggleAutoOrbit(): boolean {
    this.autoMotion = !this.autoMotion
    return this.autoMotion
  }

  toggleAutoRotate(): boolean {
    this.controls.autoRotate = !this.controls.autoRotate
    return this.controls.autoRotate
  }

  toggleDither(): boolean {
    return this.postProcessing.toggleDither()
  }

  getDiagnostics(): Record<string, number | boolean> {
    const info = this.renderer.info
    const materialSet = new Set<THREE.Material>()
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => materialSet.add(material))
    })
    return {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      materials: materialSet.size,
      dpr: this.renderer.getPixelRatio(),
      shadows: this.renderer.shadowMap.enabled,
      postPasses: this.postProcessing.passCount,
      dither: this.postProcessing.isDitherEnabled,
      autoRotate: this.controls.autoRotate,
      videoSurfaces: this.watchVideo.surfaceCount,
    }
  }

  destroy(): void {
    this.selectionToken += 1
    this.modelRequest?.abort()
    this.modelRequest = null
    cancelAnimationFrame(this.frameId)
    this.resizeObserver.disconnect()
    this.timer.dispose()
    this.controls.dispose()
    this.dracoLoader.dispose()
    this.displayMotion.clear()
    this.clearAllDisplays()
    this.references.destroy()
    this.watchVideo.destroy()
    this.editorial.destroy()
    this.postProcessing.dispose()
    disposeObject(this.scene)
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
  }

  private emitStatus(status: AssetDisplayStatus): void {
    this.statusListeners.forEach((listener) => listener(status))
  }

  private createEnvironment(): void {
    const stageShadow = new THREE.Mesh(
      new THREE.CircleGeometry(1, 96),
      this.stageShadowMaterial,
    )
    stageShadow.name = 'accent-stage-shadow'
    stageShadow.rotation.x = -Math.PI / 2
    stageShadow.position.y = 0.004
    stageShadow.scale.set(1.5, 0.72, 1)
    stageShadow.renderOrder = 1
    this.scene.add(stageShadow)

    const hemisphere = new THREE.HemisphereLight('#f1efe8', '#343734', 2.25)
    hemisphere.name = 'studio-fill'
    this.scene.add(hemisphere)

    const key = new THREE.DirectionalLight('#fff8ec', 5.8)
    key.name = 'studio-key'
    key.position.set(-3.6, 7.8, 5.2)
    key.castShadow = true
    const shadowMapSize = this.mobileViewport ? 1024 : 1536
    key.shadow.mapSize.set(shadowMapSize, shadowMapSize)
    key.shadow.camera.near = 0.5
    key.shadow.camera.far = 22
    key.shadow.camera.left = -3.4
    key.shadow.camera.right = 3.4
    key.shadow.camera.top = 4.5
    key.shadow.camera.bottom = -1
    key.shadow.bias = -0.0008
    this.scene.add(key)

    const rim = new THREE.DirectionalLight('#ff4f12', 3.2)
    rim.name = 'accent-rim'
    rim.position.set(4.2, 3.1, -2.8)
    this.scene.add(rim)
  }

  private applyTheme(theme: RobotTheme): void {
    const clearColor = this.studio.updateTheme(theme)
    this.renderer.setClearColor(clearColor, 1)

    const rim = this.scene.getObjectByName('accent-rim') as THREE.DirectionalLight
    rim.color.set(theme.accent)
  }

  private showTemporarySilhouette(
    robot: CatalogRobot,
    theme: RobotTheme,
    direction: number,
    animateTransition: boolean,
  ): void {
    const silhouette = createTemporarySilhouette(robot, theme)
    silhouette.rotation.y = -0.08
    silhouette.userData.baseRotationY = -0.08
    this.attachDisplay(silhouette, robot, direction, animateTransition)
    this.emitStatus({ kind: 'temporary-silhouette', message: 'Calibration proxy / Mint twin pending' })
  }

  private attachDisplay(
    subject: THREE.Group,
    robot: CatalogRobot,
    direction: number,
    animateTransition: boolean,
  ): void {
    const wrapper = new THREE.Group()
    wrapper.name = `${robot.id}-transition-wrapper`
    wrapper.userData.subject = subject
    wrapper.add(subject)
    this.currentDisplay = wrapper
    this.activeDisplays.add(wrapper)
    this.scene.add(wrapper)

    if (animateTransition && direction !== 0) {
      applySpatialPose(wrapper, {
        x: direction * 1.85,
        y: 0,
        z: 0.24,
        scale: 0.64,
        rotationY: -direction * 0.44,
      })
      this.displayMotion.move(
        wrapper,
        { x: 0, y: 0, z: 0, scale: 1, rotationY: 0 },
        { duration: 0.6, delay: 0.08, easing: 'enter' },
      )
    }

    this.frameRobot(robot)
  }

  private transitionDisplayOut(display: THREE.Group, direction: number): void {
    if (this.currentDisplay === display) this.currentDisplay = null
    this.displayMotion.move(
      display,
      {
        x: -direction * 2.1,
        y: 0.04,
        z: 0.3,
        scale: 0.55,
        rotationY: direction * 0.5,
      },
      {
        duration: 0.36,
        easing: 'exit',
        onComplete: () => this.removeDisplay(display),
      },
    )
  }

  private prepareImportedModel(
    canonicalRoot: THREE.Object3D,
    robot: CatalogRobot,
    record: MintAssetRecord,
  ): THREE.Group {
    canonicalRoot.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(canonicalRoot)
    const size = bounds.getSize(new THREE.Vector3())
    const scale = expectedHeight(robot) / Math.max(size.y, 0.001)
    const center = bounds.getCenter(new THREE.Vector3())

    const normalized = new THREE.Group()
    normalized.name = `${robot.id}-normalized-presentation`
    canonicalRoot.scale.setScalar(scale)
    canonicalRoot.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale)
    canonicalRoot.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true
        object.receiveShadow = true
      }
    })
    normalized.add(canonicalRoot)

    const presentation = new THREE.Group()
    presentation.name = `${robot.id}-registry-transform`
    const transform = record.transform
    if (transform) {
      presentation.position.set(...transform.position)
      presentation.rotation.set(...transform.rotation)
      presentation.scale.set(...transform.scale)
    }
    presentation.add(normalized)
    return presentation
  }

  private frameRobot(robot: CatalogRobot): void {
    const height = expectedHeight(robot)
    const narrowFactor = this.camera.aspect < 0.9 ? 1.32 : 1
    const distance = (THREE.MathUtils.clamp(height * 3.12, 5.25, 6.6) - 0.55) * narrowFactor
    const verticalLift = 0.12
    this.controls.target.set(0, height * 0.48 + verticalLift, 0)
    this.camera.position.set(0, height * 0.5 + 0.12 + verticalLift, distance)
    this.camera.near = Math.max(0.03, distance / 220)
    this.camera.far = 100
    this.camera.updateProjectionMatrix()
    this.controls.update()
  }

  private clearCurrentDisplay(): void {
    if (!this.currentDisplay) return
    this.removeDisplay(this.currentDisplay)
    this.currentDisplay = null
  }

  private removeDisplay(display: THREE.Group): void {
    this.displayMotion.cancel(display)
    this.activeDisplays.delete(display)
    display.removeFromParent()
    disposeObject(display)
    this.renderer.renderLists.dispose()
  }

  private clearAllDisplays(): void {
    this.currentDisplay = null
    for (const display of [...this.activeDisplays]) this.removeDisplay(display)
  }

  private resize(): void {
    const width = Math.max(this.host.clientWidth, 1)
    const height = Math.max(this.host.clientHeight, 1)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.maxPixelRatio))
    this.renderer.setSize(width, height, false)
    this.postProcessing.setSize(width, height, this.renderer.getPixelRatio())
    this.watchVideo.setSize(width, height)
    if (this.currentRobot) this.frameRobot(this.currentRobot)
  }

  private animate = (timestamp: number): void => {
    this.frameId = requestAnimationFrame(this.animate)
    this.timer.update(timestamp)
    const delta = Math.min(this.timer.getDelta(), 0.05)
    const elapsed = this.timer.getElapsed()
    this.controls.update(delta)
    this.displayMotion.update(delta)

    if (this.currentDisplay) {
      const subject = this.currentDisplay.userData.subject as THREE.Group | undefined
      const base = Number(subject?.userData.baseRotationY ?? 0)
      const travel = this.autoMotion && !this.reducedMotion ? Math.sin(elapsed * 0.34) * 0.1 : 0
      if (subject) subject.rotation.y = base + travel
      if (subject?.userData.temporarySilhouette) {
        subject.position.y = this.reducedMotion ? 0 : Math.sin(elapsed * 0.68) * 0.006
      }
    }

    this.editorial.animate(delta)
    this.references.animate(delta)
    this.watchVideo.animate(delta)
    this.postProcessing.render(delta, this.reducedMotion ? 0 : elapsed)
    this.watchVideo.render(this.camera)
  }
}
