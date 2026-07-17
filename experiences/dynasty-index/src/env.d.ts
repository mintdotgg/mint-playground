/// <reference types="vite/client" />

import type * as THREE from 'three';
import type { AppState } from './types';

declare global {
  interface Window {
    __DYNASTY_INDEX__?: {
      renderer: THREE.WebGLRenderer;
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      getState: () => AppState;
      getDiagnostics: () => {
        calls: number;
        triangles: number;
        geometries: number;
        textures: number;
        dpr: number;
        viewport: { width: number; height: number };
        shadows: boolean;
        postPasses: number;
      };
    };
    __THREE_APP_TEST_HOOKS__?: {
      seed: (value: number) => void;
      setState: (name: string) => void | Promise<void>;
      setPausedForScreenshot: (paused: boolean) => void;
      setReducedMotion: (enabled: boolean) => void;
      hideDebugUi: (hidden: boolean) => void;
    };
    __THREE_APP_DIAGNOSTICS__?: {
      readonly renderer: {
        calls: number;
        triangles: number;
        geometries: number;
        textures: number;
      };
      readonly state: AppState;
      assets: {
        cardArtworks: number;
        cardModels: number;
        displayModels: number;
        audioFiles: number;
        source: string;
      };
      quality: {
        dprCapDesktop: number;
        dprCapMobile: number;
        postPasses: number;
        shadowCastingLights: number;
      };
    };
  }
}

export {};
