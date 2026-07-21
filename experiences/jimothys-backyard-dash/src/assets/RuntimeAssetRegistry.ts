import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { createCompatibleGltfLoader, type CompatibleGltfLoader } from './createGltfLoader';
import { MOBILE_MODEL_PATHS, MODEL_PATHS } from './assetPaths';

type LoadedModel = {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
};

const SOURCE_ROTATION_Y: Record<string, number> = {
  // The supplied Jimothy GLB is authored lengthwise on +X; rotate once at the
  // import boundary so his nose aligns with the game's canonical +Z forward.
  'hero-jimothy': -Math.PI / 2,
};

export class RuntimeAssetRegistry {
  private readonly models = new Map<string, LoadedModel>();
  private readonly compatible: CompatibleGltfLoader;
  private readonly paths: Record<string, string>;
  readonly qualityTier: 'mobile' | 'desktop';
  readonly maxConcurrentLoads: number;

  constructor(renderer: THREE.WebGLRenderer) {
    this.compatible = createCompatibleGltfLoader(renderer);
    const useMobileTier = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760;
    this.qualityTier = useMobileTier ? 'mobile' : 'desktop';
    this.paths = useMobileTier ? MOBILE_MODEL_PATHS : MODEL_PATHS;
    this.maxConcurrentLoads = useMobileTier ? 2 : 4;
  }

  get modelCount(): number {
    return Object.keys(this.paths).length;
  }

  get loadedModelCount(): number {
    return this.models.size;
  }

  async loadAll(onItem: (key: string, loaded: number, total: number) => void): Promise<void> {
    const entries = Object.entries(this.paths);
    let loaded = 0;
    let nextIndex = 0;

    const worker = async (): Promise<void> => {
      while (nextIndex < entries.length) {
        const [key, path] = entries[nextIndex++];
        let gltf: GLTF;
        try {
          gltf = await this.compatible.loader.loadAsync(path);
        } catch (cause) {
          throw new Error(`Model load failed: ${key} (${this.qualityTier} tier)`, { cause });
        }
        gltf.scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.castShadow = true;
          object.receiveShadow = true;
          object.frustumCulled = true;
        });
        this.models.set(key, { scene: gltf.scene, animations: gltf.animations });
        loaded += 1;
        onItem(key, loaded, entries.length);
      }
    };

    const workerCount = Math.min(this.maxConcurrentLoads, entries.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
  }

  has(key: string): boolean {
    return this.models.has(key);
  }

  createModel(key: string, targetLongest = 1): THREE.Group {
    const source = this.models.get(key);
    if (!source) return this.createFallback(key, targetLongest);
    const clone = source.scene.clone(true);
    const wrapper = new THREE.Group();
    wrapper.name = `mint-${key}`;
    wrapper.add(clone);
    this.normalize(wrapper, clone, targetLongest, key);
    return wrapper;
  }

  dispose(): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    for (const model of this.models.values()) {
      model.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of meshMaterials) {
          materials.add(material);
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        }
      });
    }
    for (const texture of textures) texture.dispose();
    for (const material of materials) material.dispose();
    for (const geometry of geometries) geometry.dispose();
    this.models.clear();
    this.compatible.dispose();
  }

  private normalize(wrapper: THREE.Group, content: THREE.Object3D, targetLongest: number, key: string): void {
    content.rotation.y = SOURCE_ROTATION_Y[key] ?? 0;
    const bounds = new THREE.Box3().setFromObject(content);
    const size = bounds.getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z, 0.001);
    const scale = targetLongest / longest;
    content.scale.setScalar(scale);
    const scaled = new THREE.Box3().setFromObject(content);
    const center = scaled.getCenter(new THREE.Vector3());
    content.position.x -= center.x;
    content.position.y -= scaled.min.y;
    content.position.z -= center.z;
    wrapper.userData.sourceBounds = { width: size.x, height: size.y, depth: size.z, targetLongest };
    wrapper.userData.spatialContract = {
      worldUp: '+Y',
      worldForward: '+Z',
      sourceRotationY: SOURCE_ROTATION_Y[key] ?? 0,
      canonicalTransformOwner: 'RaceSimulation',
      presentationTransformOwner: 'RuntimeAssetRegistry wrapper',
    };
  }

  private createFallback(key: string, targetLongest: number): THREE.Group {
    const group = new THREE.Group();
    group.name = `missing-${key}`;
    const material = new THREE.MeshStandardMaterial({ color: '#b6544a', roughness: 0.8 });
    const geometry = new THREE.IcosahedronGeometry(targetLongest * 0.28, 1);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = targetLongest * 0.28;
    mesh.castShadow = true;
    group.add(mesh);
    return group;
  }
}
