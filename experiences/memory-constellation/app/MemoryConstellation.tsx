"use client";

import {
  ChangeEvent,
  FormEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { MEMORY_CONSTELLATION_ASSETS, MemoryCategory } from "./memoryConstellationAssets";

type MediaRef = {
  id: string;
  name: string;
  type: string;
  size: number;
  transcript?: string;
};

type Memory = {
  id: string;
  title: string;
  date: string;
  body: string;
  place: string;
  people: string[];
  emotions: string[];
  tags: string[];
  category: MemoryCategory;
  importance: number;
  constellation: string;
  chapter: string;
  collections: string[];
  shareable: boolean;
  favorite: boolean;
  sensitive: boolean;
  connections: string[];
  reflections: { id: string; date: string; text: string }[];
  media: MediaRef[];
  createdAt: string;
  updatedAt: string;
};

type Filters = {
  year: "all" | string;
  person: "all" | string;
  place: "all" | string;
};

type Draft = {
  title: string;
  date: string;
  body: string;
  place: string;
  people: string;
  importance: number;
  shareable: boolean;
  favorite: boolean;
  sensitive: boolean;
  transcript: string;
};

type ConnectionKind = "person" | "location" | "date";

type MemoryConnection = {
  from: string;
  to: string;
  kinds: ConnectionKind[];
};

const STORE_KEY = "memory-constellation-v1";
const DEMO_DATA_VERSION_KEY = "memory-constellation-demo-data-v4-nine-memory-matrix";
const SETTINGS_KEY = "memory-constellation-settings-v1";
const INTRO_KEY = "memory-constellation-intro-seen-v1";
const MEDIA_DB = "memory-constellation-media-v1";

const STAR_VARIANTS = Object.keys(MEMORY_CONSTELLATION_ASSETS.stars) as MemoryCategory[];
const STAR_COLORS: Record<MemoryCategory, string> = {
  family: "#f2dfb4",
  friendship: "#e7b5ad",
  travel: "#9bc7c7",
  achievement: "#e8c27f",
  everyday: "#c1ccd6",
  growth: "#bdcbaa",
};

const EMPTY_FILTERS: Filters = {
  year: "all",
  person: "all",
  place: "all",
};

const today = () => new Date().toISOString().slice(0, 10);
const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const DEMO_SCENARIOS: {
  id: string;
  title: string;
  date: string;
  body: string;
  place: string;
  person: string;
  category: MemoryCategory;
  importance: number;
  favorite?: boolean;
}[] = [
  { id: "demo-mom-california-2016", title: "The California coast with Mom", date: "2016-07-01", body: "We pulled over above the ocean, shared a paper bag of cherries, and stayed until the fog reached the road.", place: "California", person: "Mom", category: "family", importance: 5, favorite: true },
  { id: "demo-mom-new-york-2025", title: "Mom's New York bakery morning", date: "2025-07-10", body: "Mom found a bakery before the city woke up, and we carried warm bread through three quiet blocks.", place: "New York", person: "Mom", category: "family", importance: 4 },
  { id: "demo-mom-chicago-2026", title: "Mom's Chicago voice note", date: "2026-07-05", body: "Mom sent a voice note from Chicago describing the lake wind and a song she heard through an open window.", place: "Chicago", person: "Mom", category: "family", importance: 3 },
  { id: "demo-sam-new-york-2016", title: "Sam's rainy New York weekend", date: "2016-07-04", body: "Sam and I walked without an umbrella, found a tiny bookstore, and spent the evening drying our coats.", place: "New York", person: "Sam Rivera", category: "friendship", importance: 4 },
  { id: "demo-sam-chicago-2025", title: "Sam under the Chicago marquee", date: "2025-07-13", body: "Sam spotted our names reflected in the theater glass just before the lights changed over the street.", place: "Chicago", person: "Sam Rivera", category: "friendship", importance: 3 },
  { id: "demo-sam-california-2026", title: "Sam's California sunset picnic", date: "2026-07-14", body: "Sam brought peaches and a blanket, and we watched the last orange light leave the hills.", place: "California", person: "Sam Rivera", category: "friendship", importance: 4, favorite: true },
  { id: "demo-jordan-chicago-2016", title: "Jordan's first Chicago museum day", date: "2016-07-07", body: "Jordan chose one painting for us to remember, then defended the choice all the way to the train.", place: "Chicago", person: "Jordan Lee", category: "everyday", importance: 4 },
  { id: "demo-jordan-california-2025", title: "Jordan on the California trail", date: "2025-07-16", body: "Jordan kept finding tiny wildflowers beside the trail and naming colors neither of us could quite describe.", place: "California", person: "Jordan Lee", category: "everyday", importance: 3 },
  { id: "demo-jordan-new-york-2026", title: "Yesterday in New York with Jordan", date: "2026-07-21", body: "Jordan called from the corner, coffee in hand, and we turned an ordinary walk into the whole afternoon.", place: "New York", person: "Jordan Lee", category: "everyday", importance: 5, favorite: true },
];

const DEMO_MEMORIES: Memory[] = DEMO_SCENARIOS.map((scenario) => ({
  id: scenario.id,
  title: scenario.title,
  date: scenario.date,
  body: scenario.body,
  place: scenario.place,
  people: [scenario.person],
  emotions: [],
  tags: [],
  category: scenario.category,
  importance: scenario.importance,
  constellation: "",
  chapter: "",
  collections: [],
  shareable: false,
  favorite: scenario.favorite ?? false,
  sensitive: false,
  connections: [],
  reflections: [],
  media: [],
  createdAt: `${scenario.date}T18:00:00.000Z`,
  updatedAt: `${scenario.date}T18:00:00.000Z`,
}));

const EMPTY_DRAFT: Draft = {
  title: "",
  date: today(),
  body: "",
  place: "",
  people: "",
  importance: 3,
  shareable: false,
  favorite: false,
  sensitive: false,
  transcript: "",
};

function openMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MEDIA_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("media")) request.result.createObjectStore("media");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function mediaPut(id: string, blob: Blob) {
  const db = await openMediaDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("media", "readwrite");
    tx.objectStore("media").put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function mediaGet(id: string): Promise<Blob | undefined> {
  const db = await openMediaDb();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction("media", "readonly");
    const request = tx.objectStore("media").get(id);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return blob;
}

async function mediaDelete(id: string) {
  const db = await openMediaDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("media", "readwrite");
    tx.objectStore("media").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function clearMediaDb() {
  const db = await openMediaDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("media", "readwrite");
    tx.objectStore("media").clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function fileToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(value: string) {
  const [header, body] = value.split(",");
  const mime = header.match(/data:(.*?);/)?.[1] ?? "application/octet-stream";
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return Math.abs(result >>> 0);
}

function memoryStarVariant(memory: Memory) {
  void memory;
  return "family" as const;
}

function connectionKinds(first: Memory, second: Memory): ConnectionKind[] {
  const kinds: ConnectionKind[] = [];
  const firstPeople = new Set(first.people.map((person) => person.trim().toLocaleLowerCase()).filter(Boolean));
  if (second.people.some((person) => firstPeople.has(person.trim().toLocaleLowerCase()))) kinds.push("person");
  const firstPlace = first.place.trim().toLocaleLowerCase();
  const secondPlace = second.place.trim().toLocaleLowerCase();
  if (firstPlace && firstPlace === secondPlace) kinds.push("location");
  const sameMonth = first.date.slice(0, 7) === second.date.slice(0, 7);
  const sameAnniversary = first.date.slice(5) === second.date.slice(5);
  if (sameMonth || sameAnniversary) kinds.push("date");
  return kinds;
}

function inferMemoryConnections(memories: Memory[]) {
  const connections: MemoryConnection[] = [];
  for (let firstIndex = 0; firstIndex < memories.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < memories.length; secondIndex += 1) {
      const kinds = connectionKinds(memories[firstIndex], memories[secondIndex]);
      if (kinds.length) connections.push({ from: memories[firstIndex].id, to: memories[secondIndex].id, kinds });
    }
  }
  return connections;
}

function memoryPosition(memory: Memory, yearIndex: number) {
  const relationship = memory.people[0] || memory.place || memory.date.slice(0, 7);
  const baseAngle = (hash(relationship) % 628) / 100;
  const dateAngle = (new Date(`${memory.date}T12:00:00`).getMonth() / 12) * Math.PI * 2;
  const angle = baseAngle * 0.62 + dateAngle * 0.38;
  const radius = 5.4 + yearIndex * 2.25 + (hash(`${memory.id}|${memory.place}`) % 100) / 140;
  const relationshipLift = ((hash(`${memory.place}|${memory.people.join("|")}|${memory.date.slice(0, 7)}`) % 100) / 100 - 0.5) * 5.6;
  return new THREE.Vector3(Math.cos(angle) * radius, relationshipLift, Math.sin(angle) * radius);
}

const MINIMUM_MEMORY_STAR_GAP = 2.65;

function distributeMemoryPositions(memories: Memory[], years: string[]) {
  const positions = new Map<string, THREE.Vector3>();
  memories.forEach((memory) => {
    positions.set(memory.id, memoryPosition(memory, years.indexOf(memory.date.slice(0, 4))));
  });

  for (let pass = 0; pass < 14; pass += 1) {
    for (let firstIndex = 0; firstIndex < memories.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < memories.length; secondIndex += 1) {
        const first = positions.get(memories[firstIndex].id);
        const second = positions.get(memories[secondIndex].id);
        if (!first || !second) continue;
        const separation = second.clone().sub(first);
        const distance = separation.length();
        if (distance >= MINIMUM_MEMORY_STAR_GAP) continue;
        if (distance < 0.001) {
          const seed = hash(`${memories[firstIndex].id}|${memories[secondIndex].id}`);
          const angle = (seed % 628) / 100;
          separation.set(Math.cos(angle), ((seed % 83) / 82 - 0.5) * 0.5, Math.sin(angle)).normalize();
        } else {
          separation.multiplyScalar(1 / distance);
        }
        const correction = (MINIMUM_MEMORY_STAR_GAP - distance) * 0.52;
        first.addScaledVector(separation, -correction);
        second.addScaledVector(separation, correction);
      }
    }
  }

  return positions;
}

function normalizeAsset(source: THREE.Object3D) {
  const root = source.clone(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  root.position.sub(center);
  const largest = Math.max(size.x, size.y, size.z, 0.001);
  root.scale.setScalar(1 / largest);
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    }
  });
  const group = new THREE.Group();
  group.add(root);
  return group;
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => material?.dispose());
    }
  });
}

function softenMintAccent(root: THREE.Object3D, opacity: number) {
  const materials: { material: THREE.Material; baseOpacity: number }[] = [];
  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const softened = source.map((material) => {
      const clone = material.clone();
      clone.transparent = true;
      clone.opacity = Math.min(clone.opacity, opacity);
      clone.depthWrite = false;
      materials.push({ material: clone, baseOpacity: clone.opacity });
      return clone;
    });
    mesh.material = Array.isArray(mesh.material) ? softened : softened[0];
  });
  return materials;
}

type ConstellationCanvasProps = {
  memories: Memory[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onStep: (direction: -1 | 1) => void;
  journey: { key: number; ids: string[] };
  reducedMotion: boolean;
};

function ConstellationCanvas({ memories, selectedId, onSelect, onStep, journey, reducedMotion }: ConstellationCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const onStepRef = useRef(onStep);
  const selectedRef = useRef(selectedId);
  const journeyRef = useRef(journey);
  onSelectRef.current = onSelect;
  onStepRef.current = onStep;
  selectedRef.current = selectedId;
  journeyRef.current = journey;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    let disposed = false;
    let skyTexture: THREE.Texture | null = null;
    const fitSkyTexture = (texture: THREE.Texture, width = host.clientWidth, height = host.clientHeight) => {
      const imageAspect = 1376 / 768;
      const viewAspect = Math.max(width, 1) / Math.max(height, 1);
      if (viewAspect < imageAspect) {
        const visibleWidth = viewAspect / imageAspect;
        texture.repeat.set(visibleWidth, 1);
        texture.offset.set((1 - visibleWidth) / 2, 0);
      } else {
        const visibleHeight = imageAspect / viewAspect;
        texture.repeat.set(1, visibleHeight);
        texture.offset.set(0, (1 - visibleHeight) / 2);
      }
      texture.updateMatrix();
    };
    new THREE.TextureLoader().load(MEMORY_CONSTELLATION_ASSETS.denseBackdrop, (texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      fitSkyTexture(texture);
      skyTexture = texture;
      scene.background = texture;
    });
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
    camera.position.set(0, 4, 20);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute("aria-label", "Interactive three-dimensional constellation of memories");
    renderer.domElement.setAttribute("role", "img");
    host.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(host.clientWidth, host.clientHeight), 1.08, 0.1, 0.72);
    composer.addPass(bloom);

    scene.add(new THREE.AmbientLight(0xc6d4df, 1.45));
    const keyLight = new THREE.DirectionalLight(0xffe1b6, 3.2);
    keyLight.position.set(6, 12, 8);
    scene.add(keyLight);
    const coolLight = new THREE.DirectionalLight(0x718ba6, 2.4);
    coolLight.position.set(-8, -4, -6);
    scene.add(coolLight);

    const content = new THREE.Group();
    scene.add(content);
    const farSpace = new THREE.Group();
    scene.add(farSpace);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const loader = new GLTFLoader();
    const textureLoader = new THREE.TextureLoader();
    const templates: Record<string, THREE.Group> = {};
    const sharpTwinkleMaps: { basecolor?: THREE.Texture; normal?: THREE.Texture; roughness?: THREE.Texture } = {};
    const animatedTwinkleTextures: THREE.Texture[] = [];
    const hitTargets: THREE.Object3D[] = [];
    const positions = new Map<string, THREE.Vector3>();
    const lights: THREE.PointLight[] = [];
    const stars: THREE.Object3D[] = [];
    const distantFlybys: {
      root: THREE.Object3D;
      light: THREE.PointLight;
      materials: { material: THREE.Material; baseOpacity: number }[];
      cycleDuration: number;
      activeDuration: number;
      phaseOffset: number;
      startX: number;
      endX: number;
      startY: number;
      endY: number;
      baseZ: number;
      baseLight: number;
    }[] = [];
    let built = false;
    let raf = 0;
    let yaw = 0;
    let pitch = 0.17;
    const distance = 22;
    const target = new THREE.Vector3(0, 0, 0);
    let pointerDown: { x: number; y: number; yaw: number; pitch: number; moved: boolean } | null = null;
    let activeJourneyKey = -1;
    let journeyStarted = 0;
    let journeyIndex = 0;
    const journeyFrom = new THREE.Vector3();
    const journeyTo = new THREE.Vector3();
    const journeyTarget = new THREE.Vector3();
    let wheelAccumulator = 0;
    let wheelLockedUntil = 0;

    const assetEntries = [
      ...Object.entries(MEMORY_CONSTELLATION_ASSETS.stars),
      ["filament", MEMORY_CONSTELLATION_ASSETS.filament],
      ["band", MEMORY_CONSTELLATION_ASSETS.yearBand],
      ...Object.entries(MEMORY_CONSTELLATION_ASSETS.flybys).map(([name, url]) => [`flyby-${name}`, url] as [string, string]),
    ] as [string, string][];

    const build = () => {
      if (disposed || built) return;
      built = true;
      const years = Array.from(new Set(memories.map((memory) => memory.date.slice(0, 4)))).sort();
      const distributedPositions = distributeMemoryPositions(memories, years);
      distributedPositions.forEach((position, id) => positions.set(id, position));
      let minimumStarGap = Number.POSITIVE_INFINITY;
      const positionList = [...distributedPositions.values()];
      for (let firstIndex = 0; firstIndex < positionList.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < positionList.length; secondIndex += 1) {
          minimumStarGap = Math.min(minimumStarGap, positionList[firstIndex].distanceTo(positionList[secondIndex]));
        }
      }
      host.dataset.minimumStarGap = Number.isFinite(minimumStarGap) ? minimumStarGap.toFixed(2) : "single";
      years.forEach((year, index) => {
        const band = templates.band.clone(true);
        band.scale.setScalar(11 + index * 4.25);
        band.rotation.set(0.025 + index * 0.018, index * 0.08, 0);
        band.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const material = (child as THREE.Mesh).material;
            const mats: THREE.Material[] = Array.isArray(material) ? material : [material];
            mats.forEach((mat) => {
              mat.transparent = true;
              mat.opacity = Math.min(mat.opacity, 0.03);
              mat.depthWrite = false;
            });
          }
        });
        band.userData.year = year;
        content.add(band);
      });

      memories.forEach((memory) => {
        const position = positions.get(memory.id)?.clone() ?? new THREE.Vector3();
        const starKey = memoryStarVariant(memory);
        const star = templates[starKey].clone(true);
        const volume = 1 + memory.body.length / 320 + memory.media.length * 0.26 + memory.reflections.length * 0.12;
        const scale = THREE.MathUtils.clamp(0.026 + volume * 0.006, 0.032, 0.046);
        star.position.copy(position);
        star.scale.setScalar(scale);
        star.userData.memoryId = memory.id;
        star.userData.baseScale = scale;
        star.userData.glowPhase = (hash(memory.id) % 628) / 100;
        star.userData.favorite = memory.favorite;
        const twinkleMaterials: {
          material: THREE.MeshStandardMaterial;
          baseEmissiveIntensity: number;
          textures: THREE.Texture[];
        }[] = [];
        star.traverse((child) => {
          child.userData.memoryId = memory.id;
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            const clonedMaterials = sourceMaterials.map((material) => material.clone());
            mesh.material = Array.isArray(mesh.material) ? clonedMaterials : clonedMaterials[0];
            clonedMaterials.forEach((material) => {
              if ((material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
                const standard = material as THREE.MeshStandardMaterial;
                const cloneTwinkleTexture = (texture?: THREE.Texture) => {
                  if (!texture) return null;
                  const clone = texture.clone();
                  clone.center.set(0.5, 0.5);
                  clone.needsUpdate = true;
                  animatedTwinkleTextures.push(clone);
                  return clone;
                };
                const basecolor = cloneTwinkleTexture(sharpTwinkleMaps.basecolor);
                const normal = cloneTwinkleTexture(sharpTwinkleMaps.normal);
                const roughness = cloneTwinkleTexture(sharpTwinkleMaps.roughness);
                standard.map = basecolor ?? standard.map;
                standard.emissiveMap = basecolor ?? standard.emissiveMap;
                standard.normalMap = normal ?? standard.normalMap;
                standard.roughnessMap = roughness ?? standard.roughnessMap;
                standard.color.setScalar(0.006);
                standard.emissive.set(0xffffff);
                standard.emissiveIntensity = 1.65;
                standard.metalness = 0;
                standard.roughness = Math.min(standard.roughness, 0.38);
                standard.normalScale.set(0.11, 0.11);
                standard.transparent = true;
                standard.opacity = 0.52;
                standard.depthWrite = false;
                standard.blending = THREE.AdditiveBlending;
                standard.toneMapped = false;
                standard.needsUpdate = true;
                twinkleMaterials.push({
                  material: standard,
                  baseEmissiveIntensity: standard.emissiveIntensity,
                  textures: [basecolor, normal, roughness].filter((texture): texture is THREE.Texture => Boolean(texture)),
                });
              }
            });
          }
        });
        star.userData.twinkleMaterials = twinkleMaterials;
        content.add(star);
        stars.push(star);

        const hitProxy = new THREE.Mesh(
          new THREE.SphereGeometry(0.62, 8, 6),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
        );
        hitProxy.position.copy(position);
        hitProxy.userData.memoryId = memory.id;
        content.add(hitProxy);
        hitTargets.push(hitProxy);

        const baseIntensity = 2.4 + memory.importance * 0.72;
        const light = new THREE.PointLight(STAR_COLORS[starKey], baseIntensity, 4.6 + memory.importance * 0.55, 2);
        light.position.copy(position);
        light.userData.memoryId = memory.id;
        light.userData.baseIntensity = baseIntensity;
        lights.push(light);
        content.add(light);

      });

      const flybyChoreography = [
        { name: "blueComet", cycleDuration: 34, activeDuration: 9, phaseOffset: 16, startX: -82, endX: 82, startY: -13, endY: 12, baseZ: -72, scale: 2.05, elongation: 1.35, opacity: 0.54, light: 0.34, lightColor: 0xb8d9ee },
        { name: "goldComet", cycleDuration: 43, activeDuration: 10, phaseOffset: 10, startX: 86, endX: -86, startY: 17, endY: 3, baseZ: -88, scale: 1.85, elongation: 1.35, opacity: 0.5, light: 0.3, lightColor: 0xffc98c },
        { name: "emberMeteor", cycleDuration: 21, activeDuration: 4.8, phaseOffset: 0, startX: -76, endX: 76, startY: 11, endY: -9, baseZ: -64, scale: 1.2, elongation: 1.75, opacity: 0.62, light: 0.28, lightColor: 0xffa668 },
        { name: "coldMeteor", cycleDuration: 27, activeDuration: 5.4, phaseOffset: 21, startX: 78, endX: -78, startY: -17, endY: 2, baseZ: -80, scale: 1.1, elongation: 1.75, opacity: 0.6, light: 0.26, lightColor: 0xb8d9ee },
      ] as const;

      flybyChoreography.forEach((flight, index) => {
        const { name } = flight;
        const root = templates[`flyby-${name}`].clone(true);
        const isComet = name.toLocaleLowerCase().includes("comet");
        const direction = flight.endX > flight.startX ? 1 : -1;
        root.scale.set(flight.scale * flight.elongation, flight.scale, flight.scale);
        const materials = softenMintAccent(root, flight.opacity);
        root.rotation.set((index - 1.5) * 0.035, direction === 1 ? 0 : Math.PI, Math.atan2(flight.endY - flight.startY, Math.abs(flight.endX - flight.startX)) * direction);
        root.visible = false;
        const light = new THREE.PointLight(flight.lightColor, flight.light, isComet ? 5 : 3.5, 2);
        root.add(light);
        farSpace.add(root);
        distantFlybys.push({
          root,
          light,
          materials,
          cycleDuration: flight.cycleDuration,
          activeDuration: flight.activeDuration,
          phaseOffset: flight.phaseOffset,
          startX: flight.startX,
          endX: flight.endX,
          startY: flight.startY,
          endY: flight.endY,
          baseZ: flight.baseZ,
          baseLight: flight.light,
        });
      });
      host.dataset.distantFlybys = String(distantFlybys.length);

      inferMemoryConnections(memories).forEach((connection) => {
          const start = positions.get(connection.from);
          const end = positions.get(connection.to);
          if (!start || !end) return;
          const filament = templates.filament.clone(true);
          const direction = end.clone().sub(start);
          const length = direction.length();
          filament.position.copy(start).add(end).multiplyScalar(0.5);
          filament.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.normalize());
          filament.scale.set(length, 0.48, 0.48);
          filament.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const material = (child as THREE.Mesh).material;
              const mats: THREE.Material[] = Array.isArray(material) ? material : [material];
              mats.forEach((mat) => {
                mat.transparent = true;
                mat.opacity = Math.min(mat.opacity, 0.045 + connection.kinds.length * 0.018);
                mat.depthWrite = false;
              });
            }
          });
          content.add(filament);
      });

    };

    const textureEntries = Object.entries(MEMORY_CONSTELLATION_ASSETS.sharpTwinkleMaterial) as [keyof typeof sharpTwinkleMaps, string][];
    Promise.all(
      [
        ...assetEntries.map(
        ([name, url]) =>
          new Promise<void>((resolve, reject) => {
            loader.load(
              url,
              (gltf) => {
                templates[name] = normalizeAsset(gltf.scene);
                resolve();
              },
              undefined,
              reject,
            );
          }),
        ),
        ...textureEntries.map(
          ([name, url]) =>
            new Promise<void>((resolve, reject) => {
              textureLoader.load(
                url,
                (texture) => {
                  texture.colorSpace = name === "basecolor" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
                  texture.wrapS = THREE.RepeatWrapping;
                  texture.wrapT = THREE.RepeatWrapping;
                  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
                  sharpTwinkleMaps[name] = texture;
                  resolve();
                },
                undefined,
                reject,
              );
            }),
        ),
      ],
    )
      .then(build)
      .catch((error) => {
        console.error("Memory Constellation Mint asset load failed", error);
        host.dataset.assetError = "true";
      });

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      camera.aspect = width / height;
      camera.fov = camera.aspect < 0.75 ? 57 : 42;
      camera.updateProjectionMatrix();
      if (skyTexture) fitSkyTexture(skyTexture, width, height);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const selectAt = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(hitTargets, false)[0];
      const id = hit?.object.userData.memoryId as string | undefined;
      if (id) onSelectRef.current(id);
    };
    const onPointerDown = (event: PointerEvent) => {
      renderer.domElement.setPointerCapture(event.pointerId);
      pointerDown = { x: event.clientX, y: event.clientY, yaw, pitch, moved: false };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointerDown) return;
      const dx = event.clientX - pointerDown.x;
      const dy = event.clientY - pointerDown.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) pointerDown.moved = true;
      yaw = pointerDown.yaw - dx * 0.0045;
      pitch = THREE.MathUtils.clamp(pointerDown.pitch - dy * 0.0038, -0.75, 0.85);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (pointerDown && !pointerDown.moved) selectAt(event.clientX, event.clientY);
      pointerDown = null;
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const now = performance.now();
      if (now < wheelLockedUntil) return;
      wheelAccumulator += event.deltaY;
      if (Math.abs(wheelAccumulator) < 22) return;
      onStepRef.current(wheelAccumulator > 0 ? 1 : -1);
      wheelAccumulator = 0;
      wheelLockedUntil = now + (reducedMotion ? 260 : 720);
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    const startedAt = performance.now();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const elapsed = (performance.now() - startedAt) / 1000;
      const currentJourney = journeyRef.current;
      if (currentJourney.key !== activeJourneyKey && currentJourney.ids.length) {
        activeJourneyKey = currentJourney.key;
        journeyIndex = 0;
        journeyStarted = performance.now();
        journeyFrom.copy(camera.position);
        const first = positions.get(currentJourney.ids[0]);
        if (first) {
          journeyTarget.copy(first);
          const radialOffset = first.clone().normalize().multiplyScalar(5.2);
          radialOffset.y += 1.25;
          journeyTo.copy(first).add(radialOffset);
          onSelectRef.current(currentJourney.ids[0]);
        }
      }
      if (currentJourney.ids.length && activeJourneyKey === currentJourney.key && positions.size) {
        const segmentDuration = reducedMotion ? 260 : currentJourney.ids.length === 1 ? 1150 : 2200;
        const progress = Math.min(1, (performance.now() - journeyStarted) / segmentDuration);
        const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        camera.position.lerpVectors(journeyFrom, journeyTo, eased);
        target.lerp(journeyTarget, 0.08);
        if (progress >= 1 && performance.now() - journeyStarted > segmentDuration + (reducedMotion ? 180 : 1500)) {
          journeyIndex += 1;
          if (journeyIndex < currentJourney.ids.length) {
            journeyStarted = performance.now();
            journeyFrom.copy(camera.position);
            const next = positions.get(currentJourney.ids[journeyIndex]);
            if (next) {
              journeyTarget.copy(next);
              const radialOffset = next.clone().normalize().multiplyScalar(5.2);
              radialOffset.y += 1.25;
              journeyTo.copy(next).add(radialOffset);
              onSelectRef.current(currentJourney.ids[journeyIndex]);
            }
          }
        }
      } else {
        const desired = new THREE.Vector3(
          target.x + Math.sin(yaw) * Math.cos(pitch) * distance,
          target.y + Math.sin(pitch) * distance,
          target.z + Math.cos(yaw) * Math.cos(pitch) * distance,
        );
        camera.position.lerp(desired, reducedMotion ? 0.25 : 0.075);
      }
      camera.lookAt(target);
      content.rotation.y = reducedMotion ? 0 : Math.sin(elapsed * 0.055) * 0.025;
      stars.forEach((star, index) => {
        const baseScale = star.userData.baseScale as number;
        const phase = star.userData.glowPhase as number;
        const favorite = star.userData.favorite as boolean;
        const shimmer = Math.sin(elapsed * (5.8 + index * 0.13) + phase * 1.73);
        const flashA = Math.pow(Math.max(0, Math.sin(elapsed * (1.34 + index * 0.021) + phase * 2.31)), 22);
        const flashB = Math.pow(Math.max(0, Math.sin(elapsed * (2.08 + index * 0.037) + phase * 4.19)), 34);
        const flash = Math.max(flashA, flashB * 0.72);
        const pulse = reducedMotion ? 1 : 1 + flash * (favorite ? 0.2 : 0.15);
        const brightness = reducedMotion ? 0.95 : 0.55 + shimmer * 0.07 + flash * (favorite ? 2.25 : 1.95);
        star.scale.setScalar(baseScale * pulse);
        if (!reducedMotion) {
          star.rotation.y = elapsed * (0.075 + index * 0.008) + phase;
          star.rotation.x = Math.sin(elapsed * 0.19 + phase) * 0.09;
        }
        const twinkleMaterials = star.userData.twinkleMaterials as {
          material: THREE.MeshStandardMaterial;
          baseEmissiveIntensity: number;
          textures: THREE.Texture[];
        }[];
        twinkleMaterials.forEach(({ material, baseEmissiveIntensity, textures }) => {
          material.emissiveIntensity = baseEmissiveIntensity * brightness;
          material.opacity = reducedMotion ? 0.72 : THREE.MathUtils.clamp(0.42 + brightness * 0.28, 0.5, 1);
          material.color.setScalar(0.006);
          if (!reducedMotion) {
            const offsetX = (phase * 0.137 + elapsed * (0.014 + index * 0.0008)) % 1;
            const offsetY = (phase * 0.071 + Math.sin(elapsed * 0.47 + phase) * 0.022 + 1) % 1;
            const rotation = phase * 0.08 + Math.sin(elapsed * 0.62 + phase * 1.37) * 0.09;
            textures.forEach((texture) => {
              texture.offset.set(offsetX, offsetY);
              texture.rotation = rotation;
            });
          }
        });
      });
      lights.forEach((light, index) => {
        const baseIntensity = light.userData.baseIntensity as number;
        const phase = stars[index]?.userData.glowPhase as number ?? index;
        const shimmer = Math.sin(elapsed * (5.8 + index * 0.13) + phase * 1.73);
        const flashA = Math.pow(Math.max(0, Math.sin(elapsed * (1.34 + index * 0.021) + phase * 2.31)), 22);
        const flashB = Math.pow(Math.max(0, Math.sin(elapsed * (2.08 + index * 0.037) + phase * 4.19)), 34);
        const flash = Math.max(flashA, flashB * 0.72);
        const favorite = stars[index]?.userData.favorite as boolean;
        light.intensity = baseIntensity * (reducedMotion ? 0.65 : 0.4 + shimmer * 0.05 + flash * (favorite ? 1.3 : 1.08));
      });
      let activeFlybyCount = 0;
      distantFlybys.forEach((flyby, index) => {
        if (reducedMotion) {
          flyby.root.visible = false;
          return;
        }
        const cycleTime = (elapsed + flyby.phaseOffset) % flyby.cycleDuration;
        const active = cycleTime < flyby.activeDuration;
        flyby.root.visible = active;
        if (!active) return;
        activeFlybyCount += 1;
        const progress = cycleTime / flyby.activeDuration;
        const fadeIn = THREE.MathUtils.smoothstep(progress, 0, 0.12);
        const fadeOut = 1 - THREE.MathUtils.smoothstep(progress, 0.76, 1);
        const visibility = fadeIn * fadeOut;
        flyby.root.position.set(
          THREE.MathUtils.lerp(flyby.startX, flyby.endX, progress),
          THREE.MathUtils.lerp(flyby.startY, flyby.endY, progress) + Math.sin(progress * Math.PI) * (index % 2 === 0 ? 1.2 : -0.8),
          flyby.baseZ,
        );
        flyby.materials.forEach(({ material, baseOpacity }) => {
          material.opacity = baseOpacity * visibility;
        });
        flyby.light.intensity = flyby.baseLight * visibility;
      });
      host.dataset.activeFlybys = String(activeFlybyCount);
      composer.render();
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      disposeTree(content);
      disposeTree(farSpace);
      animatedTwinkleTextures.forEach((texture) => texture.dispose());
      Object.values(sharpTwinkleMaps).forEach((texture) => texture?.dispose());
      skyTexture?.dispose();
      composer.dispose();
      renderer.dispose();
      host.replaceChildren();
    };
  }, [memories, reducedMotion]);

  return <div className="mc-canvas" ref={hostRef} />;
}

function MemoryMedia({ memory }: { memory: Memory }) {
  const [sources, setSources] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    Promise.all(
      memory.media.map(async (item) => {
        const blob = await mediaGet(item.id);
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return [item.id, url] as const;
      }),
    ).then((pairs) => {
      if (active) setSources(Object.fromEntries(pairs.filter(Boolean) as [string, string][]));
    });
    return () => {
      active = false;
      urls.forEach(URL.revokeObjectURL);
    };
  }, [memory]);

  if (!memory.media.length) return null;
  return (
    <div className="mc-media-stack">
      {memory.media.map((item) => {
        const src = sources[item.id];
        if (!src) return <div className="mc-media-loading" key={item.id}>Restoring {item.name}…</div>;
        // Blob URLs are local archive data and cannot use Next's image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        if (item.type.startsWith("image/")) return <img key={item.id} src={src} alt={item.name} />;
        if (item.type.startsWith("video/")) return <video key={item.id} src={src} controls playsInline aria-label={item.name} />;
        if (item.type.startsWith("audio/")) {
          return (
            <div className="mc-audio" key={item.id}>
              <audio src={src} controls aria-label={item.name} />
              {item.transcript && <details><summary>Transcript</summary><p>{item.transcript}</p></details>}
            </div>
          );
        }
        return <a key={item.id} href={src} download={item.name}>Download {item.name}</a>;
      })}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export default function MemoryConstellation() {
  const [memories, setMemories] = useState<Memory[]>(DEMO_MEMORIES);
  const [hydrated, setHydrated] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"sky" | "timeline">("sky");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formError, setFormError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [introVisible, setIntroVisible] = useState(false);
  const [quietFrequency, setQuietFrequency] = useState<"off" | "weekly" | "monthly">("monthly");
  const [showIntroAgain, setShowIntroAgain] = useState(false);
  const [ambienceOn, setAmbienceOn] = useState(false);
  const [reflection, setReflection] = useState("");
  const [notice, setNotice] = useState("");
  const [journey, setJourney] = useState({ key: 0, ids: [] as string[] });
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const forceMotionPreview = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("motion") === "full";
  const reduceMotion = !forceMotionPreview && typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    try {
      setFiltersOpen(false);
      const stored = localStorage.getItem(STORE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Memory[];
        if (Array.isArray(parsed)) {
          const needsOverlapFixture = localStorage.getItem(DEMO_DATA_VERSION_KEY) !== "ready";
          setMemories(needsOverlapFixture ? [...DEMO_MEMORIES, ...parsed.filter((memory) => !memory.id.startsWith("demo-"))] : parsed);
          setSelectedId(null);
        }
      }
      localStorage.setItem(DEMO_DATA_VERSION_KEY, "ready");
      const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as { quietFrequency?: "off" | "weekly" | "monthly"; showIntroAgain?: boolean };
      if (settings.quietFrequency) setQuietFrequency(settings.quietFrequency);
      if (settings.showIntroAgain) setShowIntroAgain(settings.showIntroAgain);
      const seen = localStorage.getItem(INTRO_KEY) === "true";
      setIntroVisible(!reduceMotion && (!seen || settings.showIntroAgain === true));
    } catch {
      setNotice("The local archive could not be restored. Your files were not uploaded anywhere.");
    }
    setHydrated(true);
  }, [reduceMotion]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORE_KEY, JSON.stringify(memories));
  }, [memories, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ quietFrequency, showIntroAgain }));
  }, [quietFrequency, showIntroAgain, hydrated]);

  useEffect(() => {
    if (!introVisible) return;
    const timer = window.setTimeout(() => {
      setIntroVisible(false);
      localStorage.setItem(INTRO_KEY, "true");
    }, 4400);
    return () => window.clearTimeout(timer);
  }, [introVisible]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (ambienceOn) audio.play().catch(() => setAmbienceOn(false));
    else audio.pause();
  }, [ambienceOn]);

  const visibleMemories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return memories.filter((memory) => {
      if (memory.sensitive) return false;
      const haystack = [memory.title, memory.body, memory.place, memory.people.join(" "), memory.date].join(" ").toLowerCase();
      return (
        (!query || haystack.includes(query)) &&
        (filters.year === "all" || memory.date.startsWith(filters.year)) &&
        (filters.person === "all" || memory.people.includes(filters.person)) &&
        (filters.place === "all" || memory.place === filters.place)
      );
    });
  }, [memories, search, filters]);

  const selected = memories.find((memory) => memory.id === selectedId) ?? null;
  const orderedMemories = useMemo(() => [...visibleMemories].sort((first, second) => second.date.localeCompare(first.date)), [visibleMemories]);
  const focusedIndex = selectedId ? orderedMemories.findIndex((memory) => memory.id === selectedId) : -1;
  const stepMemory = useCallback((direction: -1 | 1) => {
    if (!orderedMemories.length) return;
    const currentIndex = selectedId ? orderedMemories.findIndex((memory) => memory.id === selectedId) : -1;
    const seedIndex = direction > 0 ? 0 : orderedMemories.length - 1;
    const nextIndex = currentIndex < 0 ? seedIndex : THREE.MathUtils.clamp(currentIndex + direction, 0, orderedMemories.length - 1);
    const next = orderedMemories[nextIndex];
    if (!next || next.id === selectedId) return;
    setSelectedId(next.id);
    setView("sky");
    setJourney({ key: Date.now(), ids: [next.id] });
  }, [orderedMemories, selectedId]);
  const years = unique(memories.map((memory) => memory.date.slice(0, 4))).sort().reverse();
  const people = unique(memories.flatMap((memory) => memory.people));
  const places = unique(memories.map((memory) => memory.place));
  const inferredConnections = useMemo(() => inferMemoryConnections(memories), [memories]);
  const selectedRelations = useMemo(() => {
    if (!selected) return [];
    return inferredConnections
      .filter((connection) => connection.from === selected.id || connection.to === selected.id)
      .map((connection) => ({
        memory: memories.find((memory) => memory.id === (connection.from === selected.id ? connection.to : connection.from)),
        kinds: connection.kinds,
      }))
      .filter((relation): relation is { memory: Memory; kinds: ConnectionKind[] } => Boolean(relation.memory));
  }, [inferredConnections, memories, selected]);
  const isDemo = memories.length > 0 && memories.every((memory) => memory.id.startsWith("demo-"));
  const rediscovery = useMemo(() => {
    if (quietFrequency === "off") return null;
    const older = memories.filter((memory) => !memory.sensitive && Date.now() - new Date(memory.date).getTime() > 1000 * 60 * 60 * 24 * 300);
    if (!older.length) return null;
    return older[hash(new Date().toISOString().slice(0, quietFrequency === "weekly" ? 8 : 7)) % older.length];
  }, [memories, quietFrequency]);

  const anniversaryMemories = useMemo(() => {
    const monthDay = today().slice(5);
    return memories.filter((memory) => !memory.sensitive && memory.date.slice(5) === monthDay && memory.date !== today());
  }, [memories]);

  const openCreate = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setFiles([]);
    setFormError("");
    setEditorOpen(true);
  };

  const openEdit = (memory: Memory) => {
    setEditingId(memory.id);
    setDraft({
      title: memory.title,
      date: memory.date,
      body: memory.body,
      place: memory.place,
      people: memory.people.join(", "),
      importance: memory.importance,
      shareable: memory.shareable,
      favorite: memory.favorite,
      sensitive: memory.sensitive,
      transcript: "",
    });
    setFiles([]);
    setFormError("");
    setEditorOpen(true);
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Array.from(event.target.files ?? []);
    const tooLarge = next.find((file) => file.size > 80 * 1024 * 1024);
    if (tooLarge) {
      setFormError(`${tooLarge.name} is larger than the 80 MB local upload limit.`);
      return;
    }
    setFiles(next);
    setFormError("");
  };

  const submitMemory = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.date) {
      setFormError("Add a title and date before saving this memory.");
      return;
    }
    setUploadProgress(files.length ? 4 : 100);
    const id = editingId ?? crypto.randomUUID();
    const now = new Date().toISOString();
    const existing = memories.find((memory) => memory.id === editingId);
    try {
      const newMedia: MediaRef[] = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const mediaId = crypto.randomUUID();
        await mediaPut(mediaId, file);
        newMedia.push({ id: mediaId, name: file.name, type: file.type, size: file.size, transcript: file.type.startsWith("audio/") ? draft.transcript.trim() : undefined });
        setUploadProgress(Math.round(((index + 1) / files.length) * 92));
      }
      const next: Memory = {
        id,
        title: draft.title.trim(),
        date: draft.date,
        body: draft.body.trim(),
        place: draft.place.trim(),
        people: splitList(draft.people),
        emotions: existing?.emotions ?? [],
        tags: existing?.tags ?? [],
        category: existing?.category ?? STAR_VARIANTS[hash(id) % STAR_VARIANTS.length],
        importance: draft.importance,
        constellation: existing?.constellation ?? "",
        chapter: existing?.chapter ?? "",
        collections: existing?.collections ?? [],
        shareable: draft.shareable,
        favorite: draft.favorite,
        sensitive: draft.sensitive,
        connections: [],
        reflections: existing?.reflections ?? [],
        media: [...(existing?.media ?? []), ...newMedia],
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      setMemories((current) => editingId ? current.map((memory) => memory.id === editingId ? next : memory) : [...current, next]);
      setSelectedId(id);
      setUploadProgress(100);
      setEditorOpen(false);
      setNotice(editingId ? "Memory updated locally." : "Memory saved locally. Nothing was uploaded to a cloud service.");
      setTimeout(() => setUploadProgress(0), 500);
    } catch {
      setFormError("This device could not store the media. The memory was not changed; try a smaller file or free local storage.");
      setUploadProgress(0);
    }
  };

  const deleteMemory = async (memory: Memory) => {
    if (!window.confirm(`Permanently delete “${memory.title}” and its local media? This cannot be undone.`)) return;
    await Promise.all(memory.media.map((item) => mediaDelete(item.id)));
    setMemories((current) => current.filter((item) => item.id !== memory.id));
    setSelectedId(null);
    setNotice("Memory permanently removed from this device.");
  };

  const addReflection = () => {
    if (!selected || !reflection.trim()) return;
    setMemories((current) => current.map((memory) => memory.id === selected.id ? { ...memory, reflections: [...memory.reflections, { id: crypto.randomUUID(), date: today(), text: reflection.trim() }], updatedAt: new Date().toISOString() } : memory));
    setReflection("");
    setNotice("Reflection added locally.");
  };

  const exportArchive = async (only?: Memory[]) => {
    const records = only ?? memories;
    const media: Record<string, string> = {};
    for (const memory of records) {
      for (const item of memory.media) {
        const blob = await mediaGet(item.id);
        if (blob) media[item.id] = await fileToDataUrl(blob);
      }
    }
    const payload = { format: "memory-constellation", version: 1, exportedAt: new Date().toISOString(), memories: records, media };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = only?.length === 1 ? `${only[0].title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.memory.json` : `memory-constellation-backup-${today()}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Encrypted transport is not implied: the downloaded backup contains your readable archive data. Store it somewhere private.");
  };

  const importArchive = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const payload = JSON.parse(await file.text()) as { format?: string; memories?: Memory[]; media?: Record<string, string> };
      if (payload.format !== "memory-constellation" || !Array.isArray(payload.memories)) throw new Error("Invalid backup");
      for (const [id, value] of Object.entries(payload.media ?? {})) await mediaPut(id, dataUrlToBlob(value));
      setMemories(payload.memories);
      setSelectedId(payload.memories.find((memory) => !memory.sensitive)?.id ?? null);
      setNotice("Backup restored on this device.");
    } catch {
      setNotice("That file is not a valid Memory Constellation backup. Your current archive was left unchanged.");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const eraseEverything = async () => {
    if (!window.confirm("Permanently erase every memory and media file stored by Memory Constellation on this device?")) return;
    if (!window.confirm("This is the final confirmation. Export a backup first if you may want these memories later.")) return;
    await clearMediaDb();
    setMemories([]);
    localStorage.removeItem(STORE_KEY);
    setSelectedId(null);
    setSettingsOpen(false);
    setNotice("Your local Memory Constellation archive has been permanently erased from this browser.");
  };

  const clearDemo = () => {
    setMemories([]);
    setSelectedId(null);
    setNotice("Sample memories cleared. Your private archive is ready.");
  };

  const setFilter = (key: keyof Filters, value: string) => setFilters((current) => ({ ...current, [key]: value } as Filters));
  const startJourney = (ids = visibleMemories.map((memory) => memory.id)) => {
    if (!ids.length) return;
    setView("sky");
    setJourney({ key: Date.now(), ids });
    setNotice(`Memory Journey started through ${ids.length} ${ids.length === 1 ? "memory" : "memories"}.`);
  };

  const skipIntro = () => {
    setIntroVisible(false);
    localStorage.setItem(INTRO_KEY, "true");
  };

  const captureDate = formatDate(today());

  return (
    <main className="mc-app">
      <audio ref={audioRef} src={MEMORY_CONSTELLATION_ASSETS.ambience} loop preload="none" />
      {introVisible && (
        <div className="mc-intro" role="dialog" aria-label="Memory Constellation introduction">
          <button className="mc-intro-skip" onClick={skipIntro}>Skip introduction</button>
          <div className="mc-intro-sky" style={{ backgroundImage: `url(${MEMORY_CONSTELLATION_ASSETS.backdrop})` }} aria-hidden="true" />
          <p>Your life, remembered in light.</p>
        </div>
      )}

      <header className="mc-header">
        <button className="mc-brand" type="button" onClick={() => { setView("sky"); setFilters(EMPTY_FILTERS); setSearch(""); }} aria-label="Memory Constellation home">
          <span className="mc-brand-mark" aria-hidden="true">✦</span>
          <span><strong>Memory Constellation</strong><small>Private archive · stored on this device</small></span>
        </button>
        <div className="mc-search-wrap">
          <label className="mc-search">
            <span aria-hidden="true">⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search every memory" aria-label="Search complete memory archive" />
            <kbd>⌘ K</kbd>
          </label>
        </div>
        <nav className="mc-header-actions" aria-label="Archive actions">
          <button className={view === "sky" ? "is-active" : ""} onClick={() => setView("sky")}>Sky</button>
          <button className={view === "timeline" ? "is-active" : ""} onClick={() => setView("timeline")}>Timeline</button>
          <button onClick={() => setAmbienceOn((value) => !value)} aria-pressed={ambienceOn} aria-label={ambienceOn ? "Mute ambient sound" : "Play ambient sound"}>{ambienceOn ? "Sound on" : "Sound off"}</button>
          <button onClick={() => setSettingsOpen(true)}>Privacy</button>
          <button className="mc-primary" onClick={openCreate}>Add memory</button>
        </nav>
      </header>

      {notice && <div className="mc-notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss message">×</button></div>}

      <section className="mc-shell">
        <aside className={`mc-filters ${filtersOpen ? "is-open" : ""}`} aria-label="Browse archive">
          <div className="mc-panel-heading">
            <div><span className="mc-eyebrow">Browse by</span><strong>{visibleMemories.length} visible memories</strong></div>
            <button onClick={() => setFiltersOpen((value) => !value)} aria-expanded={filtersOpen} aria-label="Toggle filters">{filtersOpen ? "−" : "+"}</button>
          </div>
          {filtersOpen && (
            <div className="mc-filter-body">
              <label>Person<select value={filters.person} onChange={(event) => setFilter("person", event.target.value)}><option value="all">Everyone</option>{people.map((person) => <option key={person}>{person}</option>)}</select></label>
              <label>Location<select value={filters.place} onChange={(event) => setFilter("place", event.target.value)}><option value="all">Everywhere</option>{places.map((place) => <option key={place}>{place}</option>)}</select></label>
              <label>Date<select value={filters.year} onChange={(event) => setFilter("year", event.target.value)}><option value="all">Any year</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
              <button className="mc-text-button" onClick={() => setFilters(EMPTY_FILTERS)}>Clear all filters</button>
              <div className="mc-relationship-key" aria-label="Automatic relationship types"><span><i />Person</span><span><i />Location</span><span><i />Date</span></div>
            </div>
          )}
          <div className="mc-filter-footer">
            <button onClick={() => startJourney()} disabled={!visibleMemories.length}><span aria-hidden="true">▶</span> Journey through this view</button>
            {isDemo && <button onClick={clearDemo}>Clear sample archive</button>}
          </div>
        </aside>

        <section className="mc-stage" aria-label={view === "sky" ? "Memory constellation" : "Chronological memory timeline"}>
          {view === "sky" ? (
            <>
              <div className="mc-sky">
                <div className="mc-far-stars" style={{ backgroundImage: `url(${MEMORY_CONSTELLATION_ASSETS.backdrop})` }} aria-hidden="true" />
                <div className="mc-far-stars mc-far-stars-dense" style={{ backgroundImage: `url(${MEMORY_CONSTELLATION_ASSETS.denseBackdrop})` }} aria-hidden="true" />
                <ConstellationCanvas memories={visibleMemories} selectedId={selectedId} onSelect={setSelectedId} onStep={stepMemory} journey={journey} reducedMotion={reduceMotion} />
                <div className="mc-sky-title">
                  <span className="mc-eyebrow">Connected by people · places · time</span>
                  <h1>{filters.person !== "all" ? `${filters.person}'s memories` : filters.place !== "all" ? `Memories from ${filters.place}` : filters.year !== "all" ? `Memories from ${filters.year}` : "Where, when, and who we remember"}</h1>
                  <p>Drag to orbit · scroll to travel · select a star to open it</p>
                </div>
                <div className="mc-sky-status"><span>{captureDate}</span><span>{visibleMemories.length} stars</span><span>{inferMemoryConnections(visibleMemories).length} connections</span></div>
                {orderedMemories.length > 0 && <div className="mc-wheel-focus" aria-label="Move between constellation memories"><button onClick={() => stepMemory(-1)} disabled={focusedIndex <= 0} aria-label="Previous memory">↑</button><span><small>Scroll to travel</small><strong>{focusedIndex >= 0 ? orderedMemories[focusedIndex]?.title : "Choose a memory"}</strong></span><em>{focusedIndex >= 0 ? focusedIndex + 1 : 0} / {orderedMemories.length}</em><button onClick={() => stepMemory(1)} disabled={focusedIndex === orderedMemories.length - 1} aria-label="Next memory">↓</button></div>}
                {!visibleMemories.length && <div className="mc-empty"><span>✦</span><h2>No visible memories here</h2><p>Adjust the filters or add a memory to begin a new region of your sky.</p><button onClick={openCreate}>Add your first memory</button></div>}
                {rediscovery && !selected && <button className="mc-rediscovery" onClick={() => setSelectedId(rediscovery.id)}><span className="mc-eyebrow">Quiet rediscovery</span><strong>{rediscovery.title}</strong><small>{formatDate(rediscovery.date)} · open when you feel like it</small></button>}
              </div>
              <div className="mc-year-rail" aria-label="Navigate years">{years.map((year) => <button key={year} className={filters.year === year ? "is-active" : ""} onClick={() => setFilter("year", filters.year === year ? "all" : year)}>{year}</button>)}</div>
            </>
          ) : (
            <div className="mc-timeline">
              <div className="mc-timeline-heading"><div><span className="mc-eyebrow">Accessible archive view</span><h1>Your memories, in time</h1><p>Every star also lives here as searchable, keyboard-navigable text.</p></div><button onClick={() => startJourney()}>Play this journey</button></div>
              {anniversaryMemories.length > 0 && <section className="mc-anniversary"><span className="mc-eyebrow">On this day</span><h2>{anniversaryMemories.length === 1 ? "One memory is returning quietly" : `${anniversaryMemories.length} memories share today's date`}</h2>{anniversaryMemories.map((memory) => <button key={memory.id} onClick={() => setSelectedId(memory.id)}>{memory.title} <small>{memory.date.slice(0, 4)}</small></button>)}</section>}
              <ol>{[...visibleMemories].sort((a, b) => b.date.localeCompare(a.date)).map((memory) => <li key={memory.id}><time dateTime={memory.date}>{memory.date.slice(0, 4)}<small>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${memory.date}T12:00:00`))}</small></time><button onClick={() => setSelectedId(memory.id)}><span className="mc-timeline-star" style={{ background: STAR_COLORS[memoryStarVariant(memory)] }} aria-hidden="true" /><span><small>{memory.place || "Location not added"}</small><strong>{memory.title}</strong><p>{memory.body || "No journal text yet."}</p><em>{memory.people.join(" · ") || "No person added"}</em></span></button></li>)}</ol>
            </div>
          )}
        </section>

        <aside className={`mc-detail ${selected ? "is-open" : ""}`} aria-label="Selected memory">
          {selected ? (
            <article>
              <div className="mc-detail-top"><span className="mc-category"><i style={{ background: STAR_COLORS[memoryStarVariant(selected)] }} />Memory</span><button onClick={() => setSelectedId(null)} aria-label="Close memory">×</button></div>
              <div className="mc-detail-date"><time dateTime={selected.date}>{formatDate(selected.date)}</time>{selected.favorite && <span>Favorite</span>}{selected.sensitive && <span>Hidden</span>}</div>
              <h2>{selected.title}</h2>
              <p className="mc-memory-body">{selected.body || "No journal text yet."}</p>
              <MemoryMedia memory={selected} />
              <dl><div><dt>Date</dt><dd>{formatDate(selected.date)}</dd></div><div><dt>Location</dt><dd>{selected.place || "Not added"}</dd></div><div><dt>Person</dt><dd>{selected.people.join(", ") || "Not added"}</dd></div><div><dt>Importance</dt><dd><span className="mc-importance" aria-label={`${selected.importance} of 5`}>{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < selected.importance ? "is-filled" : ""} />)}</span></dd></div></dl>
              {selectedRelations.length > 0 && <section className="mc-relations"><span className="mc-eyebrow">Connected through</span>{selectedRelations.map(({ memory, kinds }) => <button key={memory.id} onClick={() => setSelectedId(memory.id)}><strong>{memory.title}</strong><small>{kinds.join(" · ")}</small></button>)}</section>}
              {selected.reflections.length > 0 && <section className="mc-reflections"><span className="mc-eyebrow">Later reflections</span>{selected.reflections.map((item) => <blockquote key={item.id}><p>{item.text}</p><time>{formatDate(item.date)}</time></blockquote>)}</section>}
              <section className="mc-add-reflection"><label htmlFor="reflection">Add a reflection from today</label><textarea id="reflection" value={reflection} onChange={(event) => setReflection(event.target.value)} placeholder="What does this memory mean now?" /><button onClick={addReflection} disabled={!reflection.trim()}>Save reflection</button></section>
              <div className="mc-detail-actions"><button onClick={() => startJourney([selected.id, ...selectedRelations.map(({ memory }) => memory.id)])}>Journey from here</button><button onClick={() => openEdit(selected)}>Edit</button><button onClick={() => exportArchive([selected])}>Download</button><button className="is-danger" onClick={() => deleteMemory(selected)}>Delete</button></div>
            </article>
          ) : (
            <div className="mc-detail-placeholder"><span>✦</span><p>Select a star or timeline entry to open the full memory.</p></div>
          )}
        </aside>
      </section>

      {editorOpen && (
        <div className="mc-modal-backdrop" role="presentation" onPointerDown={(event: ReactPointerEvent) => { if (event.target === event.currentTarget) setEditorOpen(false); }}>
          <section className="mc-modal mc-editor" role="dialog" aria-modal="true" aria-labelledby="memory-editor-title">
            <header><div><span className="mc-eyebrow">{editingId ? "Edit memory" : "New memory"}</span><h2 id="memory-editor-title">{editingId ? "Return to this moment" : "Give this moment a place in your sky"}</h2></div><button onClick={() => setEditorOpen(false)} aria-label="Close editor">×</button></header>
            <form onSubmit={submitMemory}>
              <div className="mc-form-grid">
                <label className="wide">Title<input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="The kitchen after everyone left" /></label>
                <label>Date<input required type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
                <label className="wide">Journal entry<textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder="Write what you want to remember, in your own words…" /></label>
                <label>Location<input value={draft.place} onChange={(event) => setDraft({ ...draft, place: event.target.value })} placeholder="Lisbon" /></label>
                <label>Person <small>comma separated</small><input value={draft.people} onChange={(event) => setDraft({ ...draft, people: event.target.value })} placeholder="Mara, Theo" /></label>
                <label className="mc-range">Importance <small>You decide—not the app</small><input type="range" min="1" max="5" value={draft.importance} onChange={(event) => setDraft({ ...draft, importance: Number(event.target.value) })} /><span>{draft.importance} of 5</span></label>
                <p className="wide mc-auto-connect">Connections happen automatically when this memory shares a person, location, or date with another memory.</p>
                <label className="wide mc-upload">Photos, videos, voice recordings, or files<input type="file" multiple accept="image/*,video/*,audio/*,.pdf,.txt" onChange={handleFiles} /><span>{files.length ? files.map((file) => file.name).join(" · ") : "Choose files stored on this device"}</span></label>
                {files.some((file) => file.type.startsWith("audio/")) && <label className="wide">Recording transcript<textarea value={draft.transcript} onChange={(event) => setDraft({ ...draft, transcript: event.target.value })} placeholder="Add a transcript or caption so this recording remains accessible." /></label>}
                <div className="wide mc-checks"><label><input type="checkbox" checked={draft.favorite} onChange={(event) => setDraft({ ...draft, favorite: event.target.checked })} />Mark as favorite</label><label><input type="checkbox" checked={draft.sensitive} onChange={(event) => setDraft({ ...draft, sensitive: event.target.checked })} />Hide from sky and search</label><label><input type="checkbox" checked={draft.shareable} onChange={(event) => setDraft({ ...draft, shareable: event.target.checked })} />Allow in an exported shareable collection</label></div>
              </div>
              {uploadProgress > 0 && <div className="mc-progress"><i style={{ width: `${uploadProgress}%` }} /><span>{uploadProgress < 100 ? `Saving media locally · ${uploadProgress}%` : "Saved locally"}</span></div>}
              {formError && <p className="mc-form-error" role="alert">{formError}</p>}
              <footer><p><strong>Private by default.</strong> This memory and its files stay in this browser. They are never sent to Mint.</p><button type="button" onClick={() => setEditorOpen(false)}>Cancel</button><button className="mc-primary" type="submit">{editingId ? "Save changes" : "Create memory"}</button></footer>
            </form>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="mc-modal-backdrop" role="presentation" onPointerDown={(event: ReactPointerEvent) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <section className="mc-modal mc-settings" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
            <header><div><span className="mc-eyebrow">Privacy and ownership</span><h2 id="privacy-title">Your memories belong to you.</h2></div><button onClick={() => setSettingsOpen(false)} aria-label="Close privacy settings">×</button></header>
            <div className="mc-privacy-callout"><strong>Stored on this device</strong><p>Journal text and archive settings use this browser&apos;s local storage. Uploaded media uses this browser&apos;s private IndexedDB storage. No account or cloud copy is created.</p></div>
            <div className="mc-setting-row"><div><strong>Cloud storage</strong><p>Off. This build has no cloud account and will never upload memories in the background.</p></div><button disabled>Not enabled</button></div>
            <div className="mc-setting-row"><div><strong>Quiet Rediscovery</strong><p>Surface one older memory inside the archive—never as a notification.</p></div><select value={quietFrequency} onChange={(event) => setQuietFrequency(event.target.value as typeof quietFrequency)}><option value="off">Off</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
            <div className="mc-setting-row"><div><strong>Cinematic introduction</strong><p>Returning users normally skip the full opening. Reduced-motion settings are always respected.</p></div><label className="mc-switch"><input type="checkbox" checked={showIntroAgain} onChange={(event) => setShowIntroAgain(event.target.checked)} />Play on every visit</label></div>
            <div className="mc-setting-row"><div><strong>Backup or move your archive</strong><p>Export includes readable journal data and any locally stored media. Keep the file private.</p></div><div className="mc-setting-actions"><button onClick={() => exportArchive()}>Export backup</button><button onClick={() => importRef.current?.click()} disabled={importing}>{importing ? "Importing…" : "Import backup"}</button><input ref={importRef} hidden type="file" accept="application/json,.json" onChange={importArchive} /></div></div>
            <div className="mc-setting-row"><div><strong>Shareable collections</strong><p>Only memories you explicitly mark shareable can be exported for someone else.</p></div><button onClick={() => exportArchive(memories.filter((memory) => memory.shareable))} disabled={!memories.some((memory) => memory.shareable)}>Export shareable</button></div>
            <div className="mc-danger-zone"><div><strong>Permanent data removal</strong><p>Erase every memory, reflection, setting, and media file from this browser.</p></div><button onClick={eraseEverything}>Erase local archive</button></div>
            <footer><p>Mint is used only for generic stars, frames, atmosphere, and sound. Your content is never included in Mint requests.</p><button className="mc-primary" onClick={() => setSettingsOpen(false)}>Done</button></footer>
          </section>
        </div>
      )}
    </main>
  );
}
