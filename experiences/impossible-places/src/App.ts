import * as THREE from 'three';
import type { SparkRenderer } from '@sparkjsdev/spark';

import { DESTINATIONS, destinationById, type Destination } from './destinations';
import { SplatTransition } from './world/SplatTransition';
import { WorldScene } from './world/WorldScene';

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing required element #${id}`);
  return element as T;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export class App {
  private readonly container = requiredElement<HTMLElement>('app');
  private readonly magazineCover = requiredElement<HTMLElement>('magazine-cover');
  private readonly coverIssue = requiredElement<HTMLElement>('cover-issue');
  private readonly coverLeadLabel = requiredElement<HTMLElement>('cover-lead-label');
  private readonly coverLeadTitle = requiredElement<HTMLElement>('cover-lead-title');
  private readonly coverLeadCopy = requiredElement<HTMLElement>('cover-lead-copy');
  private readonly coverStory = requiredElement<HTMLElement>('cover-story');
  private readonly coverSideLabel = requiredElement<HTMLElement>('cover-side-label');
  private readonly coverSideTitle = requiredElement<HTMLElement>('cover-side-title');
  private readonly coverFolio = requiredElement<HTMLElement>('cover-folio');
  private readonly coverChapter = requiredElement<HTMLElement>('cover-chapter');
  private readonly coverFooter = requiredElement<HTMLElement>('cover-footer');
  private readonly coverEdgeLeft = requiredElement<HTMLElement>('cover-edge-left');
  private readonly coverEdgeRight = requiredElement<HTMLElement>('cover-edge-right');
  private readonly coverNextIssue = requiredElement<HTMLElement>('cover-next-issue');
  private readonly worldCopy = requiredElement<HTMLElement>('world-copy');
  private readonly worldKicker = requiredElement<HTMLElement>('world-kicker');
  private readonly worldTitle = requiredElement<HTMLElement>('world-title');
  private readonly worldDescription = requiredElement<HTMLElement>('world-description');
  private readonly worldCoordinate = requiredElement<HTMLElement>('world-coordinate');
  private readonly worldStrip = requiredElement<HTMLElement>('world-strip');
  private readonly previousButton = requiredElement<HTMLButtonElement>('previous-world');
  private readonly nextButton = requiredElement<HTMLButtonElement>('next-world');
  private readonly worldControls = requiredElement<HTMLElement>('world-controls');
  private readonly worldStatus = requiredElement<HTMLElement>('world-status');
  private readonly worldStatusLabel = requiredElement<HTMLElement>('world-status-label');
  private readonly retryButton = requiredElement<HTMLButtonElement>('retry-button');
  private readonly tourButton = requiredElement<HTMLButtonElement>('tour-button');
  private readonly resetButton = requiredElement<HTMLButtonElement>('reset-button');
  private readonly transitionCanvas = requiredElement<HTMLCanvasElement>('splat-transition');
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly splatTransition: SplatTransition;
  private sharedSpark?: SparkRenderer;
  private lastFrameSeconds = performance.now() / 1000;
  private elapsedSeconds = 0;
  private activeWorld?: WorldScene;
  private selected: Destination = DESTINATIONS[0]!;
  private transitioning = true;
  private statusGeneration = 0;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private coverAnimationFrame?: number;
  private typographyExitTimer?: number;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.01,
      2_000,
    );
    this.splatTransition = new SplatTransition(this.transitionCanvas);
    this.splatTransition.setReducedMotion(this.reducedMotion);

    this.buildWorldStrip();
    this.bindUi();
    this.updatePresentation(this.selected);

    window.addEventListener('resize', this.onResize);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('keydown', this.onKeyDown);
    this.renderer.setAnimationLoop(this.render);
    this.installDiagnostics();
    void this.openInitialWorld();
  }

  private pixelRatio(): number {
    const cap = window.innerWidth < 700 ? 1.25 : 1.5;
    return Math.min(window.devicePixelRatio, cap);
  }

  private buildWorldStrip(): void {
    for (const destination of DESTINATIONS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'world-card';
      button.dataset.destinationId = destination.id;
      button.style.setProperty('--card-accent', destination.accent);
      button.setAttribute('aria-label', `Open ${destination.name}`);
      button.innerHTML = `
        <img class="world-thumbnail" src="${destination.thumbnail}" alt="" />
        <span class="card-index">${String(destination.index).padStart(2, '0')}</span>
        <span class="card-name">${destination.shortName}</span>
      `;
      button.addEventListener('click', () => {
        const direction = destination.index > this.selected.index ? 1 : -1;
        void this.switchWorld(destination.id, direction);
      });
      this.worldStrip.appendChild(button);
    }
  }

  private bindUi(): void {
    this.previousButton.addEventListener('click', () => void this.stepWorld(-1));
    this.nextButton.addEventListener('click', () => void this.stepWorld(1));
    this.tourButton.addEventListener('click', () => this.activeWorld?.toggleTour());
    this.resetButton.addEventListener('click', () => this.activeWorld?.reset());
    this.retryButton.addEventListener('click', () => void this.retryActiveWorld());
  }

  private createWorld(destination: Destination): WorldScene {
    return new WorldScene({
      renderer: this.renderer,
      camera: this.camera,
      destination,
      initialOpacity: 0,
      getSparkRenderer: () => this.getSharedSparkRenderer(),
      onStatus: (state, label) => this.setWorldStatus(state, label),
      onFirstMove: () => this.dismissMagazineCover(),
      onTourChange: (active) => {
        this.tourButton.textContent = active ? 'Stop tour' : 'Start tour';
        this.tourButton.dataset.active = String(active);
      },
    });
  }

  private async getSharedSparkRenderer(): Promise<SparkRenderer> {
    if (this.sharedSpark) return this.sharedSpark;
    const { SparkRenderer } = await import('@sparkjsdev/spark');
    this.sharedSpark = new SparkRenderer({ renderer: this.renderer, enableLod: true });
    return this.sharedSpark;
  }

  private async openInitialWorld(): Promise<void> {
    document.body.dataset.transitioning = 'true';
    const preparePromise = this.splatTransition.beginInitial(this.selected);
    this.activeWorld = this.createWorld(this.selected);
    const loadPromise = this.activeWorld.load();
    await preparePromise;
    const loaded = await loadPromise;
    if (!loaded || !this.activeWorld) {
      this.splatTransition.cancel();
      this.transitioning = false;
      document.body.dataset.transitioning = 'false';
      return;
    }

    this.setWorldStatus('loading', `Materializing ${this.selected.shortName}…`);
    await Promise.all([
      this.activeWorld.transitionIn(this.motionDuration(1_180)),
      this.splatTransition.reveal(),
    ]);
    this.activeWorld.setInputEnabled(true);
    this.transitioning = false;
    document.body.dataset.transitioning = 'false';
    this.showMagazineCover();
    this.setWorldStatus('ready', `${this.selected.shortName} ready`);
    void this.splatTransition.prepare(DESTINATIONS);
  }

  private async switchWorld(id: string, direction: number): Promise<void> {
    const incoming = destinationById(id);
    if (this.transitioning || incoming.id === this.selected.id) return;

    const outgoing = this.selected;
    this.transitioning = true;
    document.body.dataset.transitioning = 'true';
    this.hideMagazineCover();
    this.setCarouselEnabled(false);
    this.updatePresentation(incoming);
    await this.splatTransition.begin(outgoing, incoming);

    const outgoingWorld = this.activeWorld;
    await outgoingWorld?.transitionOut(this.motionDuration(620));
    outgoingWorld?.destroy();

    this.activeWorld = this.createWorld(incoming);
    const loaded = await this.activeWorld.load();
    if (!loaded || !this.activeWorld) {
      this.splatTransition.cancel();
      this.finishTransition(false);
      return;
    }

    this.setWorldStatus('loading', `Resolving ${incoming.shortName} from points…`);
    await Promise.all([
      this.activeWorld.transitionIn(this.motionDuration(1_180)),
      this.splatTransition.reveal(),
    ]);
    this.activeWorld.setInputEnabled(true);
    this.setWorldStatus('ready', `${incoming.shortName} ready`);
    this.finishTransition(true);

    // Direction remains an explicit part of the carousel contract for future
    // camera-biased transitions and keeps direct-card selection deterministic.
    document.body.dataset.direction = direction < 0 ? 'previous' : 'next';
  }

  private finishTransition(showCover: boolean): void {
    this.transitioning = false;
    document.body.dataset.transitioning = 'false';
    this.setCarouselEnabled(true);
    if (showCover) this.showMagazineCover();
  }

  private async retryActiveWorld(): Promise<void> {
    if (this.transitioning || !this.activeWorld) return;
    this.transitioning = true;
    document.body.dataset.transitioning = 'true';
    this.hideMagazineCover();
    this.setCarouselEnabled(false);
    await this.splatTransition.beginInitial(this.selected);
    const loaded = await this.activeWorld.load();
    if (loaded) {
      await Promise.all([
        this.activeWorld.transitionIn(this.motionDuration(1_180)),
        this.splatTransition.reveal(),
      ]);
      this.activeWorld.setInputEnabled(true);
      this.setWorldStatus('ready', `${this.selected.shortName} ready`);
    } else {
      this.splatTransition.cancel();
    }
    this.finishTransition(loaded);
  }

  private stepWorld(direction: number): void {
    const currentIndex = DESTINATIONS.findIndex((destination) => destination.id === this.selected.id);
    const nextIndex = (currentIndex + direction + DESTINATIONS.length) % DESTINATIONS.length;
    const destination = DESTINATIONS[nextIndex];
    if (destination) void this.switchWorld(destination.id, direction);
  }

  private updatePresentation(destination: Destination): void {
    this.selected = destination;
    document.documentElement.style.setProperty('--accent', destination.accent);
    document.documentElement.style.setProperty('--accent-soft', destination.accentSoft);
    this.worldKicker.textContent = `${String(destination.index).padStart(2, '0')} · ${destination.kicker}`;
    this.worldTitle.textContent = destination.name;
    this.worldDescription.textContent = destination.description;
    this.worldCoordinate.textContent = destination.coordinate;
    this.coverIssue.textContent = destination.editorial.issue;
    this.coverLeadLabel.textContent = destination.editorial.leadLabel;
    this.coverLeadTitle.textContent = destination.editorial.leadTitle;
    this.coverLeadCopy.textContent = destination.editorial.leadCopy;
    this.renderCoverStory(destination.editorial.story);
    this.coverSideLabel.textContent = destination.editorial.sideLabel;
    this.coverSideTitle.textContent = destination.editorial.sideTitle;
    this.coverFolio.textContent = destination.editorial.folio;
    this.coverChapter.textContent = destination.editorial.chapter;
    this.coverFooter.textContent = destination.editorial.footer;
    this.coverEdgeLeft.textContent = destination.editorial.edgeLeft;
    this.coverEdgeRight.textContent = destination.editorial.edgeRight;
    this.coverNextIssue.textContent = destination.editorial.nextIssue;
    this.magazineCover.dataset.destination = destination.id;
    document.body.dataset.destination = destination.id;
    document.title = `${destination.shortName} · Impossible Places`;

    for (const card of this.worldStrip.querySelectorAll<HTMLButtonElement>('.world-card')) {
      const active = card.dataset.destinationId === destination.id;
      card.classList.toggle('is-active', active);
      card.setAttribute('aria-current', String(active));
    }
  }

  private renderCoverStory(paragraphs: string[]): void {
    const groups = [false, true].map((duplicate) => {
      const group = document.createElement('div');
      group.className = 'cover-story-group';
      if (duplicate) group.setAttribute('aria-hidden', 'true');
      paragraphs.forEach((copy, index) => {
        const paragraph = document.createElement('p');
        paragraph.dataset.storyIndex = String(index + 1).padStart(2, '0');
        paragraph.textContent = copy;
        group.appendChild(paragraph);
      });
      return group;
    });
    this.coverStory.replaceChildren(...groups);
  }

  private hideMagazineCover(): void {
    this.clearTypographyExitTimer();
    if (this.coverAnimationFrame !== undefined) {
      window.cancelAnimationFrame(this.coverAnimationFrame);
      this.coverAnimationFrame = undefined;
    }
    document.body.dataset.cover = 'hidden';
  }

  private showMagazineCover(): void {
    this.hideMagazineCover();
    this.coverAnimationFrame = window.requestAnimationFrame(() => {
      this.coverAnimationFrame = window.requestAnimationFrame(() => {
        document.body.dataset.cover = 'visible';
        this.coverAnimationFrame = undefined;
      });
    });
  }

  private dismissMagazineCover(): void {
    if (document.body.dataset.cover !== 'visible') return;
    this.clearTypographyExitTimer();
    this.typographyExitTimer = window.setTimeout(() => {
      if (document.body.dataset.cover === 'visible') {
        document.body.dataset.cover = 'immersive';
      }
      this.typographyExitTimer = undefined;
    }, 1_000);
  }

  private clearTypographyExitTimer(): void {
    if (this.typographyExitTimer === undefined) return;
    window.clearTimeout(this.typographyExitTimer);
    this.typographyExitTimer = undefined;
  }

  private setCarouselEnabled(enabled: boolean): void {
    this.previousButton.disabled = !enabled;
    this.nextButton.disabled = !enabled;
    this.tourButton.disabled = !enabled;
    this.resetButton.disabled = !enabled;
    for (const card of this.worldStrip.querySelectorAll<HTMLButtonElement>('.world-card')) {
      card.disabled = !enabled;
    }
  }

  private motionDuration(duration: number): number {
    return Math.max(1, duration * this.splatTransition.motionScale);
  }

  private setWorldStatus(state: 'loading' | 'ready' | 'error', label: string): void {
    const generation = ++this.statusGeneration;
    this.worldStatus.hidden = false;
    this.worldStatus.dataset.state = state;
    this.worldStatusLabel.textContent = label;
    this.retryButton.hidden = state !== 'error';
    if (state === 'ready') {
      window.setTimeout(() => {
        if (generation === this.statusGeneration && this.worldStatus.dataset.state === 'ready') {
          this.worldStatus.hidden = true;
        }
      }, 2_600);
    }
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (isEditableTarget(event.target) || this.transitioning) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.stepWorld(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.stepWorld(1);
    }
  };

  private readonly onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.splatTransition.resize();
  };

  private readonly render = (): void => {
    const now = performance.now();
    const nowSeconds = now / 1_000;
    const delta = Math.min(Math.max(nowSeconds - this.lastFrameSeconds, 0), 0.1);
    this.lastFrameSeconds = nowSeconds;
    this.elapsedSeconds += delta;
    this.activeWorld?.update(delta);
    if (this.activeWorld) this.renderer.render(this.activeWorld.scene, this.camera);
    this.splatTransition.update(now);
  };

  private installDiagnostics(): void {
    const getState = () => ({
      mode: 'world-carousel',
      selectedDestination: this.selected.id,
      transitioning: this.transitioning,
      cameraPosition: this.camera.position.toArray(),
    });
    window.__THREE_APP_DIAGNOSTICS__ = {
      renderer: this.renderer.info,
      get state() {
        return getState();
      },
    };
    window.__THREE_APP_TEST_HOOKS__ = {
      setState: (state: string) => {
        if (state.startsWith('destination:')) {
          const id = state.slice('destination:'.length);
          const destination = destinationById(id);
          const direction = destination.index > this.selected.index ? 1 : -1;
          void this.switchWorld(id, direction);
        }
      },
      setPausedForScreenshot: (paused: boolean) => {
        this.splatTransition.setPaused(paused);
      },
      setReducedMotion: (enabled: boolean) => {
        this.reducedMotion = enabled;
        this.splatTransition.setReducedMotion(enabled);
      },
      hideDebugUi: (hidden: boolean) => {
        document.body.dataset.testUiHidden = String(hidden);
      },
      seed: (value: number) => {
        this.splatTransition.setSeed(value);
      },
    };
  }

  private readonly onPageHide = (): void => {
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('keydown', this.onKeyDown);
    this.clearTypographyExitTimer();
    if (this.coverAnimationFrame !== undefined) window.cancelAnimationFrame(this.coverAnimationFrame);
    this.activeWorld?.destroy();
    this.sharedSpark?.dispose();
    this.sharedSpark = undefined;
    this.renderer.dispose();
  };
}
