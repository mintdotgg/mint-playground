import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { decorById, products, productById } from '../data/catalog'
import { loadMintDecorModel, loadMintProductModel } from '../assets/mintModelLoader'
import { resolveMintMaterialPath } from '../assets/mintAssets'
import { useAppStore } from '../state/store'
import { ROOM_DEPTH, ROOM_HEIGHT, ROOM_WIDTH } from '../state/defaultRoom'
import type { LightingPreset, PlacedItem, RoomDocument } from '../types'
import { buildDecorModel, buildProductModel, disposeObject, productForObject } from './modelFactory'
import { footprintFor, footprintsOverlap, snapValue } from './spatial'

interface MeasurementLabel {
  element: HTMLDivElement
  point: THREE.Vector3
}

interface DragState {
  id: string
  offsetX: number
  offsetZ: number
  pointerId: number
}

const wallColors: Record<RoomDocument['wallColor'], string> = {
  bone: '#d8cfbe',
  clay: '#aa7d6d',
  chalk: '#ece8de',
  ultramarine: '#1737b8',
}

const floorColors: Record<RoomDocument['floorFinish'], string> = {
  travertine: '#bdab8d',
  'smoked-oak': '#4a3a30',
  'pale-ash': '#bda982',
}

export class RoomScene {
  readonly renderer: THREE.WebGLRenderer
  readonly canvas: HTMLCanvasElement
  private readonly container: HTMLElement
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(37, 1, 0.05, 60)
  private readonly controls: OrbitControls
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private readonly itemLayer = new THREE.Group()
  private readonly decorLayer = new THREE.Group()
  private readonly roomLayer = new THREE.Group()
  private readonly lightingLayer = new THREE.Group()
  private readonly measurementLayer = new THREE.Group()
  private readonly itemObjects = new Map<string, THREE.Group>()
  private readonly decorObjects = new Map<string, THREE.Group>()
  private readonly mintItemLoads = new Set<string>()
  private readonly mintDecorLoads = new Set<string>()
  private readonly resizeObserver: ResizeObserver
  private readonly overlay: HTMLDivElement
  private readonly floorMaterial: THREE.MeshStandardMaterial
  private readonly wallMaterial: THREE.MeshStandardMaterial
  private readonly rugMaterial: THREE.MeshStandardMaterial
  private readonly floorMesh: THREE.Mesh
  private readonly rugMesh: THREE.Mesh
  private readonly textureLoader = new THREE.TextureLoader()
  private readonly surfaceTextures = new Map<string, THREE.Texture>()
  private readonly grid: THREE.GridHelper
  private readonly selectionBox = new THREE.Box3()
  private readonly selectionHelper: THREE.Box3Helper
  private readonly footprintMesh: THREE.Mesh
  private measurementLabels: MeasurementLabel[] = []
  private drag: DragState | null = null
  private animationFrame = 0
  private disposed = false
  private unsubscribe: (() => void) | null = null
  private lastCameraResetKey = -1
  private lastInspectMode = false
  private lastSelectedItemId: string | null = null
  private cameraGoal: THREE.Vector3 | null = null
  private targetGoal: THREE.Vector3 | null = null
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private lastFrameTime = performance.now()
  private lastMeasurementSignature = ''
  private mobileTier = false

  constructor(container: HTMLElement) {
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.canvas = this.renderer.domElement
    this.canvas.className = 'room-canvas'
    this.canvas.setAttribute('aria-label', 'Editable three-dimensional apartment room')
    this.canvas.tabIndex = 0
    container.appendChild(this.canvas)

    this.overlay = document.createElement('div')
    this.overlay.className = 'measurement-overlay'
    this.overlay.setAttribute('aria-hidden', 'true')
    container.appendChild(this.overlay)

    this.scene.background = new THREE.Color('#d3ccbf')
    this.scene.fog = new THREE.Fog('#d3ccbf', 12, 25)
    this.scene.add(this.roomLayer, this.itemLayer, this.decorLayer, this.lightingLayer, this.measurementLayer)

    this.camera.position.set(7.25, 6.2, 7.8)
    this.controls = new OrbitControls(this.camera, this.canvas)
    this.controls.target.set(0, 0.55, 0)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.075
    this.controls.minDistance = 4.5
    this.controls.maxDistance = 14
    this.controls.minPolarAngle = 0.32
    this.controls.maxPolarAngle = Math.PI * 0.46
    this.controls.screenSpacePanning = false

    this.wallMaterial = new THREE.MeshStandardMaterial({ color: wallColors.bone, roughness: 0.96, emissive: '#c5bbab', emissiveIntensity: 0.48 })
    this.floorMaterial = new THREE.MeshStandardMaterial({ color: floorColors.travertine, roughness: 0.82, emissive: '#aa987b', emissiveIntensity: 0.36 })
    this.rugMaterial = new THREE.MeshStandardMaterial({ color: '#1838b8', roughness: 1, emissive: '#112884', emissiveIntensity: 0.18 })
    this.floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH), this.floorMaterial)
    this.floorMesh.rotation.x = -Math.PI / 2
    this.floorMesh.receiveShadow = true
    this.floorMesh.name = 'roomFloor'
    this.roomLayer.add(this.floorMesh)

    this.rugMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2), this.rugMaterial)
    this.rugMesh.rotation.x = -Math.PI / 2
    this.rugMesh.position.set(-1.3, 0.009, -0.55)
    this.rugMesh.receiveShadow = true
    this.roomLayer.add(this.rugMesh)

    this.grid = new THREE.GridHelper(Math.max(ROOM_WIDTH, ROOM_DEPTH), 36, '#3153c4', '#817c72')
    this.grid.position.y = 0.014
    const gridMaterials = Array.isArray(this.grid.material) ? this.grid.material : [this.grid.material]
    gridMaterials.forEach((material) => { material.transparent = true; material.opacity = 0.14 })
    this.measurementLayer.add(this.grid)

    this.selectionHelper = new THREE.Box3Helper(this.selectionBox, '#1838ff')
    this.selectionHelper.visible = false
    this.selectionHelper.renderOrder = 8
    this.measurementLayer.add(this.selectionHelper)

    this.footprintMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: '#1838ff', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }),
    )
    this.footprintMesh.rotation.x = -Math.PI / 2
    this.footprintMesh.position.y = 0.018
    this.footprintMesh.visible = false
    this.footprintMesh.renderOrder = 4
    this.measurementLayer.add(this.footprintMesh)

    this.buildArchitecture()
    this.applyLighting('day')
    this.bindEvents()

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()

    this.unsubscribe = useAppStore.subscribe((state) => this.sync(state))
    this.sync(useAppStore.getState())
    this.animate()
  }

  private buildArchitecture() {
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(ROOM_WIDTH + 0.22, ROOM_HEIGHT, 0.18), this.wallMaterial)
    backWall.position.set(0, ROOM_HEIGHT / 2, -ROOM_DEPTH / 2 - 0.09)
    backWall.receiveShadow = true
    this.roomLayer.add(backWall)

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.18, ROOM_HEIGHT, ROOM_DEPTH + 0.18), this.wallMaterial)
    leftWall.position.set(-ROOM_WIDTH / 2 - 0.09, ROOM_HEIGHT / 2, 0)
    leftWall.receiveShadow = true
    this.roomLayer.add(leftWall)

    const travertine = new THREE.MeshStandardMaterial({ color: '#b9a584', roughness: 0.8 })
    const baseBack = new THREE.Mesh(new THREE.BoxGeometry(ROOM_WIDTH, 0.1, 0.08), travertine)
    baseBack.position.set(0, 0.05, -ROOM_DEPTH / 2 + 0.01)
    this.roomLayer.add(baseBack)
    const baseLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, ROOM_DEPTH), travertine)
    baseLeft.position.set(-ROOM_WIDTH / 2 + 0.01, 0.05, 0)
    this.roomLayer.add(baseLeft)

    const steel = new THREE.MeshStandardMaterial({ color: '#252826', metalness: 0.65, roughness: 0.34 })
    const windowWidth = 2.7
    const windowHeight = 2.15
    const windowGroup = new THREE.Group()
    windowGroup.position.set(-1.15, 1.68, -ROOM_DEPTH / 2 + 0.02)
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(windowWidth, windowHeight), new THREE.MeshPhysicalMaterial({ color: '#bdcee0', transparent: true, opacity: 0.26, roughness: 0.15, transmission: 0.4 }))
    windowGroup.add(glass)
    for (const x of [-windowWidth / 2, -windowWidth / 6, windowWidth / 6, windowWidth / 2]) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.035, windowHeight, 0.04), steel)
      mullion.position.x = x
      windowGroup.add(mullion)
    }
    for (const y of [-windowHeight / 2, 0, windowHeight / 2]) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(windowWidth, 0.035, 0.04), steel)
      mullion.position.y = y
      windowGroup.add(mullion)
    }
    this.roomLayer.add(windowGroup)

    const column = new THREE.Mesh(new THREE.BoxGeometry(0.48, ROOM_HEIGHT, 0.48), this.wallMaterial)
    column.position.set(2.9, ROOM_HEIGHT / 2, -2.25)
    column.castShadow = true
    column.receiveShadow = true
    this.roomLayer.add(column)

    const beamMaterial = new THREE.MeshStandardMaterial({ color: '#887560', roughness: 0.85 })
    for (const x of [-2.4, 0, 2.4]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, ROOM_DEPTH), beamMaterial)
      beam.position.set(x, ROOM_HEIGHT + 0.05, 0)
      beam.userData.mobileOptional = true
      this.roomLayer.add(beam)
    }
  }

  private applyLighting(preset: LightingPreset) {
    while (this.lightingLayer.children.length) this.lightingLayer.remove(this.lightingLayer.children[0])
    const settings = {
      day: { ambient: '#eaf3ff', ground: '#847767', ambientPower: 2.25, key: '#fff0d8', keyPower: 3.5, exposure: 1.03, background: '#cfc9bd' },
      evening: { ambient: '#65749e', ground: '#51453e', ambientPower: 1.3, key: '#ffb66b', keyPower: 3.2, exposure: 0.9, background: '#777789' },
      gallery: { ambient: '#f4f1e8', ground: '#77736e', ambientPower: 1.8, key: '#fffdf7', keyPower: 4.4, exposure: 1.12, background: '#d9d7d0' },
      'warm-home': { ambient: '#e4bb8a', ground: '#67534b', ambientPower: 1.55, key: '#ffcb87', keyPower: 3.1, exposure: 0.98, background: '#aa9481' },
    }[preset]
    const hemisphere = new THREE.HemisphereLight(settings.ambient, settings.ground, settings.ambientPower)
    this.lightingLayer.add(hemisphere)
    const ambient = new THREE.AmbientLight('#fffaf0', preset === 'evening' ? 0.72 : 1.15)
    this.lightingLayer.add(ambient)
    const key = new THREE.DirectionalLight(settings.key, settings.keyPower)
    key.position.set(-3.8, 7, 4.4)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = -6
    key.shadow.camera.right = 6
    key.shadow.camera.top = 6
    key.shadow.camera.bottom = -6
    key.shadow.bias = -0.0003
    this.lightingLayer.add(key)
    const fill = new THREE.DirectionalLight(preset === 'evening' ? '#5570b8' : '#d7e2e8', preset === 'gallery' ? 1.4 : 0.8)
    fill.position.set(4, 3.5, 2)
    this.lightingLayer.add(fill)
    if (preset === 'warm-home' || preset === 'evening') {
      const practical = new THREE.PointLight('#ff9d4d', 8, 5.5, 2)
      practical.position.set(-2.8, 1.5, -1.6)
      this.lightingLayer.add(practical)
    }
    this.renderer.toneMappingExposure = settings.exposure
    this.scene.background = new THREE.Color(settings.background)
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.set(settings.background)
  }

  private bindEvents() {
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('pointercancel', this.onPointerCancel)
    this.canvas.addEventListener('lostpointercapture', this.onPointerCancel)
    this.canvas.addEventListener('dragover', this.onDragOver)
    this.canvas.addEventListener('drop', this.onDrop)
    window.addEventListener('blur', this.onWindowBlur)
  }

  private updatePointer(event: PointerEvent | DragEvent) {
    const rect = this.canvas.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
  }

  private floorPoint(event: PointerEvent | DragEvent) {
    this.updatePointer(event)
    const point = new THREE.Vector3()
    return this.raycaster.ray.intersectPlane(this.floorPlane, point) ? point : null
  }

  private pickProduct(event: PointerEvent) {
    this.updatePointer(event)
    const hits = this.raycaster.intersectObjects([...this.itemObjects.values()], true)
    return productForObject(hits[0]?.object ?? null)
  }

  private onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    const id = this.pickProduct(event)
    if (!id) {
      useAppStore.getState().selectItem(null)
      return
    }
    const point = this.floorPoint(event)
    const item = useAppStore.getState().room.items.find((candidate) => candidate.id === id)
    if (!point || !item) return
    useAppStore.getState().selectItem(id)
    useAppStore.getState().beginInteraction()
    this.drag = { id, offsetX: item.position[0] - point.x, offsetZ: item.position[2] - point.z, pointerId: event.pointerId }
    this.controls.enabled = false
    this.canvas.setPointerCapture(event.pointerId)
    this.canvas.classList.add('is-dragging')
    event.preventDefault()
  }

  private onPointerMove = (event: PointerEvent) => {
    if (!this.drag) {
      const id = this.pickProduct(event)
      useAppStore.getState().setHoveredItem(id)
      this.canvas.style.cursor = id ? 'grab' : 'default'
      return
    }
    if (event.pointerId !== this.drag.pointerId) return
    const point = this.floorPoint(event)
    if (!point) return
    useAppStore.getState().previewItemTransform(this.drag.id, {
      x: snapValue(point.x + this.drag.offsetX),
      z: snapValue(point.z + this.drag.offsetZ),
    })
    this.refreshCollisions(this.drag.id)
    event.preventDefault()
  }

  private finishDrag(commit: boolean) {
    if (!this.drag) return
    if (commit) {
      useAppStore.getState().commitInteraction()
      window.dispatchEvent(new CustomEvent('roomritual:audio', { detail: 'placement' }))
    } else useAppStore.getState().cancelInteraction()
    useAppStore.getState().setCollisionIds([])
    this.controls.enabled = true
    this.canvas.classList.remove('is-dragging')
    this.drag = null
  }

  private onPointerUp = (event: PointerEvent) => {
    if (this.drag?.pointerId !== event.pointerId) return
    this.finishDrag(true)
  }

  private onPointerCancel = () => this.finishDrag(false)
  private onWindowBlur = () => this.finishDrag(false)
  private onDragOver = (event: DragEvent) => {
    if (event.dataTransfer?.types.includes('application/x-room-ritual-product')) event.preventDefault()
  }
  private onDrop = (event: DragEvent) => {
    const productId = event.dataTransfer?.getData('application/x-room-ritual-product')
    if (!productId || !productById(productId)) return
    const point = this.floorPoint(event)
    if (!point) return
    event.preventDefault()
    const id = useAppStore.getState().addProduct(productId, [snapValue(point.x), 0, snapValue(point.z)])
    if (id) {
      this.refreshCollisions(id)
      window.dispatchEvent(new CustomEvent('roomritual:audio', { detail: 'placement' }))
    }
  }

  private refreshCollisions(id: string) {
    const { room, setCollisionIds } = useAppStore.getState()
    const selected = room.items.find((item) => item.id === id)
    const selectedProduct = selected ? productById(selected.productId) : undefined
    if (!selected || !selectedProduct) return setCollisionIds([])
    const selectedFootprint = footprintFor(selected, selectedProduct)
    const collisions = room.items.filter((item) => {
      if (item.id === id) return false
      const product = productById(item.productId)
      return product ? footprintsOverlap(selectedFootprint, footprintFor(item, product), 0.03) : false
    }).map((item) => item.id)
    setCollisionIds(collisions)
  }

  private sync(state: ReturnType<typeof useAppStore.getState>) {
    const wallTextureName = state.room.wallColor === 'bone' ? 'bone limewash' : state.room.wallColor === 'clay' ? 'clay limewash' : undefined
    const wallTexture = wallTextureName ? this.getSurfaceTexture(wallTextureName, 2.4, 1.4) : null
    this.wallMaterial.map = wallTexture
    this.wallMaterial.color.set(wallTexture ? '#f4efe8' : wallColors[state.room.wallColor])
    this.wallMaterial.needsUpdate = true
    const floorTextureName = state.room.floorFinish === 'travertine' ? 'warm travertine' : state.room.floorFinish === 'smoked-oak' ? 'smoked oak flooring' : 'pale ash'
    const floorTexture = this.getSurfaceTexture(floorTextureName, 3.2, 2.4)
    this.floorMaterial.map = floorTexture
    this.floorMaterial.color.set(floorTexture ? '#ffffff' : floorColors[state.room.floorFinish])
    this.floorMaterial.roughness = state.room.floorFinish === 'travertine' ? 0.82 : 0.68
    this.floorMaterial.needsUpdate = true
    this.rugMesh.visible = state.room.rugId !== 'none'
    if (state.room.rugId === 'ultramarine-grid') {
      this.rugMaterial.map = this.getSurfaceTexture('ultramarine wool', 2, 2)
      this.rugMaterial.color.set('#1738b8')
      this.rugMesh.scale.set(1, 1, 1)
    } else if (state.room.rugId === 'travertine-tone') {
      this.rugMaterial.map = this.getSurfaceTexture('warm travertine', 1.5, 1.5)
      this.rugMaterial.color.set('#c4ad88')
      this.rugMesh.scale.set(0.93, 0.95, 1)
    }
    this.rugMaterial.needsUpdate = true

    const liveIds = new Set(state.room.items.map((item) => item.id))
    for (const [id, object] of this.itemObjects) {
      if (liveIds.has(id)) continue
      this.itemLayer.remove(object)
      disposeObject(object)
      this.itemObjects.delete(id)
    }
    for (const item of state.room.items) this.syncItem(item)

    const liveDecorIds = new Set(state.room.decor.map((item) => item.id))
    for (const [id, object] of this.decorObjects) {
      if (liveDecorIds.has(id)) continue
      this.decorLayer.remove(object)
      disposeObject(object)
      this.decorObjects.delete(id)
    }
    for (const item of state.room.decor) {
      let object = this.decorObjects.get(item.id)
      if (object?.userData.source === 'mint' && this.mobileTier) {
        this.decorLayer.remove(object)
        disposeObject(object)
        this.decorObjects.delete(item.id)
        object = undefined
      }
      if (!object) {
        object = buildDecorModel(item.decorId)
        object.userData.decorInstanceId = item.id
        object.traverse((child) => { child.userData.decorInstanceId = item.id })
        this.decorObjects.set(item.id, object)
        this.decorLayer.add(object)
        this.applyQualityTier(object)
      }
      object.position.set(...item.position)
      object.rotation.y = item.rotation
      object.scale.setScalar(item.scale)
      if (!this.mobileTier) this.ensureMintDecor(item.id, item.decorId)
    }

    if (this.lastLightingPreset !== state.room.lighting) {
      this.applyLighting(state.room.lighting)
      this.lastLightingPreset = state.room.lighting
      window.dispatchEvent(new CustomEvent('roomritual:audio', { detail: 'lighting' }))
    }
    this.grid.visible = state.measurementsVisible && !this.mobileTier
    this.updateSelection(state.selectedItemId, state.collisionIds, state.measurementsVisible)
    this.updateMeasurements(state.selectedItemId, state.measurementsVisible, state.collisionIds.length > 0)

    const selectionChanged = state.selectedItemId !== this.lastSelectedItemId
    if (state.inspectMode && (!this.lastInspectMode || selectionChanged)) this.focusSelected()
    if (this.lastInspectMode && !state.inspectMode) this.setDefaultCamera(false)
    this.lastInspectMode = state.inspectMode
    this.lastSelectedItemId = state.selectedItemId
    this.animateDrawerDetail(state.inspectMode, state.selectedItemId)
    if (state.cameraResetKey !== this.lastCameraResetKey) {
      this.lastCameraResetKey = state.cameraResetKey
      this.setDefaultCamera(this.lastCameraResetKey < 1)
    }
  }

  private lastLightingPreset: LightingPreset | null = null

  private getSurfaceTexture(name: string, repeatX: number, repeatY: number) {
    const path = resolveMintMaterialPath(name)
    if (!path) return null
    const cacheKey = `${path}:${repeatX}:${repeatY}`
    let texture = this.surfaceTextures.get(cacheKey)
    if (!texture) {
      texture = this.textureLoader.load(path)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(repeatX, repeatY)
      texture.anisotropy = 4
      this.surfaceTextures.set(cacheKey, texture)
    }
    return texture
  }

  private syncItem(item: PlacedItem) {
    let object = this.itemObjects.get(item.id)
    if (!object || object.userData.finishId !== item.finishId || (this.mobileTier && object.userData.source === 'mint')) {
      if (object) {
        this.itemLayer.remove(object)
        disposeObject(object)
      }
      object = buildProductModel(item.productId, item.finishId)
      object.userData.instanceId = item.id
      object.traverse((child) => { child.userData.instanceId = item.id })
      this.itemObjects.set(item.id, object)
      this.itemLayer.add(object)
      this.applyQualityTier(object)
    }
    object.position.set(...item.position)
    object.rotation.y = item.rotation
    object.scale.setScalar(item.planningScale)
    if (!this.mobileTier) this.ensureMintItem(item)
  }

  private ensureMintItem(item: PlacedItem) {
    const current = this.itemObjects.get(item.id)
    if (current?.userData.source === 'mint' && current.userData.finishId === item.finishId) return
    const key = `${item.id}:${item.finishId}`
    if (this.mintItemLoads.has(key)) return
    const product = productById(item.productId)
    const finish = product?.finishes.find((candidate) => candidate.id === item.finishId)
    if (!product || !finish) return
    this.mintItemLoads.add(key)
    void loadMintProductModel(product, finish).then((mintObject) => {
      if (!mintObject || this.disposed || this.mobileTier) return
      const latest = useAppStore.getState().room.items.find((candidate) => candidate.id === item.id)
      if (!latest || latest.finishId !== item.finishId) return
      const previous = this.itemObjects.get(item.id)
      if (previous) {
        this.itemLayer.remove(previous)
        disposeObject(previous)
      }
      mintObject.userData.instanceId = item.id
      mintObject.traverse((child) => { child.userData.instanceId = item.id })
      mintObject.position.set(...latest.position)
      mintObject.rotation.y = latest.rotation
      mintObject.scale.setScalar(latest.planningScale)
      this.itemObjects.set(item.id, mintObject)
      this.itemLayer.add(mintObject)
      this.applyQualityTier(mintObject)
      this.lastMeasurementSignature = ''
      this.sync(useAppStore.getState())
    }).catch(() => undefined).finally(() => this.mintItemLoads.delete(key))
  }

  private ensureMintDecor(instanceId: string, decorId: string) {
    const current = this.decorObjects.get(instanceId)
    if (current?.userData.source === 'mint') return
    const key = `${instanceId}:${decorId}`
    if (this.mintDecorLoads.has(key)) return
    const decor = decorById(decorId)
    if (!decor) return
    this.mintDecorLoads.add(key)
    void loadMintDecorModel(decor).then((mintObject) => {
      if (!mintObject || this.disposed || this.mobileTier) return
      const latest = useAppStore.getState().room.decor.find((candidate) => candidate.id === instanceId)
      if (!latest) return
      const previous = this.decorObjects.get(instanceId)
      if (previous) {
        this.decorLayer.remove(previous)
        disposeObject(previous)
      }
      mintObject.userData.decorInstanceId = instanceId
      mintObject.traverse((child) => { child.userData.decorInstanceId = instanceId })
      mintObject.position.set(...latest.position)
      mintObject.rotation.y = latest.rotation
      mintObject.scale.setScalar(latest.scale)
      this.decorObjects.set(instanceId, mintObject)
      this.decorLayer.add(mintObject)
      this.applyQualityTier(mintObject)
    }).catch(() => undefined).finally(() => this.mintDecorLoads.delete(key))
  }

  private updateSelection(selectedId: string | null, collisionIds: string[], measurementsVisible: boolean) {
    const object = selectedId ? this.itemObjects.get(selectedId) : undefined
    const item = selectedId ? useAppStore.getState().room.items.find((candidate) => candidate.id === selectedId) : undefined
    const product = item ? productById(item.productId) : undefined
    this.selectionHelper.visible = Boolean(object)
    this.footprintMesh.visible = Boolean(item && product && measurementsVisible)
    if (!object || !item || !product) return
    this.selectionBox.setFromObject(object)
    const hasCollision = collisionIds.length > 0
    const selectionMaterial = this.selectionHelper.material as THREE.LineBasicMaterial
    selectionMaterial.color.set(hasCollision ? '#d43d25' : '#1738ff')
    const footprintMaterial = this.footprintMesh.material as THREE.MeshBasicMaterial
    footprintMaterial.color.set(hasCollision ? '#d43d25' : '#1738ff')
    footprintMaterial.opacity = hasCollision ? 0.24 : 0.12
    this.footprintMesh.position.set(item.position[0], 0.018, item.position[2])
    this.footprintMesh.rotation.z = -item.rotation
    this.footprintMesh.scale.set(product.dimensions.width * item.planningScale, product.dimensions.depth * item.planningScale, 1)
  }

  private clearMeasurements() {
    for (const child of [...this.measurementLayer.children]) {
      if (child === this.grid || child === this.selectionHelper || child === this.footprintMesh) continue
      this.measurementLayer.remove(child)
      disposeObject(child)
    }
    this.measurementLabels.forEach((label) => label.element.remove())
    this.measurementLabels = []
  }

  private addMeasureLine(from: THREE.Vector3, to: THREE.Vector3, label: string, danger = false) {
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to])
    const material = new THREE.LineBasicMaterial({ color: danger ? '#d43d25' : '#1738b8', transparent: true, opacity: 0.9, depthTest: false })
    const line = new THREE.Line(geometry, material)
    line.renderOrder = 9
    this.measurementLayer.add(line)
    const element = document.createElement('div')
    element.className = `measurement-label${danger ? ' is-danger' : ''}`
    element.textContent = label
    this.overlay.appendChild(element)
    this.measurementLabels.push({ element, point: from.clone().lerp(to, 0.5) })
  }

  private updateMeasurements(selectedId: string | null, visible: boolean, danger: boolean) {
    const selected = selectedId ? useAppStore.getState().room.items.find((candidate) => candidate.id === selectedId) : undefined
    const signature = JSON.stringify([
      visible,
      danger,
      selected?.id,
      selected?.position,
      selected?.rotation,
      selected?.planningScale,
    ])
    if (signature === this.lastMeasurementSignature) return
    this.lastMeasurementSignature = signature
    this.clearMeasurements()
    if (!visible) return
    this.addMeasureLine(new THREE.Vector3(-ROOM_WIDTH / 2, 0.035, ROOM_DEPTH / 2 + 0.08), new THREE.Vector3(ROOM_WIDTH / 2, 0.035, ROOM_DEPTH / 2 + 0.08), `${ROOM_WIDTH.toFixed(1)} m room`)
    this.addMeasureLine(new THREE.Vector3(ROOM_WIDTH / 2 + 0.08, 0.035, -ROOM_DEPTH / 2), new THREE.Vector3(ROOM_WIDTH / 2 + 0.08, 0.035, ROOM_DEPTH / 2), `${ROOM_DEPTH.toFixed(1)} m`)
    const item = selectedId ? useAppStore.getState().room.items.find((candidate) => candidate.id === selectedId) : undefined
    const product = item ? productById(item.productId) : undefined
    if (!item || !product) return
    const w = product.dimensions.width * item.planningScale
    const d = product.dimensions.depth * item.planningScale
    const center = new THREE.Vector3(item.position[0], 0.045, item.position[2])
    const right = new THREE.Vector3(Math.cos(item.rotation), 0, -Math.sin(item.rotation))
    const forward = new THREE.Vector3(Math.sin(item.rotation), 0, Math.cos(item.rotation))
    const widthA = center.clone().addScaledVector(right, -w / 2).addScaledVector(forward, d / 2 + 0.08)
    const widthB = center.clone().addScaledVector(right, w / 2).addScaledVector(forward, d / 2 + 0.08)
    const depthA = center.clone().addScaledVector(forward, -d / 2).addScaledVector(right, w / 2 + 0.08)
    const depthB = center.clone().addScaledVector(forward, d / 2).addScaledVector(right, w / 2 + 0.08)
    this.addMeasureLine(widthA, widthB, `${Math.round(w * 100)} cm`, danger)
    this.addMeasureLine(depthA, depthB, `${Math.round(d * 100)} cm`, danger)
    const nearestWall = Math.min(
      ROOM_WIDTH / 2 - Math.abs(item.position[0]) - w / 2,
      ROOM_DEPTH / 2 - Math.abs(item.position[2]) - d / 2,
    )
    const wallTarget = center.clone().add(new THREE.Vector3(0, 0, item.position[2] < 0 ? -d / 2 - Math.max(0, nearestWall) : d / 2 + Math.max(0, nearestWall)))
    const itemEdge = center.clone().add(new THREE.Vector3(0, 0, item.position[2] < 0 ? -d / 2 : d / 2))
    this.addMeasureLine(itemEdge, wallTarget, `${Math.max(0, Math.round(nearestWall * 100))} cm clear`, danger)
  }

  private animateDrawerDetail(inspectMode: boolean, selectedId: string | null) {
    for (const [id, object] of this.itemObjects) {
      const drawer = object.getObjectByName('detailDrawer')
      if (!drawer) continue
      const selected = id === selectedId && inspectMode
      const closedZ = typeof drawer.userData.closedZ === 'number' ? drawer.userData.closedZ : 0.02
      const targetZ = selected ? closedZ + 0.27 : closedZ
      drawer.position.z = this.reducedMotion ? targetZ : THREE.MathUtils.lerp(drawer.position.z, targetZ, 0.12)
    }
  }

  private focusSelected() {
    const id = useAppStore.getState().selectedItemId
    const object = id ? this.itemObjects.get(id) : undefined
    if (!object) return
    const box = new THREE.Box3().setFromObject(object)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const radius = Math.max(size.x, size.y, size.z)
    const goal = center.clone().add(new THREE.Vector3(radius * 1.55, radius * 1.05, radius * 1.9))
    this.setCameraGoal(goal, center)
    if (object.userData.productId === 'pilaster-credenza') window.dispatchEvent(new CustomEvent('roomritual:audio', { detail: 'drawer' }))
  }

  private setDefaultCamera(immediate: boolean) {
    const position = new THREE.Vector3(7.25, 6.2, 7.8)
    const target = new THREE.Vector3(0, 0.55, 0)
    if (immediate || this.reducedMotion) {
      this.camera.position.copy(position)
      this.controls.target.copy(target)
      this.cameraGoal = null
      this.targetGoal = null
      this.controls.update()
    } else this.setCameraGoal(position, target)
  }

  private setCameraGoal(position: THREE.Vector3, target: THREE.Vector3) {
    if (this.reducedMotion) {
      this.camera.position.copy(position)
      this.controls.target.copy(target)
      return
    }
    this.cameraGoal = position
    this.targetGoal = target
  }

  private resize() {
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    const mobileTier = width < 700
    this.mobileTier = mobileTier
    this.renderer.shadowMap.enabled = !mobileTier
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobileTier ? 1.5 : 1.75))
    this.applyQualityTier(this.roomLayer)
    this.itemObjects.forEach((object) => this.applyQualityTier(object))
    this.decorObjects.forEach((object) => this.applyQualityTier(object))
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    if (this.itemObjects.size) this.sync(useAppStore.getState())
  }

  private applyQualityTier(root: THREE.Object3D) {
    root.traverse((object) => {
      if (object.userData.mobileOptional) object.visible = !this.mobileTier
    })
  }

  private positionMeasurementLabels() {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    for (const label of this.measurementLabels) {
      const point = label.point.clone().project(this.camera)
      const visible = point.z > -1 && point.z < 1
      label.element.style.display = visible ? 'block' : 'none'
      label.element.style.transform = `translate(-50%, -50%) translate(${(point.x * 0.5 + 0.5) * width}px, ${(-point.y * 0.5 + 0.5) * height}px)`
    }
  }

  private animate = () => {
    if (this.disposed) return
    this.animationFrame = requestAnimationFrame(this.animate)
    const now = performance.now()
    const delta = Math.min((now - this.lastFrameTime) / 1000, 0.04)
    this.lastFrameTime = now
    if (this.cameraGoal && this.targetGoal) {
      const alpha = 1 - Math.pow(0.0005, delta)
      this.camera.position.lerp(this.cameraGoal, alpha)
      this.controls.target.lerp(this.targetGoal, alpha)
      if (this.camera.position.distanceTo(this.cameraGoal) < 0.015 && this.controls.target.distanceTo(this.targetGoal) < 0.01) {
        this.camera.position.copy(this.cameraGoal)
        this.controls.target.copy(this.targetGoal)
        this.cameraGoal = null
        this.targetGoal = null
      }
    }
    this.animateDrawerDetail(useAppStore.getState().inspectMode, useAppStore.getState().selectedItemId)
    this.controls.update()
    this.positionMeasurementLabels()
    this.renderer.render(this.scene, this.camera)
  }

  captureThumbnail() {
    this.renderer.render(this.scene, this.camera)
    try { return this.canvas.toDataURL('image/jpeg', 0.74) } catch { return undefined }
  }

  diagnostics() {
    const info = this.renderer.info
    return {
      calls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      dpr: this.renderer.getPixelRatio(),
      productCount: products.length,
      mintModels: [...this.itemObjects.values()].filter((object) => object.userData.source === 'mint').length,
      mintDecor: [...this.decorObjects.values()].filter((object) => object.userData.source === 'mint').length,
    }
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.animationFrame)
    this.unsubscribe?.()
    this.resizeObserver.disconnect()
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel)
    this.canvas.removeEventListener('lostpointercapture', this.onPointerCancel)
    this.canvas.removeEventListener('dragover', this.onDragOver)
    this.canvas.removeEventListener('drop', this.onDrop)
    window.removeEventListener('blur', this.onWindowBlur)
    this.controls.dispose()
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach((material) => material.dispose())
      }
    })
    this.renderer.dispose()
    this.surfaceTextures.forEach((texture) => texture.dispose())
    this.canvas.remove()
    this.overlay.remove()
  }
}
