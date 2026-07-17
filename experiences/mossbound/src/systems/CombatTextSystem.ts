import * as THREE from 'three';

export type CombatTextKind = 'damage' | 'kill' | 'xp' | 'coin' | 'heal';

type Floater = {
  element: HTMLDivElement;
  position: THREE.Vector3;
  active: boolean;
  life: number;
  duration: number;
  drift: number;
  kind: CombatTextKind;
};

const FLOATER_COUNT = 14;

export class CombatTextSystem {
  private readonly floaters: Floater[];
  private readonly projected = new THREE.Vector3();
  private serial = 0;

  constructor(private readonly container: HTMLElement) {
    this.floaters = Array.from({ length: FLOATER_COUNT }, () => {
      const element = document.createElement('div');
      element.className = 'combat-floater';
      container.append(element);
      return {
        element,
        position: new THREE.Vector3(),
        active: false,
        life: 0,
        duration: .7,
        drift: 0,
        kind: 'damage',
      };
    });
  }

  show(position: THREE.Vector3, text: string, kind: CombatTextKind): void {
    const floater = this.floaters.find((candidate) => !candidate.active)
      ?? this.floaters.reduce((oldest, candidate) => candidate.life < oldest.life ? candidate : oldest);
    floater.active = true;
    floater.kind = kind;
    floater.duration = kind === 'kill' ? .88 : .7;
    floater.life = floater.duration;
    floater.position.copy(position);
    floater.drift = ((this.serial % 5) - 2) * 7;
    floater.element.textContent = text;
    floater.element.className = `combat-floater ${kind}`;
    floater.element.style.display = 'block';
    this.serial += 1;
  }

  update(delta: number, camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement): void {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    for (const floater of this.floaters) {
      if (!floater.active) continue;
      floater.life -= delta;
      if (floater.life <= 0) {
        this.deactivate(floater);
        continue;
      }

      const progress = 1 - floater.life / floater.duration;
      this.projected.copy(floater.position);
      this.projected.y += progress * (floater.kind === 'kill' ? 1.35 : .9);
      this.projected.project(camera);
      if (this.projected.z < -1 || this.projected.z > 1) {
        floater.element.style.display = 'none';
        continue;
      }

      floater.element.style.display = 'block';
      const x = (this.projected.x * .5 + .5) * width + floater.drift * progress;
      const y = (-this.projected.y * .5 + .5) * height;
      const enter = Math.min(1, progress / .16);
      const exit = Math.min(1, floater.life / .2);
      const punch = floater.kind === 'kill' ? 1.18 : 1;
      const scale = (.72 + enter * .28) * punch;
      floater.element.style.opacity = String(Math.min(enter, exit));
      floater.element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale})`;
    }
  }

  clear(): void {
    for (const floater of this.floaters) this.deactivate(floater);
  }

  dispose(): void {
    this.clear();
    this.container.replaceChildren();
  }

  private deactivate(floater: Floater): void {
    floater.active = false;
    floater.element.style.display = 'none';
  }
}
