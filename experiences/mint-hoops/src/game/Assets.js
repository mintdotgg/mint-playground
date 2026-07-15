import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MINT_MODEL_PATHS } from './modelManifest.js';

function inspectModel(scene, animations = []) {
  scene.updateMatrixWorld(true);
  let meshes = 0;
  let triangles = 0;
  const materials = new Set();
  const textures = new Set();
  scene.traverse((child) => {
    if (!child.isMesh) return;
    meshes += 1;
    const geometry = child.geometry;
    const count = geometry?.index?.count ?? geometry?.attributes?.position?.count ?? 0;
    triangles += Math.floor(count / 3);
    const meshMaterials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of meshMaterials) {
      if (!material) continue;
      materials.add(material.uuid);
      for (const value of Object.values(material)) {
        if (value?.isTexture) textures.add(value.uuid);
      }
    }
  });
  const bounds = new THREE.Box3().setFromObject(scene, true);
  const size = bounds.getSize(new THREE.Vector3());
  const roundVector = (vector) => vector.toArray().map((value) => Number(value.toFixed(4)));
  return {
    meshes,
    triangles,
    materials: materials.size,
    textures: textures.size,
    animations: animations.length,
    bounds: {
      min: roundVector(bounds.min),
      max: roundVector(bounds.max),
      size: roundVector(size),
    },
  };
}

async function loadGlb(source) {
  if (!source) {
    return { scene: null, animations: [], loaded: false, source: null, reason: 'not-configured' };
  }
  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(source);
    return {
      scene: gltf.scene,
      animations: gltf.animations,
      loaded: true,
      source,
      stats: inspectModel(gltf.scene, gltf.animations),
    };
  } catch (error) {
    return {
      scene: null,
      animations: [],
      loaded: false,
      source,
      reason: error instanceof Error ? error.message : 'GLB load failed',
    };
  }
}

export async function loadGameAssets({ loadFallbackImages = true } = {}) {
  const base = import.meta.env.BASE_URL;
  const modelPath = (path) => {
    if (!path) return null;
    return path.startsWith('https://') ? path : `${base}${path}`;
  };
  const skippedImage = (source) => Promise.resolve({
    image: null,
    loaded: false,
    source,
    reason: loadFallbackImages ? 'procedural-fallback' : 'webgl-active',
  });
  const [basketball, hoop, basketballGlb, hoopGlb, logoGlb] = await Promise.all([
    skippedImage(null),
    skippedImage(null),
    loadGlb(modelPath(MINT_MODEL_PATHS.basketball)),
    loadGlb(modelPath(MINT_MODEL_PATHS.hoop)),
    loadGlb(modelPath(MINT_MODEL_PATHS.logo)),
  ]);
  return {
    fallbackImagesRequested: loadFallbackImages,
    basketball: { ...basketball, glb: basketballGlb },
    hoop: { ...hoop, glb: hoopGlb },
    logo: { glb: logoGlb },
  };
}
