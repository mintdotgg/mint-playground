import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getMintArtifact } from './index';

export class MintAssetRegistry {
  private readonly loader = new GLTFLoader();

  async loadNormalizedModel(label: string, targetSize: number): Promise<THREE.Group> {
    const artifact = getMintArtifact(label);
    if (artifact.loaderHint !== 'gltf') throw new Error(`${label} is not a GLTF artifact.`);

    const gltf = await this.loader.loadAsync(artifact.path);
    const canonical = gltf.scene;
    canonical.name = `${label} / Canonical`;
    canonical.updateMatrixWorld(true);

    const sourceBounds = new THREE.Box3().setFromObject(canonical);
    if (sourceBounds.isEmpty()) throw new Error(`${label} has empty bounds.`);
    const size = sourceBounds.getSize(new THREE.Vector3());
    const largestAxis = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(largestAxis) || largestAxis <= 0) throw new Error(`${label} has invalid bounds.`);

    canonical.scale.multiplyScalar(targetSize / largestAxis);
    canonical.updateMatrixWorld(true);
    const normalizedBounds = new THREE.Box3().setFromObject(canonical);
    const center = normalizedBounds.getCenter(new THREE.Vector3());
    canonical.position.x -= center.x;
    canonical.position.y -= normalizedBounds.min.y;
    canonical.position.z -= center.z;
    canonical.updateMatrixWorld(true);

    canonical.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = false;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if ('envMapIntensity' in material) material.envMapIntensity = 0.9;
      });
    });

    const presentation = new THREE.Group();
    presentation.name = `${label} / Presentation`;
    presentation.add(canonical);
    return presentation;
  }
}
