import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import mintAssets from '../../mint-assets.json' with { type: 'json' }
import { enuToScene, SF_ATLAS_ANCHOR, wgs84ToEnu } from '../shared/geo.js'
import type {
  DirectoryManifest,
  AtlasFacility,
  NeighborhoodGeometry,
} from '../shared/types.js'

const CITY_CAMERA_POSITION = new THREE.Vector3(-6_700, 9_400, 11_800)
const CITY_CAMERA_TARGET = new THREE.Vector3(0, 0, 350)
const MARKER_GROUND_OFFSET_METERS = 22

const COLORS = {
  reservable: new THREE.Color('#dfff52'),
  'walk-up-only': new THREE.Color('#7fcfff'),
}

type DiagnosticsWindow = Window & {
  __SF_TENNIS_ATLAS_RENDER_INFO__?: () => Record<string, number | boolean | string>
  __SF_TENNIS_ATLAS_FACILITY_MARKERS__?: () => Array<{
    id: string
    iconIndex: number
    latitude: number
    longitude: number
    x: number
    y: number
    visible: boolean
  }>
  __THREE_APP_TEST_HOOKS__?: {
    setState?: (state: string) => void
  }
}

function project(longitude: number, latitude: number) {
  const local = wgs84ToEnu(
    { longitude, latitude, elevation: 0 },
    SF_ATLAS_ANCHOR,
  )
  const scene = enuToScene(local)
  return new THREE.Vector3(scene.x, scene.y, scene.z)
}

function courtOverlayHeight(_position: THREE.Vector3) {
  return MARKER_GROUND_OFFSET_METERS
}

export class CourtScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(38, 1, 5, 50_000)
  private controls: OrbitControls
  private cityLayer = new THREE.Group()
  private courtMesh: THREE.InstancedMesh | null = null
  private facilityIconMesh: THREE.InstancedMesh | null = null
  private facilityIconPickMesh: THREE.InstancedMesh | null = null
  private haloMesh: THREE.InstancedMesh | null = null
  private statusMeshes: THREE.InstancedMesh[] = []
  private facilities: AtlasFacility[] = []
  private visibleIds = new Set<string>()
  private selectedId: string | null = null
  private target = CITY_CAMERA_TARGET.clone()
  private targetCamera = CITY_CAMERA_POSITION.clone()
  private moving = false
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private selectHandler: (facilityId: string) => void = () => undefined
  private selectionLight = new THREE.PointLight('#dfff52', 0, 1_500, 1.5)
  private mintLoader: Promise<GLTFLoader> | null = null
  private mintSelection = new THREE.Group()
  private mintModelsLayer = new THREE.Group()
  private mintModelPathById = new Map<string, string>()
  private mintModelTemplates = new Map<string, Promise<THREE.Group>>()
  private mintModelInstances = new Map<string, THREE.Group>()
  private mintModelInstancePromises = new Map<string, Promise<THREE.Group>>()
  private mintLoadedModelIds = new Set<string>()
  private mintLoadVersion = 0
  private iconIndexById = new Map<string, number>()
  private frame = 0
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private compactPresentation = window.matchMedia('(max-width: 820px)').matches
  private renderFramesRemaining = 8
  private lastRenderTime = 0

  constructor(
    private canvas: HTMLCanvasElement,
    private directory: DirectoryManifest,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(this.getTargetPixelRatio())
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.NeutralToneMapping
    this.renderer.toneMappingExposure = 1
    this.camera.position.copy(this.targetCamera)
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.075
    this.controls.minDistance = 240
    this.controls.maxDistance = 28_000
    this.controls.maxPolarAngle = Math.PI * 0.49
    this.controls.target.copy(this.target)
    this.controls.addEventListener('change', this.onControlsChange)
    this.controls.update()

    this.buildWorld(directory.neighborhoods)
    this.iconIndexById = new Map(directory.facilities.map((facility, index) => [facility.id, index]))
    this.mintSelection.name = 'Selected canonical Mint facility model'
    this.mintModelsLayer.name = '64 centered-court Mint asset-pack facility models'
    this.scene.add(this.selectionLight, this.mintSelection, this.mintModelsLayer)
    this.canvas.dataset.mintAssets = 'loading-models'
    this.canvas.dataset.facilityIcons = 'procedural-until-mint-glb'
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('resize', this.resize)
    this.resize()
    this.animate()
    this.installDiagnostics()
  }

  onSelect(handler: (facilityId: string) => void) {
    this.selectHandler = handler
  }

  private installDiagnostics() {
    ;(window as DiagnosticsWindow).__SF_TENNIS_ATLAS_RENDER_INFO__ = () => {
      const materials = new Set<THREE.Material>()
      let meshes = 0
      let instancedMeshes = 0
      let instances = 0
      this.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        meshes += 1
        const objectMaterials = Array.isArray(object.material)
          ? object.material
          : [object.material]
        objectMaterials.forEach((material) => materials.add(material))
        if (object instanceof THREE.InstancedMesh) {
          instancedMeshes += 1
          instances += object.count
        }
      })
      return {
        calls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
        geometries: this.renderer.info.memory.geometries,
        textures: this.renderer.info.memory.textures,
        materials: materials.size,
        meshes,
        instancedMeshes,
        instances,
        pixelRatio: this.renderer.getPixelRatio(),
        cameraPosition: this.camera.position.toArray().map((value) => value.toFixed(1)).join(','),
        cameraTarget: this.controls.target.toArray().map((value) => value.toFixed(1)).join(','),
        shadows: this.renderer.shadowMap.enabled,
        postPasses: 0,
        citywideLayerVisible: this.cityLayer.visible,
        generatedReliefVisible: false,
        gridVisible: false,
        selectedCourtArtifacts: this.selectedId && this.mintModelInstances.has(this.selectedId) ? 1 : 0,
        mintFacilityModelsAvailable: this.mintModelPathById.size,
        mintFacilityModelsLoaded: this.mintLoadedModelIds.size,
        mintFacilityModelsInScene: this.mintModelInstances.size,
        mintFacilityModelsVisible: [...this.mintModelInstances.values()].filter(
          (model) => model.visible,
        ).length,
        billboardIconsVisible: Boolean(this.facilityIconMesh?.visible),
        selectedCourtOnly: true,
      }
    }
    ;(window as DiagnosticsWindow).__SF_TENNIS_ATLAS_FACILITY_MARKERS__ = () =>
      this.facilities.map((facility) => {
        const position = project(facility.longitude, facility.latitude)
        position.y =
          courtOverlayHeight(position) + (facility.id === this.selectedId ? 110 : 70)
        const screen = position.project(this.camera)
        return {
          id: facility.id,
          iconIndex: this.iconIndexById.get(facility.id) ?? -1,
          latitude: facility.latitude,
          longitude: facility.longitude,
          x: ((screen.x + 1) * this.canvas.clientWidth) / 2,
          y: ((1 - screen.y) * this.canvas.clientHeight) / 2,
          visible: this.visibleIds.has(facility.id),
        }
      })
    ;(window as DiagnosticsWindow).__THREE_APP_TEST_HOOKS__ = {
      setState: (state) => {
        if (state === 'citywide') this.resetCamera()
      },
    }
  }

  setFacilities(facilities: AtlasFacility[]) {
    this.facilities = facilities
    this.visibleIds = new Set(facilities.map((facility) => facility.id))
    const missingIcons = facilities.filter((facility) => !this.iconIndexById.has(facility.id))
    if (missingIcons.length) {
      this.canvas.dataset.facilityIcons = 'error'
      console.error(
        `Facility icon manifest is missing: ${missingIcons.map((facility) => facility.id).join(', ')}`,
      )
    }
    this.rebuildCourtInstances()
    if (this.mintModelPathById.size === 0) void this.loadMintFacilityRegistry()
  }

  setVisible(ids: Set<string>) {
    this.visibleIds = ids
    this.updateMintModelTransforms()
    this.updateInstances()
  }

  select(facilityId: string | null, moveCamera = true) {
    this.cityLayer.visible = true
    this.cityLayer.position.y = 0
    this.camera.fov = 38
    this.camera.updateProjectionMatrix()
    this.selectedId = facilityId
    const facility = this.facilities.find((item) => item.id === facilityId)
    if (facility) {
      const position = project(facility.longitude, facility.latitude)
      const overlayY = courtOverlayHeight(position)
      if (moveCamera) {
        this.target.set(position.x, overlayY, position.z)
        this.targetCamera.set(position.x + 820, overlayY + 920, position.z + 1_080)
        this.moving = !this.reducedMotion
        if (!this.moving) {
          this.camera.position.copy(this.targetCamera)
          this.controls.target.copy(this.target)
        }
      }
      this.selectionLight.position.set(position.x, overlayY + 90, position.z)
      this.selectionLight.color.copy(COLORS[facility.accessStatus])
      this.selectionLight.intensity = facility.accessStatus === 'reservable' ? 8 : 4
    } else {
      this.selectionLight.intensity = 0
    }
    this.updateMintModelTransforms()
    void this.updateMintSelection()
    this.updateInstances()
  }

  resetCamera() {
    this.cityLayer.visible = true
    this.cityLayer.position.y = 0
    this.camera.fov = 38
    this.camera.updateProjectionMatrix()
    this.target.copy(CITY_CAMERA_TARGET)
    this.targetCamera.copy(CITY_CAMERA_POSITION)
    this.moving = !this.reducedMotion
  }

  private buildWorld(neighborhoods: NeighborhoodGeometry[]) {
    this.canvas.dataset.grid = 'removed'
    this.canvas.dataset.citywideLayer = 'official-neighborhood-geometry'
    this.scene.background = new THREE.Color('#eaf6fb')
    this.scene.fog = new THREE.FogExp2('#eaf6fb', 0.000035)
    this.cityLayer.name = 'Citywide ENU vector ground — official SF neighborhood geometry'
    const fillMaterial = new THREE.MeshPhysicalMaterial({
      color: '#d9eef5',
      roughness: 0.58,
      metalness: 0.02,
      transmission: 0.04,
      transparent: true,
      opacity: 0.84,
      side: THREE.DoubleSide,
    })
    const lineMaterial = new THREE.LineBasicMaterial({
      color: '#9ec5d5',
      transparent: true,
      opacity: 0.55,
    })
    const fillGeometries: THREE.BufferGeometry[] = []
    const boundaryVertices: number[] = []
    neighborhoods.forEach((neighborhood) => {
      neighborhood.polygons.forEach((polygon) => {
        const rings = polygon.map((ring) =>
          ring.map(([longitude, latitude]) => {
            const position = project(longitude!, latitude!)
            return new THREE.Vector2(position.x, -position.z)
          }),
        )
        const outer = rings[0]
        if (!outer || outer.length < 3) return
        const shape = new THREE.Shape(outer)
        rings.slice(1).forEach((hole) => {
          if (hole.length >= 3) shape.holes.push(new THREE.Path(hole))
        })
        const geometry = new THREE.ShapeGeometry(shape)
        geometry.rotateX(-Math.PI / 2)
        geometry.translate(0, -4, 0)
        fillGeometries.push(geometry)
        rings.forEach((ring) => {
          for (let index = 0; index < ring.length; index += 1) {
            const current = ring[index]
            const next = ring[(index + 1) % ring.length]
            if (!current || !next) continue
            boundaryVertices.push(
              current.x,
              1,
              -current.y,
              next.x,
              1,
              -next.y,
            )
          }
        })
      })
    })
    const mergedGround = mergeGeometries(fillGeometries, false)
    if (!mergedGround) throw new Error('Official city geometry could not be merged')
    fillGeometries.forEach((geometry) => geometry.dispose())
    const ground = new THREE.Mesh(mergedGround, fillMaterial)
    ground.name = 'Merged official SF neighborhood ground'
    this.cityLayer.add(ground)
    const boundaryGeometry = new THREE.BufferGeometry()
    boundaryGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(boundaryVertices, 3),
    )
    const boundaries = new THREE.LineSegments(boundaryGeometry, lineMaterial)
    boundaries.name = 'Merged official SF neighborhood boundaries'
    this.cityLayer.add(boundaries)
    this.scene.add(this.cityLayer)
    const ambient = new THREE.HemisphereLight('#ffffff', '#7f9ba7', 1.05)
    const sun = new THREE.DirectionalLight('#fffdf4', 1.45)
    sun.position.set(-6_000, 12_000, 8_000)
    this.scene.add(ambient, sun)
  }

  private async loadMintFacilityRegistry() {
    try {
      const registryItems = Object.values(mintAssets.assets).flatMap((asset) =>
        Object.entries(asset.artifacts).map(([id, artifact]) => ({
          id,
          modelPath: artifact.runtimeUrl,
        })),
      )
      const expectedIds = new Set(this.directory.facilities.map((facility) => facility.id))
      const actualIds = new Set(registryItems.map((item) => item.id))
      const missing = [...expectedIds].filter((id) => !actualIds.has(id))
      const unexpected = [...actualIds].filter((id) => !expectedIds.has(id))
      if (
        registryItems.length !== this.directory.facilities.length ||
        missing.length ||
        unexpected.length
      ) {
        throw new Error(
          `Mint facility registry does not reconcile (missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'})`,
        )
      }
      this.mintModelPathById = new Map(
        registryItems.map((item) => [item.id, item.modelPath]),
      )
      this.canvas.dataset.mintAssetRegistry = 'mint-assets.json'
      this.canvas.dataset.mintAssets = 'loading-models'
      await this.loadAllMintFacilityModels()
      this.canvas.dataset.mintAssets = 'ready'
      await this.updateMintSelection()
      this.canvas.dispatchEvent(new CustomEvent('mintfacilitymodelsready'))
    } catch (error) {
      this.canvas.dataset.mintAssets = 'error'
      console.error('Mint facility registry import failed', error)
    }
  }

  private loadMintTemplate(facilityId: string, modelPath: string) {
    const existing = this.mintModelTemplates.get(facilityId)
    if (existing) return existing
    const loader = (this.mintLoader ??= import(
      'three/examples/jsm/loaders/GLTFLoader.js'
    ).then(({ GLTFLoader }) => new GLTFLoader()))
    const pending = loader.then((gltfLoader) => gltfLoader.loadAsync(modelPath)).then((gltf) => {
      const source = gltf.scene
      source.updateMatrixWorld(true)
      const bounds = new THREE.Box3().setFromObject(source)
      const size = bounds.getSize(new THREE.Vector3())
      const center = bounds.getCenter(new THREE.Vector3())
      const longestEdge = Math.max(size.x, size.y, size.z)
      if (!Number.isFinite(longestEdge) || longestEdge <= 0) {
        throw new Error(`${facilityId} Mint model has empty or invalid bounds`)
      }
      source.position.set(-center.x, -bounds.min.y, -center.z)
      const normalized = new THREE.Group()
      normalized.name = `Mint facility template: ${facilityId}`
      normalized.userData.mintRole = 'facility_icon'
      normalized.add(source)
      normalized.scale.setScalar(1 / longestEdge)
      source.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = false
          object.receiveShadow = false
        }
      })
      this.mintLoadedModelIds.add(facilityId)
      return normalized
    })
    this.mintModelTemplates.set(facilityId, pending)
    return pending
  }

  private ensureMintFacilityModel(facility: AtlasFacility) {
    const existing = this.mintModelInstances.get(facility.id)
    if (existing) return Promise.resolve(existing)
    const pending = this.mintModelInstancePromises.get(facility.id)
    if (pending) return pending
    const modelPath = this.mintModelPathById.get(facility.id)
    if (!modelPath) return Promise.reject(new Error(`No Mint GLB path for ${facility.id}`))
    const instancePromise = this.loadMintTemplate(facility.id, modelPath).then((template) => {
      const alreadyMounted = this.mintModelInstances.get(facility.id)
      if (alreadyMounted) return alreadyMounted
      const model = template.clone(true)
      model.name = `Mint GLB facility model: ${facility.id}`
      model.userData.mintRole = 'facility_icon'
      model.userData.facilityId = facility.id
      model.userData.normalizedScale = model.scale.x
      this.mintModelInstances.set(facility.id, model)
      this.mintModelsLayer.add(model)
      this.updateMintModelTransforms()
      this.canvas.dataset.mintModelCount = `${this.mintModelInstances.size}`
      this.requestRender(4)
      return model
    })
    this.mintModelInstancePromises.set(facility.id, instancePromise)
    return instancePromise
  }

  private async loadAllMintFacilityModels() {
    let cursor = 0
    // Pack-authored icons are a little larger than the prior standalone GLBs.
    // A bounded 12-way pool keeps the 64-model citywide view responsive without
    // issuing an unbounded burst or changing canonical mount order.
    const workers = Array.from({ length: 12 }, async () => {
      while (cursor < this.facilities.length) {
        const facility = this.facilities[cursor]
        cursor += 1
        if (facility) await this.ensureMintFacilityModel(facility)
      }
    })
    await Promise.all(workers)
    if (this.mintModelInstances.size !== this.facilities.length) {
      throw new Error(
        `Mounted ${this.mintModelInstances.size}/${this.facilities.length} Mint GLB models`,
      )
    }
    this.updateMintModelTransforms()
  }

  private updateMintModelTransforms() {
    this.facilities.forEach((facility, index) => {
      const model = this.mintModelInstances.get(facility.id)
      if (!model) return
      const position = project(facility.longitude, facility.latitude)
      const selected = facility.id === this.selectedId
      const normalizedScale = Number(model.userData.normalizedScale) || 1
      const presentationScale = selected
        ? this.compactPresentation
          ? 150
          : 185
        : this.compactPresentation
          ? 78
          : 108
      model.position.set(position.x, courtOverlayHeight(position) + 8, position.z)
      model.scale.setScalar(normalizedScale * presentationScale)
      model.rotation.y = Math.PI * (0.16 + (index % 5) * 0.035)
      model.visible = this.visibleIds.has(facility.id)
    })
  }

  private async updateMintSelection() {
    const version = ++this.mintLoadVersion
    const facility = this.facilities.find((item) => item.id === this.selectedId)
    const modelPath = facility ? this.mintModelPathById.get(facility.id) : undefined
    if (!facility || !modelPath) {
      this.canvas.dataset.mintSelected = 'unavailable'
      this.updateInstances()
      this.requestRender()
      return
    }
    this.canvas.dataset.mintSelected = 'loading'
    try {
      await this.ensureMintFacilityModel(facility)
      if (version !== this.mintLoadVersion || facility.id !== this.selectedId) return
      this.canvas.dataset.mintSelected = facility.id
      this.updateMintModelTransforms()
      this.updateInstances()
      this.requestRender(5)
    } catch (error) {
      if (version !== this.mintLoadVersion) return
      this.canvas.dataset.mintSelected = 'error'
      this.updateInstances()
      console.error(`Mint model import failed for ${facility.id}`, error)
    }
  }

  private rebuildCourtInstances() {
    this.courtMesh?.removeFromParent()
    this.facilityIconMesh?.removeFromParent()
    this.haloMesh?.removeFromParent()
    this.statusMeshes.forEach((mesh) => {
      mesh.removeFromParent()
      mesh.geometry.dispose()
      if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose())
      else mesh.material.dispose()
    })
    this.statusMeshes = []
    this.courtMesh?.geometry.dispose()
    this.facilityIconMesh?.geometry.dispose()
    this.facilityIconPickMesh?.geometry.dispose()
    if (this.facilityIconPickMesh) {
      if (Array.isArray(this.facilityIconPickMesh.material)) {
        this.facilityIconPickMesh.material.forEach((material) => material.dispose())
      } else this.facilityIconPickMesh.material.dispose()
    }
    this.haloMesh?.geometry.dispose()
    if (this.courtMesh) {
      if (Array.isArray(this.courtMesh.material)) {
        this.courtMesh.material.forEach((material) => material.dispose())
      } else this.courtMesh.material.dispose()
    }
    if (this.haloMesh) {
      if (Array.isArray(this.haloMesh.material)) {
        this.haloMesh.material.forEach((material) => material.dispose())
      } else this.haloMesh.material.dispose()
    }
    if (this.facilityIconMesh) {
      if (Array.isArray(this.facilityIconMesh.material)) {
        this.facilityIconMesh.material.forEach((material) => material.dispose())
      } else this.facilityIconMesh.material.dispose()
    }
    this.facilityIconMesh = null
    this.facilityIconPickMesh = null

    const courtGeometry = new THREE.BoxGeometry(82, 7, 44)
    const courtMaterial = new THREE.MeshBasicMaterial({
      color: '#dff5fd',
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    })
    courtMaterial.toneMapped = false
    this.courtMesh = new THREE.InstancedMesh(
      courtGeometry,
      courtMaterial,
      this.facilities.length,
    )
    this.courtMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.courtMesh.userData.interactive = true
    this.scene.add(this.courtMesh)

    // This proxy is intentionally not rendered; it keeps each mounted GLB easy to
    // select while preserving stable canonical facility instance IDs.
    this.facilityIconPickMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshBasicMaterial(),
      this.facilities.length,
    )
    this.facilityIconPickMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.facilityIconPickMesh.name = 'Mint GLB facility selection proxies'

    const haloGeometry = new THREE.RingGeometry(48, 63, 24)
    haloGeometry.rotateX(-Math.PI / 2)
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: '#aacbd8',
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    haloMaterial.toneMapped = false
    this.haloMesh = new THREE.InstancedMesh(
      haloGeometry,
      haloMaterial,
      this.facilities.length,
    )
    this.haloMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.scene.add(this.haloMesh)

    Object.entries(COLORS).forEach(([status, color]) => {
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
      })
      material.toneMapped = false
      const mesh = new THREE.InstancedMesh(
        new THREE.SphereGeometry(12, 12, 8),
        material,
        this.facilities.length,
      )
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.userData.status = status
      this.statusMeshes.push(mesh)
      this.scene.add(mesh)
    })
    this.updateInstances()
    this.requestRender()
  }

  private updateInstances() {
    if (!this.courtMesh || !this.haloMesh) return
    const transform = new THREE.Object3D()
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0)
    this.facilities.forEach((facility, index) => {
      const visible = this.visibleIds.has(facility.id)
      const selected = this.selectedId === facility.id
      if (!visible) {
        this.courtMesh!.setMatrixAt(index, hidden)
        this.facilityIconMesh?.setMatrixAt(index, hidden)
        this.facilityIconPickMesh?.setMatrixAt(index, hidden)
        this.haloMesh!.setMatrixAt(index, hidden)
        this.statusMeshes.forEach((mesh) => mesh.setMatrixAt(index, hidden))
        return
      }
      const position = project(facility.longitude, facility.latitude)
      const overlayY = courtOverlayHeight(position)
      transform.position.set(position.x, overlayY + (selected ? 10 : 5), position.z)
      transform.rotation.set(0, Math.PI * 0.25, 0)
      transform.scale.setScalar(selected ? 1.65 : 1)
      transform.updateMatrix()
      this.courtMesh!.setMatrixAt(index, transform.matrix)

      if (this.facilityIconMesh) {
        const mintModelVisible =
          selected && this.canvas.dataset.mintSelected === facility.id
        const iconScale = selected
          ? this.compactPresentation
            ? 185
            : 215
          : this.compactPresentation
            ? 108
            : 126
        transform.position.set(
          position.x,
          overlayY + (selected ? 230 : 150),
          position.z,
        )
        transform.rotation.set(0, 0, 0)
        transform.scale.setScalar(iconScale)
        transform.updateMatrix()
        this.facilityIconMesh.setMatrixAt(
          index,
          mintModelVisible ? hidden : transform.matrix,
        )

        if (this.facilityIconPickMesh) {
          transform.scale.setScalar(iconScale * 0.58)
          transform.updateMatrix()
          this.facilityIconPickMesh.setMatrixAt(index, transform.matrix)
        }
      }

      if (this.facilityIconPickMesh) {
        transform.position.set(
          position.x,
          overlayY + (selected ? 110 : 70),
          position.z,
        )
        transform.rotation.set(0, 0, 0)
        transform.scale.setScalar(selected ? 125 : 82)
        transform.updateMatrix()
        this.facilityIconPickMesh.setMatrixAt(index, transform.matrix)
      }

      transform.position.y = overlayY + 2
      transform.rotation.set(0, 0, 0)
      transform.scale.setScalar(selected ? 1.55 : facility.accessStatus === 'reservable' ? 0.75 : 0.42)
      transform.updateMatrix()
      this.haloMesh!.setMatrixAt(index, transform.matrix)

      this.statusMeshes.forEach((mesh) => {
        if (mesh.userData.status !== facility.accessStatus) {
          mesh.setMatrixAt(index, hidden)
          return
        }
        transform.position.set(
          position.x,
          overlayY + (selected ? 270 : 190),
          position.z,
        )
        transform.rotation.set(0, 0, 0)
        transform.scale.setScalar(
          selected ? 1.75 : facility.accessStatus === 'reservable' ? 1.35 : 0.92,
        )
        transform.updateMatrix()
        mesh.setMatrixAt(index, transform.matrix)
      })
    })
    this.courtMesh.instanceMatrix.needsUpdate = true
    if (this.facilityIconMesh) this.facilityIconMesh.instanceMatrix.needsUpdate = true
    if (this.facilityIconPickMesh) {
      this.facilityIconPickMesh.instanceMatrix.needsUpdate = true
      this.facilityIconPickMesh.updateMatrixWorld(true)
    }
    this.haloMesh.instanceMatrix.needsUpdate = true
    this.statusMeshes.forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true
    })
    this.requestRender()
  }

  private onPointerUp = (event: PointerEvent) => {
    if (!this.courtMesh) return
    const bounds = this.canvas.getBoundingClientRect()
    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hit = this.facilityIconPickMesh
      ? this.raycaster.intersectObject(this.facilityIconPickMesh, false)[0] ??
        this.raycaster.intersectObject(this.courtMesh, false)[0]
      : this.raycaster.intersectObject(this.courtMesh, false)[0]
    const facility = hit?.instanceId === undefined ? undefined : this.facilities[hit.instanceId]
    if (facility && this.visibleIds.has(facility.id)) this.selectHandler(facility.id)
  }

  private resize = () => {
    const { clientWidth, clientHeight } = this.canvas
    if (!clientWidth || !clientHeight) return
    const compactPresentation = window.matchMedia('(max-width: 820px)').matches
    if (compactPresentation !== this.compactPresentation) {
      this.compactPresentation = compactPresentation
      void this.updateMintSelection()
      this.updateMintModelTransforms()
      this.updateInstances()
    }
    const pixelRatio = this.getTargetPixelRatio()
    if (this.renderer.getPixelRatio() !== pixelRatio) this.renderer.setPixelRatio(pixelRatio)
    this.camera.aspect = clientWidth / clientHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(clientWidth, clientHeight, false)
    this.requestRender(5)
  }

  private getTargetPixelRatio() {
    const cap = window.matchMedia('(max-width: 820px)').matches ? 1.35 : 1.75
    return Math.min(window.devicePixelRatio, cap)
  }

  private requestRender(frames = 3) {
    this.renderFramesRemaining = Math.max(this.renderFramesRemaining, frames)
  }

  private onControlsChange = () => {
    this.requestRender(3)
  }

  private animate = (time = 0) => {
    this.frame = requestAnimationFrame(this.animate)
    if (this.moving) {
      this.camera.position.lerp(this.targetCamera, 0.065)
      this.controls.target.lerp(this.target, 0.08)
      this.requestRender(3)
      if (
        this.camera.position.distanceTo(this.targetCamera) < 0.08 &&
        this.controls.target.distanceTo(this.target) < 0.05
      ) {
        this.moving = false
      }
    }
    this.controls.update()
    if (this.renderFramesRemaining > 0 && time - this.lastRenderTime >= 1000 / 30) {
      this.renderer.render(this.scene, this.camera)
      this.lastRenderTime = time
      this.renderFramesRemaining -= 1
    }
  }

  destroy() {
    cancelAnimationFrame(this.frame)
    window.removeEventListener('resize', this.resize)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.controls.removeEventListener('change', this.onControlsChange)
    this.controls.dispose()
    this.renderer.dispose()
    this.mintLoadVersion += 1
    for (const pending of this.mintModelTemplates.values()) {
      void pending.then((template) => {
        template.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose())
        })
      })
    }
    delete (window as DiagnosticsWindow).__SF_TENNIS_ATLAS_RENDER_INFO__
    delete (window as DiagnosticsWindow).__SF_TENNIS_ATLAS_FACILITY_MARKERS__
    delete (window as DiagnosticsWindow).__THREE_APP_TEST_HOOKS__
  }
}
