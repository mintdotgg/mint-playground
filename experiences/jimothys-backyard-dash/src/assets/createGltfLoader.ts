import type * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { runtimeAssetUrl } from './runtimeAssets';

export type CompatibleGltfLoader = {
  loader: GLTFLoader;
  dispose: () => void;
};

export function createCompatibleGltfLoader(_renderer: THREE.WebGLRenderer): CompatibleGltfLoader {
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath(runtimeAssetUrl('draco-runtime', 'decoder-path'));
  loader.setDRACOLoader(draco);
  return {
    loader,
    dispose: () => draco.dispose(),
  };
}
