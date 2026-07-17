import * as THREE from 'three';
import type { AssetLibrary } from '../assets/AssetLibrary';

export class Projectile {
  readonly group: THREE.Group;
  private readonly velocity: THREE.Vector3;
  private life = 5;

  constructor(assets: AssetLibrary, origin: THREE.Vector3, direction: THREE.Vector3, speed: number, readonly damage: number) {
    this.group = assets.create('sporeProjectilePod', .42);
    this.group.position.copy(origin);
    this.velocity = direction.clone().multiplyScalar(speed);
  }

  update(delta: number, playerPosition: THREE.Vector3): 'active' | 'hit' | 'expired' {
    this.life -= delta;
    this.group.position.addScaledVector(this.velocity, delta);
    this.group.rotation.x += delta * 5;
    this.group.rotation.y += delta * 7;
    if (this.group.position.distanceToSquared(playerPosition) < .65 * .65) return 'hit';
    return this.life <= 0 ? 'expired' : 'active';
  }
}
