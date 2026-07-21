import * as THREE from 'three';
import { createMaterialLibrary, disposeMaterialLibrary, type MaterialLibrary } from '../assets/MaterialLibrary';
import { RuntimeAssetRegistry } from '../assets/RuntimeAssetRegistry';
import { getWorldPresentationProfile } from '../assets/worldPresentationProfiles';
import { InputController } from '../core/InputController';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { RacerView } from '../entities/RacerView';
import { AudioSystem } from '../systems/AudioSystem';
import { CameraRig } from '../systems/CameraRig';
import { MintWorldStream } from '../systems/MintWorldStream';
import { StartIntro } from '../systems/StartIntro';
import { VfxSystem } from '../systems/VfxSystem';
import {
  WorldCalibrationPanel,
  type WorldPresentationCalibration,
} from '../systems/WorldCalibrationPanel';
import { WorldBuilder } from '../systems/WorldBuilder';
import { GameUI } from '../ui/GameUI';
import { laneToWorldX } from './spatial';
import type { GameMode, RaceEvent, RacerId } from './types';
import { RaceSimulation } from './RaceSimulation';

const REDUCED_MOTION_KEY = 'jimothy-reduced-motion';

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(60, 1, 0.08, 190);
  private readonly simulation = new RaceSimulation(731);
  private readonly audio = new AudioSystem();
  private readonly registry: RuntimeAssetRegistry;
  private readonly materials: MaterialLibrary;
  private readonly cameraRig = new CameraRig(this.camera);
  private readonly playerPosition = new THREE.Vector3();
  private readonly projectedPlayerPosition = new THREE.Vector3();
  private readonly sun = new THREE.DirectionalLight('#ffd990', 3.15);
  private readonly sunTarget = new THREE.Object3D();
  private readonly ui: GameUI;
  private readonly input: InputController;
  private readonly loop: Loop;
  private world: WorldBuilder | null = null;
  private mintWorlds: MintWorldStream | null = null;
  private vfx: VfxSystem | null = null;
  private startIntro: StartIntro | null = null;
  private calibrationPanel: WorldCalibrationPanel | null = null;
  private readonly racerViews = new Map<RacerId, RacerView>();
  private reducedMotion = false;
  private pausedForScreenshot = false;
  private elapsed = 0;
  private frame = 0;
  private stepClock = 0;
  private booted = false;
  private presentationSequence = -1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    this.scene.add(this.camera);
    this.renderer.toneMappingExposure = 1.08;
    this.registry = new RuntimeAssetRegistry(this.renderer);
    this.materials = createMaterialLibrary();
    this.reducedMotion = this.readReducedMotion();
    document.documentElement.classList.toggle('reduced-motion', this.reducedMotion);
    this.simulation.setReducedMotion(this.reducedMotion);

    this.ui = new GameUI({
      start: () => this.startRace('race'),
      startEndless: () => this.startRace('endless'),
      resume: () => this.togglePause(),
      retry: () => this.retry(),
      restart: () => this.retry(),
      menu: () => this.returnToMenu(),
      pause: () => this.togglePause(),
      reload: () => window.location.reload(),
      audio: (settings) => this.audio.setSettings(settings),
      reducedMotion: (value) => this.setReducedMotion(value),
    }, this.audio.audioSettings, this.reducedMotion);

    const boostButton = this.getElement<HTMLButtonElement>('#boost-button');
    this.input = new InputController(canvas, boostButton, (intent) => this.simulation.queueIntent(intent));
    this.loop = new Loop((delta) => this.update(delta), () => this.render());

    this.createLighting();
    resizeRenderer(this.renderer, this.camera, this.maxDpr());
    this.applyWorldPresentation(0, true);
    this.installTestHooks();
    this.updateMenuRecord();
  }

  start(): void {
    this.render();
    void this.boot();
  }

  dispose(): void {
    this.loop.stop();
    this.input.dispose();
    this.ui.dispose();
    this.world?.dispose();
    this.mintWorlds?.dispose();
    this.vfx?.dispose();
    this.startIntro?.dispose();
    this.calibrationPanel?.dispose();
    for (const view of this.racerViews.values()) view.dispose();
    this.registry.dispose();
    this.audio.dispose();
    disposeMaterialLibrary(this.materials);
    this.renderer.dispose();
    window.__THREE_GAME_DIAGNOSTICS__ = undefined;
    window.__THREE_GAME_TEST_HOOKS__ = undefined;
  }

  private async boot(): Promise<void> {
    const total = this.registry.modelCount + 1;
    let loaded = 0;
    const onItem = (label: string) => {
      loaded += 1;
      this.ui.setLoading(loaded, total, `Loaded ${this.friendlyAssetName(label)}`);
    };

    try {
      this.ui.setLoading(0, total, 'Preparing Jimothy’s Backyard Dash');
      await this.registry.loadAll((key) => onItem(key));
      this.createExperience();
      const inspectionSequence = this.inspectionWorldSequence();
      if (inspectionSequence !== 0) this.applyWorldPresentation(inspectionSequence, true);
      this.ui.setLoading(
        total - 1,
        total,
        `Opening ${getWorldPresentationProfile(inspectionSequence).name}`,
      );
      try {
        await this.mintWorlds?.initialize(inspectionSequence);
      } catch (error) {
        console.warn('Dewy Lawn stream was unavailable; keeping the lightweight course.', error);
      }
      this.ui.setLoading(total, total, 'Jimothy’s Backyard Dash is ready');
      this.booted = true;
      this.simulation.goToMenu();
      this.ui.render(this.simulation.snapshot);
      this.loop.start();
      if (new URLSearchParams(window.location.search).get('world-calibration') === '1') {
        this.calibrationPanel = new WorldCalibrationPanel({
          view: (worldIndex, checkpoint) => this.showWorldCheckpoint(worldIndex, checkpoint),
          adjust: (values) => this.adjustWorldCalibration(values),
        });
      }
      // Decode short effects only after the model peak has passed. Music and
      // ambience remain streamed media, so their full PCM data is never held.
      window.setTimeout(() => void this.audio.loadAll(() => undefined), 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'A required race asset could not be loaded.';
      this.ui.showLoadError(message);
      console.error('Jimothy’s Backyard Dash asset loading failed.', error);
    }
  }

  private createExperience(): void {
    this.world = new WorldBuilder(this.simulation.course, this.registry, this.materials);
    this.scene.add(this.world.root);
    this.mintWorlds = new MintWorldStream(
      this.scene,
      this.renderer,
      this.camera,
      this.simulation.course.length,
      this.simulation.course.sections.length,
      this.isMobile(),
      (status) => this.ui.showWorldStreamStatus(status),
      (active) => this.world?.setGeneratedBackdropActive(active),
    );
    this.startIntro = new StartIntro(this.camera, this.registry);

    const keys: Record<RacerId, string> = {
      jimothy: 'hero-jimothy',
      maple: 'rival-maple',
      tank: 'rival-tank',
    };
    for (const racer of this.simulation.snapshot.racers) {
      const view = new RacerView(this.registry, racer.id, keys[racer.id]);
      this.racerViews.set(racer.id, view);
      this.scene.add(view.root);
    }
    this.vfx = new VfxSystem();
    this.scene.add(this.vfx.root);
  }

  private update(delta: number): void {
    if (!this.booted) return;
    this.frame += 1;
    if (!this.pausedForScreenshot) {
      this.elapsed += delta;
      this.simulation.update(delta);
    }

    const snapshot = this.simulation.snapshot;
    const player = snapshot.racers[0];
    const playerWorldX = laneToWorldX(player.visualLane);
    this.playerPosition.set(playerWorldX, 0.6, 0);

    const events = this.simulation.drainEvents();
    for (const event of events) this.handleEvent(event);

    this.world?.syncEntities(this.simulation.getActiveEntities());
    this.world?.update(delta, this.reducedMotion || this.pausedForScreenshot, player.distance);
    this.mintWorlds?.update(delta, player.distance, snapshot.mode === 'endless');
    this.syncWorldPresentation();
    for (const racer of snapshot.racers) {
      const shielded = racer.id === 'jimothy' && snapshot.shield;
      const view = this.racerViews.get(racer.id);
      if (view) view.root.visible = snapshot.phase !== 'countdown';
      view?.update(
        racer,
        delta,
        snapshot.phase,
        shielded,
        this.reducedMotion || this.pausedForScreenshot,
        player.distance,
      );
    }
    this.startIntro?.update(delta, snapshot.phase, this.reducedMotion || this.pausedForScreenshot);
    this.vfx?.update(delta, this.playerPosition, snapshot.boostTime > 0, this.reducedMotion || this.pausedForScreenshot);
    this.cameraRig.update(delta, playerWorldX, snapshot.boostTime > 0, this.reducedMotion || this.pausedForScreenshot);
    this.ui.render(snapshot);
    this.updateFootsteps(delta, snapshot.phase === 'racing' && player.jumpTimer <= 0 && player.scuttleTimer <= 0, player.speed);
    resizeRenderer(this.renderer, this.camera, this.maxDpr());
    this.publishDiagnostics();
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private handleEvent(event: RaceEvent): void {
    this.audio.handle(event);
    this.vfx?.handle(event, this.playerPosition);
    if (event.type === 'countdown') this.ui.showCountdown(event.value);
    if (event.type === 'go') {
      this.ui.showCountdown('GO');
      this.ui.showSection('Dewy Lawn');
    }
    if (event.type === 'section') {
      this.ui.showSection(event.name);
      this.ui.pulsePace();
    }
    if (event.type === 'lap') {
      this.ui.showSection(`Loop ${event.lap} · Keep going!`);
      this.ui.pulsePace();
    }
    if (event.type === 'token') this.ui.feedback('token');
    if (event.type === 'boost') {
      this.ui.feedback('boost');
      this.cameraRig.addTrauma(0.16);
    }
    if (event.type === 'collision') {
      this.ui.feedback('collision');
      this.cameraRig.addTrauma(event.protected ? 0.22 : 0.42);
    }
    if (event.type === 'finish') {
      this.ui.feedback('finish');
      this.cameraRig.addTrauma(0.24);
      this.updateMenuRecord();
    }
    if (event.type === 'phase') this.audio.setPaused(event.phase === 'paused');
  }

  private startRace(mode: GameMode): void {
    if (!this.booted) return;
    this.audio.startRaceLoops();
    void this.audio.unlock();
    this.simulation.startRace(mode);
    this.ensureWorldMode(mode === 'endless');
    this.mintWorlds?.reset();
    this.applyWorldPresentation(0, true);
    this.canvas.focus();
  }

  private retry(): void {
    if (!this.booted) return;
    this.audio.stopRaceLoops();
    this.audio.startRaceLoops();
    void this.audio.unlock();
    this.simulation.restart();
    this.mintWorlds?.reset();
    this.applyWorldPresentation(0, true);
    this.canvas.focus();
  }

  private returnToMenu(): void {
    this.audio.stopRaceLoops();
    this.simulation.goToMenu();
    this.mintWorlds?.reset();
    this.applyWorldPresentation(0, true);
    this.updateMenuRecord();
  }

  private togglePause(): void {
    this.simulation.togglePause();
    this.audio.setPaused(this.simulation.snapshot.phase === 'paused');
  }

  private setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
    this.simulation.setReducedMotion(value);
    document.documentElement.classList.toggle('reduced-motion', value);
    try { localStorage.setItem(REDUCED_MOTION_KEY, String(value)); } catch { /* storage optional */ }
  }

  private createLighting(): void {
    this.scene.background = new THREE.Color('#70947e');
    this.scene.fog = new THREE.Fog('#8eaa8e', 72, 174);
    const sky = new THREE.HemisphereLight('#fff0c7', '#244438', 1.85);
    this.scene.add(sky);
    this.sun.position.set(-14, 22, -7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.isMobile() ? 1024 : 2048, this.isMobile() ? 1024 : 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 70;
    this.sun.shadow.camera.left = -12;
    this.sun.shadow.camera.right = 12;
    this.sun.shadow.camera.top = 28;
    this.sun.shadow.camera.bottom = -8;
    this.sun.shadow.bias = -0.0004;
    this.sun.target = this.sunTarget;
    this.scene.add(this.sunTarget, this.sun);
    const rim = new THREE.DirectionalLight('#b7e1d0', 0.78);
    rim.position.set(9, 7, -12);
    this.scene.add(rim);
  }

  private syncWorldPresentation(): void {
    const sequence = this.mintWorlds?.diagnostics.activeSequence ?? 0;
    if (sequence === this.presentationSequence) return;
    this.applyWorldPresentation(sequence, false);
  }

  private applyWorldPresentation(sequence: number, snapCamera: boolean): void {
    const profile = getWorldPresentationProfile(sequence);
    this.presentationSequence = sequence;
    this.cameraRig.setProfile(profile.camera, snapCamera);
    this.scene.background = new THREE.Color(profile.background);
    this.scene.fog = new THREE.Fog(profile.fog.color, profile.fog.near, profile.fog.far);
  }

  private updateFootsteps(delta: number, active: boolean, speed: number): void {
    if (!active || speed < 3) {
      this.stepClock = 0;
      return;
    }
    this.stepClock += delta;
    const cadence = Math.max(0.11, 0.24 - speed * 0.006);
    if (this.stepClock >= cadence) {
      this.stepClock %= cadence;
      this.audio.playStep(this.frame % 4);
    }
  }

  private installTestHooks(): void {
    window.__THREE_GAME_TEST_HOOKS__ = {
      seed: (value) => {
        this.simulation.seed(value);
        if (this.booted) this.rebuildWorld();
      },
      setState: (name) => this.simulation.debugSetState(name),
      setPausedForScreenshot: (paused) => { this.pausedForScreenshot = paused; },
      setReducedMotion: (enabled) => this.setReducedMotion(enabled),
      setWorldCheckpoint: async (worldIndex, checkpoint) => {
        await this.showWorldCheckpoint(worldIndex, checkpoint);
      },
      setRaceCheckpoint: (worldIndex, checkpoint) => {
        const index = THREE.MathUtils.clamp(
          Math.round(worldIndex),
          0,
          this.simulation.course.sections.length - 1,
        );
        const section = this.simulation.course.sections[index];
        if (!section) return;
        this.pausedForScreenshot = true;
        this.simulation.debugSetDistance(THREE.MathUtils.lerp(
          section.start,
          section.end,
          THREE.MathUtils.clamp(checkpoint, 0, 0.999),
        ));
        this.ui.render(this.simulation.snapshot);
      },
      hideDebugUi: () => undefined,
    };
  }

  private rebuildWorld(endless = this.simulation.snapshot.mode === 'endless'): void {
    if (!this.world) return;
    this.scene.remove(this.world.root);
    this.world.dispose();
    this.world = new WorldBuilder(this.simulation.course, this.registry, this.materials, endless);
    this.world.setGeneratedBackdropActive(!(this.mintWorlds?.diagnostics.fallbackActive ?? true));
    this.scene.add(this.world.root);
  }

  private ensureWorldMode(endless: boolean): void {
    if (this.world?.endless === endless) return;
    this.rebuildWorld(endless);
  }

  private async showWorldCheckpoint(
    worldIndex: number,
    checkpoint: number,
  ): Promise<WorldPresentationCalibration | null> {
    if (!this.booted || !this.mintWorlds) return null;
    const index = THREE.MathUtils.clamp(Math.round(worldIndex), 0, this.simulation.course.sections.length - 1);
    const section = this.simulation.course.sections[index];
    if (!section) return null;
    const progress = THREE.MathUtils.clamp(checkpoint, 0, 0.999);
    this.pausedForScreenshot = true;
    this.ensureWorldMode(false);
    this.simulation.debugSetDistance(THREE.MathUtils.lerp(section.start, section.end, progress));
    const calibration = await this.mintWorlds.showForCalibration(index);
    this.applyWorldPresentation(index, true);
    this.ui.render(this.simulation.snapshot);
    return calibration ? { ...calibration, ...this.cameraRig.calibration } : null;
  }

  private adjustWorldCalibration(
    values: Partial<WorldPresentationCalibration>,
  ): WorldPresentationCalibration | null {
    const world = this.mintWorlds?.calibrateActiveWorld(values);
    if (!world) return null;
    const camera = this.cameraRig.calibrate(values);
    return { ...world, ...camera };
  }

  private publishDiagnostics(): void {
    const snapshot = this.simulation.snapshot;
    const player = snapshot.racers[0];
    const info = this.renderer.info;
    this.projectedPlayerPosition.copy(this.playerPosition).project(this.camera);
    window.__THREE_GAME_DIAGNOSTICS__ = {
      frame: this.frame,
      elapsed: snapshot.elapsed,
      phase: snapshot.phase,
      complete: snapshot.phase === 'finished',
      score: snapshot.score,
      tokens: snapshot.tokens,
      position: snapshot.position,
      player: {
        lane: player.lane,
        distance: player.distance,
        speed: player.speed,
        jumpTimer: player.jumpTimer,
        scuttleTimer: player.scuttleTimer,
        boostTimer: player.boostTimer,
        visualOriginDistance: player.distance,
        position: { x: this.playerPosition.x, y: this.playerPosition.y, z: this.playerPosition.z },
        screenPosition: {
          x: (this.projectedPlayerPosition.x + 1) * this.canvas.clientWidth * 0.5,
          y: (1 - this.projectedPlayerPosition.y) * this.canvas.clientHeight * 0.5,
        },
      },
      renderer: {
        calls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      },
      canvas: {
        clientWidth: this.canvas.clientWidth,
        clientHeight: this.canvas.clientHeight,
        width: this.canvas.width,
        height: this.canvas.height,
        dpr: Math.min(window.devicePixelRatio || 1, this.maxDpr()),
      },
      assets: {
        models: this.registry.loadedModelCount,
        totalModels: this.registry.modelCount,
        audio: this.audio.assetCount,
        modelTier: this.registry.qualityTier,
        maxConcurrentModelLoads: this.registry.maxConcurrentLoads,
      },
      path: this.world?.diagnostics ?? {
        routeSurfaceCount: 0,
        routeVisible: false,
        routeWidth: 0,
        routeRenderOrder: 0,
        nearestFinishZ: 0,
        generatedBackdropActive: false,
        fallbackDressingVisible: true,
      },
      worlds: this.mintWorlds?.diagnostics ?? {
        activeSequence: 0,
        activeName: '',
        activeReady: false,
        residentWorlds: 0,
        readyWorlds: 0,
        loadingWorlds: 0,
        maxResidentWorlds: 2,
        maxPagedSplats: 0,
        qualityTier: 'mobile-safe',
        lodSplatCount: 0,
        lodRenderScale: 1,
        focalAdjustment: 1,
        activeLodSplats: 0,
        activeLoadedPages: 0,
        sourceSplats: 0,
        refinementStableFrames: 0,
        qualityReady: false,
        qualityForced: false,
        activeOpacity: 0,
        nextSequence: 1,
        nextName: '',
        nextReady: false,
        nextLodSplats: 0,
        nextLoadedPages: 0,
        nextQualityReady: false,
        corridorScreenX: 0.5,
        horizonScreenX: 0.5,
        horizonScreenY: 0.5,
        expectedHorizonY: 0.5,
        centered: false,
        colliderAligned: false,
        fallbackActive: true,
        rootStatic: false,
        rootMovedSinceReady: false,
        rootMatrixHash: '',
        currentRootMatrixHash: '',
        transitionActive: false,
        transitionTarget: '',
        pathMaskActive: false,
      },
      audio: this.audio.diagnostics,
      intro: this.startIntro?.diagnostics ?? { visible: false, elapsed: 0, modelY: 0, modelRotationY: 0 },
      simulation: {
        fixedTimestep: this.simulation.fixedDt,
        collision: 'custom swept lane overlap',
        seed: this.simulation.course.seed,
        racerCount: snapshot.racers.length,
        speedMultiplier: snapshot.speedMultiplier,
        speedIncreasePerSecond: this.simulation.paceIncreasePerSecond,
        mode: snapshot.mode,
        lap: snapshot.lap,
      },
    };
  }

  private updateMenuRecord(): void {
    let best: number | null = null;
    let pickups: number | null = null;
    try {
      const bestRaw = localStorage.getItem('jimothys-backyard-dash-best-time');
      const pickupRaw = localStorage.getItem('jimothys-backyard-dash-pickup-record');
      best = bestRaw === null ? null : Number(bestRaw);
      pickups = pickupRaw === null ? null : Number(pickupRaw);
    } catch { /* storage optional */ }
    this.ui.updateMenuRecord(best, pickups);
  }

  private inspectionWorldSequence(): number {
    const value = Number(new URLSearchParams(window.location.search).get('world-inspection'));
    if (!Number.isFinite(value)) return 0;
    return THREE.MathUtils.clamp(
      Math.round(value),
      0,
      this.simulation.course.sections.length - 1,
    );
  }

  private readReducedMotion(): boolean {
    try {
      const stored = localStorage.getItem(REDUCED_MOTION_KEY);
      if (stored !== null) return stored === 'true';
    } catch { /* storage optional */ }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private maxDpr(): number {
    return this.isMobile() ? 1.5 : 2;
  }

  private isMobile(): boolean {
    return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760;
  }

  private friendlyAssetName(key: string): string {
    return key.replaceAll('-', ' ');
  }

  private getElement<T extends HTMLElement>(selector: string): T {
    const element = document.querySelector<T>(selector);
    if (!element) throw new Error(`Missing element: ${selector}`);
    return element;
  }
}
