import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { Character } from './roster'

type ShowcaseOptions = {
  container: HTMLElement
  roster: readonly Character[]
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

type AnimationPhase = 'stopped' | 'signature' | 'idle'

type CharacterAnimationRuntime = {
  mixer: THREE.AnimationMixer
  idle: THREE.AnimationAction
  signature: THREE.AnimationAction
  idleClip: THREE.AnimationClip
  signatureClip: THREE.AnimationClip
  probeBone: THREE.Bone | null
  probeRest: THREE.Quaternion
  phase: AnimationPhase
  replayAt: number
}

type OrbitPresentation = {
  yaw: number
  pitch: number
  zoom: number
  targetYaw: number
  targetPitch: number
  targetZoom: number
}

type OrbitGesture = {
  pointerId: number
  lastX: number
  lastY: number
}

type InspectionPointer = {
  x: number
  y: number
}

type PinchGesture = {
  pointerIds: readonly [number, number]
  lastDistance: number
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
  animation: AnimationPhase
  animationTime: number
  poseDelta: number
  stageFx: boolean
  orbiting: boolean
  orbitYaw: number
  orbitPitch: number
  orbitZoom: number
}

const easeOutQuint = (value: number): number => 1 - Math.pow(1 - value, 5)
const easeInCubic = (value: number): number => value * value * value
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

export class CharacterShowcase {
  private readonly container: HTMLElement
  private readonly roster: readonly Character[]
  private readonly onProgress: ShowcaseOptions['onProgress']
  private readonly onThumbnail: ShowcaseOptions['onThumbnail']
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(31, 1, 0.1, 80)
  private readonly renderer: THREE.WebGLRenderer
  private readonly composer: EffectComposer
  private readonly bloomPass: UnrealBloomPass
  private readonly clock = new THREE.Clock()
  private readonly loader = new GLTFLoader()
  private readonly models: THREE.Group[] = []
  private readonly modelPivots: THREE.Group[] = []
  private readonly pickProxies: THREE.Mesh[] = []
  private readonly orbitPresentations: OrbitPresentation[] = []
  private readonly animationRuntimes: CharacterAnimationRuntime[] = []
  private readonly bayGroup = new THREE.Group()
  private readonly stageFxGroup = new THREE.Group()
  private readonly animatedRings: THREE.Mesh[] = []
  private readonly rotatingStageGroups: { object: THREE.Object3D; speed: number }[] = []
  private readonly stageFxMaterials: THREE.ShaderMaterial[] = []
  private readonly ambientFields: THREE.Object3D[] = []
  private readonly scanMaterial: THREE.ShaderMaterial
  private readonly dustMaterial: THREE.PointsMaterial
  private readonly accentMaterials: (THREE.MeshBasicMaterial | THREE.MeshStandardMaterial)[] = []
  private readonly accentLights: THREE.Light[] = []
  private keyLight: THREE.DirectionalLight | null = null
  private fillLight: THREE.DirectionalLight | null = null
  private readonly currentAccent = new THREE.Color()
  private readonly targetAccent = new THREE.Color()
  private readonly currentSecondary = new THREE.Color()
  private readonly targetSecondary = new THREE.Color()
  private readonly currentFog = new THREE.Color()
  private readonly targetFog = new THREE.Color()
  private readonly currentKey = new THREE.Color()
  private readonly targetKey = new THREE.Color()
  private readonly currentFill = new THREE.Color()
  private readonly targetFill = new THREE.Color()
  private currentExposure = 1.12
  private targetExposure = 1.12
  private currentBloom = 0.48
  private targetBloom = 0.48
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly inspectionScreenPoint = new THREE.Vector3()
  private readonly pickGeometry = new THREE.BoxGeometry(1.72, 4.25, 1.25)
  private readonly pickMaterial = new THREE.MeshBasicMaterial({ visible: false })
  private orbitGesture: OrbitGesture | null = null
  private pinchGesture: PinchGesture | null = null
  private readonly inspectionPointers = new Map<number, InspectionPointer>()
  private animationFrame = 0
  private selectedIndex = 0
  private transition: Transition | null = null
  private disposed = false
  private lastDiagnosticAt = 0
  private frameAccumulator = 0
  private frameSamples = 0
  private materialCount = 0
  private postEnabled = !new URLSearchParams(window.location.search).has('post') || new URLSearchParams(window.location.search).get('post') !== '0'
  private stageFxEnabled = new URLSearchParams(window.location.search).get('stagefx') !== '0'
  private readonly prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(options: ShowcaseOptions) {
    this.container = options.container
    this.roster = options.roster
    this.onProgress = options.onProgress
    this.onThumbnail = options.onThumbnail

    this.currentAccent.set(options.roster[0].accent)
    this.targetAccent.copy(this.currentAccent)
    this.currentSecondary.set(options.roster[0].theme.secondary)
    this.targetSecondary.copy(this.currentSecondary)
    this.currentFog.set(options.roster[0].theme.fog)
    this.targetFog.copy(this.currentFog)
    this.currentKey.set(options.roster[0].theme.key)
    this.targetKey.copy(this.currentKey)
    this.currentFill.set(options.roster[0].theme.fill)
    this.targetFill.copy(this.currentFill)
    this.currentExposure = options.roster[0].theme.exposure
    this.targetExposure = this.currentExposure
    this.currentBloom = options.roster[0].theme.bloom
    this.targetBloom = this.currentBloom

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.12
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.info.autoReset = false
    this.container.appendChild(this.renderer.domElement)
    this.container.dataset.orbit = 'idle'
    this.container.dataset.stageFx = String(this.stageFxEnabled)
    this.renderer.domElement.addEventListener('pointerdown', this.onModelPointerDown)
    this.renderer.domElement.addEventListener('pointermove', this.onModelPointerMove)
    this.renderer.domElement.addEventListener('pointerup', this.onModelPointerUp)
    this.renderer.domElement.addEventListener('pointercancel', this.onModelPointerCancel)
    this.renderer.domElement.addEventListener('pointerleave', this.onModelPointerLeave)
    this.renderer.domElement.addEventListener('lostpointercapture', this.onModelLostPointerCapture)
    this.renderer.domElement.addEventListener('wheel', this.onModelWheel, { passive: false })
    this.renderer.domElement.addEventListener('dblclick', this.onModelDoubleClick)

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.48, 0.42, 0.83)
    this.composer.addPass(this.bloomPass)

    this.scanMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: this.currentAccent.clone() },
        uSecondary: { value: this.currentSecondary.clone() },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform vec3 uSecondary;
        varying vec2 vUv;
        void main() {
          float line = pow(max(0.0, sin((vUv.y + uTime * 0.028) * 230.0)), 24.0);
          float band = smoothstep(0.0, .12, vUv.y) * smoothstep(1.0, .78, vUv.y);
          float edge = smoothstep(0.0, .28, vUv.x) * smoothstep(1.0, .72, vUv.x);
          gl_FragColor = vec4(mix(uColor, uSecondary, vUv.y * .72), line * band * edge * .105);
        }
      `,
    })

    this.dustMaterial = new THREE.PointsMaterial({
      color: this.currentAccent,
      size: 0.018,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })

    this.setupScene()
    this.resize()
    window.addEventListener('resize', this.resize)
    window.addEventListener('blur', this.cancelOrbitGesture)
  }

  async initialize(): Promise<void> {
    this.animationFrame = requestAnimationFrame(this.animate)
    let loaded = 0

    const loadTasks = this.roster.map(async (character, index) => {
      const root = await this.loadCharacter(character, index)
      this.models[index] = root
      loaded += 1
      this.onProgress(loaded, this.roster.length, character.name)
      return root
    })

    await Promise.all(loadTasks)
    this.models.forEach((model, index) => {
      model.visible = index === 0
      model.scale.setScalar(this.stageScale())
      this.scene.add(model)
    })
    this.materialCount = this.countMaterials()

    await this.captureThumbnails()
    this.playSignature(0)
    this.onProgress(this.roster.length, this.roster.length, 'Roster ready')
  }

  select(index: number, direction: number): Promise<void> {
    if (index === this.selectedIndex || !this.models[index]) return Promise.resolve()
    if (this.transition) this.finishTransition()

    const from = this.selectedIndex
    this.selectedIndex = index
    const character = this.roster[index]
    this.targetAccent.set(character.accent)
    this.targetSecondary.set(character.theme.secondary)
    this.targetFog.set(character.theme.fog)
    this.targetKey.set(character.theme.key)
    this.targetFill.set(character.theme.fill)
    this.targetExposure = character.theme.exposure
    this.targetBloom = character.theme.bloom

    const incoming = this.models[index]
    incoming.visible = true
    incoming.position.set(this.stageX() + direction * 4.7, 0.18, 0)
    incoming.rotation.set(0, -direction * 0.28, -direction * 0.035)
    incoming.scale.setScalar(this.stageScale() * 0.78)
    this.playSignature(index)

    return new Promise<void>((resolve) => {
      this.transition = {
        from,
        to: index,
        direction,
        startedAt: performance.now(),
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 40 : 650,
        resolve,
      }
    })
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.animationFrame)
    window.removeEventListener('resize', this.resize)
    window.removeEventListener('blur', this.cancelOrbitGesture)
    this.renderer.domElement.removeEventListener('pointerdown', this.onModelPointerDown)
    this.renderer.domElement.removeEventListener('pointermove', this.onModelPointerMove)
    this.renderer.domElement.removeEventListener('pointerup', this.onModelPointerUp)
    this.renderer.domElement.removeEventListener('pointercancel', this.onModelPointerCancel)
    this.renderer.domElement.removeEventListener('pointerleave', this.onModelPointerLeave)
    this.renderer.domElement.removeEventListener('lostpointercapture', this.onModelLostPointerCapture)
    this.renderer.domElement.removeEventListener('wheel', this.onModelWheel)
    this.renderer.domElement.removeEventListener('dblclick', this.onModelDoubleClick)
    this.animationRuntimes.forEach((runtime, index) => {
      runtime.mixer.stopAllAction()
      if (this.models[index]) runtime.mixer.uncacheRoot(this.models[index])
    })
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Points)) return
      object.geometry?.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => {
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) value.dispose()
        }
        material.dispose()
      })
    })
    this.scanMaterial.dispose()
    this.dustMaterial.dispose()
    this.composer.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private setupScene(): void {
    this.scene.fog = new THREE.FogExp2(this.currentFog, 0.041)

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environment = environment
    pmrem.dispose()

    this.camera.position.set(1.05, 2.3, 9.45)
    this.camera.lookAt(1.05, 2.2, 0)

    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x080c12, roughness: 0.78, metalness: 0.44 })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.025
    floor.receiveShadow = true
    this.scene.add(floor)

    const grid = new THREE.GridHelper(30, 60, 0x53606d, 0x111923)
    grid.position.y = 0.006
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
    gridMaterials.forEach((material) => {
      material.transparent = true
      material.opacity = 0.19
    })
    this.scene.add(grid)

    this.buildStageFx()
    this.buildBay()
    this.buildDust()

    const ambient = new THREE.HemisphereLight(0xbfd1ff, 0x131722, 1.15)
    this.scene.add(ambient)

    const key = new THREE.DirectionalLight(this.currentKey, 4.2)
    key.position.set(4.6, 7.5, 5.5)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = -4
    key.shadow.camera.right = 4
    key.shadow.camera.top = 6
    key.shadow.camera.bottom = -1
    key.shadow.bias = -0.0005
    this.scene.add(key)
    this.keyLight = key

    const fill = new THREE.DirectionalLight(this.currentFill, 2.1)
    fill.position.set(-4, 3.4, 3.5)
    this.scene.add(fill)
    this.fillLight = fill

    const rim = new THREE.PointLight(this.currentAccent, 38, 12, 1.6)
    rim.position.set(this.stageX() + 1.5, 3.6, -2.1)
    this.scene.add(rim)
    this.accentLights.push(rim)

    const lowRim = new THREE.PointLight(this.currentAccent, 20, 8, 1.8)
    lowRim.position.set(this.stageX() - 1.6, 0.6, 0.8)
    this.scene.add(lowRim)
    this.accentLights.push(lowRim)

    this.accentLights.forEach((light) => { light.userData.baseIntensity = light.intensity })
  }

  private buildStageFx(): void {
    this.stageFxGroup.name = 'Procedural stage atmosphere'
    this.stageFxGroup.position.x = this.stageX()
    this.stageFxGroup.visible = this.stageFxEnabled
    this.scene.add(this.stageFxGroup)

    const domeMaterial = this.createStageShader(
      `varying vec3 vDirection;
       void main() {
         vDirection = normalize(position);
         gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
       }`,
      `uniform float uTime;
       uniform vec3 uColor;
       uniform vec3 uSecondary;
       varying vec3 vDirection;
       float hash21(vec2 p) {
         p = fract(p * vec2(123.34, 456.21));
         p += dot(p, p + 45.32);
         return fract(p.x * p.y);
       }
       void main() {
         vec3 direction = normalize(vDirection);
         float horizon = smoothstep(-0.45, 0.42, direction.y);
         vec3 color = mix(vec3(0.002, 0.003, 0.007), vec3(0.014, 0.018, 0.030), horizon);
         float halo = pow(max(0.0, dot(direction, normalize(vec3(0.16, 0.08, 1.0)))), 9.0);
         vec2 starCell = floor(direction.xy * 220.0);
         float star = step(0.996, hash21(starCell)) * (0.55 + 0.45 * sin(uTime * 0.32 + hash21(starCell + 7.1) * 6.283));
         color += mix(uSecondary, uColor, horizon) * (halo * 0.072 + star * 0.046);
         gl_FragColor = vec4(color, 1.0);
       }`,
      { side: THREE.BackSide },
    )
    const dome = new THREE.Mesh(new THREE.SphereGeometry(36, 32, 18), domeMaterial)
    dome.name = 'Deep hangar atmosphere'
    dome.frustumCulled = false
    dome.renderOrder = -100
    this.stageFxGroup.add(dome)

    const finGeometry = new THREE.BoxGeometry(0.08, 3.1, 0.18)
    const finMaterial = new THREE.MeshStandardMaterial({ color: 0x0c121b, metalness: 0.82, roughness: 0.42 })
    const fins = new THREE.InstancedMesh(finGeometry, finMaterial, 18)
    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    for (let index = 0; index < 18; index += 1) {
      const x = (index - 8.5) * 0.73
      position.set(x, 2.05 + (index % 3) * 0.08, -4.65 - Math.abs(x) * 0.055)
      scale.set(1, 0.72 + (index % 4) * 0.09, 1)
      matrix.compose(position, quaternion, scale)
      fins.setMatrixAt(index, matrix)
    }
    fins.instanceMatrix.needsUpdate = true
    fins.name = 'Hangar wall ribs'
    this.stageFxGroup.add(fins)

    const tickMaterial = new THREE.MeshBasicMaterial({
      color: this.currentAccent,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.accentMaterials.push(tickMaterial)
    const tickMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.24, 0.025), tickMaterial, 48)
    for (let index = 0; index < 48; index += 1) {
      const angle = (index / 48) * Math.PI * 2
      position.set(Math.cos(angle) * 3.32, Math.sin(angle) * 2.82, 0)
      quaternion.setFromEuler(new THREE.Euler(0, 0, angle))
      scale.set(1, index % 6 === 0 ? 1.85 : index % 3 === 0 ? 1.3 : 0.72, 1)
      matrix.compose(position, quaternion, scale)
      tickMesh.setMatrixAt(index, matrix)
    }
    tickMesh.instanceMatrix.needsUpdate = true
    const tickGroup = new THREE.Group()
    tickGroup.name = 'Rotating aperture telemetry'
    tickGroup.position.set(0, 2.36, -2.12)
    tickGroup.add(tickMesh)
    this.stageFxGroup.add(tickGroup)
    this.rotatingStageGroups.push({ object: tickGroup, speed: 0.018 })

    const panelMaterial = this.createStageShader(
      `varying vec2 vUv;
       void main() {
         vUv = uv;
         gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
       }`,
      `uniform float uTime;
       uniform vec3 uColor;
       uniform vec3 uSecondary;
       varying vec2 vUv;
       void main() {
         vec2 edgeDistance = min(vUv, 1.0 - vUv);
         float frame = 1.0 - smoothstep(0.0, 0.035, min(edgeDistance.x, edgeDistance.y));
         float verticals = pow(max(0.0, sin(vUv.x * 30.0)), 22.0);
         float scan = pow(max(0.0, sin((vUv.y - uTime * 0.08) * 82.0)), 30.0);
         float fade = smoothstep(0.0, 0.16, vUv.y) * smoothstep(1.0, 0.72, vUv.y);
         float alpha = (frame * 0.18 + verticals * 0.025 + scan * 0.05) * fade;
         gl_FragColor = vec4(mix(uSecondary, uColor, vUv.y), alpha);
       }`,
      { side: THREE.DoubleSide },
    )
    const panels = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.82, 2.9), panelMaterial, 6)
    for (let index = 0; index < 6; index += 1) {
      const side = index < 3 ? -1 : 1
      const lane = index % 3
      position.set(side * (3.72 + lane * 0.72), 2.2 + lane * 0.16, -3.45 - lane * 0.24)
      quaternion.setFromEuler(new THREE.Euler(0, side * -0.16, side * (0.012 + lane * 0.018)))
      scale.set(1, 0.9 + lane * 0.12, 1)
      matrix.compose(position, quaternion, scale)
      panels.setMatrixAt(index, matrix)
    }
    panels.instanceMatrix.needsUpdate = true
    panels.name = 'Holographic side diagnostics'
    this.stageFxGroup.add(panels)

    const beamGeometry = new THREE.PlaneGeometry(1.25, 7.4)
    for (let index = 0; index < 3; index += 1) {
      const beamMaterial = this.createStageShader(
        `varying vec2 vUv;
         void main() {
           vUv = uv;
           gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
         }`,
        `uniform float uTime;
         uniform vec3 uColor;
         uniform vec3 uSecondary;
         varying vec2 vUv;
         void main() {
           float core = pow(max(0.0, 1.0 - abs(vUv.x - 0.5) * 2.0), 2.4);
           float vertical = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.42, vUv.y);
           float pulse = 0.72 + 0.28 * sin(uTime * 0.44 + ${index.toFixed(1)} * 1.7);
           gl_FragColor = vec4(mix(uSecondary, uColor, vUv.y), core * vertical * pulse * 0.068);
         }`,
        { side: THREE.DoubleSide },
      )
      const beam = new THREE.Mesh(beamGeometry, beamMaterial)
      beam.position.set((index - 1) * 2.85, 4.15, -3.0 - index * 0.18)
      beam.rotation.z = (index - 1) * -0.12
      beam.name = 'Volumetric light shaft'
      this.stageFxGroup.add(beam)
    }

    const floorMaterial = this.createStageShader(
      `varying vec2 vUv;
       void main() {
         vUv = uv;
         gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
       }`,
      `uniform float uTime;
       uniform vec3 uColor;
       uniform vec3 uSecondary;
       varying vec2 vUv;
       void main() {
         vec2 p = (vUv - 0.5) * 2.0;
         float radius = length(p);
         float rings = pow(max(0.0, sin((radius * 7.0 - uTime * 0.62) * 3.14159)), 20.0);
         float sweepAngle = atan(p.y, p.x) / 6.28318 + 0.5;
         float sweep = pow(max(0.0, sin((sweepAngle - uTime * 0.035) * 6.28318)), 38.0);
         float mask = smoothstep(1.0, 0.82, radius) * smoothstep(0.08, 0.26, radius);
         gl_FragColor = vec4(mix(uColor, uSecondary, sweep * .75), (rings * 0.105 + sweep * 0.058) * mask);
       }`,
      { side: THREE.DoubleSide },
    )
    const floorEnergy = new THREE.Mesh(new THREE.CircleGeometry(2.05, 96), floorMaterial)
    floorEnergy.rotation.x = -Math.PI / 2
    floorEnergy.position.y = 0.196
    floorEnergy.name = 'Animated floor telemetry'
    this.stageFxGroup.add(floorEnergy)
  }

  private createStageShader(
    vertexShader: string,
    fragmentShader: string,
    options: { side?: THREE.Side } = {},
  ): THREE.ShaderMaterial {
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: options.side ?? THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: this.currentAccent.clone() },
        uSecondary: { value: this.currentSecondary.clone() },
      },
      vertexShader,
      fragmentShader,
    })
    this.stageFxMaterials.push(material)
    return material
  }

  private buildBay(): void {
    this.bayGroup.position.x = this.stageX()
    this.scene.add(this.bayGroup)

    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(2.05, 2.22, 0.16, 80),
      new THREE.MeshStandardMaterial({ color: 0x101620, metalness: 0.86, roughness: 0.3 }),
    )
    platform.position.y = 0.055
    platform.receiveShadow = true
    this.bayGroup.add(platform)

    const inset = new THREE.Mesh(
      new THREE.CylinderGeometry(1.74, 1.82, 0.185, 80),
      new THREE.MeshStandardMaterial({ color: 0x05080d, metalness: 0.72, roughness: 0.42 }),
    )
    inset.position.y = 0.085
    inset.receiveShadow = true
    this.bayGroup.add(inset)

    for (const radius of [1.79, 2.08]) {
      const material = new THREE.MeshBasicMaterial({ color: this.currentAccent, transparent: true, opacity: radius < 2 ? 0.72 : 0.22 })
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, radius < 2 ? 0.015 : 0.008, 6, 128), material)
      ring.rotation.x = Math.PI / 2
      ring.position.y = 0.185
      this.bayGroup.add(ring)
      this.animatedRings.push(ring)
      this.accentMaterials.push(material)
    }

    for (const radius of [2.16, 2.55, 3.05]) {
      const material = new THREE.MeshBasicMaterial({ color: this.currentAccent, transparent: true, opacity: radius === 2.16 ? 0.34 : 0.11, depthWrite: false })
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, radius === 2.16 ? 0.012 : 0.006, 5, 160, Math.PI * 1.62), material)
      ring.position.set(0, 2.34, -1.78 - (radius - 2.1) * 0.12)
      ring.rotation.z = Math.PI * 0.69
      this.bayGroup.add(ring)
      this.animatedRings.push(ring)
      this.accentMaterials.push(material)
    }

    const pylonMaterial = new THREE.MeshStandardMaterial({ color: 0x121922, metalness: 0.76, roughness: 0.36 })
    const lightMaterial = new THREE.MeshBasicMaterial({ color: this.currentAccent, transparent: true, opacity: 0.46 })
    this.accentMaterials.push(lightMaterial)
    for (const side of [-1, 1]) {
      const pylon = new THREE.Group()
      pylon.position.set(side * 2.82, 2.06, -1.22)
      pylon.rotation.z = side * -0.075

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 3.9, 0.18), pylonMaterial)
      body.castShadow = true
      pylon.add(body)

      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.018, 3.35, 0.195), lightMaterial)
      strip.position.x = side * -0.075
      pylon.add(strip)
      this.bayGroup.add(pylon)
    }

    const scanPlane = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 5.25), this.scanMaterial)
    scanPlane.position.set(0, 2.55, -1.7)
    this.bayGroup.add(scanPlane)

    const railGeometry = new THREE.BoxGeometry(0.045, 0.045, 5.5)
    const railMaterial = new THREE.MeshStandardMaterial({ color: 0x1e2935, metalness: 0.85, roughness: 0.3 })
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(railGeometry, railMaterial)
      rail.position.set(side * 3.55, 0.04, 0.4)
      this.scene.add(rail)
    }
  }

  private buildDust(): void {
    const count = 240
    const positions = new Float32Array(count * 3)
    let seed = 709
    const random = (): number => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (random() - 0.5) * 14
      positions[index * 3 + 1] = random() * 6.8
      positions[index * 3 + 2] = (random() - 0.5) * 8 - 0.8
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const dust = new THREE.Points(geometry, this.dustMaterial)
    dust.name = 'Atmospheric dust'
    this.scene.add(dust)
    this.ambientFields.push(dust)
  }

  private async loadCharacter(character: Character, index: number): Promise<THREE.Group> {
    const [signatureGltf, idleGltf] = await Promise.all([
      this.loader.loadAsync(character.animation.signature),
      this.loader.loadAsync(character.animation.idle),
    ])
    const canonical = signatureGltf.scene
    const signatureClip = signatureGltf.animations[0]?.clone()
    const idleClip = idleGltf.animations[0]?.clone()
    if (!signatureClip || !idleClip) {
      this.disposeObjectResources(idleGltf.scene)
      throw new Error(`${character.name} is missing its Mint combat animation clips.`)
    }
    this.makeClipInPlace(signatureClip, canonical)
    this.makeClipInPlace(idleClip, canonical)
    canonical.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(canonical)
    const center = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    if (!Number.isFinite(size.y) || size.y <= 0.001) throw new Error(`${character.name} has invalid model bounds.`)

    const normalized = new THREE.Group()
    const scale = 4.35 / size.y
    normalized.scale.setScalar(scale)
    normalized.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale)
    normalized.add(canonical)

    canonical.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.castShadow = true
      object.receiveShadow = true
      object.frustumCulled = !(object instanceof THREE.SkinnedMesh)
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => {
        if ('envMapIntensity' in material) material.envMapIntensity = 1.15
        material.needsUpdate = true
      })
    })

    const root = new THREE.Group()
    const orbitPivot = new THREE.Group()
    const orbitCenterY = 2.15
    orbitPivot.name = `${character.name} inspection pivot`
    orbitPivot.position.y = orbitCenterY
    normalized.position.y -= orbitCenterY
    orbitPivot.add(normalized)
    const pickProxy = new THREE.Mesh(this.pickGeometry, this.pickMaterial)
    pickProxy.name = `${character.name} inspection target`
    orbitPivot.add(pickProxy)
    root.name = character.name
    root.add(orbitPivot)
    root.position.set(this.stageX(), 0.18, 0)
    root.visible = index === 0
    this.modelPivots[index] = orbitPivot
    this.pickProxies[index] = pickProxy
    this.orbitPresentations[index] = {
      yaw: 0,
      pitch: 0,
      zoom: 1,
      targetYaw: 0,
      targetPitch: 0,
      targetZoom: 1,
    }
    root.userData.canonicalBounds = {
      height: Number(size.y.toFixed(3)),
      width: Number(size.x.toFixed(3)),
      depth: Number(size.z.toFixed(3)),
      presentationScale: Number(scale.toFixed(4)),
      clips: 2,
    }

    const mixer = new THREE.AnimationMixer(root)
    const idle = mixer.clipAction(idleClip)
    idle.setLoop(THREE.LoopRepeat, Infinity)
    const signature = mixer.clipAction(signatureClip)
    signature.setLoop(THREE.LoopOnce, 1)
    signature.clampWhenFinished = true
    let probeBone: THREE.Bone | null = null
    root.traverse((object) => {
      if (probeBone || !(object instanceof THREE.Bone)) return
      if (/rightarm|leftarm|spine2|spine_02/i.test(object.name)) probeBone = object
    })
    this.animationRuntimes[index] = {
      mixer,
      idle,
      signature,
      idleClip,
      signatureClip,
      probeBone,
      probeRest: probeBone ? (probeBone as THREE.Bone).quaternion.clone() : new THREE.Quaternion(),
      phase: 'stopped',
      replayAt: Infinity,
    }
    mixer.addEventListener('finished', (event) => {
      if (event.action === signature) this.playIdle(index)
    })

    this.disposeObjectResources(idleGltf.scene)
    return root
  }

  private readonly onModelPointerDown = (event: PointerEvent): void => {
    if (!this.canInspectSelected()) return
    const alreadyInspecting = this.inspectionPointers.size > 0
    if (!alreadyInspecting && !this.hitActiveCharacter(event.clientX, event.clientY)) return
    event.preventDefault()
    event.stopPropagation()
    if (this.inspectionPointers.size >= 2) return
    this.inspectionPointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    this.renderer.domElement.setPointerCapture(event.pointerId)
    if (this.inspectionPointers.size === 1) {
      this.orbitGesture = { pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY }
      this.pinchGesture = null
      this.container.dataset.orbit = 'dragging'
      return
    }

    const pointerIds = [...this.inspectionPointers.keys()].slice(0, 2) as [number, number]
    this.orbitGesture = null
    this.pinchGesture = {
      pointerIds,
      lastDistance: this.inspectionPointerDistance(pointerIds),
    }
    this.container.dataset.orbit = 'zooming'
  }

  private readonly onModelPointerMove = (event: PointerEvent): void => {
    const inspectionPointer = this.inspectionPointers.get(event.pointerId)
    if (inspectionPointer) {
      inspectionPointer.x = event.clientX
      inspectionPointer.y = event.clientY
    }

    if (this.pinchGesture && this.pinchGesture.pointerIds.includes(event.pointerId)) {
      event.preventDefault()
      event.stopPropagation()
      const distance = this.inspectionPointerDistance(this.pinchGesture.pointerIds)
      if (distance > 0 && this.pinchGesture.lastDistance > 0) {
        const presentation = this.orbitPresentations[this.selectedIndex]
        if (presentation) {
          presentation.targetZoom = THREE.MathUtils.clamp(
            presentation.targetZoom * (distance / this.pinchGesture.lastDistance),
            0.78,
            1.48,
          )
        }
      }
      this.pinchGesture.lastDistance = distance
      return
    }

    const gesture = this.orbitGesture
    if (!gesture) {
      if (event.pointerType === 'mouse') {
        this.container.dataset.orbit = this.hitActiveCharacter(event.clientX, event.clientY) ? 'hovering' : 'idle'
      }
      return
    }
    if (event.pointerId !== gesture.pointerId) return

    event.preventDefault()
    event.stopPropagation()
    const presentation = this.orbitPresentations[this.selectedIndex]
    if (!presentation) return
    const deltaX = event.clientX - gesture.lastX
    const deltaY = event.clientY - gesture.lastY
    gesture.lastX = event.clientX
    gesture.lastY = event.clientY
    presentation.targetYaw += deltaX * 0.008
    presentation.targetPitch = THREE.MathUtils.clamp(presentation.targetPitch + deltaY * 0.0045, -0.2, 0.18)
  }

  private readonly onModelPointerUp = (event: PointerEvent): void => {
    if (!this.inspectionPointers.has(event.pointerId)) return
    event.preventDefault()
    event.stopPropagation()
    this.endInspectionPointer(event.pointerId)
    if (this.inspectionPointers.size === 0) {
      this.container.dataset.orbit = this.hitActiveCharacter(event.clientX, event.clientY) ? 'hovering' : 'idle'
    }
  }

  private readonly onModelPointerCancel = (event: PointerEvent): void => {
    if (!this.inspectionPointers.has(event.pointerId)) return
    event.stopPropagation()
    this.endInspectionPointer(event.pointerId)
    if (this.inspectionPointers.size === 0) this.container.dataset.orbit = 'idle'
  }

  private readonly onModelLostPointerCapture = (event: PointerEvent): void => {
    if (!this.inspectionPointers.has(event.pointerId)) return
    this.endInspectionPointer(event.pointerId, false)
    if (this.inspectionPointers.size === 0) this.container.dataset.orbit = 'idle'
  }

  private readonly onModelPointerLeave = (): void => {
    if (this.inspectionPointers.size === 0) this.container.dataset.orbit = 'idle'
  }

  private readonly cancelOrbitGesture = (): void => {
    const pointerIds = [...this.inspectionPointers.keys()]
    pointerIds.forEach((pointerId) => this.endInspectionPointer(pointerId))
    this.container.dataset.orbit = 'idle'
  }

  private readonly onModelWheel = (event: WheelEvent): void => {
    if (!this.canInspectSelected() || !this.hitActiveCharacter(event.clientX, event.clientY)) return
    event.preventDefault()
    event.stopPropagation()
    const presentation = this.orbitPresentations[this.selectedIndex]
    if (!presentation) return
    const normalizedDelta = THREE.MathUtils.clamp(event.deltaY, -140, 140)
    presentation.targetZoom = THREE.MathUtils.clamp(
      presentation.targetZoom * Math.exp(-normalizedDelta * 0.00165),
      0.78,
      1.48,
    )
    this.container.dataset.orbit = 'zooming'
  }

  private readonly onModelDoubleClick = (event: MouseEvent): void => {
    if (!this.canInspectSelected() || !this.hitActiveCharacter(event.clientX, event.clientY)) return
    event.preventDefault()
    const presentation = this.orbitPresentations[this.selectedIndex]
    if (!presentation) return
    presentation.targetYaw = 0
    presentation.targetPitch = 0
    presentation.targetZoom = 1
  }

  private endInspectionPointer(pointerId: number, releaseCapture = true): void {
    if (releaseCapture && this.renderer.domElement.hasPointerCapture(pointerId)) {
      this.renderer.domElement.releasePointerCapture(pointerId)
    }
    this.inspectionPointers.delete(pointerId)
    if (this.pinchGesture?.pointerIds.includes(pointerId)) this.pinchGesture = null
    if (this.orbitGesture?.pointerId === pointerId) this.orbitGesture = null

    const remaining = [...this.inspectionPointers.entries()]
    if (remaining.length === 1) {
      const [remainingId, pointer] = remaining[0]
      this.orbitGesture = { pointerId: remainingId, lastX: pointer.x, lastY: pointer.y }
      this.container.dataset.orbit = 'dragging'
    }
  }

  private inspectionPointerDistance(pointerIds: readonly [number, number]): number {
    const first = this.inspectionPointers.get(pointerIds[0])
    const second = this.inspectionPointers.get(pointerIds[1])
    if (!first || !second) return 0
    return Math.hypot(second.x - first.x, second.y - first.y)
  }

  private canInspectSelected(): boolean {
    if (!this.transition) return true
    const progress = (performance.now() - this.transition.startedAt) / this.transition.duration
    return this.transition.to === this.selectedIndex && progress >= 0.26
  }

  private hitActiveCharacter(clientX: number, clientY: number): boolean {
    const model = this.models[this.selectedIndex]
    if (!model?.visible || !this.canInspectSelected()) return false
    const bounds = this.renderer.domElement.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) return false
    this.pointer.set(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1,
    )
    model.updateMatrixWorld(true)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    return this.raycaster.intersectObject(this.pickProxies[this.selectedIndex], false).length > 0
  }

  private playSignature(index: number): void {
    const runtime = this.animationRuntimes[index]
    if (!runtime) return

    runtime.signature.enabled = true
    runtime.signature.clampWhenFinished = true
    runtime.signature.reset().setLoop(THREE.LoopOnce, 1).play()
    if (runtime.phase === 'idle') runtime.idle.crossFadeTo(runtime.signature, 0.2, false)
    else runtime.signature.fadeIn(0.12)
    runtime.phase = 'signature'
    runtime.replayAt = Infinity
  }

  private playIdle(index: number): void {
    const runtime = this.animationRuntimes[index]
    if (!runtime || runtime.phase !== 'signature') return

    runtime.idle.enabled = true
    runtime.idle.reset().setLoop(THREE.LoopRepeat, Infinity).play()
    runtime.signature.crossFadeTo(runtime.idle, 0.24, false)
    runtime.phase = 'idle'
    runtime.replayAt = this.clock.elapsedTime + 2.55 + index * 0.18
  }

  private makeClipInPlace(clip: THREE.AnimationClip, rig: THREE.Object3D): void {
    let hips: THREE.Bone | null = null
    rig.traverse((object) => {
      if (!hips && object instanceof THREE.Bone && /hips/i.test(object.name)) hips = object
    })
    const restX = hips ? (hips as THREE.Bone).position.x : 0
    const restZ = hips ? (hips as THREE.Bone).position.z : 0
    clip.tracks.forEach((track) => {
      if (!(track instanceof THREE.VectorKeyframeTrack) || !/hips.*\.position$/i.test(track.name)) return
      const values = track.values as Float32Array
      for (let index = 0; index < values.length; index += 3) {
        values[index] = restX
        values[index + 2] = restZ
      }
    })
    clip.resetDuration()
  }

  private disposeObjectResources(root: THREE.Object3D): void {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.geometry?.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => {
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) value.dispose()
        }
        material.dispose()
      })
    })
  }

  private async captureThumbnails(): Promise<void> {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' })
    renderer.setSize(240, 300, false)
    renderer.setPixelRatio(1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.22

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x080c12)
    scene.environment = this.scene.environment
    scene.add(new THREE.HemisphereLight(0xe0e8ff, 0x11141d, 2.2))

    const key = new THREE.DirectionalLight(0xffffff, 4)
    key.position.set(3, 5, 4)
    scene.add(key)

    const accent = new THREE.PointLight(0xffffff, 42, 10, 1.5)
    accent.position.set(-2, 3.5, 1.5)
    scene.add(accent)

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 48),
      new THREE.MeshStandardMaterial({ color: 0x0e141d, metalness: 0.7, roughness: 0.42 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = 0.15
    scene.add(floor)

    const camera = new THREE.PerspectiveCamera(28, 240 / 300, 0.1, 30)
    camera.position.set(0.18, 2.35, 8.25)
    camera.lookAt(0, 2.25, 0)

    for (let index = 0; index < this.models.length; index += 1) {
      const clone = cloneSkeleton(this.models[index])
      clone.visible = true
      clone.position.set(0, 0, 0)
      clone.rotation.set(0, 0.12, 0)
      clone.scale.setScalar(1)
      scene.add(clone)
      const runtime = this.animationRuntimes[index]
      const thumbnailMixer = new THREE.AnimationMixer(clone)
      const thumbnailAction = thumbnailMixer.clipAction(runtime.signatureClip)
      thumbnailAction.setLoop(THREE.LoopOnce, 1).play()
      thumbnailMixer.setTime(runtime.signatureClip.duration * this.roster[index].animation.thumbnailPose)
      clone.updateMatrixWorld(true)
      accent.color.set(this.roster[index].accent)
      renderer.render(scene, camera)
      this.onThumbnail(index, renderer.domElement.toDataURL('image/webp', 0.86))
      thumbnailMixer.stopAllAction()
      thumbnailMixer.uncacheRoot(clone)
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
    this.scanMaterial.uniforms.uTime.value = elapsed
    const stageTime = this.prefersReducedMotion ? 0 : elapsed
    if (this.stageFxEnabled) {
      this.stageFxMaterials.forEach((material) => { material.uniforms.uTime.value = stageTime })
      this.rotatingStageGroups.forEach(({ object, speed }) => { object.rotation.z += delta * speed })
      this.ambientFields.forEach((field, index) => { field.rotation.y += delta * (index % 2 === 0 ? 0.004 : -0.003) })
    }
    this.animatedRings.forEach((ring, index) => {
      ring.rotation.z += this.prefersReducedMotion ? 0 : delta * (index % 2 === 0 ? 0.025 : -0.018)
    })

    this.animationRuntimes.forEach((runtime, index) => {
      if (this.models[index]?.visible) runtime.mixer.update(delta)
    })
    const activeRuntime = this.animationRuntimes[this.selectedIndex]
    if (activeRuntime?.phase === 'idle' && elapsed >= activeRuntime.replayAt) {
      this.playSignature(this.selectedIndex)
    }
    if (activeRuntime) {
      const activeAction = activeRuntime.phase === 'signature' ? activeRuntime.signature : activeRuntime.idle
      this.container.dataset.animation = activeRuntime.phase
      this.container.dataset.animationTime = activeAction.time.toFixed(3)
      this.container.dataset.signature = this.roster[this.selectedIndex].animation.signatureName
      this.container.dataset.poseDelta = activeRuntime.probeBone
        ? activeRuntime.probeBone.quaternion.angleTo(activeRuntime.probeRest).toFixed(3)
        : '0'
    }

    this.orbitPresentations.forEach((presentation, index) => {
      const pivot = this.modelPivots[index]
      if (!pivot) return
      const smoothing = 1 - Math.exp(-delta * 16)
      presentation.yaw = THREE.MathUtils.lerp(presentation.yaw, presentation.targetYaw, smoothing)
      presentation.pitch = THREE.MathUtils.lerp(presentation.pitch, presentation.targetPitch, smoothing)
      presentation.zoom = THREE.MathUtils.lerp(presentation.zoom, presentation.targetZoom, smoothing)
      pivot.rotation.set(presentation.pitch, presentation.yaw, 0)
      pivot.scale.setScalar(presentation.zoom)
    })
    const activeOrbit = this.orbitPresentations[this.selectedIndex]
    if (activeOrbit) {
      this.container.dataset.orbitYaw = activeOrbit.yaw.toFixed(3)
      this.container.dataset.orbitPitch = activeOrbit.pitch.toFixed(3)
      this.container.dataset.orbitZoom = activeOrbit.zoom.toFixed(3)
    }

    if (this.transition) this.updateTransition(performance.now())
    else if (this.models[this.selectedIndex]) {
      const active = this.models[this.selectedIndex]
      active.position.x = this.stageX()
      active.position.y = 0.18
      active.rotation.y = 0
    }

    const transitionProgress = this.transition
      ? clamp01((performance.now() - this.transition.startedAt) / this.transition.duration)
      : 1
    this.container.dataset.transitionProgress = transitionProgress.toFixed(3)
    this.container.dataset.transitionDuration = String(this.transition?.duration ?? 0)
    this.container.dataset.inspectReady = String(this.canInspectSelected())

    this.currentAccent.lerp(this.targetAccent, 1 - Math.exp(-delta * 5.5))
    this.currentSecondary.lerp(this.targetSecondary, 1 - Math.exp(-delta * 5.1))
    this.currentFog.lerp(this.targetFog, 1 - Math.exp(-delta * 4.2))
    this.currentKey.lerp(this.targetKey, 1 - Math.exp(-delta * 5.4))
    this.currentFill.lerp(this.targetFill, 1 - Math.exp(-delta * 4.8))
    this.currentExposure = THREE.MathUtils.lerp(this.currentExposure, this.targetExposure, 1 - Math.exp(-delta * 4.5))
    this.currentBloom = THREE.MathUtils.lerp(this.currentBloom, this.targetBloom, 1 - Math.exp(-delta * 4.5))
    this.applyAccent()
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.color.copy(this.currentFog)
    this.renderer.toneMappingExposure = this.currentExposure
    this.bloomPass.strength = this.currentBloom
    if (this.keyLight) {
      this.keyLight.color.copy(this.currentKey)
      this.keyLight.intensity = 4.15 + Math.sin(stageTime * 0.48) * 0.14
    }
    if (this.fillLight) this.fillLight.color.copy(this.currentFill)
    this.accentLights.forEach((light, index) => {
      const baseIntensity = Number(light.userData.baseIntensity ?? light.intensity)
      light.intensity = baseIntensity * (0.93 + Math.sin(stageTime * 0.82 + index * 1.7) * 0.07)
    })

    const frameMs = rawDelta * 1000
    this.frameAccumulator += frameMs
    this.frameSamples += 1

    const canUsePost = this.postEnabled && window.innerWidth >= 700
    this.renderer.info.reset()
    if (canUsePost) this.composer.render()
    else this.renderer.render(this.scene, this.camera)

    const activeProxy = this.pickProxies[this.selectedIndex]
    if (activeProxy?.visible) {
      activeProxy.getWorldPosition(this.inspectionScreenPoint)
      this.inspectionScreenPoint.project(this.camera)
      this.container.dataset.inspectX = ((this.inspectionScreenPoint.x + 1) * 0.5).toFixed(4)
      this.container.dataset.inspectY = ((1 - this.inspectionScreenPoint.y) * 0.5).toFixed(4)
    }

    if (elapsed - this.lastDiagnosticAt > 0.5) {
      this.publishDiagnostics(canUsePost)
      this.lastDiagnosticAt = elapsed
    }
  }

  private updateTransition(now: number): void {
    const transition = this.transition
    if (!transition) return
    const progress = clamp01((now - transition.startedAt) / transition.duration)
    const outgoingProgress = easeInCubic(Math.min(1, progress * 1.24))
    const incomingProgress = easeOutQuint(clamp01((progress - 0.08) / 0.92))
    const outgoing = this.models[transition.from]
    const incoming = this.models[transition.to]
    const stageX = this.stageX()

    outgoing.position.x = THREE.MathUtils.lerp(stageX, stageX - transition.direction * 4.2, outgoingProgress)
    outgoing.position.y = THREE.MathUtils.lerp(0.18, 0.02, outgoingProgress)
    outgoing.rotation.y = transition.direction * 0.34 * outgoingProgress
    outgoing.rotation.z = transition.direction * 0.04 * outgoingProgress
    const stageScale = this.stageScale()
    outgoing.scale.setScalar(THREE.MathUtils.lerp(stageScale, stageScale * 0.7, outgoingProgress))

    incoming.position.x = THREE.MathUtils.lerp(stageX + transition.direction * 4.7, stageX, incomingProgress)
    incoming.position.y = THREE.MathUtils.lerp(0.04, 0.18, incomingProgress)
    incoming.rotation.y = THREE.MathUtils.lerp(-transition.direction * 0.28, 0, incomingProgress)
    incoming.rotation.z = THREE.MathUtils.lerp(-transition.direction * 0.035, 0, incomingProgress)
    incoming.scale.setScalar(THREE.MathUtils.lerp(stageScale * 0.78, stageScale, incomingProgress))

    this.camera.position.x = this.cameraX() + Math.sin(progress * Math.PI) * transition.direction * 0.14
    this.lookAtStage()

    if (progress >= 1) this.finishTransition()
  }

  private finishTransition(): void {
    const transition = this.transition
    if (!transition) return
    const outgoing = this.models[transition.from]
    const incoming = this.models[transition.to]
    outgoing.visible = false
    outgoing.scale.setScalar(this.stageScale())
    outgoing.rotation.set(0, 0, 0)
    incoming.visible = true
    incoming.position.set(this.stageX(), 0.18, 0)
    incoming.rotation.set(0, 0, 0)
    incoming.scale.setScalar(this.stageScale())
    this.camera.position.x = this.cameraX()
    this.lookAtStage()
    this.transition = null
    transition.resolve()
  }

  private applyAccent(): void {
    this.accentMaterials.forEach((material) => material.color.copy(this.currentAccent))
    this.accentLights.forEach((light, index) => light.color.copy(index === 0 ? this.currentAccent : this.currentSecondary))
    this.scanMaterial.uniforms.uColor.value.copy(this.currentAccent)
    this.scanMaterial.uniforms.uSecondary.value.copy(this.currentSecondary)
    this.dustMaterial.color.copy(this.currentSecondary)
    this.stageFxMaterials.forEach((material) => {
      material.uniforms.uColor.value.copy(this.currentAccent)
      material.uniforms.uSecondary.value.copy(this.currentSecondary)
    })
  }

  private readonly resize = (): void => {
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    const mobile = width < 700
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(width, height, false)
    this.composer.setPixelRatio(dpr)
    this.composer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.fov = mobile ? 36 : 31
    this.camera.position.set(this.cameraX(), mobile ? 2.72 : 2.3, mobile ? 10.15 : 9.45)
    this.camera.updateProjectionMatrix()
    this.bayGroup.position.x = this.stageX()
    this.stageFxGroup.position.x = this.stageX()
    this.models.forEach((model) => {
      if (!this.transition) {
        model.position.x = this.stageX()
        model.scale.setScalar(this.stageScale())
      }
    })
    this.accentLights.forEach((light, index) => {
      light.position.x = this.stageX() + (index === 0 ? 1.5 : -1.6)
    })
    if (this.keyLight) {
      const shadowSize = mobile ? 1024 : 2048
      if (this.keyLight.shadow.mapSize.x !== shadowSize) {
        this.keyLight.shadow.map?.dispose()
        this.keyLight.shadow.map = null
        this.keyLight.shadow.mapSize.set(shadowSize, shadowSize)
      }
    }
    this.lookAtStage()
  }

  private stageX(): number { return window.innerWidth < 900 ? 0 : 1.25 }
  private cameraX(): number { return window.innerWidth < 900 ? 0 : 1.05 }
  private stageScale(): number { return window.innerWidth < 700 ? 0.65 : 0.88 }

  private lookAtStage(): void {
    this.camera.lookAt(this.stageX(), window.innerWidth < 700 ? 2.65 : 2.2, 0)
  }

  private countMaterials(): number {
    const materials = new Set<THREE.Material>()
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Points)) return
      const list = Array.isArray(object.material) ? object.material : [object.material]
      list.forEach((material) => materials.add(material))
    })
    return materials.size
  }

  private publishDiagnostics(postEnabled: boolean): void {
    const info = this.renderer.info
    const averageFrameMs = this.frameSamples > 0 ? this.frameAccumulator / this.frameSamples : 0
    const activeRuntime = this.animationRuntimes[this.selectedIndex]
    const activeAction = activeRuntime?.phase === 'signature' ? activeRuntime.signature : activeRuntime?.idle
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
      shadowMap: window.innerWidth < 700 ? 1024 : 2048,
      selected: this.selectedIndex,
      animation: activeRuntime?.phase ?? 'stopped',
      animationTime: Number((activeAction?.time ?? 0).toFixed(3)),
      poseDelta: Number((activeRuntime?.probeBone?.quaternion.angleTo(activeRuntime.probeRest) ?? 0).toFixed(3)),
      stageFx: this.stageFxEnabled,
      orbiting: this.inspectionPointers.size > 0,
      orbitYaw: Number((this.orbitPresentations[this.selectedIndex]?.yaw ?? 0).toFixed(3)),
      orbitPitch: Number((this.orbitPresentations[this.selectedIndex]?.pitch ?? 0).toFixed(3)),
      orbitZoom: Number((this.orbitPresentations[this.selectedIndex]?.zoom ?? 1).toFixed(3)),
    }
    const diagnosticWindow = window as Window & {
      __VANGUARD_DIAGNOSTICS__?: Diagnostics
      __THREE_APP_DIAGNOSTICS__?: {
        renderer: { calls: number; triangles: number; geometries: number; textures: number }
        state: Record<string, unknown>
        performance: { fps: number; frameMs: number; dpr: number; postPasses: number; shadowMap: number }
      }
    }
    diagnosticWindow.__VANGUARD_DIAGNOSTICS__ = diagnostics
    diagnosticWindow.__THREE_APP_DIAGNOSTICS__ = {
      renderer: {
        calls: diagnostics.calls,
        triangles: diagnostics.triangles,
        geometries: diagnostics.geometries,
        textures: diagnostics.textures,
      },
      state: {
        selected: this.roster[this.selectedIndex].id,
        materials: diagnostics.materials,
        animation: diagnostics.animation,
        animationTime: diagnostics.animationTime,
        poseDelta: diagnostics.poseDelta,
        signature: this.roster[this.selectedIndex].animation.signatureName,
        stageFx: diagnostics.stageFx,
        orbiting: diagnostics.orbiting,
        orbitYaw: diagnostics.orbitYaw,
        orbitPitch: diagnostics.orbitPitch,
        orbitZoom: diagnostics.orbitZoom,
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
    this.frameAccumulator = 0
    this.frameSamples = 0
  }
}
