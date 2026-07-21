import * as THREE from 'three';
import type { RaceEvent } from '../game/types';
import { createSeededRandom } from '../utils/random';

type Particle = {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  scale: number;
  color: THREE.Color;
};

export class VfxSystem {
  readonly root = new THREE.Group();
  private readonly particles: Particle[];
  private readonly particleMesh: THREE.InstancedMesh;
  private readonly speedLines: THREE.InstancedMesh;
  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly rng = createSeededRandom(991);

  constructor() {
    this.particles = Array.from({ length: 96 }, () => ({
      active: false,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      life: 0,
      maxLife: 1,
      scale: 0,
      color: new THREE.Color('#ffffff'),
    }));
    const particleGeometry = new THREE.IcosahedronGeometry(0.07, 0);
    const particleMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
    this.particleMesh = new THREE.InstancedMesh(particleGeometry, particleMaterial, this.particles.length);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    this.root.add(this.particleMesh);

    this.speedLines = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.025, 0.025, 2.4),
      new THREE.MeshBasicMaterial({ color: '#d8fff7', transparent: true, opacity: 0.42 }),
      18,
    );
    this.speedLines.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.speedLines.visible = false;
    this.root.add(this.speedLines);
  }

  handle(event: RaceEvent, playerPosition: THREE.Vector3): void {
    if (event.type === 'token') this.burst(playerPosition, '#ffd761', 7, 0.75);
    if (event.type === 'powerup') this.burst(playerPosition, '#85e0d2', 15, 1.1);
    if (event.type === 'boost') this.burst(playerPosition, '#b5f5ed', 18, 1.35);
    if (event.type === 'collision') this.burst(playerPosition, event.protected ? '#b7ece4' : '#bd7147', event.protected ? 18 : 24, 1.2);
    if (event.type === 'finish') this.burst(playerPosition.clone().add(new THREE.Vector3(0, 2, 1)), '#f6cc65', 40, 1.8);
  }

  update(delta: number, playerPosition: THREE.Vector3, boosted: boolean, reducedMotion: boolean): void {
    let visible = 0;
    for (const particle of this.particles) {
      if (!particle.active) continue;
      particle.life -= delta;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }
      particle.velocity.y -= delta * 2.8;
      particle.position.addScaledVector(particle.velocity, delta);
      const fade = particle.life / particle.maxLife;
      const scale = particle.scale * fade;
      this.matrix.compose(particle.position, this.quaternion, new THREE.Vector3(scale, scale, scale));
      this.particleMesh.setMatrixAt(visible, this.matrix);
      this.particleMesh.setColorAt(visible, particle.color);
      visible += 1;
    }
    for (let index = visible; index < this.particles.length; index += 1) {
      this.matrix.makeScale(0, 0, 0);
      this.particleMesh.setMatrixAt(index, this.matrix);
    }
    this.particleMesh.count = visible;
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;

    this.speedLines.visible = boosted && !reducedMotion;
    if (this.speedLines.visible) {
      for (let index = 0; index < 18; index += 1) {
        const angle = (index / 18) * Math.PI * 2;
        const radius = 2.8 + (index % 3) * 0.48;
        const position = new THREE.Vector3(
          playerPosition.x + Math.cos(angle) * radius,
          1.2 + Math.sin(angle) * 1.2,
          playerPosition.z - 2 + (index % 6) * 2.6,
        );
        this.matrix.compose(position, this.quaternion, new THREE.Vector3(1, 1, 1));
        this.speedLines.setMatrixAt(index, this.matrix);
      }
      this.speedLines.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.speedLines.geometry.dispose();
    (this.speedLines.material as THREE.Material).dispose();
  }

  private burst(position: THREE.Vector3, color: THREE.ColorRepresentation, count: number, energy: number): void {
    for (let index = 0; index < count; index += 1) {
      const particle = this.particles.find((item) => !item.active);
      if (!particle) return;
      const angle = this.rng() * Math.PI * 2;
      const speed = (0.9 + this.rng() * 2.2) * energy;
      particle.active = true;
      particle.position.copy(position).add(new THREE.Vector3((this.rng() - 0.5) * 0.5, 0.35 + this.rng() * 0.45, (this.rng() - 0.5) * 0.5));
      particle.velocity.set(Math.cos(angle) * speed, 0.8 + this.rng() * 2.1 * energy, Math.sin(angle) * speed);
      particle.maxLife = 0.45 + this.rng() * 0.55;
      particle.life = particle.maxLife;
      particle.scale = 0.7 + this.rng() * 1.5;
      particle.color.set(color).offsetHSL((this.rng() - 0.5) * 0.06, 0, (this.rng() - 0.5) * 0.12);
    }
  }
}
