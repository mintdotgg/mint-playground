import * as THREE from 'three';
import { MODEL_KEYS, MINT_MODEL_URLS, type ModelKey } from './assetCatalog';
import { createMintGltfLoader, disposeMintGltfRuntime } from './gltf-runtime';

export type LoadProgress = {
  loaded: number;
  total: number;
  key: ModelKey;
};

export class AssetLibrary {
  private readonly loader = createMintGltfLoader();
  private readonly models = new Map<ModelKey, THREE.Group>();

  async loadAll(onProgress: (progress: LoadProgress) => void): Promise<void> {
    const entries = MODEL_KEYS.map((key) => ({ key, url: MINT_MODEL_URLS[key] }));
    const missing = entries.filter(({ url }) => !url);
    if (missing.length > 0) throw new Error(`Mint model paths are not ready: ${missing.map(({ key }) => key).join(', ')}`);

    let cursor = 0;
    let loaded = 0;
    const worker = async () => {
      while (cursor < entries.length) {
        const index = cursor;
        cursor += 1;
        const entry = entries[index];
        const gltf = await this.loader.loadAsync(entry.url);
        this.models.set(entry.key, gltf.scene);
        loaded += 1;
        onProgress({ loaded, total: entries.length, key: entry.key });
      }
    };
    await Promise.all(Array.from({ length: 4 }, () => worker()));
  }

  create(key: ModelKey, targetHeight: number, cloneMaterials = false): THREE.Group {
    const source = this.models.get(key);
    if (!source) throw new Error(`Mint model not loaded: ${key}`);
    const visual = source.clone(true);
    if (cloneMaterials) {
      visual.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.material = Array.isArray(object.material)
          ? object.material.map((material) => material.clone())
          : object.material.clone();
      });
    }
    const sourceBounds = new THREE.Box3().setFromObject(visual);
    const size = sourceBounds.getSize(new THREE.Vector3());
    const scale = size.y > 0.0001 ? targetHeight / size.y : 1;
    visual.scale.setScalar(scale);
    visual.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(visual);
    const center = bounds.getCenter(new THREE.Vector3());
    const wrapper = new THREE.Group();
    visual.position.set(-center.x, -bounds.min.y, -center.z);
    visual.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });
    wrapper.add(visual);
    wrapper.userData.mintKey = key;
    return wrapper;
  }

  dispose(): void {
    for (const model of this.models.values()) {
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.dispose();
      });
    }
    this.models.clear();
    disposeMintGltfRuntime();
  }
}
