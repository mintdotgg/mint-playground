import * as THREE from 'three';

export type CircleObstacle = {
  x: number;
  z: number;
  radius: number;
};

export type WorldBounds = {
  halfWidth: number;
  halfDepth: number;
};

export class CollisionSystem {
  private readonly push = new THREE.Vector2();

  resolvePlayer(position: THREE.Vector3, radius: number, bounds: WorldBounds, obstacles: readonly CircleObstacle[]): void {
    position.x = THREE.MathUtils.clamp(position.x, -bounds.halfWidth + radius, bounds.halfWidth - radius);
    position.z = THREE.MathUtils.clamp(position.z, -bounds.halfDepth + radius, bounds.halfDepth - radius);

    for (const obstacle of obstacles) {
      this.push.set(position.x - obstacle.x, position.z - obstacle.z);
      const minDistance = radius + obstacle.radius;
      const distanceSq = this.push.lengthSq();
      if (distanceSq >= minDistance * minDistance) continue;
      if (distanceSq < 0.0001) this.push.set(1, 0);
      else this.push.multiplyScalar(1 / Math.sqrt(distanceSq));
      position.x = obstacle.x + this.push.x * minDistance;
      position.z = obstacle.z + this.push.y * minDistance;
    }
  }
}
