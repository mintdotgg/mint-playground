/// <reference types="vite/client" />

interface ThreeGameDiagnostics {
  frame: number;
  elapsed: number;
  phase: string;
  complete: boolean;
  score: number;
  tokens: number;
  position: number;
  player: {
    lane: number;
    distance: number;
    speed: number;
    jumpTimer: number;
    scuttleTimer: number;
    boostTimer: number;
    visualOriginDistance: number;
    position: { x: number; y: number; z: number };
    screenPosition: { x: number; y: number };
  };
  renderer: { calls: number; triangles: number; geometries: number; textures: number };
  canvas: { clientWidth: number; clientHeight: number; width: number; height: number; dpr: number };
  assets: {
    models: number;
    totalModels: number;
    audio: number;
    modelTier: 'mobile' | 'desktop';
    maxConcurrentModelLoads: number;
  };
  path: {
    routeSurfaceCount: number;
    routeVisible: boolean;
    routeWidth: number;
    routeRenderOrder: number;
    nearestFinishZ: number;
    generatedBackdropActive: boolean;
    fallbackDressingVisible: boolean;
  };
  worlds: {
    activeSequence: number;
    activeName: string;
    activeReady: boolean;
    residentWorlds: number;
    readyWorlds: number;
    loadingWorlds: number;
    maxResidentWorlds: number;
    maxPagedSplats: number;
    qualityTier: 'desktop-ultra' | 'desktop-balanced' | 'mobile-high' | 'mobile-safe';
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
  audio: { contextState: string; loadedBuffers: number; streamedTracks: number; unlocked: boolean; loops: number };
  intro: { visible: boolean; elapsed: number; modelY: number; modelRotationY: number };
  simulation: {
    fixedTimestep: number;
    collision: string;
    seed: number;
    racerCount: number;
    speedMultiplier: number;
    speedIncreasePerSecond: number;
    mode: 'race' | 'endless';
    lap: number;
  };
}

interface ThreeGameTestHooks {
  seed(value: number): void;
  setState(name: string): void;
  setPausedForScreenshot(paused: boolean): void;
  setReducedMotion(enabled: boolean): void;
  setWorldCheckpoint(worldIndex: number, checkpoint: number): Promise<void>;
  setRaceCheckpoint(worldIndex: number, checkpoint: number): void;
  hideDebugUi(hidden: boolean): void;
}

interface Window {
  __THREE_GAME_DIAGNOSTICS__?: ThreeGameDiagnostics;
  __THREE_GAME_TEST_HOOKS__?: ThreeGameTestHooks;
}
