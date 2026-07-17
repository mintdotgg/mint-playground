import * as THREE from 'three';
import type { AssetLibrary } from '../assets/AssetLibrary';
import type { ModelKey } from '../assets/assetCatalog';
import type { CircleObstacle, WorldBounds } from './CollisionSystem';

type PropPlacement = {
  key: ModelKey;
  x: number;
  z: number;
  height: number;
  rotation?: number;
  collider?: number;
};

export type BuiltWorld = {
  root: THREE.Group;
  obstacles: CircleObstacle[];
  bounds: WorldBounds;
};

const PROP_PLACEMENTS: PropPlacement[] = [
  { key: 'mossyStoneArchway', x: 0, z: -18, height: 6.5, rotation: Math.PI, collider: 1.1 },
  { key: 'collapsedArchHalf', x: -13, z: -7, height: 5.2, rotation: 0.4, collider: 1.2 },
  { key: 'tallRuneMonolith', x: 9, z: -15, height: 6.8, rotation: -0.2, collider: 1.2 },
  { key: 'brokenRuneMonolith', x: -9, z: 11, height: 3.8, rotation: 0.2, collider: 1 },
  { key: 'intactSquarePillar', x: 14, z: 5, height: 5.5, rotation: 0.1, collider: 1.1 },
  { key: 'brokenPillarStump', x: -14, z: 6, height: 2.2, rotation: -0.3, collider: .9 },
  { key: 'lowRuinedWall', x: 12, z: -5, height: 2.1, rotation: -0.7, collider: 1.5 },
  { key: 'cornerRuinedWall', x: -11, z: -14, height: 2.6, rotation: 1.1, collider: 1.5 },
  { key: 'stoneStairFlight', x: 0, z: -23, height: 2.1, rotation: Math.PI },
  { key: 'smallStoneFootbridge', x: 15, z: 15, height: 2.3, rotation: Math.PI / 2, collider: 1.2 },
  { key: 'moonwellShrineBasin', x: -15, z: 15, height: 2.2, rotation: 0.4, collider: 1.4 },
  { key: 'ancientRewardChest', x: -17, z: -19, height: 1.35, rotation: 0.7, collider: .7 },
  { key: 'runeBrazier', x: 7, z: 15, height: 2, rotation: -0.4, collider: .7 },
  { key: 'carvedStonePlinth', x: -7, z: -20, height: 1.65, rotation: 0.2, collider: .9 },
  { key: 'weatheredWaystone', x: 5, z: 10, height: 2.3, rotation: -0.7, collider: .65 },
  { key: 'thornheartArenaAltar', x: 0, z: -24, height: 1.6, rotation: 0, collider: 2.2 },
  { key: 'ancientBroadOak', x: -20, z: -13, height: 13, rotation: 0.4, collider: 2.2 },
  { key: 'twistedRootTree', x: 20, z: -15, height: 12, rotation: -0.3, collider: 2 },
  { key: 'youngBirchCluster', x: -21, z: 9, height: 9, rotation: 0.2, collider: 1.8 },
  { key: 'fallenMossyLog', x: 18, z: 2, height: 2.2, rotation: -0.9, collider: 1.4 },
  { key: 'hollowStump', x: -18, z: 1, height: 3.1, rotation: 0.4, collider: 1.1 },
  { key: 'redBerryBush', x: 16, z: -10, height: 2.3, rotation: 0.5 },
  { key: 'blueFlowerBush', x: -16, z: -9, height: 2.4, rotation: -0.4 },
  { key: 'fernClump', x: 7, z: -10, height: 1.3, rotation: 0.1 },
  { key: 'tallGrassClump', x: -6, z: -11, height: 1.45, rotation: 0.7 },
  { key: 'whiteDaisyPatch', x: 4, z: 7, height: .65, rotation: 0.4 },
  { key: 'orangeWildflowerPatch', x: -5, z: 8, height: .7, rotation: -0.3 },
  { key: 'purpleMushroomCluster', x: 10, z: 8, height: 1.2, rotation: 0.5 },
  { key: 'redMushroomCluster', x: -10, z: 3, height: .95, rotation: -0.4 },
  { key: 'hangingVineCurtain', x: 0, z: -18, height: 4.8, rotation: Math.PI },
  { key: 'mossyBoulderCluster', x: 17, z: 20, height: 3.3, rotation: 0.2, collider: 1.6 },
  { key: 'crystalFlowerCluster', x: -14, z: 20, height: 1.25, rotation: -0.2 },
  { key: 'upgradeShrineObelisk', x: 0, z: 20, height: 3.2, rotation: Math.PI, collider: .8 },
  { key: 'rootSpikeTrap', x: 12, z: 11, height: 1.8, rotation: .2 },
];

export class WorldBuilder {
  private readonly bounds: WorldBounds = { halfWidth: 24, halfDepth: 28 };

  constructor(private readonly assets: AssetLibrary) {}

  build(): BuiltWorld {
    const root = new THREE.Group();
    root.name = 'MossboundWorld';
    const obstacles: CircleObstacle[] = [];
    root.add(this.createGround());
    root.add(this.createStream());
    root.add(this.createFireflies());

    for (const placement of PROP_PLACEMENTS) {
      const prop = this.assets.create(placement.key, placement.height);
      prop.position.set(placement.x, 0, placement.z);
      prop.rotation.y = placement.rotation ?? 0;
      root.add(prop);
      if (placement.collider) obstacles.push({ x: placement.x, z: placement.z, radius: placement.collider });
    }

    // Dense repeated foliage uses real Mint props as shared visual sources.
    const grassSource = this.assets.create('tallGrassClump', 1.05);
    const fernSource = this.assets.create('fernClump', 1.15);
    for (let index = 0; index < 42; index += 1) {
      const angle = index * 2.399963;
      const radius = 10 + (index % 8) * 2.05;
      const source = index % 2 === 0 ? grassSource : fernSource;
      const clone = source.clone(true);
      clone.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
      clone.rotation.y = angle * 1.7;
      clone.scale.setScalar(.72 + (index % 4) * .11);
      root.add(clone);
    }

    return { root, obstacles, bounds: this.bounds };
  }

  private createGround(): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to author grove ground texture.');
    context.fillStyle = '#506522';
    context.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 32; y += 1) {
      for (let x = 0; x < 32; x += 1) {
        const hash = (x * 17 + y * 31 + x * y * 3) % 7;
        context.fillStyle = ['#44591d', '#5f7428', '#697e2d', '#3e5120', '#758438', '#536b28', '#61732c'][hash];
        context.fillRect(x * 16, y * 16, 16, 16);
      }
    }
    for (let index = 0; index < 180; index += 1) {
      const x = (index * 73 + index * index * 7) % 512;
      const y = (index * 131 + index * index * 3) % 512;
      context.fillStyle = index % 3 === 0 ? 'rgba(191, 211, 76, .2)' : 'rgba(27, 57, 24, .18)';
      const size = 2 + (index % 3) * 2;
      context.fillRect(x, y, size, size);
    }
    context.fillStyle = 'rgba(154, 118, 63, .72)';
    context.beginPath();
    context.moveTo(214, 512);
    context.bezierCurveTo(255, 390, 205, 280, 252, 0);
    context.lineTo(330, 0);
    context.bezierCurveTo(285, 285, 338, 404, 300, 512);
    context.closePath();
    context.fill();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    texture.anisotropy = 8;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(this.bounds.halfWidth * 2, this.bounds.halfDepth * 2),
      new THREE.MeshStandardMaterial({ map: texture, color: '#a7b265', roughness: .96, metalness: 0 }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    return mesh;
  }

  private createStream(): THREE.Mesh {
    const stream = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 15),
      new THREE.MeshPhysicalMaterial({ color: '#238a92', emissive: '#0c3842', emissiveIntensity: .3, roughness: .18, metalness: .05, transparent: true, opacity: .74 }),
    );
    stream.rotation.x = -Math.PI / 2;
    stream.rotation.z = .18;
    stream.position.set(17, .025, 13);
    return stream;
  }

  private createFireflies(): THREE.Points {
    const positions = new Float32Array(120 * 3);
    for (let index = 0; index < 120; index += 1) {
      const angle = index * 1.618;
      const radius = 4 + (index % 25) * .85;
      positions[index * 3] = Math.sin(angle) * radius;
      positions[index * 3 + 1] = .8 + ((index * 13) % 34) * .12;
      positions[index * 3 + 2] = Math.cos(angle) * radius;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: '#7ff9bf', size: .08, transparent: true, opacity: .72, depthWrite: false, blending: THREE.AdditiveBlending });
    return new THREE.Points(geometry, material);
  }
}
