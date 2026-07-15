/// <reference types="vite/client" />

declare global {
  interface Window {
    __THREE_APP_DIAGNOSTICS__?: {
      renderer: import('three').WebGLInfo;
      readonly state: unknown;
    };
    __THREE_APP_TEST_HOOKS__?: {
      seed: (value: number) => void;
      setState: (name: string) => void;
      setPausedForScreenshot: (paused: boolean) => void;
      setReducedMotion: (enabled: boolean) => void;
      hideDebugUi: (hidden: boolean) => void;
    };
  }
}

export {};
