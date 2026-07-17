import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AudioDirector } from '../audio/AudioDirector';
import { cards, getCard } from '../catalog/cards';
import { CameraDirector } from '../scene/CameraDirector';
import { CardRig } from '../scene/CardRig';
import { LightingRig } from '../scene/LightingRig';
import { VaultScene } from '../scene/VaultScene';
import type { AppState } from '../types';
import { UIController } from '../ui/UIController';

function damp(current: number, target: number, smoothing: number, delta: number): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-smoothing * delta));
}

function usesCompactLayout(width: number, height: number): boolean {
  return width <= 700 || (width <= 980 && height <= 520);
}

export class DynastyIndex {
  private readonly ui: UIController;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly cameraDirector: CameraDirector;
  private readonly vault: VaultScene;
  private readonly cardRig: CardRig;
  private readonly lighting: LightingRig;
  private readonly audio = new AudioDirector();
  private readonly clock = new THREE.Clock();
  private readonly reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly state: AppState = {
    selectedIndex: 0,
    side: 'front',
    inspection: false,
    notesOpen: false,
    muted: false,
    transitioning: false,
  };

  private animationFrame = 0;
  private reducedMotion = this.reducedMotionQuery.matches;
  private exposureTarget = cards[0].lighting.exposure;
  private isDisposed = false;
  private screenshotPaused = false;
  private frozenElapsed = 0;
  private automatedFrameDirty = true;

  constructor(root: HTMLElement) {
    this.ui = new UIController(root, cards, {
      onSelect: (index) => void this.select(index),
      onFlip: () => this.flip(),
      onInspect: () => this.toggleInspection(),
      onReset: () => this.reset(),
      onNotes: () => this.toggleNotes(),
      onMute: () => this.toggleMute(),
      onUnlockAudio: () => void this.audio.unlock(),
    });

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.ui.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.exposureTarget;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.background = new THREE.Color(0x171a1b);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.86;
    pmrem.dispose();

    this.vault = new VaultScene(cards[0]);
    this.scene.add(this.vault.root);
    this.cardRig = new CardRig(this.vault.cardAnchor);
    this.scene.add(this.cardRig.root);
    this.lighting = new LightingRig(this.vault.cardAnchor, cards[0]);
    this.scene.add(this.lighting.root);

    this.camera = new THREE.PerspectiveCamera(cards[0].camera.fov, 1, 0.05, 50);
    this.cameraDirector = new CameraDirector(this.camera, this.ui.canvas, this.vault.cardAnchor, cards[0]);
    this.cameraDirector.controls.addEventListener('change', this.invalidateAutomatedFrame);
    this.cardRig.setReducedMotion(this.reducedMotion);
    this.cameraDirector.setReducedMotion(this.reducedMotion);
    this.lighting.setReducedMotion(this.reducedMotion);

    this.ui.render(cards[0], this.state);
    this.bindEvents();
    this.resize();
    this.installDiagnostics();
  }

  async start(): Promise<void> {
    try {
      const [, loadedMintProps] = await Promise.all([
        this.cardRig.preload(cards).then(() => this.cardRig.setInitialCard(cards[0])),
        this.vault.loadMintDisplayKit(),
      ]);
      if (loadedMintProps === 0) this.ui.setStatus('Generated display kit unavailable / authored fallback active');
      this.ui.setStatus('Specimen 01 ready', true);
      this.ui.setReady();
      this.clock.start();
      this.animationFrame = requestAnimationFrame(this.animate);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to initialize the archive.';
      this.ui.setError(message);
      throw error;
    }
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.onKeyDown);
    this.ui.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.ui.canvas.addEventListener('pointermove', this.onPointerMove);
    this.ui.canvas.addEventListener('dblclick', this.onDoubleClick);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.reducedMotionQuery.addEventListener('change', this.onReducedMotionChange);
  }

  private readonly onPointerDown = (): void => {
    void this.audio.unlock();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const bounds = this.ui.canvas.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * 2 - 1;
    const y = ((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * 2 - 1;
    this.lighting.setPointer(x, y);
    this.invalidateAutomatedFrame();
  };

  private readonly invalidateAutomatedFrame = (): void => {
    this.automatedFrameDirty = true;
  };

  private readonly onDoubleClick = (): void => {
    if (!this.state.inspection) this.toggleInspection();
  };

  private readonly onVisibilityChange = (): void => {
    this.audio.setPageVisible(!document.hidden);
    if (!document.hidden) this.clock.getDelta();
  };

  private readonly onReducedMotionChange = (event: MediaQueryListEvent): void => {
    this.applyReducedMotion(event.matches);
  };

  private applyReducedMotion(active: boolean): void {
    this.reducedMotion = active;
    this.cardRig.setReducedMotion(active);
    this.cameraDirector.setReducedMotion(active);
    this.lighting.setReducedMotion(active);
    this.resize();
    this.invalidateAutomatedFrame();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.matches('input, textarea, select')) return;

    switch (event.key.toLowerCase()) {
      case 'arrowleft':
        event.preventDefault();
        void this.select((this.state.selectedIndex - 1 + cards.length) % cards.length);
        break;
      case 'arrowright':
        event.preventDefault();
        void this.select((this.state.selectedIndex + 1) % cards.length);
        break;
      case 'f':
        this.flip();
        break;
      case 'i':
        this.toggleInspection();
        break;
      case 'r':
        this.reset();
        break;
      case 'n':
        this.toggleNotes();
        break;
      case 'm':
        this.toggleMute();
        break;
      case 'escape':
        if (this.state.notesOpen) this.toggleNotes();
        else if (this.state.inspection) this.toggleInspection();
        break;
      default: {
        const numeric = Number.parseInt(event.key, 10);
        if (numeric >= 1 && numeric <= cards.length) void this.select(numeric - 1);
      }
    }
  };

  private async select(index: number): Promise<void> {
    if (this.state.transitioning || index === this.state.selectedIndex) return;
    const card = getCard(index);
    this.state.selectedIndex = index;
    this.state.side = 'front';
    this.state.notesOpen = false;
    this.state.transitioning = true;
    this.ui.render(card, this.state);
    this.ui.setStatus(`Indexing specimen ${card.index}`);
    this.audio.playSelection();
    this.cardRig.setSide('front');
    this.vault.setProfile(card, this.reducedMotion);
    this.lighting.setProfile(card, this.reducedMotion);
    this.cameraDirector.setProfile(card);
    this.exposureTarget = card.lighting.exposure;
    this.invalidateAutomatedFrame();

    await this.cardRig.transitionTo(card);
    this.state.transitioning = false;
    this.ui.render(card, this.state);
    this.ui.setStatus(`${card.player} / ${card.rarity}`, true);
    this.invalidateAutomatedFrame();
  }

  private flip(): void {
    if (this.state.transitioning) return;
    this.state.side = this.state.side === 'front' ? 'back' : 'front';
    this.cardRig.setSide(this.state.side);
    this.invalidateAutomatedFrame();
    this.ui.render(getCard(this.state.selectedIndex), this.state);
    this.ui.setStatus(this.state.side === 'front' ? 'Front surface' : 'Archive reverse', true);
    if (this.state.side === 'front') this.audio.playFoil();
  }

  private toggleInspection(): void {
    if (this.state.transitioning) return;
    this.state.inspection = !this.state.inspection;
    if (this.state.inspection) this.state.notesOpen = false;
    this.cardRig.setInspection(this.state.inspection);
    this.cameraDirector.setInspection(this.state.inspection);
    this.lighting.setInspection(this.state.inspection);
    this.invalidateAutomatedFrame();
    this.ui.render(getCard(this.state.selectedIndex), this.state);
    this.ui.setStatus(this.state.inspection ? 'Focused inspection / light follows pointer' : 'Vault presentation', true);
    if (this.state.inspection) this.audio.playFoil();
  }

  private reset(): void {
    this.state.side = 'front';
    this.state.inspection = false;
    this.state.notesOpen = false;
    this.cardRig.setSide('front');
    this.cardRig.setInspection(false);
    this.cameraDirector.setInspection(false);
    this.cameraDirector.reset();
    this.lighting.setInspection(false);
    this.invalidateAutomatedFrame();
    this.ui.render(getCard(this.state.selectedIndex), this.state);
    this.ui.setStatus('View reset', true);
  }

  private toggleNotes(): void {
    this.state.notesOpen = !this.state.notesOpen;
    if (this.state.notesOpen && this.state.inspection) {
      this.state.inspection = false;
      this.cardRig.setInspection(false);
      this.cameraDirector.setInspection(false);
      this.lighting.setInspection(false);
      this.invalidateAutomatedFrame();
    }
    this.ui.render(getCard(this.state.selectedIndex), this.state);
  }

  private toggleMute(): void {
    this.state.muted = !this.state.muted;
    this.audio.setMuted(this.state.muted);
    this.ui.render(getCard(this.state.selectedIndex), this.state);
    this.ui.setStatus(this.state.muted ? 'Audio muted' : 'Audio enabled', true);
  }

  private readonly resize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const compact = usesCompactLayout(width, height);
    const dprCap = compact ? 1.45 : 1.8;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.reducedMotion ? 1.5 : dprCap));
    this.renderer.setSize(width, height, false);
    this.cameraDirector.resize(width, height, compact);
  };

  private readonly animate = (): void => {
    if (this.isDisposed) return;
    this.animationFrame = requestAnimationFrame(this.animate);
    if (document.hidden) return;
    if (navigator.webdriver && !this.automatedFrameDirty) return;

    const delta = this.screenshotPaused ? 0 : Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.screenshotPaused ? this.frozenElapsed : this.clock.elapsedTime;
    this.cameraDirector.update(delta);
    this.lighting.update(delta, elapsed);
    this.vault.update(delta);
    this.cardRig.setLightPosition(this.lighting.getInspectionLightPosition());
    this.cardRig.update(delta, elapsed);
    this.renderer.toneMappingExposure = damp(this.renderer.toneMappingExposure, this.exposureTarget, 3.2, delta);
    this.renderer.render(this.scene, this.camera);
    this.automatedFrameDirty = false;
  };

  private installDiagnostics(): void {
    window.__DYNASTY_INDEX__ = {
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
      getState: () => ({ ...this.state }),
      getDiagnostics: () => ({
        calls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
        geometries: this.renderer.info.memory.geometries,
        textures: this.renderer.info.memory.textures,
        dpr: this.renderer.getPixelRatio(),
        viewport: { width: window.innerWidth, height: window.innerHeight },
        shadows: this.renderer.shadowMap.enabled,
        postPasses: 0,
      }),
    };
    const renderer = this.renderer;
    const getState = () => ({ ...this.state });
    window.__THREE_APP_DIAGNOSTICS__ = {
      get renderer() {
        return {
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
        };
      },
      get state() {
        return getState();
      },
      assets: {
        cardArtworks: 6,
        cardModels: 0,
        displayModels: 4,
        audioFiles: 3,
        source: 'Mint CDN runtime URLs from mint-assets.json',
      },
      quality: {
        dprCapDesktop: 1.8,
        dprCapMobile: 1.45,
        postPasses: 0,
        shadowCastingLights: 0,
      },
    };
    window.__THREE_APP_TEST_HOOKS__ = {
      seed: () => undefined,
      setState: async (name: string) => {
        this.applyReducedMotion(true);
        if (name === 'primary') {
          if (this.state.selectedIndex !== 0) await this.select(0);
          this.reset();
        }
        if (name === 'selected-configured') await this.select(5);
        if (name === 'inspection' && !this.state.inspection) this.toggleInspection();
      },
      setPausedForScreenshot: (paused: boolean) => {
        this.screenshotPaused = paused;
        if (paused) this.frozenElapsed = this.clock.elapsedTime;
        else this.clock.getDelta();
      },
      setReducedMotion: (enabled: boolean) => this.applyReducedMotion(enabled),
      hideDebugUi: () => undefined,
    };
  }

  dispose(): void {
    this.isDisposed = true;
    cancelAnimationFrame(this.animationFrame);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.onKeyDown);
    this.ui.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.ui.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.ui.canvas.removeEventListener('dblclick', this.onDoubleClick);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.reducedMotionQuery.removeEventListener('change', this.onReducedMotionChange);
    this.cameraDirector.controls.removeEventListener('change', this.invalidateAutomatedFrame);
    this.cameraDirector.dispose();
    this.cardRig.dispose();
    this.audio.dispose();
    this.renderer.dispose();
    delete window.__DYNASTY_INDEX__;
    delete window.__THREE_APP_DIAGNOSTICS__;
    delete window.__THREE_APP_TEST_HOOKS__;
  }
}
