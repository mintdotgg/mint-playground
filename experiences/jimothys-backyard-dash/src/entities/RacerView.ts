import * as THREE from 'three';
import type { RuntimeAssetRegistry } from '../assets/RuntimeAssetRegistry';
import type { GamePhase, RacerState } from '../game/types';
import { laneToWorldX } from '../game/spatial';

export class RacerView {
  readonly root = new THREE.Group();
  private readonly modelAnchor = new THREE.Group();
  private readonly shadow: THREE.Mesh;
  private readonly shield: THREE.Mesh;
  private readonly leafPile: THREE.InstancedMesh;
  private previousLane = 0;
  private time = 0;

  constructor(
    registry: RuntimeAssetRegistry,
    readonly id: RacerState['id'],
    modelKey: string,
  ) {
    this.root.name = `racer-${id}`;
    const model = registry.createModel(modelKey, id === 'jimothy' ? 1.55 : 1.62);
    this.modelAnchor.add(model);
    this.root.add(this.modelAnchor);

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(id === 'jimothy' ? 0.67 : 0.62, 24),
      new THREE.MeshBasicMaterial({ color: '#172018', transparent: true, opacity: 0.28, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.012;
    this.root.add(this.shadow);

    this.shield = new THREE.Mesh(
      new THREE.SphereGeometry(0.92, 20, 12),
      new THREE.MeshPhysicalMaterial({
        color: '#94e6dc',
        emissive: '#194f48',
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.22,
        roughness: 0.1,
        transmission: 0.22,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.shield.position.y = 0.72;
    this.shield.visible = false;
    this.root.add(this.shield);

    const leafGeometry = new THREE.IcosahedronGeometry(0.14, 0);
    const leafMaterial = new THREE.MeshStandardMaterial({ color: '#a55e37', roughness: 0.92 });
    this.leafPile = new THREE.InstancedMesh(leafGeometry, leafMaterial, 18);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    for (let index = 0; index < 18; index += 1) {
      const angle = (index / 18) * Math.PI * 2;
      const radius = 0.18 + (index % 5) * 0.16;
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle * 1.7);
      scale.set(1.25, 0.42, 0.72);
      matrix.compose(new THREE.Vector3(Math.cos(angle) * radius, 0.08 + (index % 3) * 0.035, Math.sin(angle) * radius), quaternion, scale);
      this.leafPile.setMatrixAt(index, matrix);
    }
    this.leafPile.instanceMatrix.needsUpdate = true;
    this.leafPile.visible = false;
    this.root.add(this.leafPile);
  }

  update(
    state: RacerState,
    delta: number,
    phase: GamePhase,
    shielded: boolean,
    reducedMotion: boolean,
    presentationOriginDistance = 0,
  ): void {
    this.time += delta;
    const laneX = laneToWorldX(state.visualLane);
    this.root.position.x = laneX;
    this.root.position.z = state.distance - presentationOriginDistance;

    const jumpHeight = state.jumpTimer > 0 ? Math.max(0, Math.sin(Math.PI * (state.jumpTimer / 0.82))) * 1.78 : 0;
    const speedRatio = Math.min(1, state.speed / 15);
    const bob = reducedMotion || phase !== 'racing' ? 0 : Math.sin(this.time * (10 + speedRatio * 5) + this.id.length) * 0.035 * speedRatio;
    this.modelAnchor.position.y = jumpHeight + bob;

    const laneDelta = state.visualLane - this.previousLane;
    this.previousLane = state.visualLane;
    const lean = reducedMotion ? 0 : THREE.MathUtils.clamp(-laneDelta * 2.7, -0.22, 0.22);
    this.modelAnchor.rotation.z += (lean - this.modelAnchor.rotation.z) * (1 - Math.exp(-delta * 14));
    this.modelAnchor.rotation.y = state.boostTimer > 0 && !reducedMotion ? Math.sin(this.time * 18) * 0.025 : 0;

    const scuttleScale = state.scuttleTimer > 0 ? 0.72 : 1;
    this.modelAnchor.scale.y += (scuttleScale - this.modelAnchor.scale.y) * (1 - Math.exp(-delta * 18));
    const targetXZ = state.scuttleTimer > 0 ? 1.08 : 1;
    this.modelAnchor.scale.x += (targetXZ - this.modelAnchor.scale.x) * (1 - Math.exp(-delta * 14));
    this.modelAnchor.scale.z += (targetXZ - this.modelAnchor.scale.z) * (1 - Math.exp(-delta * 14));

    const stumble = state.stumbleTimer > 0 && !reducedMotion ? Math.sin(this.time * 26) * 0.16 : 0;
    this.modelAnchor.rotation.x = stumble;
    if ((phase === 'finished' || phase === 'failed') && this.id === 'jimothy' && !reducedMotion) {
      this.modelAnchor.position.y += phase === 'finished' ? Math.abs(Math.sin(this.time * 4.6)) * 0.22 : 0;
      this.modelAnchor.rotation.y = phase === 'finished' ? Math.sin(this.time * 3.2) * 0.18 : 0.38;
    }
    this.leafPile.visible = phase === 'failed' && this.id === 'jimothy';
    if (phase === 'failed' && this.id === 'jimothy') {
      this.modelAnchor.rotation.z += (-0.46 - this.modelAnchor.rotation.z) * (1 - Math.exp(-delta * 8));
      this.modelAnchor.position.y += 0.1;
    }

    this.shadow.scale.setScalar(1 - jumpHeight * 0.12);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.08, 0.28 - jumpHeight * 0.11);
    this.shield.visible = shielded;
    if (shielded && !reducedMotion) {
      const pulse = 1 + Math.sin(this.time * 5.8) * 0.025;
      this.shield.scale.setScalar(pulse);
      this.shield.rotation.y += delta * 0.45;
    }
  }

  dispose(): void {
    this.leafPile.geometry.dispose();
    (this.leafPile.material as THREE.Material).dispose();
    this.shadow.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
    this.shield.geometry.dispose();
    (this.shield.material as THREE.Material).dispose();
  }
}
