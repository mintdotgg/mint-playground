import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import './styles.css';

// Every runtime URL is registered in mint-assets.json; keep them literal so sync can verify them.
const DRACO_DECODER_URL = 'https://cdn.mint.gg/runtime/draco/gltf/three-0.184.0/';
const TEXTURE_URLS = {
  earthDay: 'https://cdn.mint.gg/app/playground/orbital-generator-study/textures/earth-day-2faa400d1ead.jpg',
  earthNormal: 'https://cdn.mint.gg/app/playground/orbital-generator-study/textures/earth-normal-3fc43e9639c3.jpg',
  earthSpecular: 'https://cdn.mint.gg/app/playground/orbital-generator-study/textures/earth-specular-2df48906732d.jpg',
  earthClouds: 'https://cdn.mint.gg/app/playground/orbital-generator-study/textures/earth-clouds-7d3b82ef6b3f.png',
};

const MODEL_SPACING = 25;
const MODEL_DATA = {
  mint: { name: 'MINT', subtitle: 'REFERENCE ASSET', url: 'https://cdn.mint.gg/app/playground/orbital-generator-study/models/mint-31b8e5336715.glb', index: '01 / 04', slot: 0, meshes: 158, vertices: 1143276, faces: 916548, materials: 53, fidelity: 100, yaw: -Math.PI / 2 },
  tripo: { name: 'TRIPO', subtitle: 'H3.1 · IMAGE TO 3D', url: 'https://cdn.mint.gg/app/playground/orbital-generator-study/models/tripo-3eb06ef1d48f.glb', index: '02 / 04', slot: 1, meshes: 1, vertices: 1012200, faces: 1890596, materials: 1, fidelity: 84, yaw: -Math.PI / 2 },
  meshy: { name: 'MESHY', subtitle: '7.1 · IMAGE TO 3D', url: 'https://cdn.mint.gg/app/playground/orbital-generator-study/models/meshy-f2f6da4a8c00.glb', index: '03 / 04', slot: 2, meshes: 1, vertices: 802052, faces: 1325666, materials: 1, fidelity: 92, yaw: 0 },
  rodin: { name: 'RODIN', subtitle: '2.5 · IMAGE TO 3D', url: 'https://cdn.mint.gg/app/playground/orbital-generator-study/models/rodin-cef6352eaebc.glb', index: '04 / 04', slot: 3, meshes: 1, vertices: 808680, faces: 1000000, materials: 1, fidelity: 88, yaw: 0 },
};

const viewport = document.querySelector('#viewport');
const loadingOverlay = document.querySelector('#loading-overlay');
const loadingProgress = document.querySelector('#loading-progress');
const loadState = document.querySelector('#load-state');
const topologyToggle = document.querySelector('#topology-toggle');
const explodeToggle = document.querySelector('#explode-toggle');
const interiorToggle = document.querySelector('#interior-toggle');
const modelButtons = [...document.querySelectorAll('.model-button')];

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
// three r184 deprecates PCFSoftShadowMap and already falls back to PCFShadowMap.
renderer.shadowMap.type = THREE.PCFShadowMap;
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x02040a, 0.0035);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.05, 420);
camera.position.set(10.5, 7.1, 11.5);
scene.add(camera);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.minDistance = 7.5;
controls.maxDistance = 30;
controls.target.set(0, 0, 0);
controls.autoRotate = true;
controls.autoRotateSpeed = 0.34;

const ambient = new THREE.HemisphereLight(0x9bcfff, 0x08090c, 1.35);
scene.add(ambient);
const key = new THREE.DirectionalLight(0xffe1bd, 4.2);
key.position.set(7, 10, 8); key.castShadow = true; scene.add(key);
const rim = new THREE.DirectionalLight(0x4bcfff, 3.4);
rim.position.set(-9, 3, -8); scene.add(rim);
const fill = new THREE.PointLight(0xff7a3d, 50, 24, 2);
fill.position.set(7, -4, 1); scene.add(fill);
const interiorKey = new THREE.PointLight(0xf2efe8, 0, 2.4, 1.5);
interiorKey.position.set(.08, .05, .08); camera.add(interiorKey);
const interiorFill = new THREE.PointLight(0xb9c0c8, 0, 1.6, 2);
interiorFill.position.set(-.12, -.08, -.05); camera.add(interiorFill);

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function createStarField(count, minRadius, maxRadius, size, color, opacity, seed) {
  const random = seededRandom(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const base = new THREE.Color(color);
  for (let i = 0; i < count; i++) {
    const radius = minRadius + random() * (maxRadius - minRadius);
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    const warmth = random();
    const tint = warmth > .92 ? new THREE.Color(0xffd6b5) : warmth < .12 ? new THREE.Color(0xa9cfff) : base;
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity, depthWrite: false, sizeAttenuation: true, toneMapped: false }));
}

const starsFar = createStarField(17000, 100, 225, .23, 0xf1f7ff, 1, 4108);
const starsNear = createStarField(4200, 44, 98, .145, 0xd7e9ff, .94, 9013);
scene.add(starsFar, starsNear);

const dustRandom = seededRandom(7717);
const dustPositions = new Float32Array(2400 * 3);
for (let i = 0; i < 2400; i++) {
  const angle = dustRandom() * Math.PI * 2;
  const radius = 120 + dustRandom() * 75;
  dustPositions[i * 3] = Math.cos(angle) * radius;
  dustPositions[i * 3 + 1] = (dustRandom() - .5) * 15;
  dustPositions[i * 3 + 2] = Math.sin(angle) * radius;
}
const dustGeometry = new THREE.BufferGeometry();
dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
const galacticDust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0x506b99, size: .28, transparent: true, opacity: .12, depthWrite: false }));
galacticDust.rotation.z = -.35;
scene.add(galacticDust);

// Camera-anchored photoreal Earth. There are deliberately no orbit rings, moons, or satellites.
const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');
const earthDay = textureLoader.load(TEXTURE_URLS.earthDay);
earthDay.colorSpace = THREE.SRGBColorSpace;
const earthSpecular = textureLoader.load(TEXTURE_URLS.earthSpecular);
const earthNormal = textureLoader.load(TEXTURE_URLS.earthNormal);
const earthCloudMap = textureLoader.load(TEXTURE_URLS.earthClouds);
earthCloudMap.colorSpace = THREE.SRGBColorSpace;

const earthGroup = new THREE.Group();
earthGroup.position.set(-7.15, -4.15, -13.4);
earthGroup.rotation.z = -.12;
camera.add(earthGroup);
const earth = new THREE.Mesh(
  new THREE.SphereGeometry(1.62, 96, 64),
  new THREE.MeshPhongMaterial({ map: earthDay, normalMap: earthNormal, normalScale: new THREE.Vector2(.65, .65), specularMap: earthSpecular, specular: 0x1a2430, shininess: 7 })
);
earth.rotation.y = -1.15;
earthGroup.add(earth);
const clouds = new THREE.Mesh(
  new THREE.SphereGeometry(1.635, 96, 64),
  new THREE.MeshPhongMaterial({ map: earthCloudMap, transparent: true, opacity: .58, depthWrite: false })
);
clouds.rotation.y = -1.08;
earthGroup.add(clouds);
const earthSun = new THREE.DirectionalLight(0xffffff, 1.7);
earthSun.position.set(-4, 2.5, 6);
earthGroup.add(earthSun);

const modelStage = new THREE.Group();
scene.add(modelStage);
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(DRACO_DECODER_URL);
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
const cache = new Map();
const loadingPromises = new Map();
let activeKey = 'mint';
let activeMeshes = [];
let topologyOn = false;
let explodeTarget = 0;
let explodeValue = 0;
let requestedKey = 'mint';
let transition = null;
let initialized = false;
let interiorTarget = 0;
let interiorValue = 0;
let interiorYaw = 0;
let interiorPitch = 0;
let exteriorCameraPosition = camera.position.clone();
let exteriorCameraQuaternion = camera.quaternion.clone();
let exteriorControlTarget = controls.target.clone();

function compactNumber(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

function updateTelemetry(keyName) {
  const data = MODEL_DATA[keyName];
  document.querySelector('#active-index').textContent = data.index;
  document.querySelector('#active-name').textContent = data.name;
  document.querySelector('#active-subtitle').textContent = data.subtitle;
  document.querySelector('#stat-meshes').textContent = compactNumber(data.meshes);
  document.querySelector('#stat-vertices').textContent = compactNumber(data.vertices);
  document.querySelector('#stat-faces').textContent = compactNumber(data.faces);
  document.querySelector('#stat-materials').textContent = data.materials;
  document.querySelector('#fidelity-bar').style.width = `${data.fidelity}%`;
  document.querySelector('#fidelity-score').textContent = data.fidelity;
  modelButtons.forEach(button => button.classList.toggle('active', button.dataset.model === keyName));
  explodeToggle.disabled = keyName !== 'mint' || Boolean(interiorTarget);
  explodeToggle.querySelector('i').textContent = keyName === 'mint' ? (explodeTarget ? 'OPEN' : 'READY') : 'MINT ONLY';
  interiorToggle.disabled = keyName !== 'mint';
  interiorToggle.querySelector('i').textContent = keyName === 'mint' ? (interiorTarget ? 'INSIDE' : 'READY') : 'MINT ONLY';
}

function calculateModelStats(root) {
  let meshes = 0, vertices = 0, faces = 0;
  const materials = new Set();
  root.traverse(object => {
    if (!object.isMesh) return;
    meshes++;
    const geometry = object.geometry;
    vertices += geometry.attributes.position?.count || 0;
    faces += geometry.index ? geometry.index.count / 3 : (geometry.attributes.position?.count || 0) / 3;
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material.uuid));
  });
  return { meshes, vertices, faces: Math.round(faces), materials: materials.size };
}

function prepareModel(root, keyName) {
  const wrapper = new THREE.Group();
  wrapper.position.x = MODEL_DATA[keyName].slot * MODEL_SPACING;
  wrapper.add(root);
  root.rotation.z = MODEL_DATA[keyName].yaw;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = 9.4 / Math.max(size.x, size.y, size.z);
  root.scale.setScalar(scale);
  root.position.copy(center.multiplyScalar(-scale));
  root.updateMatrixWorld(true);

  const meshes = [];
  root.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    object.userData.originalMaterial = object.material;
    meshes.push(object);
  });

  if (keyName === 'mint') {
    wrapper.updateMatrixWorld(true);
    const destinyInterior = root.getObjectByName('Destiny_Interior_Outfit') || root.getObjectByName('Destiny_Interior');
    if (destinyInterior) {
      destinyInterior.updateMatrixWorld(true);
      const labCenterWorld = new THREE.Box3().setFromObject(destinyInterior).getCenter(new THREE.Vector3());
      const labAxisWorld = new THREE.Vector3(1, 0, 0).applyQuaternion(destinyInterior.getWorldQuaternion(new THREE.Quaternion())).normalize();
      const labCenter = wrapper.worldToLocal(labCenterWorld.clone());
      const wrapperRotationInverse = wrapper.getWorldQuaternion(new THREE.Quaternion()).invert();
      const labAxis = labAxisWorld.applyQuaternion(wrapperRotationInverse).normalize();
      wrapper.userData.interiorPosition = labCenter.clone().addScaledVector(labAxis, -.12);
      wrapper.userData.interiorForward = labAxis;
      wrapper.userData.interiorName = 'DESTINY LABORATORY';
    }
    const partsGroup = new THREE.Group();
    partsGroup.visible = false;
    wrapper.add(partsGroup);
    const wrapperInverse = wrapper.matrixWorld.clone().invert();
    const columns = 18;
    const rows = Math.ceil(meshes.length / columns);
    const parts = meshes.map((object, index) => {
      object.updateMatrixWorld(true);
      const clone = new THREE.Mesh(object.geometry, object.material);
      const localMatrix = wrapperInverse.clone().multiply(object.matrixWorld);
      const assembledPosition = new THREE.Vector3();
      const assembledQuaternion = new THREE.Quaternion();
      const assembledScale = new THREE.Vector3();
      localMatrix.decompose(assembledPosition, assembledQuaternion, assembledScale);
      clone.position.copy(assembledPosition);
      clone.quaternion.copy(assembledQuaternion);
      clone.scale.copy(assembledScale);
      clone.castShadow = true;
      clone.receiveShadow = true;

      object.geometry.computeBoundingBox();
      const localSize = object.geometry.boundingBox.getSize(new THREE.Vector3());
      const displayedSize = localSize.multiply(assembledScale.clone().set(Math.abs(assembledScale.x), Math.abs(assembledScale.y), Math.abs(assembledScale.z)));
      const largestDimension = Math.max(displayedSize.x, displayedSize.y, displayedSize.z, .0001);
      const fitFactor = THREE.MathUtils.clamp(.36 / largestDimension, .025, 6);
      const row = Math.floor(index / columns);
      const column = index % columns;
      const catalogScale = assembledScale.clone().multiplyScalar(fitFactor);
      const geometryCenter = object.geometry.boundingBox.getCenter(new THREE.Vector3());
      const gridCenter = new THREE.Vector3((column - (columns - 1) / 2) * .5, ((rows - 1) / 2 - row) * .55 + .12, ((index % 3) - 1) * .025);
      clone.userData.assembledPosition = assembledPosition;
      clone.userData.assembledQuaternion = assembledQuaternion;
      clone.userData.assembledScale = assembledScale;
      clone.userData.catalogPosition = gridCenter.sub(geometryCenter.multiply(catalogScale));
      clone.userData.catalogQuaternion = new THREE.Quaternion();
      clone.userData.catalogScale = catalogScale;
      partsGroup.add(clone);
      return clone;
    });
    wrapper.userData.sourceRoot = root;
    wrapper.userData.partsGroup = partsGroup;
    wrapper.userData.catalogParts = parts;
  }
  wrapper.userData.meshes = meshes;
  wrapper.userData.stats = calculateModelStats(root);
  return wrapper;
}

function ensureModel(keyName, onProgress) {
  if (cache.has(keyName)) return Promise.resolve(cache.get(keyName));
  if (loadingPromises.has(keyName)) return loadingPromises.get(keyName);
  const promise = new Promise((resolve, reject) => {
    loader.load(
      MODEL_DATA[keyName].url,
      gltf => {
        const wrapper = prepareModel(gltf.scene, keyName);
        cache.set(keyName, wrapper);
        modelStage.add(wrapper);
        loadingPromises.delete(keyName);
        resolve(wrapper);
      },
      event => {
        if (event.total && onProgress) onProgress(Math.min(99, Math.round(event.loaded / event.total * 100)));
      },
      error => { loadingPromises.delete(keyName); reject(error); }
    );
  });
  loadingPromises.set(keyName, promise);
  return promise;
}

function restoreMaterials() {
  activeMeshes.forEach(mesh => {
    if (mesh.material !== mesh.userData.originalMaterial) mesh.material.dispose?.();
    mesh.material = mesh.userData.originalMaterial;
  });
  topologyOn = false;
  topologyToggle.setAttribute('aria-pressed', 'false');
  topologyToggle.querySelector('i').textContent = 'OFF';
}

async function loadModel(keyName) {
  if (keyName === requestedKey && initialized) return;
  requestedKey = keyName;
  const hadModel = cache.has(keyName);
  if (!hadModel) {
    loadingOverlay.classList.remove('hidden');
    loadingOverlay.querySelector('p').textContent = `ACQUIRING ${MODEL_DATA[keyName].name} MODEL`;
    loadingProgress.textContent = '0%';
  }
  loadState.textContent = hadModel ? 'TRANSIT' : 'LOADING';
  try {
    const wrapper = await ensureModel(keyName, progress => { if (requestedKey === keyName) loadingProgress.textContent = `${progress}%`; });
    if (requestedKey !== keyName) return;
    restoreMaterials();
    explodeTarget = 0;
    explodeToggle.setAttribute('aria-pressed', 'false');
    activeKey = keyName;
    activeMeshes = wrapper.userData.meshes;
    updateTelemetry(keyName);
    loadingProgress.textContent = '100%';
    loadingOverlay.classList.add('hidden');

    const targetX = -MODEL_DATA[keyName].slot * MODEL_SPACING;
    if (!initialized) {
      modelStage.position.x = targetX;
      initialized = true;
      loadState.textContent = 'READY';
      Object.keys(MODEL_DATA).filter(name => name !== keyName).forEach(name => ensureModel(name).catch(console.error));
      return;
    }
    transition = { from: modelStage.position.x, to: targetX, started: performance.now(), duration: 2350 };
    document.body.classList.add('in-transit');
    controls.autoRotate = false;
  } catch (error) {
    console.error(error);
    loadState.textContent = 'ERROR';
    loadingOverlay.querySelector('p').textContent = 'MODEL LOAD FAILED';
  }
}

function setTopology(enabled) {
  topologyOn = enabled;
  activeMeshes.forEach(mesh => {
    if (enabled) {
      mesh.material = new THREE.MeshBasicMaterial({ color: 0x55e8ff, wireframe: true, transparent: true, opacity: .82 });
    } else {
      mesh.material.dispose?.();
      mesh.material = mesh.userData.originalMaterial;
    }
  });
  topologyToggle.setAttribute('aria-pressed', String(enabled));
  topologyToggle.querySelector('i').textContent = enabled ? 'ON' : 'OFF';
  loadState.textContent = enabled ? 'TOPOLOGY' : 'READY';
}

function setInterior(enabled) {
  if (activeKey !== 'mint') return;
  const mintWrapper = cache.get('mint');
  if (!mintWrapper?.userData.interiorPosition) return;
  if (enabled) {
    if (topologyOn) setTopology(false);
    explodeTarget = 0;
    explodeToggle.setAttribute('aria-pressed', 'false');
    explodeToggle.querySelector('i').textContent = 'READY';
    exteriorCameraPosition = camera.position.clone();
    exteriorCameraQuaternion = camera.quaternion.clone();
    exteriorControlTarget = controls.target.clone();
    interiorYaw = 0;
    interiorPitch = 0;
    interiorTarget = 1;
    controls.enabled = false;
    controls.autoRotate = false;
    document.body.classList.add('interior-mode');
    loadState.textContent = 'INTERIOR';
  } else {
    interiorTarget = 0;
    document.body.classList.remove('interior-mode');
    loadState.textContent = 'RETURNING';
  }
  interiorToggle.setAttribute('aria-pressed', String(enabled));
  interiorToggle.querySelector('strong').textContent = enabled ? 'EXIT DESTINY' : 'ENTER DESTINY';
  interiorToggle.querySelector('i').textContent = enabled ? 'INSIDE' : 'READY';
  explodeToggle.disabled = Boolean(enabled);
}

topologyToggle.addEventListener('click', () => setTopology(!topologyOn));
explodeToggle.addEventListener('click', () => {
  if (activeKey !== 'mint') return;
  if (topologyOn) setTopology(false);
  explodeTarget = explodeTarget ? 0 : 1;
  controls.autoRotate = !explodeTarget;
  explodeToggle.setAttribute('aria-pressed', String(Boolean(explodeTarget)));
  explodeToggle.querySelector('i').textContent = explodeTarget ? 'FULL SPREAD' : 'READY';
  loadState.textContent = explodeTarget ? 'DISASSEMBLED' : 'READY';
});
interiorToggle.addEventListener('click', () => setInterior(!interiorTarget));
modelButtons.forEach(button => button.addEventListener('click', () => loadModel(button.dataset.model)));

let interiorDragging = false;
let pointerX = 0;
let pointerY = 0;
renderer.domElement.addEventListener('pointerdown', event => {
  if (!interiorTarget) return;
  interiorDragging = true;
  pointerX = event.clientX;
  pointerY = event.clientY;
  renderer.domElement.setPointerCapture?.(event.pointerId);
});
renderer.domElement.addEventListener('pointermove', event => {
  if (!interiorDragging || !interiorTarget) return;
  interiorYaw -= (event.clientX - pointerX) * .0032;
  interiorPitch = THREE.MathUtils.clamp(interiorPitch - (event.clientY - pointerY) * .0028, -1.15, 1.15);
  pointerX = event.clientX;
  pointerY = event.clientY;
});
window.addEventListener('pointerup', () => { interiorDragging = false; });
window.addEventListener('keydown', event => { if (event.key === 'Escape' && interiorTarget) setInterior(false); });

let previousTime = performance.now();
function animate(time) {
  requestAnimationFrame(animate);
  const dt = Math.min(.05, (time - previousTime) / 1000); previousTime = time;
  let flight = 0;
  if (transition) {
    const t = Math.min(1, (time - transition.started) / transition.duration);
    const eased = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    modelStage.position.x = THREE.MathUtils.lerp(transition.from, transition.to, eased);
    flight = Math.sin(t * Math.PI);
    if (t >= 1) {
      modelStage.position.x = transition.to;
      transition = null;
      document.body.classList.remove('in-transit');
      controls.autoRotate = true;
      loadState.textContent = topologyOn ? 'TOPOLOGY' : 'READY';
    }
  }
  interiorValue = THREE.MathUtils.damp(interiorValue, interiorTarget, interiorTarget ? 2.4 : 3.1, dt);
  const mintWrapper = cache.get('mint');
  if (mintWrapper && (interiorTarget || interiorValue > .002)) {
    mintWrapper.updateMatrixWorld(true);
    const insidePosition = mintWrapper.localToWorld(mintWrapper.userData.interiorPosition.clone());
    const insideForward = mintWrapper.userData.interiorForward.clone().applyQuaternion(mintWrapper.getWorldQuaternion(new THREE.Quaternion())).normalize();
    const insideLook = insidePosition.clone().add(insideForward);
    const lookMatrix = new THREE.Matrix4().lookAt(insidePosition, insideLook, new THREE.Vector3(0, 1, 0));
    const insideQuaternion = new THREE.Quaternion().setFromRotationMatrix(lookMatrix);
    insideQuaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(interiorPitch, interiorYaw, 0, 'YXZ')));
    camera.position.lerpVectors(exteriorCameraPosition, insidePosition, interiorValue);
    camera.quaternion.slerpQuaternions(exteriorCameraQuaternion, insideQuaternion, interiorValue);
    camera.fov = THREE.MathUtils.lerp(42, 74, interiorValue);
    camera.near = THREE.MathUtils.lerp(.05, .006, interiorValue);
    camera.updateProjectionMatrix();
    earthGroup.visible = interiorValue < .14;
    renderer.toneMappingExposure = THREE.MathUtils.lerp(1.08, .52, interiorValue);
    ambient.intensity = THREE.MathUtils.lerp(1.35, .12, interiorValue);
    key.intensity = THREE.MathUtils.lerp(4.2, .22, interiorValue);
    rim.intensity = THREE.MathUtils.lerp(3.4, .12, interiorValue);
    fill.intensity = THREE.MathUtils.lerp(50, 0, interiorValue);
    interiorKey.intensity = interiorValue * 1.65;
    interiorFill.intensity = interiorValue * .72;
  } else {
    if (!controls.enabled) {
      camera.position.copy(exteriorCameraPosition);
      camera.quaternion.copy(exteriorCameraQuaternion);
      camera.fov = 42;
      camera.near = .05;
      camera.updateProjectionMatrix();
      controls.target.copy(exteriorControlTarget);
      controls.enabled = true;
      controls.autoRotate = true;
      explodeToggle.disabled = activeKey !== 'mint';
      loadState.textContent = 'READY';
    }
    earthGroup.visible = true;
    renderer.toneMappingExposure = 1.08;
    ambient.intensity = 1.35;
    key.intensity = 4.2;
    rim.intensity = 3.4;
    fill.intensity = 50;
    interiorKey.intensity = 0;
    interiorFill.intensity = 0;
    controls.update();
  }
  earth.rotation.y += dt * .055;
  clouds.rotation.y += dt * .072;

  explodeValue = THREE.MathUtils.damp(explodeValue, explodeTarget, explodeTarget ? 2.8 : 4.5, dt);
  if (mintWrapper) {
    const sourceRoot = mintWrapper.userData.sourceRoot;
    const partsGroup = mintWrapper.userData.partsGroup;
    const parts = mintWrapper.userData.catalogParts;
    if (explodeValue > .002) {
      sourceRoot.visible = false;
      partsGroup.visible = true;
    }
    parts.forEach(part => {
      part.position.lerpVectors(part.userData.assembledPosition, part.userData.catalogPosition, explodeValue);
      part.quaternion.slerpQuaternions(part.userData.assembledQuaternion, part.userData.catalogQuaternion, explodeValue);
      part.scale.lerpVectors(part.userData.assembledScale, part.userData.catalogScale, explodeValue);
    });
    const facingGuide = new THREE.Object3D();
    facingGuide.position.copy(partsGroup.getWorldPosition(new THREE.Vector3()));
    facingGuide.lookAt(camera.getWorldPosition(new THREE.Vector3()));
    facingGuide.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2));
    partsGroup.quaternion.slerpQuaternions(new THREE.Quaternion(), facingGuide.quaternion, explodeValue);
    partsGroup.scale.setScalar(THREE.MathUtils.lerp(1, .7, explodeValue));
    if (explodeValue <= .002) {
      partsGroup.visible = false;
      sourceRoot.visible = true;
    }
  }
  document.documentElement.style.setProperty('--flight', flight.toFixed(3));
  document.querySelector('#coordinate').textContent = `LAT ${(28.5 + Math.sin(time * .00004) * 2.2).toFixed(1)}° · LON ${(-80.6 + Math.cos(time * .00003) * 3.8).toFixed(1)}°`;
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
});

loadModel('mint');
requestAnimationFrame(animate);
