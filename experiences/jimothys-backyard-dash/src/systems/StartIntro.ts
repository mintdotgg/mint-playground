import * as THREE from 'three';
import type { RuntimeAssetRegistry } from '../assets/RuntimeAssetRegistry';
import type { GamePhase } from '../game/types';

export type StartIntroDiagnostics = {
  visible: boolean;
  elapsed: number;
  modelY: number;
  modelRotationY: number;
};

function easeOutBack(value: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
}

export class StartIntro {
  private readonly root = new THREE.Group();
  private readonly modelAnchor = new THREE.Group();
  private elapsed = 0;
  private previousPhase: GamePhase = 'menu';

  constructor(camera: THREE.PerspectiveCamera, registry: RuntimeAssetRegistry) {
    this.root.name = 'jimothy-start-intro';
    this.root.visible = false;
    const model = registry.createModel('hero-jimothy', 2.3);
    this.modelAnchor.add(model);
    const introFill = new THREE.HemisphereLight('#fff0c2', '#6b806d', 2.15);
    this.root.add(introFill);

    this.root.add(this.modelAnchor);
    camera.add(this.root);
  }

  get diagnostics(): StartIntroDiagnostics {
    return {
      visible: this.root.visible,
      elapsed: this.elapsed,
      modelY: this.modelAnchor.position.y,
      modelRotationY: this.modelAnchor.rotation.y,
    };
  }

  update(delta: number, phase: GamePhase, reducedMotion: boolean): void {
    if (phase !== 'countdown') {
      this.root.visible = false;
      this.previousPhase = phase;
      return;
    }
    if (this.previousPhase !== 'countdown') this.elapsed = 0;
    this.previousPhase = phase;
    this.elapsed += delta;
    this.root.visible = true;

    const narrow = window.innerWidth < 720;
    this.root.position.set(narrow ? 0 : 2.15, narrow ? -0.32 : -0.2, narrow ? -5.4 : -5.7);
    const entrance = Math.min(1, this.elapsed / 0.5);
    this.root.scale.setScalar(Math.max(0.05, 0.18 + easeOutBack(entrance) * 0.82));
    if (reducedMotion) {
      this.modelAnchor.position.set(0, 0, 0);
      this.modelAnchor.rotation.set(0, 0, 0);
      this.modelAnchor.scale.setScalar(1);
      return;
    }

    const spin = Math.max(0, Math.min(1, (this.elapsed - 1.25) / 0.82));
    const launch = Math.max(0, Math.min(1, (this.elapsed - 2.45) / 0.5));
    const wiggle = Math.sin(this.elapsed * 12) * 0.1 * (1 - spin);
    const bounce = Math.abs(Math.sin(this.elapsed * 6.2)) * 0.18;
    const squash = 1 - Math.abs(Math.sin(this.elapsed * 8.4)) * 0.07 * (1 - launch);
    this.modelAnchor.position.set(Math.sin(this.elapsed * 8) * 0.06, bounce + launch * 1.45, 0);
    this.modelAnchor.rotation.set(Math.sin(this.elapsed * 9) * 0.055, wiggle + spin * Math.PI * 2, Math.sin(this.elapsed * 11) * 0.09);
    this.modelAnchor.scale.set(1 / Math.sqrt(squash), squash + launch * 0.18, 1 / Math.sqrt(squash));
  }

  dispose(): void {
    this.root.removeFromParent();
  }
}
