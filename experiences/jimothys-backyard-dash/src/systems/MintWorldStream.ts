import type { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MINT_WORLDS } from '../assets/mintWorlds';
import { getWorldPresentationProfile } from '../assets/worldPresentationProfiles';

type StreamState = 'loading' | 'ready' | 'error';

type WorldSlot = {
  sequence: number;
  root: THREE.Group;
  splat: SplatMesh;
  collider: THREE.Group | null;
  ready: boolean;
  discarded: boolean;
  reveal: number;
  readyMatrix: THREE.Matrix4 | null;
  rootMovedSinceReady: boolean;
  calibrationOpacity: number | null;
  refinementAge: number;
  refinementStartedAt: number;
  refinementStableFrames: number;
  lodSplats: number;
  loadedPages: number;
  sourceSplats: number;
  lastLodSplats: number;
  lastLoadedPages: number;
  qualityReady: boolean;
  qualityForced: boolean;
  promise: Promise<void>;
};

export type SplatQualityTier = 'desktop-ultra' | 'desktop-balanced' | 'mobile-high' | 'mobile-safe';

type SplatQualityConfig = {
  tier: SplatQualityTier;
  maxPagedSplats: number;
  lodSplatCount: number;
  lodRenderScale: number;
  focalAdjustment: number;
  numLodFetchers: number;
  minReadyPages: number;
  minReadySplats: number;
};

export type MintWorldStreamStatus = {
  state: StreamState;
  name: string;
  message: string;
};

export type MintWorldCalibration = {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  opacity: number;
};

export type MintWorldStreamDiagnostics = {
  activeSequence: number;
  activeName: string;
  activeReady: boolean;
  residentWorlds: number;
  readyWorlds: number;
  loadingWorlds: number;
  maxResidentWorlds: number;
  maxPagedSplats: number;
  qualityTier: SplatQualityTier;
  lodSplatCount: number;
  lodRenderScale: number;
  focalAdjustment: number;
  activeLodSplats: number;
  activeLoadedPages: number;
  sourceSplats: number;
  refinementStableFrames: number;
  qualityReady: boolean;
  qualityForced: boolean;
  activeOpacity: number;
  nextSequence: number;
  nextName: string;
  nextReady: boolean;
  nextLodSplats: number;
  nextLoadedPages: number;
  nextQualityReady: boolean;
  corridorScreenX: number;
  horizonScreenX: number;
  horizonScreenY: number;
  expectedHorizonY: number;
  centered: boolean;
  colliderAligned: boolean;
  fallbackActive: boolean;
  rootStatic: boolean;
  rootMovedSinceReady: boolean;
  rootMatrixHash: string;
  currentRootMatrixHash: string;
  transitionActive: boolean;
  transitionTarget: string;
  pathMaskActive: boolean;
};

const QUALITY_CONFIGS: Record<SplatQualityTier, SplatQualityConfig> = {
  'desktop-ultra': {
    tier: 'desktop-ultra',
    maxPagedSplats: 1_048_576,
    lodSplatCount: 750_000,
    lodRenderScale: 1,
    focalAdjustment: 1.6,
    numLodFetchers: 3,
    minReadyPages: 4,
    minReadySplats: 110_000,
  },
  'desktop-balanced': {
    tier: 'desktop-balanced',
    maxPagedSplats: 786_432,
    lodSplatCount: 550_000,
    lodRenderScale: 1.1,
    focalAdjustment: 1.5,
    numLodFetchers: 2,
    minReadyPages: 3,
    minReadySplats: 85_000,
  },
  'mobile-high': {
    tier: 'mobile-high',
    maxPagedSplats: 524_288,
    lodSplatCount: 400_000,
    lodRenderScale: 1.2,
    focalAdjustment: 1.45,
    numLodFetchers: 2,
    minReadyPages: 2,
    minReadySplats: 55_000,
  },
  'mobile-safe': {
    tier: 'mobile-safe',
    maxPagedSplats: 393_216,
    lodSplatCount: 280_000,
    lodRenderScale: 1.35,
    focalAdjustment: 1.35,
    numLodFetchers: 1,
    minReadyPages: 2,
    minReadySplats: 35_000,
  },
};

const MIN_REFINEMENT_AGE = 0.35;
const MIN_STABLE_REFINEMENT_FRAMES = 6;
const QUALITY_REVEAL_RATE = 3.5;
const FALLBACK_RELEASE_REVEAL = 0.85;
const MATRIX_EPSILON = 0.00001;

export class MintWorldStream {
  private readonly root = new THREE.Group();
  private spark: SparkRenderer | null = null;
  private corridorMask: THREE.Object3D | null = null;
  private sparkRuntime: typeof import('@sparkjsdev/spark') | null = null;
  private readonly runtimePromise: Promise<void>;
  private readonly loader = new GLTFLoader();
  private readonly slots = new Map<number, WorldSlot>();
  private readonly quality: SplatQualityConfig;
  private readonly mobile: boolean;
  private activeSequence = 0;
  private calibrationMode = false;
  private fallbackActive = true;
  private disposed = false;

  constructor(
    private readonly scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly courseLength: number,
    private readonly sectionCount: number,
    mobile: boolean,
    private readonly onStatus: (status: MintWorldStreamStatus) => void,
    private readonly onBackdropChange: (active: boolean) => void,
  ) {
    this.root.name = 'mint-world-stream';
    this.mobile = mobile;
    this.quality = this.selectQuality(renderer, mobile);
    this.scene.add(this.root);
    // Defer parsing Spark's sizeable WASM/rendering runtime until the compact
    // model tier is fully loaded, avoiding the old mobile boot memory peak.
    this.runtimePromise = import('@sparkjsdev/spark').then((runtime) => {
      this.sparkRuntime = runtime;
      const spark = new runtime.SparkRenderer({
        renderer,
        enableLod: true,
        enableLodFetching: true,
        lodSplatCount: this.quality.lodSplatCount,
        lodRenderScale: this.quality.lodRenderScale,
        lodInflate: false,
        focalAdjustment: this.quality.focalAdjustment,
        maxPagedSplats: this.quality.maxPagedSplats,
        numLodFetchers: this.quality.numLodFetchers,
        coneFov0: 72,
        coneFov: 112,
        coneFoveate: mobile ? 0.48 : 0.58,
        behindFoveate: mobile ? 0.14 : 0.2,
      });
      spark.name = 'mint-spark-renderer';
      if (this.disposed) {
        spark.dispose();
        return;
      }
      this.spark = spark;
      this.scene.add(spark);

      // Mint remains the detailed static backdrop, while the playable route is
      // authored by WorldBuilder. This soft global SDF clears only the central
      // gameplay volume so source-scene trees and walls can never cover the
      // lane ribbon or the hazards the player must read.
      const corridor = new runtime.SplatEditSdf({
        type: runtime.SplatEditSdfType.BOX,
        opacity: 0,
        color: new THREE.Color('#ffffff'),
        radius: 0.7,
      });
      corridor.name = 'gameplay-corridor-splat-mask-volume';
      corridor.position.set(0, 3.15, 40);
      corridor.scale.set(4.15, 3.75, 58);
      const mask = new runtime.SplatEdit({
        name: 'always-visible-gameplay-corridor',
        rgbaBlendMode: runtime.SplatEditRgbaBlendMode.MULTIPLY,
        softEdge: 0.72,
        sdfs: [corridor],
      });
      mask.add(corridor);
      this.corridorMask = mask;
      this.root.add(mask);
    });
  }

  async initialize(sequence = 0): Promise<void> {
    await this.runtimePromise;
    this.activeSequence = Math.max(0, Math.floor(sequence));
    await this.prepare(this.activeSequence);
    const slot = this.slots.get(this.activeSequence);
    if (!slot?.ready) {
      const name = getWorldPresentationProfile(this.activeSequence).name;
      throw new Error(`${name} could not be prepared.`);
    }
    // The first meaningful render frames refine after Spark joins the app's
    // animation loop. Keep the lightweight course at full width until that
    // camera-facing page set is stable instead of exposing the base RAD LoD.
    this.fallbackActive = true;
    this.onBackdropChange(false);
  }

  update(delta: number, distance: number, endless: boolean): void {
    if (this.disposed) return;
    const sectionLength = this.sectionLength;
    const requestedSequence = Math.max(0, Math.floor(distance / sectionLength));
    const maxSequence = endless ? Number.POSITIVE_INFINITY : this.sectionCount - 1;
    const desiredSequence = Math.min(requestedSequence, maxSequence);
    void this.prepare(this.activeSequence);
    // Keep exactly one future world resident from the first gameplay frame.
    // Spark shares one LoD and page budget across both meshes, so the larger
    // tier budgets below let the future camera-facing view become stable while
    // the current world remains fully detailed.
    if (!this.calibrationMode && this.activeSequence < maxSequence) {
      void this.prepare(this.activeSequence + 1);
    }

    const nextSequence = this.activeSequence + 1;
    for (const slot of this.slots.values()) {
      if (!slot.ready) continue;
      this.verifyStaticRoot(slot);
      this.updateRefinement(slot);
      slot.reveal = slot.qualityReady
        ? Math.min(1, slot.reveal + delta * QUALITY_REVEAL_RATE)
        : 0;
      const maxOpacity = slot.calibrationOpacity ?? this.profileOpacity(slot.sequence);
      slot.splat.opacity = slot.sequence === this.activeSequence ? slot.reveal * maxOpacity : 0;
      // Keep the prepared world render-participating at zero opacity so Spark
      // can refine camera-facing RAD pages without two splats ever blending.
      slot.root.visible = true;
    }

    // Never hand control to a partially paged world. If a slow device reaches
    // a boundary early, the fully rendered outgoing world remains on screen
    // until the prepared target satisfies the stable page/splat quality gate.
    if (!this.calibrationMode && desiredSequence > this.activeSequence) {
      const next = this.slots.get(nextSequence);
      if (next?.ready && next.qualityReady) this.activatePreparedWorld(nextSequence);
    }

    const active = this.slots.get(this.activeSequence);
    // The route/fallback is only withdrawn after the active splat is both
    // stable and almost fully revealed. It can therefore never expose a blank
    // background or a low-opacity base LoD.
    const generatedBackdropReady = active?.ready === true
      && active.qualityReady
      && active.reveal >= FALLBACK_RELEASE_REVEAL;
    if (generatedBackdropReady === this.fallbackActive) {
      this.fallbackActive = !generatedBackdropReady;
      this.onBackdropChange(generatedBackdropReady);
    }

    const keep = new Set<number>([this.activeSequence]);
    if (this.slots.has(this.activeSequence + 1)) {
      keep.add(this.activeSequence + 1);
    }
    for (const [slotSequence, slot] of this.slots) {
      if (keep.has(slotSequence)) continue;
      this.release(slot);
    }
  }

  reset(): void {
    this.calibrationMode = false;
    this.activeSequence = 0;
    for (const slot of [...this.slots.values()]) {
      if (slot.sequence !== 0) this.release(slot);
    }
    const first = this.slots.get(0);
    if (first?.ready) {
      first.reveal = first.qualityReady ? 1 : 0;
      first.splat.opacity = first.qualityReady ? this.profileOpacity(0) : 0;
      first.root.visible = true;
    } else {
      void this.prepare(0);
    }
    const generatedBackdropReady = first?.qualityReady === true;
    this.fallbackActive = !generatedBackdropReady;
    this.onBackdropChange(generatedBackdropReady);
  }

  async showForCalibration(sequence: number): Promise<MintWorldCalibration | null> {
    this.calibrationMode = true;
    this.activeSequence = sequence;
    for (const slot of [...this.slots.values()]) {
      if (slot.sequence === sequence) continue;
      this.release(slot);
    }
    this.fallbackActive = true;
    this.onBackdropChange(false);
    await this.prepare(sequence);
    const target = this.slots.get(sequence);
    if (!target?.ready) return null;
    target.reveal = 1;
    target.splat.opacity = target.calibrationOpacity ?? this.profileOpacity(sequence);
    this.fallbackActive = false;
    this.onBackdropChange(true);
    return this.getActiveCalibration();
  }

  getActiveCalibration(): MintWorldCalibration | null {
    const slot = this.slots.get(this.activeSequence);
    if (!slot?.ready) return null;
    return {
      x: slot.root.position.x,
      y: slot.root.position.y,
      z: slot.root.position.z,
      scale: slot.root.scale.x,
      rotationX: slot.root.rotation.x,
      rotationY: slot.root.rotation.y,
      rotationZ: slot.root.rotation.z,
      opacity: slot.calibrationOpacity ?? this.profileOpacity(slot.sequence),
    };
  }

  calibrateActiveWorld(values: Partial<MintWorldCalibration>): MintWorldCalibration | null {
    const slot = this.slots.get(this.activeSequence);
    if (!slot?.ready) return null;
    slot.root.position.set(
      values.x ?? slot.root.position.x,
      values.y ?? slot.root.position.y,
      values.z ?? slot.root.position.z,
    );
    slot.root.rotation.set(
      values.rotationX ?? slot.root.rotation.x,
      values.rotationY ?? slot.root.rotation.y,
      values.rotationZ ?? slot.root.rotation.z,
    );
    slot.root.scale.setScalar(values.scale ?? slot.root.scale.x);
    if (values.opacity !== undefined) slot.calibrationOpacity = values.opacity;
    slot.root.updateMatrixWorld(true);
    slot.readyMatrix = slot.root.matrixWorld.clone();
    slot.rootMovedSinceReady = false;
    return this.getActiveCalibration();
  }

  dispose(): void {
    this.disposed = true;
    for (const slot of [...this.slots.values()]) this.release(slot);
    this.scene.remove(this.root);
    this.corridorMask = null;
    if (this.spark) {
      this.scene.remove(this.spark);
      this.spark.dispose();
      this.spark = null;
    }
  }

  get diagnostics(): MintWorldStreamDiagnostics {
    const active = this.slots.get(this.activeSequence);
    const nextSequence = this.activeSequence + 1;
    const next = this.slots.get(nextSequence);
    const composition = this.compositionDiagnostics(active);
    let readyWorlds = 0;
    let loadingWorlds = 0;
    for (const slot of this.slots.values()) {
      if (slot.ready) readyWorlds += 1;
      else loadingWorlds += 1;
    }
    return {
      activeSequence: this.activeSequence,
      activeName: MINT_WORLDS[this.activeSequence % this.sectionCount]?.name ?? '',
      activeReady: active?.ready === true,
      residentWorlds: this.slots.size,
      readyWorlds,
      loadingWorlds,
      maxResidentWorlds: 2,
      maxPagedSplats: this.quality.maxPagedSplats,
      qualityTier: this.quality.tier,
      lodSplatCount: this.quality.lodSplatCount,
      lodRenderScale: this.quality.lodRenderScale,
      focalAdjustment: this.quality.focalAdjustment,
      activeLodSplats: active?.lodSplats ?? 0,
      activeLoadedPages: active?.loadedPages ?? 0,
      sourceSplats: active?.sourceSplats ?? 0,
      refinementStableFrames: active?.refinementStableFrames ?? 0,
      qualityReady: active?.qualityReady ?? false,
      qualityForced: active?.qualityForced ?? false,
      activeOpacity: active?.splat.opacity ?? 0,
      nextSequence,
      nextName: getWorldPresentationProfile(nextSequence).name,
      nextReady: next?.ready ?? false,
      nextLodSplats: next?.lodSplats ?? 0,
      nextLoadedPages: next?.loadedPages ?? 0,
      nextQualityReady: next?.qualityReady ?? false,
      corridorScreenX: composition.corridorScreenX,
      horizonScreenX: composition.horizonScreenX,
      horizonScreenY: composition.horizonScreenY,
      expectedHorizonY: composition.expectedHorizonY,
      centered: composition.centered,
      colliderAligned: active?.ready === true && active.collider !== null && active.collider.parent === active.root,
      fallbackActive: this.fallbackActive,
      rootStatic: active?.ready === true && !active.rootMovedSinceReady,
      rootMovedSinceReady: active?.rootMovedSinceReady ?? false,
      rootMatrixHash: active?.readyMatrix ? this.matrixHash(active.readyMatrix) : '',
      currentRootMatrixHash: active?.ready ? this.matrixHash(active.root.matrixWorld) : '',
      transitionActive: false,
      transitionTarget: '',
      pathMaskActive: this.corridorMask?.visible === true,
    };
  }

  private get sectionLength(): number {
    return this.courseLength / this.sectionCount;
  }

  private async prepare(sequence: number): Promise<void> {
    await this.runtimePromise;
    const existing = this.slots.get(sequence);
    if (existing) return existing.promise;
    if (!this.sparkRuntime || !this.spark) throw new Error('The Mint world renderer is unavailable.');

    const config = MINT_WORLDS[sequence % MINT_WORLDS.length];
    const root = new THREE.Group();
    root.name = `mint-world-${sequence}-${config.name.toLowerCase().replaceAll(' ', '-')}`;
    // Mint's viewer faces from +Z toward -Z. The runner advances along world
    // +Z, so the shared splat/collider root uses the standard X correction and
    // one additional Y half-turn relative to the viewer calibration.
    root.rotation.set(Math.PI, 0, 0);

    const splat = new this.sparkRuntime.SplatMesh({
      url: config.runtimeUrl,
      fileType: this.sparkRuntime.SplatFileType.RAD,
      paged: true,
      editable: true,
      raycastable: false,
      onFrame: () => undefined,
    });
    splat.lodScale = getWorldPresentationProfile(sequence).composition.detailScale;
    root.add(splat);
    this.root.add(root);

    const slot: WorldSlot = {
      sequence,
      root,
      splat,
      collider: null,
      ready: false,
      discarded: false,
      reveal: 0,
      readyMatrix: null,
      rootMovedSinceReady: false,
      calibrationOpacity: null,
      refinementAge: 0,
      refinementStartedAt: performance.now(),
      refinementStableFrames: 0,
      lodSplats: 0,
      loadedPages: 0,
      sourceSplats: 0,
      lastLodSplats: 0,
      lastLoadedPages: 0,
      qualityReady: false,
      qualityForced: false,
      promise: Promise.resolve(),
    };
    this.slots.set(sequence, slot);
    this.onStatus({ state: 'loading', name: config.name, message: `Growing ${config.name}…` });

    slot.promise = Promise.all([splat.initialized, this.loader.loadAsync(config.colliderUrl)])
      .then(([, gltf]) => {
        if (slot.discarded || this.disposed) {
          splat.dispose();
          this.disposeCollider(gltf.scene);
          return;
        }
        slot.collider = gltf.scene;
        root.add(slot.collider);
        this.alignSlot(slot);
        slot.collider.traverse((object) => { object.visible = false; });
        slot.ready = true;
        slot.sourceSplats = splat.splats?.getNumSplats() ?? 0;
        void splat.paged?.getRadMeta().then(({ meta }) => {
          if (!slot.discarded) slot.sourceSplats = Math.max(slot.sourceSplats, meta.count);
        });
        slot.readyMatrix = slot.root.matrixWorld.clone();
        slot.root.visible = true;
        this.onStatus({ state: 'ready', name: config.name, message: `${config.name} framing ready` });
      })
      .catch((error: unknown) => {
        if (slot.discarded || this.disposed) {
          splat.dispose();
          return;
        }
        console.error(`Mint world stream failed for ${config.name}.`, error);
        this.onStatus({ state: 'error', name: config.name, message: `${config.name} is using the lightweight course.` });
        this.release(slot);
        splat.dispose();
      });

    return slot.promise;
  }

  private alignSlot(slot: WorldSlot): void {
    if (!slot.collider) return;
    const profile = getWorldPresentationProfile(slot.sequence);
    slot.root.scale.setScalar(1);
    slot.root.position.set(0, 0, 0);
    slot.root.rotation.set(...profile.rootRotation);
    slot.root.updateMatrixWorld(true);
    const unitBounds = new THREE.Box3().setFromObject(slot.collider);
    const unitDepth = Math.max(1, unitBounds.getSize(new THREE.Vector3()).z);
    // Preserve Mint's calibrated world scale. The generated environments have
    // different native extents, so authored fences/foliage carry the course
    // between them rather than stretching splats and their colliders.
    const scale = profile.rootScale;
    slot.root.scale.setScalar(scale);
    slot.root.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(slot.collider);
    slot.root.position.set(
      profile.rootOffset[0],
      -bounds.min.y + profile.rootOffset[1],
      profile.rootOffset[2],
    );
    slot.root.updateMatrixWorld(true);
    slot.root.userData.spatialContract = {
      worldUp: '+Y',
      worldForward: '+Z',
      canonicalTransformOwner: 'MintWorldStream shared root',
      colliderTransformOwner: 'MintWorldStream shared root',
      scale,
      nativeDepth: unitDepth,
      presentationAnchor: profile.rootOffset,
      corridorAnchor: profile.composition.corridorAnchor,
      horizonAnchor: profile.composition.horizonAnchor,
      qualityDetailScale: profile.composition.detailScale,
      immutableAfterReady: true,
    };
  }

  private activatePreparedWorld(toSequence: number): void {
    if (toSequence !== this.activeSequence + 1) return;
    const target = this.slots.get(toSequence);
    if (!target?.ready || !target.qualityReady) return;
    const previous = this.slots.get(this.activeSequence);
    if (previous?.ready) previous.splat.opacity = 0;
    this.activeSequence = toSequence;
    target.reveal = 1;
    target.qualityForced = false;
    target.splat.opacity = this.profileOpacity(toSequence);
    if (previous) this.release(previous);
  }

  private updateRefinement(slot: WorldSlot): void {
    slot.refinementAge = (performance.now() - slot.refinementStartedAt) / 1_000;
    const instance = this.spark?.lodInstances.get(slot.splat);
    const paged = slot.splat.paged;
    // Paged RAD meshes update their own visible index count and intentionally
    // bypass SparkRenderer.lodInstances, which is only populated for packed
    // and extended in-memory splats.
    const lodSplats = paged?.numSplats ?? instance?.numSplats ?? 0;
    const pageEntries = paged ? this.spark?.pager?.splatsChunkToPage.get(paged) : undefined;
    let loadedPages = 0;
    if (pageEntries) {
      for (const entry of pageEntries) if (entry) loadedPages += 1;
    }

    slot.lodSplats = lodSplats;
    slot.loadedPages = loadedPages;
    slot.sourceSplats = Math.max(slot.sourceSplats, slot.splat.splats?.getNumSplats() ?? 0);

    const splatTolerance = Math.max(2_048, lodSplats * 0.035);
    const stable = lodSplats > 0
      && loadedPages > 0
      && loadedPages === slot.lastLoadedPages
      && Math.abs(lodSplats - slot.lastLodSplats) <= splatTolerance;
    slot.refinementStableFrames = stable ? slot.refinementStableFrames + 1 : 0;
    slot.lastLodSplats = lodSplats;
    slot.lastLoadedPages = loadedPages;

    const meetsBudget = loadedPages >= this.quality.minReadyPages
      && lodSplats >= this.quality.minReadySplats;
    const comfortablyReady = loadedPages > this.quality.minReadyPages
      && lodSplats >= this.quality.minReadySplats * 1.35;
    if (
      slot.refinementAge >= MIN_REFINEMENT_AGE
      && meetsBudget
      && (slot.refinementStableFrames >= MIN_STABLE_REFINEMENT_FRAMES || comfortablyReady)
    ) {
      slot.qualityReady = true;
    }
  }

  private compositionDiagnostics(slot: WorldSlot | undefined): {
    corridorScreenX: number;
    horizonScreenX: number;
    horizonScreenY: number;
    expectedHorizonY: number;
    centered: boolean;
  } {
    if (!slot?.ready) {
      return {
        corridorScreenX: 0.5,
        horizonScreenX: 0.5,
        horizonScreenY: 0.5,
        expectedHorizonY: 0.5,
        centered: false,
      };
    }
    const profile = getWorldPresentationProfile(slot.sequence);
    slot.root.updateMatrixWorld(true);
    const corridor = new THREE.Vector3(...profile.composition.corridorAnchor)
      .applyMatrix4(slot.root.matrixWorld)
      .project(this.camera);
    const horizon = new THREE.Vector3(...profile.composition.horizonAnchor)
      .applyMatrix4(slot.root.matrixWorld)
      .project(this.camera);
    const corridorScreenX = (corridor.x + 1) * 0.5;
    const horizonScreenX = (horizon.x + 1) * 0.5;
    const horizonScreenY = (1 - horizon.y) * 0.5;
    const expectedHorizonY = this.mobile
      ? profile.composition.horizonRatio.mobile
      : profile.composition.horizonRatio.desktop;
    const finite = [corridorScreenX, horizonScreenX, horizonScreenY].every(Number.isFinite);
    const centered = finite
      && Math.abs(corridorScreenX - 0.5) <= profile.composition.centerTolerance
      && Math.abs(horizonScreenX - 0.5) <= profile.composition.centerTolerance
      && Math.abs(horizonScreenY - expectedHorizonY) <= profile.composition.horizonTolerance;
    return { corridorScreenX, horizonScreenX, horizonScreenY, expectedHorizonY, centered };
  }

  private profileOpacity(sequence: number): number {
    const opacity = getWorldPresentationProfile(sequence).opacity;
    if (!this.mobile) return opacity.desktop;
    return this.quality.tier === 'mobile-high' ? opacity.mobileHigh : opacity.mobileSafe;
  }

  private selectQuality(renderer: THREE.WebGLRenderer, mobile: boolean): SplatQualityConfig {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const cores = Math.max(1, nav.hardwareConcurrency || 4);
    const memory = nav.deviceMemory;
    const textureSize = renderer.capabilities.maxTextureSize;
    if (mobile) {
      const highMemoryMobile = (memory ?? 0) >= 6 && cores >= 6 && textureSize >= 8_192;
      return QUALITY_CONFIGS[highMemoryMobile ? 'mobile-high' : 'mobile-safe'];
    }
    const desktopUltra = cores >= 8 && textureSize >= 8_192 && (memory === undefined || memory >= 8);
    return QUALITY_CONFIGS[desktopUltra ? 'desktop-ultra' : 'desktop-balanced'];
  }

  private verifyStaticRoot(slot: WorldSlot): void {
    if (!slot.readyMatrix) return;
    slot.root.updateMatrixWorld(true);
    const current = slot.root.matrixWorld.elements;
    const baseline = slot.readyMatrix.elements;
    for (let index = 0; index < current.length; index += 1) {
      if (Math.abs((current[index] ?? 0) - (baseline[index] ?? 0)) <= MATRIX_EPSILON) continue;
      slot.rootMovedSinceReady = true;
      return;
    }
  }

  private matrixHash(matrix: THREE.Matrix4): string {
    return matrix.elements.map((value) => value.toFixed(4)).join(',');
  }

  private release(slot: WorldSlot): void {
    if (!this.slots.has(slot.sequence)) return;
    this.slots.delete(slot.sequence);
    slot.discarded = true;
    this.root.remove(slot.root);
    // Spark's page workers still need their pager while initialization is in
    // flight. The prepare promise owns deferred disposal for loading slots.
    if (!slot.ready) return;
    slot.splat.dispose();
    if (slot.collider) this.disposeCollider(slot.collider);
  }

  private disposeCollider(collider: THREE.Object3D): void {
    collider.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    });
  }

}
