import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { AIM_ARROW, BALL, COLORS, COURT, VIEWPORT } from './config.js';

const WORLD_PER_PIXEL = 20.86 / VIEWPORT.width;
const ACTOR_Z = 0.8;
const MAX_PARTICLES = 24;
const MAX_TRAIL_POINTS = 20;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const HIDDEN_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);
// Measured directly from mint-hoop.glb. The wrapper scales the 0.9980469-high
// source prop to 8.35 world units. The authored rim/net assembly starts at
// local Z 0.120 while the board-side mount ends near 0.040, which provides a
// stable geometry boundary for closing the model's exaggerated 65 px gap.
const MINT_HOOP_TARGET_SIZE = 8.35;
const MINT_HOOP_SOURCE_HEIGHT = 0.9980469048023224;
const MINT_HOOP_SOURCE_RIM_CENTER_Z = 0.2490234375;
const MINT_HOOP_SOURCE_RIM_CENTERLINE_RADIUS = 0.122182623;
const MINT_HOOP_SOURCE_BOARD_FRONT_Z = -0.0048828125;
const MINT_HOOP_FRONT_ASSEMBLY_MIN_Z = 0.11;
const MINT_HOOP_FRONT_ASSEMBLY_SHIFT_PIXELS = 65;
const MINT_HOOP_SCALE = MINT_HOOP_TARGET_SIZE / MINT_HOOP_SOURCE_HEIGHT;
const MINT_HOOP_FRONT_ASSEMBLY_SHIFT_Z = (
  MINT_HOOP_FRONT_ASSEMBLY_SHIFT_PIXELS * WORLD_PER_PIXEL / MINT_HOOP_SCALE
);
const MINT_HOOP_PRESENTED_RIM_CENTER_Z = (
  MINT_HOOP_SOURCE_RIM_CENTER_Z - MINT_HOOP_FRONT_ASSEMBLY_SHIFT_Z
);
const MINT_HOOP_RIM_FORWARD_OFFSET = MINT_HOOP_PRESENTED_RIM_CENTER_Z * MINT_HOOP_SCALE;
const MINT_HOOP_RIM_CENTERLINE_RADIUS = MINT_HOOP_SOURCE_RIM_CENTERLINE_RADIUS * MINT_HOOP_SCALE;
const MINT_HOOP_BOARD_FRONT_OFFSET = MINT_HOOP_SOURCE_BOARD_FRONT_Z * MINT_HOOP_SCALE;
// The fixed three-quarter gameplay camera still makes a physically horizontal
// torus read lower at the board side. This small presentation-only shear
// counteracts that projection so the player-facing rim silhouette is level.
const MINT_HOOP_SCREEN_LEVEL_SLOPE = -0.034;
const WALL_SIGN = Object.freeze({
  x: -0.7,
  y: 8.05,
  width: 4.85,
  height: 3.3,
  mountFrontZ: -2.42,
  logoWidth: 3.8,
  logoHeight: 3.04,
  logoDepth: 0.56,
  logoTopRatio: 0.26,
  logoBevel: 0.035,
  logoEmbed: 0.045,
});

function gameToWorld(x, y, z = ACTOR_Z) {
  return new THREE.Vector3(
    (x - VIEWPORT.width / 2) * WORLD_PER_PIXEL,
    (COURT.floorY - y) * WORLD_PER_PIXEL,
    z,
  );
}

function mesh(geometry, material, { cast = true, receive = false } = {}) {
  const result = new THREE.Mesh(geometry, material);
  result.castShadow = cast;
  result.receiveShadow = receive;
  return result;
}

function addBox(parent, material, size, position, rotation = null, shadow = {}) {
  const result = mesh(new THREE.BoxGeometry(...size), material, shadow);
  result.position.set(...position);
  if (rotation) result.rotation.set(...rotation);
  parent.add(result);
  return result;
}

function roundedRectShape(width, height, radius) {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function createSurfaceTexture(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#f3f3ee';
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (kind === 'wood') {
    context.lineCap = 'round';
    for (let i = 0; i < 42; i += 1) {
      const x = (i * 37) % 256;
      const drift = ((i * 19) % 23) - 11;
      context.strokeStyle = `rgba(80, 48, 24, ${0.035 + (i % 5) * 0.008})`;
      context.lineWidth = 0.7 + (i % 3) * 0.45;
      context.beginPath();
      context.moveTo(x, -8);
      context.bezierCurveTo(x + drift, 72, x - drift * 0.4, 174, x + drift * 0.2, 264);
      context.stroke();
    }
    for (let i = 0; i < 8; i += 1) {
      context.strokeStyle = 'rgba(92, 53, 25, 0.09)';
      context.lineWidth = 1.2;
      context.beginPath();
      context.ellipse((i * 71) % 256, (i * 43 + 30) % 256, 9 + (i % 3) * 3, 3.2, 0.25, 0, Math.PI * 2);
      context.stroke();
    }
  } else {
    context.strokeStyle = 'rgba(23, 63, 53, 0.055)';
    context.lineWidth = 1;
    for (let i = 0; i <= 256; i += 32) {
      context.beginPath();
      context.moveTo(i, 0);
      context.lineTo(i, 256);
      context.stroke();
      context.beginPath();
      context.moveTo(0, i);
      context.lineTo(256, i);
      context.stroke();
    }
    for (let i = 0; i < 54; i += 1) {
      const x = (i * 83) % 256;
      const y = (i * 47) % 256;
      context.fillStyle = `rgba(23, 63, 53, ${0.018 + (i % 4) * 0.007})`;
      context.fillRect(x, y, 1 + (i % 2), 1 + ((i + 1) % 2));
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === 'wood' ? 2 : 3, kind === 'wood' ? 5 : 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.name = `${kind}-surface-texture`;
  return texture;
}

function createFieldhouseDisplayTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#10130e';
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = 'rgba(196, 244, 61, 0.22)';
  context.lineWidth = 2;
  for (let x = 20; x < canvas.width; x += 28) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }
  for (let y = 20; y < canvas.height; y += 28) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }

  context.fillStyle = '#c4f43d';
  context.font = '900 84px Arial, sans-serif';
  context.fillText('OPEN RUN', 42, 112);
  context.fillStyle = 'rgba(255,255,255,0.78)';
  context.font = '700 27px Arial, sans-serif';
  context.fillText('MINT FIELDHOUSE / 01', 46, 178);
  context.fillStyle = '#ff8a29';
  context.fillRect(46, 204, 94, 7);
  context.fillStyle = '#7fe0c3';
  context.fillRect(150, 204, 54, 7);
  context.fillStyle = 'rgba(255,255,255,0.32)';
  context.fillRect(214, 204, 132, 7);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.name = 'fieldhouse-display-texture';
  return texture;
}

function cylinderBetween(start, end, radius, material) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const result = mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), 14),
    material,
  );
  result.position.copy(start).add(end).multiplyScalar(0.5);
  result.quaternion.setFromUnitVectors(Y_AXIS, direction.clone().normalize());
  return result;
}

function createNetLine(points, material) {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(curve.getPoints(16)),
    material,
  );
}

function centerAndScale(scene, targetSize, anchor = 'center') {
  const bounds = new THREE.Box3().setFromObject(scene, true);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = targetSize / Math.max(size.x, size.y, size.z, 0.0001);
  const scaled = new THREE.Group();
  scaled.add(scene);
  scaled.scale.setScalar(scale);
  scaled.updateMatrixWorld(true);
  const scaledBounds = new THREE.Box3().setFromObject(scaled, true);
  const center = scaledBounds.getCenter(new THREE.Vector3());
  scaled.position.x -= center.x;
  scaled.position.z -= center.z;
  scaled.position.y -= anchor === 'floor' ? scaledBounds.min.y : center.y;
  const root = new THREE.Group();
  root.add(scaled);
  return root;
}

function prepareImportedScene(scene, { cast = false, receive = false } = {}) {
  scene.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = cast;
    child.receiveShadow = receive;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material) continue;
      material.needsUpdate = true;
    }
  });
}

function cloneImportedSceneForPresentation(scene) {
  const clone = scene.clone(true);
  clone.traverse((child) => {
    if (child.isMesh && child.geometry) child.geometry = child.geometry.clone();
  });
  return clone;
}

function measuredPitchRadians(points) {
  const front = points.filter((point) => (
    Math.abs(point.x) < 0.025
      && point.z > MINT_HOOP_SOURCE_RIM_CENTER_Z + 0.09
  ));
  const back = points.filter((point) => (
    Math.abs(point.x) < 0.025
      && point.z < MINT_HOOP_SOURCE_RIM_CENTER_Z - 0.09
  ));
  if (front.length === 0 || back.length === 0) return null;
  const mean = (values, key) => (
    values.reduce((sum, point) => sum + point[key], 0) / values.length
  );
  const depth = mean(front, 'z') - mean(back, 'z');
  return Math.abs(depth) > 0.000001
    ? Math.atan((mean(front, 'y') - mean(back, 'y')) / depth)
    : null;
}

function getIndexedGeometryComponents(position, index) {
  const parent = new Int32Array(position.count);
  const rank = new Uint8Array(position.count);
  for (let i = 0; i < parent.length; i += 1) parent[i] = i;
  const find = (value) => {
    let root = value;
    while (parent[root] !== root) root = parent[root];
    let current = value;
    while (parent[current] !== current) {
      const next = parent[current];
      parent[current] = root;
      current = next;
    }
    return root;
  };
  const union = (left, right) => {
    let leftRoot = find(left);
    let rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    if (rank[leftRoot] < rank[rightRoot]) [leftRoot, rightRoot] = [rightRoot, leftRoot];
    parent[rightRoot] = leftRoot;
    if (rank[leftRoot] === rank[rightRoot]) rank[leftRoot] += 1;
  };
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    union(a, b);
    union(a, c);
  }

  const components = new Map();
  for (let i = 0; i < position.count; i += 1) {
    const root = find(i);
    let component = components.get(root);
    if (!component) {
      component = {
        indices: [],
        min: new THREE.Vector3(Infinity, Infinity, Infinity),
        max: new THREE.Vector3(-Infinity, -Infinity, -Infinity),
      };
      components.set(root, component);
    }
    const point = new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i));
    component.indices.push(i);
    component.min.min(point);
    component.max.max(point);
  }
  return [...components.values()];
}

function levelMintHoopRim(scene) {
  const sourcePoints = [];
  const correctedPoints = [];
  let componentCount = 0;
  let vertexCount = 0;

  scene.traverse((child) => {
    if (!child.isMesh) return;
    const geometry = child.geometry;
    const position = geometry?.getAttribute('position');
    const normal = geometry?.getAttribute('normal');
    const index = geometry?.getIndex();
    if (!position || !index) return;

    const rimComponents = getIndexedGeometryComponents(position, index).filter((component) => {
      if (component.min.y <= 0.13 || component.max.y >= 0.22) return false;
      return component.indices.every((vertexIndex) => {
        const radialDistance = Math.hypot(
          position.getX(vertexIndex),
          position.getZ(vertexIndex) - MINT_HOOP_SOURCE_RIM_CENTER_Z,
        );
        return radialDistance > 0.095 && radialDistance < 0.15;
      });
    });

    const meshSourcePoints = rimComponents.flatMap((component) => (
      component.indices.map((vertexIndex) => ({
        x: position.getX(vertexIndex),
        y: position.getY(vertexIndex),
        z: position.getZ(vertexIndex),
      }))
    ));
    const meshSourcePitch = measuredPitchRadians(meshSourcePoints);
    const levelingSlope = (meshSourcePitch === null ? 0 : Math.tan(meshSourcePitch))
      + MINT_HOOP_SCREEN_LEVEL_SLOPE;
    sourcePoints.push(...meshSourcePoints);

    for (const component of rimComponents) {
      componentCount += 1;
      vertexCount += component.indices.length;
      for (const vertexIndex of component.indices) {
        const z = position.getZ(vertexIndex);
        const sourceY = position.getY(vertexIndex);
        const correctedY = sourceY - levelingSlope * (z - MINT_HOOP_SOURCE_RIM_CENTER_Z);
        correctedPoints.push({ x: position.getX(vertexIndex), y: correctedY, z });
        position.setY(vertexIndex, correctedY);
        if (normal) {
          const nx = normal.getX(vertexIndex);
          const ny = normal.getY(vertexIndex);
          const nz = normal.getZ(vertexIndex) + levelingSlope * ny;
          const inverseLength = 1 / Math.max(Math.hypot(nx, ny, nz), 0.000001);
          normal.setXYZ(vertexIndex, nx * inverseLength, ny * inverseLength, nz * inverseLength);
        }
      }
    }

    if (rimComponents.length > 0) {
      position.needsUpdate = true;
      if (normal) normal.needsUpdate = true;
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    }
  });

  const sourcePitchRadians = measuredPitchRadians(sourcePoints);
  const correctedPitchRadians = measuredPitchRadians(correctedPoints);
  return {
    applied: componentCount > 0,
    componentCount,
    vertexCount,
    sourcePitchDegrees: sourcePitchRadians === null ? null : THREE.MathUtils.radToDeg(sourcePitchRadians),
    correctedPitchDegrees: correctedPitchRadians === null ? null : THREE.MathUtils.radToDeg(correctedPitchRadians),
    screenCompensationDegrees: THREE.MathUtils.radToDeg(Math.atan(MINT_HOOP_SCREEN_LEVEL_SLOPE)),
  };
}

function bringMintHoopFrontAssemblyToBoard(scene) {
  let componentCount = 0;
  let vertexCount = 0;

  scene.traverse((child) => {
    if (!child.isMesh) return;
    const geometry = child.geometry;
    const position = geometry?.getAttribute('position');
    const index = geometry?.getIndex();
    if (!position || !index) return;

    // The authored board, pole, and compact board-side mount all remain below
    // this depth boundary. The torus, net, and rim-side hardware are entirely
    // above it, so disconnected surfaces can be translated without stretching
    // or deforming the imported mesh.
    const frontAssembly = getIndexedGeometryComponents(position, index).filter((component) => (
      component.min.x >= -0.14
        && component.max.x <= 0.14
        && component.min.y >= -0.03
        && component.max.y <= 0.22
        && component.min.z >= MINT_HOOP_FRONT_ASSEMBLY_MIN_Z
    ));

    for (const component of frontAssembly) {
      componentCount += 1;
      vertexCount += component.indices.length;
      for (const vertexIndex of component.indices) {
        position.setZ(
          vertexIndex,
          position.getZ(vertexIndex) - MINT_HOOP_FRONT_ASSEMBLY_SHIFT_Z,
        );
      }
    }

    if (frontAssembly.length > 0) {
      position.needsUpdate = true;
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    }
  });

  return {
    applied: componentCount > 0,
    componentCount,
    vertexCount,
    shiftPixels: MINT_HOOP_FRONT_ASSEMBLY_SHIFT_PIXELS,
    rearRimX: COURT.hoop.rimRight,
    backboardX: COURT.hoop.backboard.x,
    remainingGapPixels: COURT.hoop.backboard.x - COURT.hoop.rimRight,
  };
}

function findImportedMaterial(scene, materialName) {
  let result = null;
  scene.traverse((child) => {
    if (result || !child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    result = materials.find((material) => material?.name === materialName) ?? null;
  });
  return result;
}

export class ThreeModelLayer {
  constructor(canvas) {
    this.canvas = canvas;
    this.assets = null;
    this.automatedQualityTier = navigator.webdriver === true;
    this.shadowMapSize = this.automatedQualityTier ? 0 : 1024;
    this.dpr = 1;
    this.reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
    this.reducedMotion = this.reducedMotionQuery?.matches ?? false;
    this.onReducedMotionChange = (event) => {
      this.reducedMotion = event.matches;
    };
    this.reducedMotionQuery?.addEventListener?.('change', this.onReducedMotionChange);
    this.ballVisual = null;
    this.retiredBallVisuals = new Map();
    this.hoopVisual = null;
    this.logoVisual = null;
    this.logoMount = null;
    this.proceduralBall = null;
    this.proceduralHoop = null;
    this.rimMaterial = null;
    this.visualRimAnchors = null;
    this.visualBackboardAnchor = null;
    this.hoopRimCorrection = null;
    this.hoopFrontAssemblyCorrection = null;
    this.cameraBase = new THREE.Vector3(0, 4.66, 20);
    this.cameraTarget = new THREE.Vector3(0, 4.66, ACTOR_Z);
    this.tempMatrix = new THREE.Matrix4();
    this.tempPosition = new THREE.Vector3();
    this.tempQuaternion = new THREE.Quaternion();
    this.tempScale = new THREE.Vector3();
    this.aimArrowLowColor = new THREE.Color(COLORS.mintDeep);
    this.aimArrowMidColor = new THREE.Color(COLORS.orange);
    this.aimArrowHighColor = new THREE.Color(COLORS.coral);
    this.aimArrowColor = this.aimArrowLowColor.clone();
    this.aimArrowLengthPixels = 0;
    this.aimArrowPower = 0;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#eaf4ec');
    this.scene.fog = new THREE.Fog('#eaf4ec', 22, 40);
    this.camera = new THREE.PerspectiveCamera(34, VIEWPORT.width / VIEWPORT.height, 0.1, 60);
    this.camera.position.copy(this.cameraBase);
    this.camera.lookAt(this.cameraTarget);

    this.proceduralTextures = {
      wood: createSurfaceTexture('wood'),
      wall: createSurfaceTexture('wall'),
      fieldhouseDisplay: createFieldhouseDisplayTexture(),
    };
    this.materials = this.createMaterialKit();
    this.buildArena();
    this.buildLighting();
    this.buildActors();
    this.buildFeedback();

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: false,
        antialias: !this.automatedQualityTier,
        // Keep the last completed frame available to the browser compositor.
        // This prevents blank/black canvas tiles during tab captures and when
        // a mobile GPU briefly presents between animation frames.
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.03;
      this.renderer.shadowMap.enabled = !this.automatedQualityTier;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      // The arena and hoop are static. A single baked shadow-map update gives
      // them grounded depth while the lightweight ellipse handles the moving
      // ball, avoiding an expensive full shadow render every frame.
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.shadowMap.needsUpdate = true;
    } catch {
      this.renderer = null;
    }

    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(this.canvas);
    this.resize();
  }

  createMaterialKit() {
    return {
      wall: new THREE.MeshStandardMaterial({ color: '#f8f1df', map: this.proceduralTextures.wall, roughness: 0.92 }),
      wallInset: new THREE.MeshStandardMaterial({ color: '#deefe5', map: this.proceduralTextures.wall, roughness: 0.88 }),
      woodA: new THREE.MeshStandardMaterial({ color: '#d7ad72', map: this.proceduralTextures.wood, roughness: 0.78 }),
      woodB: new THREE.MeshStandardMaterial({ color: '#ebc98f', map: this.proceduralTextures.wood, roughness: 0.75 }),
      dark: new THREE.MeshStandardMaterial({ color: COLORS.dark, roughness: 0.58, metalness: 0.12 }),
      mint: new THREE.MeshStandardMaterial({ color: COLORS.mintDeep, roughness: 0.48, metalness: 0.16 }),
      mintLight: new THREE.MeshStandardMaterial({ color: COLORS.mintLight, roughness: 0.72 }),
      brandLime: new THREE.MeshStandardMaterial({ color: '#c4f042', roughness: 0.4, metalness: 0.08 }),
      brandYellow: new THREE.MeshStandardMaterial({ color: '#f4f06a', roughness: 0.44, metalness: 0.06 }),
      orange: new THREE.MeshStandardMaterial({
        color: COLORS.orange,
        roughness: 0.56,
        metalness: 0.06,
        emissive: '#5b1600',
        emissiveIntensity: 0.08,
      }),
      metal: new THREE.MeshStandardMaterial({ color: '#71827f', roughness: 0.32, metalness: 0.72 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: '#dff8ef',
        transparent: true,
        opacity: 0.48,
        roughness: 0.2,
        transmission: 0,
        thickness: 0,
        metalness: 0.02,
      }),
      white: new THREE.MeshStandardMaterial({ color: '#fffdf7', roughness: 0.78 }),
      glow: new THREE.MeshBasicMaterial({ color: COLORS.mint, toneMapped: false }),
      shadow: new THREE.MeshBasicMaterial({ color: COLORS.dark, transparent: true, opacity: 0.16, depthWrite: false }),
      signalDark: new THREE.MeshStandardMaterial({
        color: '#69aa96',
        roughness: 0.58,
        metalness: 0.08,
        emissive: '#214f43',
        emissiveIntensity: 0.1,
      }),
    };
  }

  buildArena() {
    const {
      wall,
      wallInset,
      woodA,
      woodB,
      dark,
      mint,
      glow,
      orange,
      brandYellow,
      metal,
      shadow,
      signalDark,
    } = this.materials;

    const backWall = mesh(new THREE.BoxGeometry(25, 12, 0.34), wall, { cast: false, receive: true });
    backWall.position.set(0, 5.2, -2.85);
    this.scene.add(backWall);

    const panels = new THREE.InstancedMesh(new THREE.BoxGeometry(2.25, 6.5, 0.12), wallInset, 9);
    panels.castShadow = false;
    panels.receiveShadow = true;
    for (let i = 0; i < 9; i += 1) {
      const x = -9.6 + i * 2.4;
      this.tempMatrix.compose(
        new THREE.Vector3(x, 4.5 + (i % 2) * 0.16, -2.62),
        new THREE.Quaternion(),
        new THREE.Vector3(1, 1, 1),
      );
      panels.setMatrixAt(i, this.tempMatrix);
      panels.setColorAt(i, new THREE.Color(i % 3 === 0 ? '#d5eee4' : '#f7efdd'));
    }
    panels.instanceMatrix.needsUpdate = true;
    panels.instanceColor.needsUpdate = true;
    this.scene.add(panels);

    const displayMount = mesh(
      new RoundedBoxGeometry(5.7, 2.18, 0.28, 3, 0.14),
      dark,
      { cast: true, receive: true },
    );
    displayMount.position.set(-7.85, 6.28, -2.28);
    this.scene.add(displayMount);
    const display = mesh(
      new THREE.PlaneGeometry(5.27, 1.76),
      new THREE.MeshBasicMaterial({
        map: this.proceduralTextures.fieldhouseDisplay,
        toneMapped: false,
      }),
      { cast: false, receive: false },
    );
    display.position.set(-7.85, 6.28, -2.12);
    this.scene.add(display);
    for (const x of [-10.42, -5.28]) {
      const fastener = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.09, 12), metal);
      fastener.rotation.x = Math.PI / 2;
      fastener.position.set(x, 6.28, -2.03);
      this.scene.add(fastener);
    }

    const wallLights = new THREE.InstancedMesh(new THREE.BoxGeometry(0.055, 4.4, 0.05), glow, 8);
    for (let i = 0; i < 8; i += 1) {
      this.tempMatrix.makeTranslation(-8.4 + i * 2.4, 4.6, -2.55);
      wallLights.setMatrixAt(i, this.tempMatrix);
    }
    wallLights.instanceMatrix.needsUpdate = true;
    this.scene.add(wallLights);

    // Layered arena architecture keeps the half-court from reading as a flat
    // wall while preserving a clean shooting lane through the center.
    addBox(this.scene, signalDark, [24.2, 0.42, 0.5], [0, 10.45, -2.35], null, { cast: true, receive: true });
    addBox(this.scene, mint, [23.2, 0.1, 0.14], [0, 10.15, -2.05], null, { cast: false, receive: true });
    const overheadLights = new THREE.InstancedMesh(new RoundedBoxGeometry(3.1, 0.22, 0.18, 2, 0.06), this.materials.white, 3);
    for (let i = 0; i < 3; i += 1) {
      this.tempMatrix.makeTranslation(-7.2 + i * 7.2, 9.86, -1.96);
      overheadLights.setMatrixAt(i, this.tempMatrix);
    }
    overheadLights.instanceMatrix.needsUpdate = true;
    this.scene.add(overheadLights);

    const pennantShape = new THREE.Shape();
    pennantShape.moveTo(-0.48, 0.65);
    pennantShape.lineTo(0.48, 0.65);
    pennantShape.lineTo(0, -0.72);
    pennantShape.closePath();
    const pennantGeometry = new THREE.ExtrudeGeometry(pennantShape, { depth: 0.08, bevelEnabled: false });
    const pennantMaterials = [orange, mint, brandYellow];
    [-7.2, -5.75, 5.75, 7.2].forEach((x, index) => {
      const pennant = mesh(pennantGeometry, pennantMaterials[index % pennantMaterials.length], { cast: true, receive: true });
      pennant.position.set(x, 8.7 - (index % 2) * 0.15, -2.22);
      pennant.rotation.z = index % 2 ? -0.05 : 0.05;
      this.scene.add(pennant);
    });

    const wallPadding = new THREE.InstancedMesh(new RoundedBoxGeometry(1.65, 1.45, 0.2, 2, 0.08), signalDark, 10);
    for (let i = 0; i < 10; i += 1) {
      const heightScale = [0.82, 1, 0.92, 1.12][i % 4];
      const widthScale = [0.88, 1.04, 0.94][i % 3];
      this.tempMatrix.compose(
        new THREE.Vector3(-10.15 + i * 2.25, 0.3 + (1.45 * heightScale) / 2, -2.45),
        new THREE.Quaternion(),
        new THREE.Vector3(widthScale, heightScale, 1),
      );
      wallPadding.setMatrixAt(i, this.tempMatrix);
      wallPadding.setColorAt(i, new THREE.Color(['#7eb9a5', '#e5bc74', '#67a994'][i % 3]));
    }
    wallPadding.instanceMatrix.needsUpdate = true;
    wallPadding.instanceColor.needsUpdate = true;
    this.scene.add(wallPadding);

    // One off-court wall ring adds depth without forming a distracting halo
    // behind the playable hoop.
    const orangeRing = mesh(new THREE.TorusGeometry(0.9, 0.12, 12, 40), this.materials.orange, { cast: true });
    orangeRing.position.set(-10.1, 3.85, -2.36);
    this.scene.add(orangeRing);

    const lowerRibbon = new THREE.InstancedMesh(new THREE.BoxGeometry(1.22, 0.16, 0.08), glow, 8);
    for (let i = 0; i < 8; i += 1) {
      this.tempMatrix.makeTranslation(-5.2 + i * 1.48, 2.1, -2.26);
      lowerRibbon.setMatrixAt(i, this.tempMatrix);
      lowerRibbon.setColorAt(i, new THREE.Color(i % 3 === 2 ? '#c4f43d' : '#7fe0c3'));
    }
    lowerRibbon.instanceMatrix.needsUpdate = true;
    lowerRibbon.instanceColor.needsUpdate = true;
    this.scene.add(lowerRibbon);

    const floorRoot = new THREE.Group();
    const planks = new THREE.InstancedMesh(new THREE.BoxGeometry(1.72, 0.1, 16), woodA, 14);
    planks.receiveShadow = true;
    for (let i = 0; i < 14; i += 1) {
      this.tempMatrix.makeTranslation(-11.18 + i * 1.72, -0.08, 3.2);
      planks.setMatrixAt(i, this.tempMatrix);
      planks.setColorAt(i, new THREE.Color(i % 2 ? '#e6c187' : '#d6aa70'));
    }
    planks.instanceMatrix.needsUpdate = true;
    planks.instanceColor.needsUpdate = true;
    floorRoot.add(planks);
    addBox(floorRoot, dark, [24, 0.12, 0.12], [0, 0, -1.72], null, { cast: false, receive: true });
    addBox(floorRoot, mint, [24, 0.035, 0.08], [0, 0.035, -1.55], null, { cast: false, receive: true });

    const centerRing = mesh(new THREE.RingGeometry(2.65, 2.71, 72), dark, { cast: false });
    centerRing.rotation.x = -Math.PI / 2;
    centerRing.position.set(-0.5, 0.015, 4.2);
    floorRoot.add(centerRing);
    const keyLine = mesh(new THREE.RingGeometry(3.3, 3.35, 72, 1, Math.PI * 0.25, Math.PI * 0.5), mint, { cast: false });
    keyLine.rotation.x = -Math.PI / 2;
    keyLine.position.set(7.7, 0.02, 3.1);
    floorRoot.add(keyLine);
    for (let i = 0; i < 7; i += 1) {
      const hash = addBox(
        floorRoot,
        i % 2 ? mint : dark,
        [0.065, 0.018, 0.58 + (i % 3) * 0.16],
        [-5.2 + i * 1.72, 0.035, 1.15 + (i % 2) * 0.16],
        null,
        { cast: false, receive: false },
      );
      hash.rotation.y = (i % 2 ? 1 : -1) * 0.14;
    }
    this.scene.add(floorRoot);

    addBox(this.scene, dark, [0.45, 6.5, 0.75], [-11.4, 3.2, -1.8], null, { cast: true, receive: true });
    addBox(this.scene, dark, [0.45, 6.5, 0.75], [11.4, 3.2, -1.8], null, { cast: true, receive: true });

    const benchRoot = new THREE.Group();
    for (let i = 0; i < 3; i += 1) {
      addBox(benchRoot, i === 1 ? mint : woodB, [4.2, 0.32, 0.72], [-6.8, 0.38 + i * 0.42, -0.9 - i * 0.28], null, { cast: true, receive: true });
    }
    addBox(benchRoot, metal, [0.18, 1.1, 0.6], [-8.35, 0.5, -1.05], null, { cast: true, receive: true });
    addBox(benchRoot, metal, [0.18, 1.1, 0.6], [-5.25, 0.5, -1.05], null, { cast: true, receive: true });
    this.scene.add(benchRoot);

    const rackRoot = new THREE.Group();
    addBox(rackRoot, dark, [2.5, 0.12, 0.5], [-3.7, 0.42, -1.25], null, { cast: true, receive: true });
    addBox(rackRoot, metal, [0.12, 0.9, 0.45], [-4.8, 0.28, -1.25], null, { cast: true, receive: true });
    addBox(rackRoot, metal, [0.12, 0.9, 0.45], [-2.6, 0.28, -1.25], null, { cast: true, receive: true });
    const rackBallGeometry = new THREE.SphereGeometry(0.3, 18, 12);
    [orange, mint, brandYellow].forEach((material, index) => {
      const rackBall = mesh(rackBallGeometry, material, { cast: true, receive: true });
      rackBall.position.set(-4.35 + index * 0.65, 0.72, -1.1);
      rackRoot.add(rackBall);
    });
    this.scene.add(rackRoot);

    const benchContact = mesh(new THREE.CircleGeometry(1, 36), shadow, { cast: false });
    benchContact.rotation.x = -Math.PI / 2;
    benchContact.scale.set(2.9, 0.85, 1);
    benchContact.position.set(-6.8, 0.012, -0.95);
    this.scene.add(benchContact);
    const hoopContact = mesh(new THREE.CircleGeometry(1, 36), shadow.clone(), { cast: false });
    hoopContact.material.opacity = 0.12;
    hoopContact.rotation.x = -Math.PI / 2;
    hoopContact.scale.set(2.1, 1.15, 1);
    hoopContact.position.set(9.55, 0.014, 0.15);
    this.scene.add(hoopContact);
  }

  buildLighting() {
    this.scene.add(new THREE.HemisphereLight(0xfff7e5, 0x4f887b, 1.85));
    const key = new THREE.DirectionalLight(0xfff7e8, 3.2);
    key.position.set(-5.5, 11.5, 12);
    key.castShadow = !this.automatedQualityTier;
    if (key.castShadow) key.shadow.mapSize.set(this.shadowMapSize, this.shadowMapSize);
    key.shadow.camera.left = -13;
    key.shadow.camera.right = 13;
    key.shadow.camera.top = 13;
    key.shadow.camera.bottom = -3;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 35;
    key.shadow.bias = -0.0005;
    this.scene.add(key);

    const fill = new THREE.PointLight(0x7fe0c3, 95, 22, 2);
    fill.position.set(-7, 5, 8);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xf4f06a, 1.15);
    rim.position.set(9, 7, -4);
    this.scene.add(rim);
    this.scoreLight = new THREE.PointLight(0xf28c28, 0, 9, 2);
    this.scoreLight.position.copy(gameToWorld((COURT.hoop.rimLeft + COURT.hoop.rimRight) / 2, COURT.hoop.rimY, 2.1));
    this.scene.add(this.scoreLight);
  }

  createProceduralBall() {
    const root = new THREE.Group();
    const radius = BALL.radius * WORLD_PER_PIXEL;
    const body = mesh(new THREE.SphereGeometry(radius, 36, 24), this.materials.orange, { cast: false, receive: true });
    root.add(body);
    const seamGeometry = new THREE.TorusGeometry(radius * 1.006, radius * 0.027, 8, 64);
    const seamMaterial = this.materials.dark;
    const seamA = mesh(seamGeometry, seamMaterial, { cast: false });
    const seamB = mesh(seamGeometry, seamMaterial, { cast: false });
    const seamC = mesh(seamGeometry, seamMaterial, { cast: false });
    seamB.rotation.x = Math.PI / 2;
    seamC.rotation.y = Math.PI / 2;
    seamC.rotation.z = Math.PI / 5;
    root.add(seamA, seamB, seamC);
    return root;
  }

  createWallLogoRelief() {
    const root = new THREE.Group();
    root.name = 'MintWallLogoRelief';
    const columnWidth = WALL_SIGN.logoWidth / 5;
    const topHeight = WALL_SIGN.logoHeight * WALL_SIGN.logoTopRatio;
    const lowerHeight = WALL_SIGN.logoHeight - topHeight;
    const topY = WALL_SIGN.logoHeight / 2 - topHeight / 2;
    const lowerY = -WALL_SIGN.logoHeight / 2 + lowerHeight / 2;
    const depth = WALL_SIGN.logoDepth;
    const geometries = {
      full: new RoundedBoxGeometry(
        columnWidth,
        WALL_SIGN.logoHeight,
        depth,
        2,
        WALL_SIGN.logoBevel,
      ),
      top: new RoundedBoxGeometry(
        columnWidth,
        topHeight,
        depth,
        2,
        WALL_SIGN.logoBevel,
      ),
      lower: new RoundedBoxGeometry(
        columnWidth,
        lowerHeight,
        depth,
        2,
        WALL_SIGN.logoBevel,
      ),
    };
    const segments = [
      { name: 'leftStem', column: 0, y: 0, geometry: geometries.full },
      { name: 'leftShoulder', column: 1, y: topY, geometry: geometries.top },
      { name: 'centerStem', column: 2, y: lowerY, geometry: geometries.lower },
      { name: 'rightShoulder', column: 3, y: topY, geometry: geometries.top },
      { name: 'rightStem', column: 4, y: lowerY, geometry: geometries.lower },
    ];
    for (const segment of segments) {
      const part = mesh(segment.geometry, this.materials.white, { cast: true, receive: true });
      part.name = `MintWallLogo_${segment.name}`;
      part.position.set(
        (segment.column - 2) * columnWidth,
        segment.y,
        depth / 2,
      );
      root.add(part);
    }
    return root;
  }

  createProceduralHoop() {
    const root = new THREE.Group();
    const { dark, metal, mintLight, brandLime, brandYellow, white } = this.materials;
    const rimRadius = ((COURT.hoop.rimRight - COURT.hoop.rimLeft) / 2) * WORLD_PER_PIXEL;
    this.rimMaterial = brandLime.clone();
    this.rimMaterial.emissive = new THREE.Color('#425800');
    const rim = mesh(new THREE.TorusGeometry(rimRadius, 0.082, 14, 64), this.rimMaterial, { cast: true, receive: true });
    rim.rotation.x = Math.PI / 2 - 0.12;
    rim.position.z = 0.42;
    root.add(rim);

    // Loading fallback follows the standalone Mint board's new horizontal
    // silhouette so the deleted portrait/glass board never flashes on screen.
    const boardX = 0;
    const boardY = 1.34;
    addBox(root, dark, [4.35, 2.82, 0.24], [boardX, boardY, -0.58]);
    addBox(root, mintLight, [3.98, 2.45, 0.12], [boardX, boardY, -0.42]);
    const targetY = boardY - 0.28;
    addBox(root, brandLime, [1.08, 0.075, 0.055], [boardX, targetY + 0.42, -0.32]);
    addBox(root, brandLime, [1.08, 0.075, 0.055], [boardX, targetY - 0.42, -0.32]);
    addBox(root, brandLime, [0.075, 0.84, 0.055], [boardX - 0.54, targetY, -0.32]);
    addBox(root, brandLime, [0.075, 0.84, 0.055], [boardX + 0.54, targetY, -0.32]);
    const boltGeometry = new THREE.CylinderGeometry(0.055, 0.055, 0.045, 10);
    for (const [x, y] of [
      [boardX - 1.82, boardY + 1.06],
      [boardX + 1.82, boardY + 1.06],
      [boardX - 1.82, boardY - 1.06],
      [boardX + 1.82, boardY - 1.06],
    ]) {
      const bolt = mesh(boltGeometry, metal, { cast: true, receive: true });
      bolt.position.set(x, y, -0.3);
      bolt.rotation.x = Math.PI / 2;
      root.add(bolt);
    }

    const floorOffset = -gameToWorld(979, COURT.hoop.rimY).y;
    const poleX = 0;
    const poleHeight = 5.75;
    addBox(root, dark, [0.62, poleHeight, 0.72], [poleX, floorOffset + poleHeight / 2, -1.25]);
    addBox(root, brandLime, [0.32, 5.05, 0.22], [poleX, floorOffset + 3, -0.94]);
    addBox(root, brandYellow, [0.34, 0.12, 0.24], [poleX, -0.45, -0.93]);
    addBox(root, dark, [2.25, 0.28, 1.28], [poleX, floorOffset + 0.1, -0.75]);
    addBox(root, dark, [0.9, 1.05, 0.78], [poleX, 0.8, -1.25]);
    root.add(cylinderBetween(
      new THREE.Vector3(poleX, 0.42, -1.22),
      new THREE.Vector3(-1.42, 0.42, -0.96),
      0.09,
      metal,
    ));
    root.add(cylinderBetween(
      new THREE.Vector3(poleX, 0.42, -1.22),
      new THREE.Vector3(1.42, 0.42, -0.96),
      0.09,
      metal,
    ));
    addBox(root, dark, [0.5, 0.2, 0.92], [0, 0.03, -0.18]);

    const netMaterial = new THREE.LineBasicMaterial({ color: white.color, transparent: true, opacity: 0.92 });
    const netTopY = -0.08;
    const netBottomY = -1.62;
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      const top = new THREE.Vector3(
        Math.cos(angle) * rimRadius * 0.92,
        netTopY,
        0.42 + Math.sin(angle) * rimRadius * 0.92,
      );
      const bottomAngle = angle + (i % 2 ? 0.38 : -0.38);
      const bottom = new THREE.Vector3(
        Math.cos(bottomAngle) * rimRadius * 0.43,
        netBottomY,
        0.42 + Math.sin(bottomAngle) * rimRadius * 0.43,
      );
      root.add(createNetLine([
        top,
        top.clone().lerp(bottom, 0.48).add(new THREE.Vector3(0.08 * Math.sin(i), -0.06, 0)),
        bottom,
      ], netMaterial));
    }
    for (let ringIndex = 0; ringIndex < 4; ringIndex += 1) {
      const t = (ringIndex + 1) / 5;
      const radius = THREE.MathUtils.lerp(rimRadius * 0.9, rimRadius * 0.43, t);
      const points = [];
      for (let i = 0; i <= 32; i += 1) {
        const angle = (i / 32) * Math.PI * 2;
        points.push(new THREE.Vector3(
          Math.cos(angle) * radius,
          THREE.MathUtils.lerp(netTopY, netBottomY, t),
          0.42 + Math.sin(angle) * radius,
        ));
      }
      root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), netMaterial));
    }
    return root;
  }

  buildActors() {
    this.proceduralBall = this.createProceduralBall();
    this.ballVisual = this.proceduralBall;
    this.scene.add(this.ballVisual);

    this.proceduralHoop = this.createProceduralHoop();
    this.hoopVisual = this.proceduralHoop;
    this.hoopVisual.position.copy(gameToWorld(
      (COURT.hoop.rimLeft + COURT.hoop.rimRight) / 2,
      COURT.hoop.rimY,
      ACTOR_Z,
    ));
    const fallbackRimRadius = ((COURT.hoop.rimRight - COURT.hoop.rimLeft) / 2) * WORLD_PER_PIXEL;
    this.visualRimAnchors = {
      center: new THREE.Object3D(),
      left: new THREE.Object3D(),
      right: new THREE.Object3D(),
    };
    this.visualRimAnchors.left.position.x = -fallbackRimRadius;
    this.visualRimAnchors.right.position.x = fallbackRimRadius;
    this.hoopVisual.add(
      this.visualRimAnchors.center,
      this.visualRimAnchors.left,
      this.visualRimAnchors.right,
    );
    this.scene.add(this.hoopVisual);

    this.ballShadow = mesh(new THREE.CircleGeometry(BALL.radius * WORLD_PER_PIXEL * 1.35, 32), this.materials.shadow, { cast: false });
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.position.y = 0.025;
    this.scene.add(this.ballShadow);
  }

  buildFeedback() {
    this.aimArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(),
      1,
      new THREE.Color(COLORS.dark).getHex(),
      0.28,
      0.19,
    );
    this.aimArrow.visible = false;
    this.aimArrow.line.material.toneMapped = false;
    this.aimArrow.cone.material.toneMapped = false;
    this.scene.add(this.aimArrow);

    const sphereGeometry = new THREE.IcosahedronGeometry(0.11, 1);
    const dashGeometry = new THREE.BoxGeometry(0.21, 0.07, 0.09);
    const particleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.roundParticles = new THREE.InstancedMesh(sphereGeometry, particleMaterial, MAX_PARTICLES);
    this.dashParticles = new THREE.InstancedMesh(dashGeometry, particleMaterial.clone(), MAX_PARTICLES);
    this.roundParticles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dashParticles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.roundParticles.frustumCulled = false;
    this.dashParticles.frustumCulled = false;
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      this.roundParticles.setMatrixAt(i, HIDDEN_MATRIX);
      this.dashParticles.setMatrixAt(i, HIDDEN_MATRIX);
      // Seed instanceColor before the first shader compile. Adding it only on
      // the first score would leave the initial material program unaware of
      // per-instance color and render the burst black.
      this.roundParticles.setColorAt(i, new THREE.Color(COLORS.white));
      this.dashParticles.setColorAt(i, new THREE.Color(COLORS.white));
    }
    this.scene.add(this.roundParticles, this.dashParticles);

    const trailGeometry = new THREE.IcosahedronGeometry(0.085, 1);
    const trailMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.mint,
      transparent: true,
      opacity: 0.64,
      depthWrite: false,
      toneMapped: false,
    });
    this.shotTrail = new THREE.InstancedMesh(trailGeometry, trailMaterial, MAX_TRAIL_POINTS);
    this.shotTrail.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shotTrail.frustumCulled = false;
    for (let i = 0; i < MAX_TRAIL_POINTS; i += 1) this.shotTrail.setMatrixAt(i, HIDDEN_MATRIX);
    this.scene.add(this.shotTrail);

    this.readyHaloMaterial = new THREE.MeshBasicMaterial({
      color: 0xc4f43d,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      toneMapped: false,
    });
    this.readyHalo = mesh(
      new THREE.TorusGeometry(BALL.radius * WORLD_PER_PIXEL * 1.5, 0.025, 8, 64),
      this.readyHaloMaterial,
      { cast: false, receive: false },
    );
    this.readyHalo.position.z = ACTOR_Z - 0.12;
    this.scene.add(this.readyHalo);

    this.scoreRingMaterial = new THREE.MeshBasicMaterial({
      color: 0xc4f43d,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    });
    this.scoreRing = mesh(
      new THREE.TorusGeometry(0.74, 0.045, 8, 72),
      this.scoreRingMaterial,
      { cast: false, receive: false },
    );
    this.scoreRing.position.copy(gameToWorld(
      (COURT.hoop.rimLeft + COURT.hoop.rimRight) / 2,
      COURT.hoop.rimY,
      1.62,
    ));
    this.scoreRing.visible = false;
    this.scene.add(this.scoreRing);
  }

  setAssets(assets) {
    this.assets = assets;
    if (assets?.basketball?.glb?.loaded) {
      this.scene.remove(this.ballVisual);
      // The moving ball already has a purpose-built contact shadow. Keeping
      // imported hero meshes out of the shadow pass avoids a costly dynamic
      // PBR shadow sample without changing the visual grounding.
      prepareImportedScene(assets.basketball.glb.scene);
      this.ballVisual = centerAndScale(assets.basketball.glb.scene, BALL.radius * WORLD_PER_PIXEL * 2.25);
      this.scene.add(this.ballVisual);
    }
    if (assets?.hoop?.glb?.loaded) {
      this.scene.remove(this.hoopVisual);
      // The hoop is fully modeled and lit, while the arena and logo mount own
      // the baked scene shadows. Imported geometry stays out of that pass so
      // software-rendered/mobile frames remain responsive.
      const hoopScene = cloneImportedSceneForPresentation(assets.hoop.glb.scene);
      this.hoopRimCorrection = levelMintHoopRim(hoopScene);
      this.hoopFrontAssemblyCorrection = bringMintHoopFrontAssemblyToBoard(hoopScene);
      prepareImportedScene(hoopScene);
      this.hoopVisual = centerAndScale(hoopScene, MINT_HOOP_TARGET_SIZE, 'floor');
      const rimTarget = gameToWorld(
        (COURT.hoop.rimLeft + COURT.hoop.rimRight) / 2,
        COURT.hoop.rimY,
        ACTOR_Z,
      );
      // The complete Mint prop is normalized from its floor. Its authored rim
      // height already lands on the score plane; the measured forward anchor
      // correction keeps the ring center there after the side-view rotation.
      this.hoopVisual.position.set(
        rimTarget.x + MINT_HOOP_RIM_FORWARD_OFFSET,
        0,
        ACTOR_Z,
      );
      // The ball approaches from the left (negative world X). Mint authored
      // the board's front toward +Z, so a -90° yaw points that face toward the
      // ball and presents the complete basket in the game's side-view axis.
      this.hoopVisual.rotation.y = -Math.PI / 2;
      this.visualRimAnchors = {
        center: new THREE.Object3D(),
        left: new THREE.Object3D(),
        right: new THREE.Object3D(),
      };
      for (const anchor of Object.values(this.visualRimAnchors)) {
        anchor.position.y = rimTarget.y;
      }
      this.visualRimAnchors.center.position.z = MINT_HOOP_RIM_FORWARD_OFFSET;
      // With -90 degree yaw, larger local Z maps to smaller world X.
      this.visualRimAnchors.left.position.z = MINT_HOOP_RIM_FORWARD_OFFSET + MINT_HOOP_RIM_CENTERLINE_RADIUS;
      this.visualRimAnchors.right.position.z = MINT_HOOP_RIM_FORWARD_OFFSET - MINT_HOOP_RIM_CENTERLINE_RADIUS;
      this.hoopVisual.add(
        this.visualRimAnchors.center,
        this.visualRimAnchors.left,
        this.visualRimAnchors.right,
      );
      this.visualBackboardAnchor = new THREE.Object3D();
      this.visualBackboardAnchor.position.set(
        0,
        gameToWorld(0, COURT.hoop.backboard.y + COURT.hoop.backboard.height / 2).y,
        MINT_HOOP_BOARD_FRONT_OFFSET,
      );
      this.hoopVisual.add(this.visualBackboardAnchor);
      this.rimMaterial = findImportedMaterial(this.hoopVisual, 'MintRim') ?? this.rimMaterial;
      this.scene.add(this.hoopVisual);
    }
    if (!this.logoVisual) {
      const mountGeometry = new THREE.ExtrudeGeometry(
        roundedRectShape(WALL_SIGN.width, WALL_SIGN.height, 0.3),
        {
          depth: 0.16,
          bevelEnabled: true,
          bevelSegments: 4,
          bevelSize: 0.055,
          bevelThickness: 0.045,
          curveSegments: 8,
        },
      );
      mountGeometry.computeBoundingBox();
      this.logoMount = mesh(
        mountGeometry,
        this.materials.dark,
        { cast: true, receive: true },
      );
      // Keep the complete plaque in front of both the inset panels and their
      // mint light strips. The previous front face shared the strips' depth,
      // which let them z-fight through the lower edge of the sign.
      const mountLocalFront = mountGeometry.boundingBox?.max.z ?? 0.205;
      this.logoMount.position.set(
        WALL_SIGN.x,
        WALL_SIGN.y,
        WALL_SIGN.mountFrontZ - mountLocalFront,
      );
      this.scene.add(this.logoMount);
      // Present the fieldhouse mark as five authored, equal-depth segments so
      // every lower stem exposes the same beveled side faces and participates
      // in the cached shadow pass without requiring a bundled runtime model.
      this.logoVisual = this.createWallLogoRelief();
      this.logoVisual.position.set(
        WALL_SIGN.x,
        WALL_SIGN.y,
        WALL_SIGN.mountFrontZ - WALL_SIGN.logoEmbed,
      );
      this.scene.add(this.logoVisual);
    }
    if (this.renderer) this.renderer.shadowMap.needsUpdate = true;
  }

  resize() {
    if (!this.renderer) return;
    const mobile = window.innerWidth <= 760;
    this.dpr = this.automatedQualityTier
      ? (mobile ? 1 : 0.75)
      : Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || VIEWPORT.width));
    const height = Math.max(1, Math.round(rect.height || VIEWPORT.height));
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.shadowMap.needsUpdate = true;
  }

  setReducedMotion(enabled) {
    this.reducedMotion = Boolean(enabled);
  }

  updateParticles(particles) {
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      this.roundParticles.setMatrixAt(i, HIDDEN_MATRIX);
      this.dashParticles.setMatrixAt(i, HIDDEN_MATRIX);
    }
    particles.slice(0, MAX_PARTICLES).forEach((particle, index) => {
      const life = Math.max(0, particle.life / particle.maxLife);
      const position = gameToWorld(particle.x, particle.y, 1.35 + ((index % 5) - 2) * 0.08);
      const size = Math.max(0.001, particle.size * WORLD_PER_PIXEL * life * 1.65);
      this.tempQuaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), particle.rotation);
      this.tempScale.setScalar(size / 0.11);
      this.tempMatrix.compose(position, this.tempQuaternion, this.tempScale);
      const target = particle.shape === 'circle' ? this.roundParticles : this.dashParticles;
      target.setMatrixAt(index, this.tempMatrix);
      target.setColorAt(index, new THREE.Color(particle.color));
    });
    this.roundParticles.instanceMatrix.needsUpdate = true;
    this.dashParticles.instanceMatrix.needsUpdate = true;
    if (this.roundParticles.instanceColor) this.roundParticles.instanceColor.needsUpdate = true;
    if (this.dashParticles.instanceColor) this.dashParticles.instanceColor.needsUpdate = true;
  }

  updateTrail(points) {
    this.activeTrailPoints = Math.min(points.length, MAX_TRAIL_POINTS);
    for (let i = 0; i < MAX_TRAIL_POINTS; i += 1) this.shotTrail.setMatrixAt(i, HIDDEN_MATRIX);
    points.slice(-MAX_TRAIL_POINTS).forEach((point, index) => {
      const life = Math.max(0, point.life / point.maxLife);
      const position = gameToWorld(point.x, point.y, ACTOR_Z - 0.08);
      const scale = 0.28 + life * 0.72;
      this.tempQuaternion.identity();
      this.tempScale.setScalar(scale);
      this.tempMatrix.compose(position, this.tempQuaternion, this.tempScale);
      this.shotTrail.setMatrixAt(index, this.tempMatrix);
    });
    this.shotTrail.instanceMatrix.needsUpdate = true;
  }

  updateRetiredBallShadow(shadow, ball, worldBall, phase) {
    const height = Math.max(
      0,
      ball.y + ball.radius < COURT.floorY ? COURT.floorY - (ball.y + ball.radius) : 0,
    );
    const shadowScale = THREE.MathUtils.clamp(1 - height / 560, 0.28, 1);
    shadow.visible = phase !== 'over';
    shadow.position.x = worldBall.x;
    shadow.position.z = worldBall.z;
    shadow.scale.set(1.2 * shadowScale, 0.58 * shadowScale, 1);
    shadow.material.opacity = 0.08 + shadowScale * 0.13;
  }

  updateRetiredBallVisuals(state) {
    const activeIds = new Set(state.retiredBalls.map((ball) => ball.id));
    for (const [id, entry] of this.retiredBallVisuals) {
      if (activeIds.has(id)) continue;
      this.scene.remove(entry.visual, entry.shadow);
      entry.shadow.material.dispose();
      this.retiredBallVisuals.delete(id);
    }

    for (const ball of state.retiredBalls) {
      let entry = this.retiredBallVisuals.get(ball.id);
      if (!entry) {
        const visual = this.ballVisual.clone(true);
        const shadow = this.ballShadow.clone();
        shadow.material = this.ballShadow.material.clone();
        entry = { visual, shadow };
        this.retiredBallVisuals.set(ball.id, entry);
        this.scene.add(visual, shadow);
      }

      const worldBall = gameToWorld(ball.x, ball.y, ACTOR_Z);
      entry.visual.visible = state.phase !== 'over';
      entry.visual.position.copy(worldBall);
      entry.visual.rotation.x = ball.rotation * 0.34;
      entry.visual.rotation.y = ball.rotation;
      entry.visual.rotation.z = ball.rotation * 0.18;
      entry.visual.scale.setScalar(1);
      this.updateRetiredBallShadow(entry.shadow, ball, worldBall, state.phase);
    }
  }

  render(state) {
    if (!this.renderer) return;
    const ball = state.ball;
    const worldBall = gameToWorld(ball.x, ball.y, ACTOR_Z);
    const resetProgress = ball.mode === 'resetting' ? Math.min(1, ball.resetTime / BALL.resetSeconds) : 0;
    const dragScale = state.drag.active && !this.reducedMotion
      ? 1.05 + Math.sin(state.elapsed * 10) * 0.018
      : 1;
    const impactSquash = !this.reducedMotion && ball.floorContactAge !== null && ball.floorContactAge < 0.16
      ? 1 - Math.sin((ball.floorContactAge / 0.16) * Math.PI) * 0.16
      : 1;
    const resetScale = 1 - resetProgress * 0.72;
    this.ballVisual.visible = state.phase !== 'over' && resetScale > 0.04;
    this.ballVisual.position.copy(worldBall);
    this.ballVisual.rotation.x = ball.rotation * 0.34;
    this.ballVisual.rotation.y = ball.rotation;
    this.ballVisual.rotation.z = ball.rotation * 0.18;
    this.ballVisual.scale.set(
      resetScale * dragScale / Math.sqrt(impactSquash),
      resetScale * dragScale * impactSquash,
      resetScale * dragScale / Math.sqrt(impactSquash),
    );

    const height = Math.max(0, ball.y + ball.radius < COURT.floorY ? COURT.floorY - (ball.y + ball.radius) : 0);
    const shadowScale = THREE.MathUtils.clamp(1 - height / 560, 0.28, 1);
    this.ballShadow.position.x = worldBall.x;
    this.ballShadow.position.z = worldBall.z;
    this.ballShadow.scale.set(1.2 * shadowScale, 0.58 * shadowScale, 1);
    this.ballShadow.material.opacity = 0.08 + shadowScale * 0.13;

    this.updateRetiredBallVisuals(state);

    if (state.drag.active && state.drag.distance >= BALL.minDragDistance) {
      const direction = new THREE.Vector3(state.drag.dx, -state.drag.dy, 0).normalize();
      const power = Math.min(1, state.drag.distance / BALL.maxDragDistance);
      this.aimArrowPower = power;
      this.aimArrowLengthPixels = THREE.MathUtils.lerp(
        AIM_ARROW.minLength,
        AIM_ARROW.maxLength,
        power,
      );
      if (power <= AIM_ARROW.midColorPower) {
        this.aimArrowColor.lerpColors(
          this.aimArrowLowColor,
          this.aimArrowMidColor,
          power / AIM_ARROW.midColorPower,
        );
      } else {
        this.aimArrowColor.lerpColors(
          this.aimArrowMidColor,
          this.aimArrowHighColor,
          (power - AIM_ARROW.midColorPower) / (1 - AIM_ARROW.midColorPower),
        );
      }
      const length = this.aimArrowLengthPixels * WORLD_PER_PIXEL;
      this.aimArrow.position.copy(worldBall).add(new THREE.Vector3(0, 0, 0.34));
      this.aimArrow.setDirection(direction);
      this.aimArrow.setLength(
        length,
        Math.min(AIM_ARROW.maxHeadLength * WORLD_PER_PIXEL, length * 0.24),
        Math.min(AIM_ARROW.maxHeadWidth * WORLD_PER_PIXEL, length * 0.16),
      );
      this.aimArrow.setColor(this.aimArrowColor);
      this.aimArrow.visible = true;
    } else {
      this.aimArrowLengthPixels = 0;
      this.aimArrowPower = 0;
      this.aimArrow.visible = false;
    }

    // Headless Chromium's video compositor can tile-flash when a WebGL
    // InstancedMesh burst is introduced mid-recording. The dedicated physics
    // evidence runner can suppress only that decorative burst; gameplay state,
    // scoring, the ball, rim response, and UI feedback remain unchanged.
    this.updateParticles(
      window.__MINT_HOOPS_CAPTURE_SAFE_MODE__ || this.reducedMotion ? [] : state.effects.particles,
    );
    this.updateTrail(this.reducedMotion ? [] : state.effects.trail);
    const flash = state.effects.rimFlash;
    if (this.rimMaterial) this.rimMaterial.emissiveIntensity = 0.08 + flash * 2.8;
    this.scoreLight.intensity = flash * 260;

    const readyPulse = this.reducedMotion ? 1 : 1 + Math.sin(state.elapsed * 3.8) * 0.06;
    this.readyHalo.visible = state.phase === 'playing' && ball.mode === 'ready' && !state.drag.active;
    this.readyHalo.position.x = worldBall.x;
    this.readyHalo.position.y = worldBall.y;
    this.readyHalo.scale.setScalar(readyPulse);
    this.readyHaloMaterial.opacity = 0.38 + Math.sin(state.elapsed * 3.8) * 0.1;

    const scorePulse = state.effects.scorePulse;
    this.scoreRing.visible = scorePulse > 0.01 && !this.reducedMotion;
    if (this.scoreRing.visible) {
      const ringProgress = 1 - scorePulse;
      this.scoreRing.scale.setScalar(0.7 + ringProgress * 2.4);
      this.scoreRingMaterial.opacity = scorePulse * 0.82;
      this.scoreRing.rotation.z = ringProgress * 0.18;
    }

    const shake = this.reducedMotion ? 0 : flash * flash;
    this.camera.position.set(
      this.cameraBase.x + Math.sin(state.elapsed * 64) * 0.07 * shake,
      this.cameraBase.y + Math.sin(state.elapsed * 51 + 1.7) * 0.045 * shake,
      this.cameraBase.z,
    );
    this.camera.lookAt(this.cameraTarget);
    this.renderer.render(this.scene, this.camera);
  }

  isAvailable() {
    return Boolean(this.renderer);
  }

  getDiagnostics() {
    if (!this.renderer) return { available: false };
    const materials = new Set();
    let meshes = 0;
    let instancedMeshes = 0;
    this.scene.traverse((child) => {
      if (!child.isMesh) return;
      meshes += 1;
      if (child.isInstancedMesh) instancedMeshes += 1;
      const list = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of list) if (material) materials.add(material.uuid);
    });
    const { render, memory } = this.renderer.info;
    const scoreCenter = gameToWorld(
      (COURT.hoop.rimLeft + COURT.hoop.rimRight) / 2,
      COURT.hoop.rimY,
      ACTOR_Z,
    );
    const scoreLeft = gameToWorld(COURT.hoop.rimLeft, COURT.hoop.rimY, ACTOR_Z);
    const scoreRight = gameToWorld(COURT.hoop.rimRight, COURT.hoop.rimY, ACTOR_Z);
    const backboardFront = gameToWorld(
      COURT.hoop.backboard.x,
      COURT.hoop.backboard.y + COURT.hoop.backboard.height / 2,
      ACTOR_Z,
    );
    this.hoopVisual?.updateWorldMatrix(true, true);
    const visualCenter = this.visualRimAnchors?.center.getWorldPosition(new THREE.Vector3()) ?? null;
    const visualLeft = this.visualRimAnchors?.left.getWorldPosition(new THREE.Vector3()) ?? null;
    const visualRight = this.visualRimAnchors?.right.getWorldPosition(new THREE.Vector3()) ?? null;
    const visualBackboard = this.visualBackboardAnchor?.getWorldPosition(new THREE.Vector3()) ?? null;
    const point = (value) => value && ({ x: value.x, y: value.y, z: value.z });
    const deltaPixels = (visual, target) => visual && ({
      x: (visual.x - target.x) / WORLD_PER_PIXEL,
      y: (visual.y - target.y) / WORLD_PER_PIXEL,
    });

    return {
      available: true,
      renderer: 'WebGLRenderer',
      camera: 'PerspectiveCamera',
      calls: render.calls,
      triangles: render.triangles,
      geometries: memory.geometries,
      textures: memory.textures,
      materials: materials.size,
      meshes,
      instancedMeshes,
      dpr: this.dpr,
      shadows: this.renderer.shadowMap.enabled,
      shadowMap: this.shadowMapSize,
      automatedQualityTier: this.automatedQualityTier,
      reducedMotion: this.reducedMotion,
      shadowAutoUpdate: this.renderer.shadowMap.autoUpdate,
      shadowNeedsUpdate: this.renderer.shadowMap.needsUpdate,
      postPasses: 0,
      basketballGlb: this.assets?.basketball?.glb?.loaded ?? false,
      hoopGlb: this.assets?.hoop?.glb?.loaded ?? false,
      logoGlb: this.assets?.logo?.glb?.loaded ?? false,
      hoopPresentation: {
        rim: this.hoopRimCorrection,
        frontAssembly: this.hoopFrontAssemblyCorrection,
      },
      wallLogo: {
        presentation: this.logoVisual ? 'five-segment-relief' : null,
        segments: this.logoVisual?.children.length ?? 0,
        depth: WALL_SIGN.logoDepth,
        castsShadows: this.logoVisual?.children.every((child) => child.castShadow) ?? false,
        receivesShadows: this.logoVisual?.children.every((child) => child.receiveShadow) ?? false,
      },
      aimArrow: {
        visible: this.aimArrow.visible,
        lengthPixels: this.aimArrowLengthPixels,
        power: this.aimArrowPower,
        color: `#${this.aimArrowColor.getHexString()}`,
      },
      aimHalo: {
        exists: Boolean(this.readyHalo),
        visible: this.readyHalo?.visible ?? false,
      },
      shotTrail: {
        maxPoints: MAX_TRAIL_POINTS,
        activePoints: this.activeTrailPoints ?? 0,
      },
      retainedBallVisuals: this.retiredBallVisuals.size,
      procedural3dFallbacks: {
        basketball: !(this.assets?.basketball?.glb?.loaded ?? false),
        hoop: !(this.assets?.hoop?.glb?.loaded ?? false),
      },
      hoopAlignment: {
        visualRimCenter: point(visualCenter),
        scorePlaneCenter: point(scoreCenter),
        centerDeltaPixels: deltaPixels(visualCenter, scoreCenter),
        visualRimLeft: point(visualLeft),
        leftCollider: point(scoreLeft),
        leftDeltaPixels: deltaPixels(visualLeft, scoreLeft),
        visualRimRight: point(visualRight),
        rightCollider: point(scoreRight),
        rightDeltaPixels: deltaPixels(visualRight, scoreRight),
        mintForwardOffsetWorld: MINT_HOOP_RIM_FORWARD_OFFSET,
        visualBackboardFront: point(visualBackboard),
        backboardColliderFront: point(backboardFront),
        backboardDeltaPixels: deltaPixels(visualBackboard, backboardFront),
      },
    };
  }

  destroy() {
    window.removeEventListener('resize', this.resize);
    this.reducedMotionQuery?.removeEventListener?.('change', this.onReducedMotionChange);
    this.resizeObserver.disconnect();
    this.scene.traverse((child) => {
      if (!child.isMesh) return;
      child.geometry?.dispose?.();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) material?.dispose?.();
    });
    for (const texture of Object.values(this.proceduralTextures)) texture.dispose();
    this.renderer?.dispose();
  }
}
