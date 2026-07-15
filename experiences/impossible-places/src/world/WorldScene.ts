import type { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import type { Destination } from '../destinations';

type WorldStatus = 'loading' | 'ready' | 'error';

type WorldSceneOptions = {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  destination: Destination;
  initialOpacity?: number;
  getSparkRenderer: () => Promise<SparkRenderer>;
  onStatus: (state: WorldStatus, label: string) => void;
  onTourChange: (active: boolean) => void;
  onFirstMove: () => void;
};

type VisualTransition = {
  fromOpacity: number;
  toOpacity: number;
  fromScale: number;
  toScale: number;
  startedAt: number;
  duration: number;
  resolve: () => void;
};

const MINT_WORLD_SCALE = 2.5;
const MINT_WORLD_Y = 1.5;
const MINT_WORLD_ROTATION: [number, number, number] = [Math.PI, Math.PI, 0];
const HOME_POSITION = new THREE.Vector3(0, 3.2, 6);
const ORBIT_PIVOT_DISTANCE = 0.55;
const HOME_TARGET = HOME_POSITION.clone().addScaledVector(
  new THREE.Vector3(0, -0.85, 6).normalize(),
  ORBIT_PIVOT_DISTANCE,
);
const WALK_SPEED = 6.4;
const SPRINT_SPEED = 16;
const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);
const NAVIGATION_KEYS = new Set([...MOVEMENT_KEYS, 'ShiftLeft', 'ShiftRight']);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export class WorldScene {
  readonly scene = new THREE.Scene();

  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly destination: Destination;
  private readonly initialOpacity: number;
  private readonly onStatus: WorldSceneOptions['onStatus'];
  private readonly onTourChange: WorldSceneOptions['onTourChange'];
  private readonly onFirstMove: WorldSceneOptions['onFirstMove'];
  private readonly getSparkRenderer: WorldSceneOptions['getSparkRenderer'];
  private readonly controls: OrbitControls;
  private readonly worldRoot = new THREE.Group();
  private readonly pressedKeys = new Set<string>();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly movement = new THREE.Vector3();
  private spark?: SparkRenderer;
  private activeSplat?: SplatMesh;
  private destroyed = false;
  private loadingToken = 0;
  private tourActive = false;
  private tourAngle = 0;
  private tourTargetDistance = ORBIT_PIVOT_DISTANCE;
  private visualOpacity = 1;
  private visualScale = 1;
  private visualTransition?: VisualTransition;
  private hasMoved = false;

  constructor(options: WorldSceneOptions) {
    this.renderer = options.renderer;
    this.camera = options.camera;
    this.destination = options.destination;
    this.initialOpacity = THREE.MathUtils.clamp(options.initialOpacity ?? 1, 0, 1);
    this.visualOpacity = this.initialOpacity;
    this.visualScale = this.initialOpacity < 1 ? 1.075 : 1;
    this.onStatus = options.onStatus;
    this.onTourChange = options.onTourChange;
    this.onFirstMove = options.onFirstMove;
    this.getSparkRenderer = options.getSparkRenderer;

    this.scene.background = new THREE.Color(options.destination.accentSoft).multiplyScalar(0.055);
    this.scene.add(this.worldRoot);
    this.worldRoot.position.set(0, MINT_WORLD_Y, 0);
    this.worldRoot.rotation.set(...MINT_WORLD_ROTATION);
    this.worldRoot.scale.setScalar(MINT_WORLD_SCALE * this.visualScale);

    this.camera.fov = 55;
    this.camera.near = 0.01;
    this.camera.far = 2000;
    this.camera.position.copy(HOME_POSITION);
    this.camera.updateProjectionMatrix();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.copy(HOME_TARGET);
    this.controls.minDistance = 0.35;
    this.controls.maxDistance = 0.75;
    this.controls.enablePan = false;
    this.controls.zoomSpeed = 0.45;
    this.controls.rotateSpeed = 0.42;
    this.controls.enabled = false;
    this.controls.update();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
  }

  async load(): Promise<boolean> {
    const token = ++this.loadingToken;
    this.setInputEnabled(false);
    this.onStatus('loading', `Streaming ${this.destination.shortName}…`);

    const runtime = this.destination.runtime;
    if (!runtime.runtimeUrl) {
      this.onStatus('error', 'This destination is still being prepared by Mint. Try again shortly.');
      return false;
    }

    try {
      this.disposeWorldAssets();
      const { SplatFileType, SplatMesh } = await import('@sparkjsdev/spark');
      if (this.destroyed || token !== this.loadingToken) return false;

      const splat = new SplatMesh({
        url: runtime.runtimeUrl,
        fileType: SplatFileType.RAD,
        paged: true,
        raycastable: false,
        onFrame: () => {},
      });
      splat.opacity = this.visualOpacity;
      this.activeSplat = splat;
      this.worldRoot.add(splat);

      await splat.initialized;
      if (this.destroyed || token !== this.loadingToken) {
        splat.dispose();
        this.activeSplat = undefined;
        return false;
      }

      // Do not attach SparkRenderer while the RAD source still has zero splats.
      // Its asynchronous depth sorter expects a populated accumulator target.
      this.spark = await this.getSparkRenderer();
      if (this.destroyed || token !== this.loadingToken) return false;
      this.scene.add(this.spark);
      this.onStatus('loading', `Resolving detail in ${this.destination.shortName}…`);
      await this.waitForInitialDetail(splat, token);
      if (this.destroyed || token !== this.loadingToken) return false;
      this.onStatus('ready', `${this.destination.shortName} ready`);
      return true;
    } catch (error) {
      if (this.destroyed || token !== this.loadingToken) return false;
      console.error('[splat-world] Failed to load', error);
      const message = error instanceof Error ? error.message : 'Unknown world-loading error';
      this.onStatus('error', `Unable to open this destination — ${message}`);
      return false;
    }
  }

  setInputEnabled(enabled: boolean): void {
    this.controls.enabled = enabled;
    if (!enabled) this.pressedKeys.clear();
  }

  transitionIn(duration = 1_180): Promise<void> {
    this.setInputEnabled(false);
    return this.transitionVisual(1, 1, duration);
  }

  transitionOut(duration = 620): Promise<void> {
    this.setTour(false);
    this.setInputEnabled(false);
    return this.transitionVisual(0, 1.075, duration);
  }

  private transitionVisual(targetOpacity: number, targetScale: number, duration: number): Promise<void> {
    this.visualTransition?.resolve();
    if (!this.activeSplat || duration <= 1) {
      this.applyVisualState(targetOpacity, targetScale);
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.visualTransition = {
        fromOpacity: this.visualOpacity,
        toOpacity: targetOpacity,
        fromScale: this.visualScale,
        toScale: targetScale,
        startedAt: performance.now(),
        duration,
        resolve,
      };
    });
  }

  private applyVisualState(opacity: number, scale: number): void {
    this.visualOpacity = THREE.MathUtils.clamp(opacity, 0, 1);
    this.visualScale = scale;
    if (this.activeSplat) this.activeSplat.opacity = this.visualOpacity;
    // The RAD presentation root owns transition scale independently of navigation.
    this.worldRoot.scale.setScalar(MINT_WORLD_SCALE * this.visualScale);
  }

  private updateVisualTransition(now: number): void {
    const transition = this.visualTransition;
    if (!transition) return;
    const progress = THREE.MathUtils.clamp(
      (now - transition.startedAt) / transition.duration,
      0,
      1,
    );
    const eased = transition.toOpacity > transition.fromOpacity
      ? 1 - Math.pow(1 - progress, 5)
      : progress * progress * progress;
    this.applyVisualState(
      THREE.MathUtils.lerp(transition.fromOpacity, transition.toOpacity, eased),
      THREE.MathUtils.lerp(transition.fromScale, transition.toScale, eased),
    );
    if (progress >= 1) {
      this.visualTransition = undefined;
      transition.resolve();
    }
  }

  private async waitForInitialDetail(splat: SplatMesh, token: number): Promise<void> {
    const startedAt = performance.now();
    let previousPages = -1;
    let stableSince = startedAt;

    while (!this.destroyed && token === this.loadingToken) {
      const now = performance.now();
      const pager = splat.paged?.pager;
      const loadedPages = pager?.pageLru.size ?? 0;
      const pending =
        (pager?.fetchers.length ?? 0) +
        (pager?.fetched.length ?? 0) +
        (pager?.newUploads.length ?? 0) +
        (pager?.readyUploads.length ?? 0);

      if (loadedPages !== previousPages) {
        previousPages = loadedPages;
        stableSince = now;
      }

      const stable = loadedPages >= 4 && pending === 0 && now - stableSince >= 700;
      const timedOutWithData = loadedPages > 0 && now - startedAt >= 12_000;
      if (stable || timedOutWithData) return;
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    }
  }

  private applyNavigation(delta: number): void {
    if (this.pressedKeys.size === 0 || this.tourActive) return;
    this.camera.getWorldDirection(this.forward);
    this.forward.y = 0;
    if (this.forward.lengthSq() < 1e-6) return;
    this.forward.normalize();
    this.right.crossVectors(this.forward, THREE.Object3D.DEFAULT_UP).normalize();

    this.movement.set(0, 0, 0);
    if (this.pressedKeys.has('KeyW')) this.movement.add(this.forward);
    if (this.pressedKeys.has('KeyS')) this.movement.sub(this.forward);
    if (this.pressedKeys.has('KeyD')) this.movement.add(this.right);
    if (this.pressedKeys.has('KeyA')) this.movement.sub(this.right);
    if (this.movement.lengthSq() === 0) return;

    const speed = this.pressedKeys.has('ShiftLeft') || this.pressedKeys.has('ShiftRight')
      ? SPRINT_SPEED
      : WALK_SPEED;
    const distance = speed * delta;
    this.movement.normalize().multiplyScalar(distance);
    const moved = this.movement.lengthSq() > 0.000001;
    this.camera.position.add(this.movement);
    this.controls.target.add(this.movement);
    if (moved && !this.hasMoved) {
      this.hasMoved = true;
      this.onFirstMove();
    }
  }

  private applyTour(delta: number): void {
    if (!this.tourActive) return;
    this.tourAngle += delta * 0.18;
    this.controls.target.set(
      this.camera.position.x + Math.sin(this.tourAngle) * this.tourTargetDistance,
      this.camera.position.y - 0.12,
      this.camera.position.z + Math.cos(this.tourAngle) * this.tourTargetDistance,
    );
  }

  toggleTour(): void {
    this.setTour(!this.tourActive);
  }

  private setTour(active: boolean): void {
    this.tourActive = active;
    if (active) {
      const direction = this.controls.target.clone().sub(this.camera.position);
      this.tourTargetDistance = ORBIT_PIVOT_DISTANCE;
      this.tourAngle = Math.atan2(direction.x, direction.z);
      this.pressedKeys.clear();
    }
    this.onTourChange(active);
  }

  reset(): void {
    this.setTour(false);
    this.camera.position.copy(HOME_POSITION);
    this.controls.target.copy(HOME_TARGET);
    this.controls.update();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (isEditableTarget(event.target) || !this.controls.enabled) return;
    if (event.code === 'KeyT') {
      event.preventDefault();
      this.toggleTour();
      return;
    }
    if (NAVIGATION_KEYS.has(event.code)) {
      this.pressedKeys.add(event.code);
      if (this.tourActive) this.setTour(false);
      if (MOVEMENT_KEYS.has(event.code) && !this.hasMoved) {
        this.hasMoved = true;
        this.onFirstMove();
      }
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressedKeys.delete(event.code);
  };

  private readonly onBlur = (): void => {
    this.pressedKeys.clear();
  };

  private readonly onPointerDown = (): void => {
    if (this.tourActive) this.setTour(false);
    this.anchorOrbitTarget();
  };

  private anchorOrbitTarget(): void {
    this.camera.getWorldDirection(this.forward).normalize();
    this.controls.target
      .copy(this.camera.position)
      .addScaledVector(this.forward, ORBIT_PIVOT_DISTANCE);
    this.controls.update();
  }

  update(delta: number): void {
    this.updateVisualTransition(performance.now());
    this.applyNavigation(delta);
    this.applyTour(delta);
    this.controls.update();
  }

  private disposeWorldAssets(): void {
    this.activeSplat?.dispose();
    this.activeSplat = undefined;
    if (this.spark) this.scene.remove(this.spark);
    this.spark = undefined;
    this.worldRoot.clear();
  }

  destroy(): void {
    this.destroyed = true;
    this.loadingToken += 1;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.controls.dispose();
    this.visualTransition?.resolve();
    this.visualTransition = undefined;
    this.disposeWorldAssets();
    this.scene.clear();
  }
}
