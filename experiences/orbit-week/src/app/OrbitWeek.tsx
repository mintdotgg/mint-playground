"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  ORBIT_WEEK_MINT_ASSETS,
  type OrbitPlanet,
} from "./orbitWeekMintAssets";

type Task = {
  id: string;
  text: string;
  done: boolean;
};

type TaskMap = Record<OrbitPlanet, Task[]>;

const DAYS: Array<{
  day: string;
  short: string;
  planet: OrbitPlanet;
  eyebrow: string;
  note: string;
  accent: string;
  scale: number;
  tilt: number;
}> = [
  {
    day: "Monday",
    short: "MON",
    planet: "mercury",
    eyebrow: "Quick launch",
    note: "Start small. Build momentum.",
    accent: "#c8d0d5",
    scale: 0.92,
    tilt: -0.08,
  },
  {
    day: "Tuesday",
    short: "TUE",
    planet: "venus",
    eyebrow: "Bright focus",
    note: "Give the important work your best energy.",
    accent: "#f5ce8e",
    scale: 1.12,
    tilt: 0.08,
  },
  {
    day: "Wednesday",
    short: "WED",
    planet: "earth",
    eyebrow: "Midweek orbit",
    note: "Protect your time. Keep the mission grounded.",
    accent: "#78d7c4",
    scale: 1.15,
    tilt: -0.12,
  },
  {
    day: "Thursday",
    short: "THU",
    planet: "mars",
    eyebrow: "Make it happen",
    note: "Turn one ambitious idea into action.",
    accent: "#f38b65",
    scale: 1,
    tilt: 0.1,
  },
  {
    day: "Friday",
    short: "FRI",
    planet: "jupiter",
    eyebrow: "Big finish",
    note: "Clear the largest task before you coast.",
    accent: "#e3af76",
    scale: 1.82,
    tilt: -0.06,
  },
  {
    day: "Saturday",
    short: "SAT",
    planet: "saturn",
    eyebrow: "Room to wander",
    note: "Make space for the plans that restore you.",
    accent: "#edc66f",
    scale: 1.48,
    tilt: 0.48,
  },
  {
    day: "Sunday",
    short: "SUN",
    planet: "neptune",
    eyebrow: "Quiet reset",
    note: "Close the loop and prepare a calm return.",
    accent: "#72b9ff",
    scale: 1.42,
    tilt: -0.1,
  },
];

const EMPTY_TASKS: TaskMap = {
  mercury: [],
  venus: [],
  earth: [],
  mars: [],
  jupiter: [],
  saturn: [],
  neptune: [],
};

const STORAGE_KEY = "orbit-week.tasks.v1";

function startOfCurrentWeek() {
  const now = new Date();
  const mondayOffset = (now.getUTCDay() + 6) % 7;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12),
  );
  monday.setUTCDate(now.getUTCDate() - mondayOffset);
  return monday;
}

function dayDates() {
  const monday = startOfCurrentWeek();
  return DAYS.map((_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return {
      number: date.getUTCDate().toString().padStart(2, "0"),
      month: date
        .toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
        .toUpperCase(),
    };
  });
}

function normalizeTasks(tasks: Partial<TaskMap>): TaskMap {
  return {
    mercury: Array.isArray(tasks.mercury) ? tasks.mercury : [],
    venus: Array.isArray(tasks.venus) ? tasks.venus : [],
    earth: Array.isArray(tasks.earth) ? tasks.earth : [],
    mars: Array.isArray(tasks.mars) ? tasks.mars : [],
    jupiter: Array.isArray(tasks.jupiter) ? tasks.jupiter : [],
    saturn: Array.isArray(tasks.saturn) ? tasks.saturn : [],
    neptune: Array.isArray(tasks.neptune) ? tasks.neptune : [],
  };
}

function createTaskId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function OrbitScene({
  scrollProgress,
}: {
  scrollProgress: React.MutableRefObject<number>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 180);
    camera.position.set(8, 4, 13);
    scene.add(camera);

    scene.add(new THREE.HemisphereLight(0x9bb9e8, 0x08050f, 1.15));
    const cameraFill = new THREE.DirectionalLight(0xb8c9e7, 1.1);
    cameraFill.position.set(3, 7, 9);
    scene.add(cameraFill);
    const focusFill = new THREE.PointLight(0xdfe7f4, 38, 14, 1.45);
    focusFill.position.set(0.8, 1.8, 1.4);
    camera.add(focusFill);
    const solarLight = new THREE.PointLight(0xffb867, 125, 48, 1.45);
    scene.add(solarLight);

    const loader = new GLTFLoader();
    const textureLoader = new THREE.TextureLoader();
    const planetRoots: THREE.Group[] = [];
    const flybyRoots: THREE.Group[] = [];
    const movingSurfaces: Array<{
      textures: THREE.Texture[];
      speed: number;
      phase: number;
      wobble: number;
    }> = [];
    let sunRoot: THREE.Group | null = null;
    let sunBoilLayer: THREE.Group | null = null;
    let sunVaporShell: THREE.Group | null = null;
    let sunRootMaterials: THREE.MeshStandardMaterial[] = [];
    let sunBoilMaterials: THREE.MeshStandardMaterial[] = [];
    let sunVaporMaterials: THREE.MeshStandardMaterial[] = [];
    let orbitalStationRoot: THREE.Group | null = null;
    let outerSystemUfoRoot: THREE.Group | null = null;
    const orbitalStationMaterials: THREE.MeshStandardMaterial[] = [];
    const outerSystemUfoMaterials: THREE.MeshStandardMaterial[] = [];
    let saturnRingRoot: THREE.Group | null = null;
    let frame = 0;
    let stopped = false;
    let firstFocus = true;
    let smoothedFocus = scrollProgress.current;

    const orbitRadii = [3.4, 5.4, 7.4, 9.4, 11.4, 13.4, 15.4];
    const orbitSpeeds = [0.095, 0.076, 0.063, 0.053, 0.043, 0.036, 0.03];
    const orbitPhases = [0.38, 1.52, 2.62, 3.72, 4.73, 5.62, 0.93];
    const atmosphericPlanets = new Set<OrbitPlanet>([
      "venus",
      "jupiter",
      "saturn",
      "neptune",
    ]);
    const gasPlanets = new Set<OrbitPlanet>(["jupiter", "saturn", "neptune"]);

    type MintMaterialSet = {
      baseColor: THREE.Texture;
      normal: THREE.Texture;
      roughness: THREE.Texture;
    };

    const loadModel = async (url: string) => {
      const gltf = await loader.loadAsync(url);
      const root = new THREE.Group();
      const model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const maximum = Math.max(size.x, size.y, size.z);
      model.position.sub(center);
      model.scale.setScalar(1 / maximum);
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        if (!object.geometry.getAttribute("normal")) {
          object.geometry.computeVertexNormals();
        }
        object.geometry.normalizeNormals();
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => {
          if (material instanceof THREE.MeshStandardMaterial) {
            material.flatShading = false;
            material.needsUpdate = true;
          }
        });
      });
      root.add(model);
      return root;
    };

    const loadMaterialSet = async ({
      baseColor,
      normal,
      roughness,
    }: {
      baseColor: string;
      normal: string;
      roughness: string;
    }): Promise<MintMaterialSet> => {
      const [baseColorMap, normalMap, roughnessMap] = await Promise.all([
        textureLoader.loadAsync(baseColor),
        textureLoader.loadAsync(normal),
        textureLoader.loadAsync(roughness),
      ]);
      baseColorMap.colorSpace = THREE.SRGBColorSpace;
      return {
        baseColor: baseColorMap,
        normal: normalMap,
        roughness: roughnessMap,
      };
    };

    const configureTexture = (source: THREE.Texture) => {
      const texture = source.clone();
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.center.set(0.5, 0.5);
      texture.needsUpdate = true;
      return texture;
    };

    const disposeMaterial = (material: THREE.Material) => {
      if (material instanceof THREE.MeshStandardMaterial) {
        [
          material.map,
          material.normalMap,
          material.roughnessMap,
          material.metalnessMap,
          material.emissiveMap,
        ].forEach((texture) => texture?.dispose());
      }
      material.dispose();
    };

    const applySphericalUv = (root: THREE.Object3D) => {
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const sourceGeometry = object.geometry;
        const geometry = sourceGeometry.index
          ? sourceGeometry.toNonIndexed()
          : sourceGeometry.clone();
        const positions = geometry.getAttribute("position");
        const uv = new Float32Array(positions.count * 2);

        for (let index = 0; index < positions.count; index += 3) {
          const triangleU = [0, 0, 0];
          const triangleV = [0, 0, 0];
          for (let corner = 0; corner < 3; corner += 1) {
            const vertex = index + corner;
            const x = positions.getX(vertex);
            const y = positions.getY(vertex);
            const z = positions.getZ(vertex);
            const radius = Math.max(Math.hypot(x, y, z), 0.0001);
            triangleU[corner] = 0.5 + Math.atan2(z, x) / (Math.PI * 2);
            triangleV[corner] =
              0.5 -
              Math.asin(THREE.MathUtils.clamp(y / radius, -1, 1)) / Math.PI;
          }

          if (Math.max(...triangleU) - Math.min(...triangleU) > 0.5) {
            triangleU.forEach((value, corner) => {
              if (value < 0.5) triangleU[corner] = value + 1;
            });
          }

          for (let corner = 0; corner < 3; corner += 1) {
            const vertex = index + corner;
            uv[vertex * 2] = triangleU[corner];
            uv[vertex * 2 + 1] = triangleV[corner];
          }
        }

        geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
        object.geometry = geometry;
        sourceGeometry.dispose();
      });
    };

    const applyRadialNormals = (root: THREE.Object3D) => {
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const positions = object.geometry.getAttribute("position");
        const normals = new Float32Array(positions.count * 3);
        for (let index = 0; index < positions.count; index += 1) {
          const length = Math.max(
            Math.hypot(
              positions.getX(index),
              positions.getY(index),
              positions.getZ(index),
            ),
            0.0001,
          );
          normals[index * 3] = positions.getX(index) / length;
          normals[index * 3 + 1] = positions.getY(index) / length;
          normals[index * 3 + 2] = positions.getZ(index) / length;
        }
        object.geometry.setAttribute(
          "normal",
          new THREE.BufferAttribute(normals, 3),
        );
      });
    };

    const applyMintMaterial = (
      root: THREE.Object3D,
      source: MintMaterialSet,
      options: {
        speed: number;
        emissiveIntensity?: number;
        opacity?: number;
        additive?: boolean;
        normalScale?: number;
        roughness?: number;
        wobble?: number;
      },
    ) => {
      const createdMaterials: THREE.MeshStandardMaterial[] = [];
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const oldMaterials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        oldMaterials.forEach(disposeMaterial);

        const map = configureTexture(source.baseColor);
        const normalMap = configureTexture(source.normal);
        const roughnessMap = configureTexture(source.roughness);
        const material = new THREE.MeshStandardMaterial({
          map,
          normalMap,
          roughnessMap,
          metalness: 0,
          roughness: options.roughness ?? 0.9,
          normalScale: new THREE.Vector2(
            options.normalScale ?? 0.32,
            options.normalScale ?? 0.32,
          ),
          transparent: (options.opacity ?? 1) < 1,
          opacity: options.opacity ?? 1,
          depthWrite: (options.opacity ?? 1) >= 1,
          blending: options.additive
            ? THREE.AdditiveBlending
            : THREE.NormalBlending,
        });
        if ((options.emissiveIntensity ?? 0) > 0) {
          material.emissive.set(0xffffff);
          material.emissiveMap = map;
          material.emissiveIntensity = options.emissiveIntensity ?? 0;
        }
        object.material = material;
        movingSurfaces.push({
          textures: [map, normalMap, roughnessMap],
          speed: options.speed,
          phase: Math.random(),
          wobble: options.wobble ?? 0.0025,
        });
        createdMaterials.push(material);
      });
      return createdMaterials;
    };

    const registerLivingSurface = (
      root: THREE.Object3D,
      speed: number,
      emissive = false,
      warmBounce = false,
      moveTexture = true,
    ) => {
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => {
          if (!(material instanceof THREE.MeshStandardMaterial)) return;
          const map = material.map;
          if (!map) return;
          if (moveTexture) {
            map.wrapS = THREE.RepeatWrapping;
            map.wrapT = THREE.RepeatWrapping;
            map.center.set(0.5, 0.5);
            const textures = [
              material.map,
              material.normalMap,
              material.roughnessMap,
            ].filter((texture): texture is THREE.Texture => Boolean(texture));
            textures.forEach((texture) => {
              texture.wrapS = THREE.RepeatWrapping;
              texture.wrapT = THREE.RepeatWrapping;
              texture.center.set(0.5, 0.5);
            });
            movingSurfaces.push({
              textures,
              speed,
              phase: Math.random(),
              wobble: 0.0025,
            });
          }
          if (emissive) {
            material.emissive.set(0xff7f35);
            material.emissiveMap = map;
            material.emissiveIntensity = 1.35;
            material.metalness = 0;
            material.roughness = Math.max(material.roughness, 0.72);
          } else if (warmBounce) {
            material.emissive.set(0x72542a);
            material.emissiveMap = map;
            material.emissiveIntensity = 0.48;
          }
          material.needsUpdate = true;
        });
      });
    };

    const setMintOpacity = (
      root: THREE.Object3D,
      opacity: number,
      depthWrite = false,
    ) => {
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => {
          if (!(material instanceof THREE.MeshStandardMaterial)) return;
          material.transparent = true;
          material.opacity = opacity;
          material.depthWrite = depthWrite;
          material.needsUpdate = true;
        });
      });
    };

    const applyLayout = () => {
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;
      const aspect = width / Math.max(height, 1);

      renderer.setSize(width, height, false);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    };

    Promise.all([
      loadModel(ORBIT_WEEK_MINT_ASSETS.sun),
      loadModel(ORBIT_WEEK_MINT_ASSETS.sun),
      loadModel(ORBIT_WEEK_MINT_ASSETS.sun),
      loadModel(ORBIT_WEEK_MINT_ASSETS.livingOrbit.orbitalStation),
      loadModel(ORBIT_WEEK_MINT_ASSETS.livingOrbit.outerSystemUfo),
      loadModel(ORBIT_WEEK_MINT_ASSETS.saturnRings),
      Promise.all(
        DAYS.map(({ planet }) =>
          loadModel(ORBIT_WEEK_MINT_ASSETS.planets[planet]),
        ),
      ),
      Promise.all(
        Object.values(ORBIT_WEEK_MINT_ASSETS.flybys).map((url) =>
          loadModel(url),
        ),
      ),
      loadMaterialSet(ORBIT_WEEK_MINT_ASSETS.materials.venus),
      loadMaterialSet(ORBIT_WEEK_MINT_ASSETS.materials.sun),
      loadMaterialSet(ORBIT_WEEK_MINT_ASSETS.materials.jupiter),
      loadMaterialSet(ORBIT_WEEK_MINT_ASSETS.materials.neptune),
    ])
      .then(
        ([
          sun,
          boilingSurface,
          vaporShell,
          orbitalStation,
          outerSystemUfo,
          saturnRings,
          planets,
          flybys,
          venusMaterial,
          sunMaterial,
          jupiterMaterial,
          neptuneMaterial,
        ]) => {
          if (stopped) return;
          sunRoot = sun;
          sunRoot.scale.setScalar(3.15);
          scene.add(sunRoot);
          applySphericalUv(sunRoot);
          sunRootMaterials = applyMintMaterial(sunRoot, sunMaterial, {
            speed: 0.008,
            emissiveIntensity: 1.42,
            normalScale: 0.3,
            roughness: 0.82,
            wobble: 0.006,
          });

          sunBoilLayer = boilingSurface;
          sunBoilLayer.scale.setScalar(3.18);
          sunBoilLayer.renderOrder = 1;
          scene.add(sunBoilLayer);
          applySphericalUv(sunBoilLayer);
          sunBoilMaterials = applyMintMaterial(sunBoilLayer, sunMaterial, {
            speed: -0.013,
            emissiveIntensity: 1.08,
            opacity: 0.17,
            normalScale: 0.38,
            roughness: 0.78,
            wobble: 0.013,
          });

          sunVaporShell = vaporShell;
          sunVaporShell.scale.setScalar(3.23);
          sunVaporShell.renderOrder = 2;
          scene.add(sunVaporShell);
          applySphericalUv(sunVaporShell);
          sunVaporMaterials = applyMintMaterial(sunVaporShell, sunMaterial, {
            speed: 0.017,
            emissiveIntensity: 0.86,
            opacity: 0.1,
            additive: true,
            normalScale: 0.16,
            roughness: 0.92,
            wobble: 0.015,
          });

          planets.forEach((root, index) => {
            root.rotation.x = DAYS[index].tilt;
            root.rotation.z = index === 5 ? 0.14 : 0;
            root.scale.setScalar(DAYS[index].scale);
            root.traverse((object) => {
              if (!(object instanceof THREE.Mesh)) return;
              const materials = Array.isArray(object.material)
                ? object.material
                : [object.material];
              materials.forEach((material) => {
                if (!(material instanceof THREE.MeshStandardMaterial)) return;
                material.metalness = 0;
                material.roughness = Math.max(
                  material.roughness,
                  atmosphericPlanets.has(DAYS[index].planet) ? 0.94 : 0.68,
                );
                material.normalScale.multiplyScalar(0.58);
                material.needsUpdate = true;
              });
            });
            if (DAYS[index].planet === "venus") {
              applySphericalUv(root);
              applyMintMaterial(root, venusMaterial, {
                speed: 0.0009,
                normalScale: 0.13,
                roughness: 0.97,
                wobble: 0.0018,
              });
            } else if (DAYS[index].planet === "jupiter") {
              applySphericalUv(root);
              applyMintMaterial(root, jupiterMaterial, {
                speed: 0.0018,
                opacity: 0.7,
                normalScale: 0.2,
                roughness: 0.92,
              });
            } else if (DAYS[index].planet === "neptune") {
              applySphericalUv(root);
              applyMintMaterial(root, neptuneMaterial, {
                speed: 0.00135,
                opacity: 0.66,
                normalScale: 0.18,
                roughness: 0.96,
              });
            } else if (atmosphericPlanets.has(DAYS[index].planet)) {
              if (DAYS[index].planet === "saturn") {
                applyRadialNormals(root);
              }
              registerLivingSurface(
                root,
                0.0012 + index * 0.00012,
                false,
                DAYS[index].planet === "saturn",
                DAYS[index].planet !== "saturn",
              );
              if (gasPlanets.has(DAYS[index].planet)) {
                setMintOpacity(root, 0.68);
              }
            }
            if (DAYS[index].planet === "saturn") {
              saturnRingRoot = saturnRings;
              saturnRingRoot.scale.setScalar(2.25);
              saturnRingRoot.traverse((object) => {
                if (!(object instanceof THREE.Mesh)) return;
                const materials = Array.isArray(object.material)
                  ? object.material
                  : [object.material];
                materials.forEach((material) => {
                  if (!(material instanceof THREE.MeshStandardMaterial)) return;
                  material.metalness = 0;
                  material.roughness = Math.max(material.roughness, 0.86);
                  material.side = THREE.DoubleSide;
                  material.transparent = true;
                  material.opacity = 0.62;
                  material.depthWrite = false;
                  if (material.map) {
                    material.emissive.set(0x6b5635);
                    material.emissiveMap = material.map;
                    material.emissiveIntensity = 0.38;
                  }
                  material.needsUpdate = true;
                });
              });
              root.add(saturnRingRoot);
            }
            scene.add(root);
            planetRoots.push(root);
          });

          orbitalStationRoot = orbitalStation;
          orbitalStationRoot.visible = false;
          orbitalStationRoot.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            const materials = Array.isArray(object.material)
              ? object.material
              : [object.material];
            materials.forEach((material) => {
              if (!(material instanceof THREE.MeshStandardMaterial)) return;
              material.transparent = true;
              material.opacity = 0;
              material.depthWrite = false;
              material.metalness = Math.min(material.metalness, 0.58);
              material.roughness = Math.max(material.roughness, 0.46);
              if (material.map) {
                material.emissive.set(0x778aa2);
                material.emissiveMap = material.map;
                material.emissiveIntensity = 0.22;
              }
              material.needsUpdate = true;
              orbitalStationMaterials.push(material);
            });
          });
          const stationLight = new THREE.PointLight(0xb9d9ff, 5, 5, 1.8);
          stationLight.position.set(0.18, 0.1, 0.12);
          orbitalStationRoot.add(stationLight);
          scene.add(orbitalStationRoot);

          outerSystemUfoRoot = outerSystemUfo;
          outerSystemUfoRoot.visible = false;
          outerSystemUfoRoot.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            const materials = Array.isArray(object.material)
              ? object.material
              : [object.material];
            materials.forEach((material) => {
              if (!(material instanceof THREE.MeshStandardMaterial)) return;
              material.transparent = true;
              material.opacity = 0;
              material.depthWrite = false;
              material.metalness = Math.max(material.metalness, 0.7);
              material.roughness = Math.max(material.roughness, 0.34);
              if (material.map) {
                material.emissive.set(0x79e3ff);
                material.emissiveMap = material.map;
                material.emissiveIntensity = 0.68;
              }
              material.needsUpdate = true;
              outerSystemUfoMaterials.push(material);
            });
          });
          const ufoLight = new THREE.PointLight(0x74e8ff, 22, 18, 1.9);
          ufoLight.position.set(0, -0.08, 0.1);
          outerSystemUfoRoot.add(ufoLight);
          camera.add(outerSystemUfoRoot);

          const flybyLightColors = [0xa9ddff, 0xffd7a2, 0xff8a55, 0xb8d8ff];
          flybys.forEach((root, index) => {
            root.visible = false;
            root.traverse((object) => {
              if (!(object instanceof THREE.Mesh)) return;
              const materials = Array.isArray(object.material)
                ? object.material
                : [object.material];
              materials.forEach((material) => {
                if (!(material instanceof THREE.MeshStandardMaterial)) return;
                if (material.map) {
                  material.emissive.set(0xffffff);
                  material.emissiveMap = material.map;
                  material.emissiveIntensity = index < 2 ? 0.48 : 0.3;
                }
                material.metalness = 0;
                material.roughness = Math.max(material.roughness, 0.72);
                material.needsUpdate = true;
              });
            });
            const flybyLight = new THREE.PointLight(
              flybyLightColors[index],
              index < 2 ? 28 : 18,
              index < 2 ? 24 : 16,
              1.7,
            );
            flybyLight.position.set(index < 2 ? 0.28 : 0.08, 0, 0);
            root.add(flybyLight);
            camera.add(root);
            flybyRoots.push(root);
          });

          applyLayout();
          setLoadState("ready");
        },
      )
      .catch((error) => {
        console.error("Orbit Week Mint assets failed to load", error);
        setLoadState("error");
      });

    const timer = new THREE.Timer();
    const desiredCamera = new THREE.Vector3();
    const radial = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();
    const desiredLookTarget = new THREE.Vector3();
    const focusPosition = new THREE.Vector3();
    const stationOffset = new THREE.Vector3();
    const lookMatrix = new THREE.Matrix4();
    const desiredCameraQuaternion = new THREE.Quaternion();

    const render = () => {
      timer.update();
      const elapsed = timer.getElapsed();
      const delta = Math.min(timer.getDelta(), 0.05);
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;
      const narrow = width / Math.max(height, 1) < 0.76;
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const motion = reduceMotion ? 0.22 : 1;

      if (sunRoot) {
        const deepPressure = Math.sin(elapsed * 0.94);
        const rollingPressure = Math.sin(elapsed * 2.17 + 0.7);
        const granularPressure = Math.sin(elapsed * 4.05 + 1.9);
        sunRoot.scale.set(
          3.15 *
            (1 + (deepPressure * 0.018 + granularPressure * 0.005) * motion),
          3.15 *
            (1 + (-deepPressure * 0.012 + rollingPressure * 0.01) * motion),
          3.15 *
            (1 + (rollingPressure * 0.011 - granularPressure * 0.004) * motion),
        );
        sunRoot.rotation.y =
          elapsed * 0.032 * motion + Math.sin(elapsed * 0.31) * 0.028 * motion;
        sunRoot.rotation.x = Math.sin(elapsed * 0.23) * 0.035 * motion;
        sunRoot.rotation.z = Math.sin(elapsed * 0.37 + 0.8) * 0.018 * motion;
        sunRootMaterials.forEach((material) => {
          const normalPressure =
            0.3 +
            (deepPressure * 0.045 +
              rollingPressure * 0.03 +
              granularPressure * 0.018) *
              motion;
          material.normalScale.set(normalPressure, normalPressure * 0.92);
          material.emissiveIntensity =
            1.42 +
            (deepPressure * 0.18 +
              rollingPressure * 0.1 +
              granularPressure * 0.05) *
              motion;
        });
        solarLight.intensity =
          132 +
          deepPressure * 14 * motion +
          rollingPressure * 7 * motion +
          granularPressure * 3 * motion;
      }
      if (sunBoilLayer) {
        const boilA = Math.sin(elapsed * 1.34 + 0.55);
        const boilB = Math.sin(elapsed * 3.08 + 2.25);
        const boilC = Math.sin(elapsed * 5.2 + 0.2);
        sunBoilLayer.scale.set(
          3.18 * (1 + (boilA * 0.016 + boilC * 0.005) * motion),
          3.18 * (1 + (boilB * 0.014 - boilA * 0.006) * motion),
          3.18 * (1 + (-boilB * 0.01 + boilC * 0.006) * motion),
        );
        sunBoilLayer.rotation.y =
          -elapsed * 0.047 * motion + Math.sin(elapsed * 0.42) * 0.04 * motion;
        sunBoilLayer.rotation.x =
          Math.sin(elapsed * 0.29 + 1.4) * 0.048 * motion;
        sunBoilLayer.rotation.z = Math.sin(elapsed * 0.51) * 0.03 * motion;
        sunBoilMaterials.forEach((material) => {
          const pressure =
            0.38 + (boilA * 0.07 + boilB * 0.045 + boilC * 0.02) * motion;
          material.normalScale.set(pressure, pressure * 0.88);
          material.opacity = 0.14 + (boilA * 0.03 + boilB * 0.02) * motion;
          material.emissiveIntensity =
            1.08 + (boilB * 0.16 + boilC * 0.06) * motion;
        });
      }
      if (sunVaporShell) {
        const vaporBreath = Math.sin(elapsed * 0.58 + 0.4);
        const vaporRoll = Math.sin(elapsed * 1.31 + 1.8);
        const vaporFlicker = Math.sin(elapsed * 3.23 + 0.7);
        sunVaporShell.scale.set(
          3.23 * (1 + (vaporBreath * 0.018 + vaporFlicker * 0.003) * motion),
          3.23 * (1 + (vaporRoll * 0.021 - vaporBreath * 0.006) * motion),
          3.23 * (1 + (-vaporRoll * 0.012 + vaporFlicker * 0.004) * motion),
        );
        sunVaporShell.position.set(
          Math.sin(elapsed * 0.41) * 0.025 * motion,
          Math.sin(elapsed * 0.53 + 1.2) * 0.02 * motion,
          Math.cos(elapsed * 0.37) * 0.018 * motion,
        );
        sunVaporShell.rotation.y = -elapsed * 0.036 * motion;
        sunVaporShell.rotation.x =
          Math.sin(elapsed * 0.29 + 0.9) * 0.045 * motion;
        sunVaporShell.rotation.z = Math.sin(elapsed * 0.43) * 0.038 * motion;
        sunVaporMaterials.forEach((material) => {
          material.opacity =
            0.085 +
            (vaporBreath * 0.02 + vaporRoll * 0.012 + vaporFlicker * 0.006) *
              motion;
          material.emissiveIntensity =
            0.86 + (vaporRoll * 0.12 + vaporFlicker * 0.05) * motion;
        });
      }

      planetRoots.forEach((root, index) => {
        const angle =
          orbitPhases[index] + elapsed * orbitSpeeds[index] * motion;
        root.position.set(
          Math.cos(angle) * orbitRadii[index],
          Math.sin(angle * 0.73 + index) * 0.09,
          Math.sin(angle) * orbitRadii[index],
        );
        root.children[0].rotation.y =
          elapsed * (0.055 + index * 0.004) * motion + index * 0.67;
      });
      if (saturnRingRoot) {
        saturnRingRoot.rotation.y = elapsed * 0.012 * motion;
      }

      const livingOrbitTime = elapsed % 78;
      if (orbitalStationRoot && planetRoots.length === DAYS.length) {
        const stationStart = 5;
        const stationEnd = 18;
        const stationVisible =
          livingOrbitTime >= stationStart && livingOrbitTime <= stationEnd;
        orbitalStationRoot.visible = stationVisible;
        if (stationVisible) {
          const stationProgress =
            (livingOrbitTime - stationStart) / (stationEnd - stationStart);
          const stationFade = THREE.MathUtils.smoothstep(
            Math.min(stationProgress / 0.16, (1 - stationProgress) / 0.16),
            0,
            1,
          );
          const stationAngle = elapsed * 0.42 * motion + 0.6;
          stationOffset.set(
            Math.cos(stationAngle) * 1.28,
            0.34 + Math.sin(stationAngle * 1.7) * 0.28,
            Math.sin(stationAngle) * 1.28,
          );
          orbitalStationRoot.position
            .copy(planetRoots[2].position)
            .add(stationOffset);
          orbitalStationRoot.scale.setScalar(narrow ? 0.4 : 0.52);
          orbitalStationRoot.rotation.set(
            0.12 + Math.sin(elapsed * 0.34) * 0.05 * motion,
            -stationAngle + Math.PI * 0.5,
            0.12 + Math.sin(elapsed * 0.27) * 0.08 * motion,
          );
          orbitalStationMaterials.forEach((material) => {
            material.opacity = stationFade * 0.94;
          });
        }
      }

      movingSurfaces.forEach(({ textures, speed, phase, wobble }, index) => {
        const horizontalWobble =
          Math.sin(elapsed * (0.46 + index * 0.013) + phase * 7) *
          wobble *
          0.55 *
          motion;
        const rawOffset = phase + elapsed * speed * motion + horizontalWobble;
        const offsetX = ((rawOffset % 1) + 1) % 1;
        const offsetY =
          Math.sin(elapsed * (0.38 + index * 0.017) + phase * 6) *
          wobble *
          motion;
        textures.forEach((texture) => {
          texture.offset.x = offsetX;
          texture.offset.y = offsetY;
          if (Math.abs(speed) > 0.004) {
            texture.rotation =
              Math.sin(elapsed * 0.29 + phase * 4) *
              (0.014 + wobble * 0.65) *
              motion;
          }
        });
      });

      if (planetRoots.length === DAYS.length) {
        const requestedFocus = THREE.MathUtils.clamp(
          scrollProgress.current,
          0,
          DAYS.length - 1,
        );
        smoothedFocus = THREE.MathUtils.lerp(
          smoothedFocus,
          requestedFocus,
          1 - Math.exp(-delta * (reduceMotion ? 7.5 : 3.8)),
        );

        const lowerIndex = Math.floor(smoothedFocus);
        const upperIndex = Math.min(lowerIndex + 1, DAYS.length - 1);
        const rawTransition = smoothedFocus - lowerIndex;
        const transition = THREE.MathUtils.smoothstep(rawTransition, 0, 1);
        const lowerPosition = planetRoots[lowerIndex].position;
        const upperPosition = planetRoots[upperIndex].position;
        const lowerAngle = Math.atan2(lowerPosition.z, lowerPosition.x);
        const upperAngle = Math.atan2(upperPosition.z, upperPosition.x);
        const angleDelta = Math.atan2(
          Math.sin(upperAngle - lowerAngle),
          Math.cos(upperAngle - lowerAngle),
        );
        const focusAngle = lowerAngle + angleDelta * transition;
        const focusRadius = THREE.MathUtils.lerp(
          Math.hypot(lowerPosition.x, lowerPosition.z),
          Math.hypot(upperPosition.x, upperPosition.z),
          transition,
        );
        focusPosition.set(
          Math.cos(focusAngle) * focusRadius,
          THREE.MathUtils.lerp(lowerPosition.y, upperPosition.y, transition),
          Math.sin(focusAngle) * focusRadius,
        );
        radial.set(focusPosition.x, 0, focusPosition.z).normalize();
        tangent.set(-radial.z, 0, radial.x);

        const focusedScale = THREE.MathUtils.lerp(
          DAYS[lowerIndex].scale,
          DAYS[upperIndex].scale,
          transition,
        );
        const saturnWeight =
          (lowerIndex === 5 ? 1 - transition : 0) +
          (upperIndex === 5 ? transition : 0);
        const cameraDistance =
          (narrow ? 4.25 : 4.9) +
          Math.min(focusedScale, 1.8) * 0.48 +
          saturnWeight * (narrow ? 0.82 : 1.18);
        desiredCamera
          .copy(focusPosition)
          .addScaledVector(radial, cameraDistance)
          .addScaledVector(tangent, narrow ? -0.32 : -1.18);
        desiredCamera.y += narrow ? 1.34 : 1.72;

        if (firstFocus) {
          camera.position.copy(desiredCamera);
          desiredLookTarget
            .set(0, narrow ? 0.42 : 0.28, 0)
            .addScaledVector(tangent, narrow ? -0.28 : -2.05);
          lookTarget.copy(desiredLookTarget);
          camera.lookAt(lookTarget);
          firstFocus = false;
        } else {
          camera.position.lerp(
            desiredCamera,
            1 - Math.exp(-delta * (narrow ? 4.8 : 4.2)),
          );
          desiredLookTarget
            .set(0, narrow ? 0.42 : 0.28, 0)
            .addScaledVector(tangent, narrow ? -0.28 : -2.05);
          lookTarget.lerp(
            desiredLookTarget,
            1 - Math.exp(-delta * (narrow ? 5.4 : 4.8)),
          );
          lookMatrix.lookAt(camera.position, lookTarget, camera.up);
          desiredCameraQuaternion.setFromRotationMatrix(lookMatrix);
          camera.quaternion.slerp(
            desiredCameraQuaternion,
            1 - Math.exp(-delta * (narrow ? 6.2 : 5.6)),
          );
        }

        const transitionLift = Math.sin(rawTransition * Math.PI);
        camera.fov = THREE.MathUtils.lerp(
          camera.fov,
          (narrow ? 44 : 37) + transitionLift * (narrow ? 7 : 5),
          1 - Math.exp(-delta * 4.8),
        );
        camera.updateProjectionMatrix();
      } else {
        camera.lookAt(0, 0, 0);
      }

      flybyRoots.forEach((root) => {
        root.visible = false;
      });
      if (flybyRoots.length > 0 && elapsed > 7) {
        const flybyCycle = 24;
        const localTime = (elapsed - 7) % flybyCycle;
        const cycleIndex =
          Math.floor((elapsed - 7) / flybyCycle) % flybyRoots.length;
        const duration = cycleIndex < 2 ? 8.2 : 5.8;
        if (localTime < duration) {
          const root = flybyRoots[cycleIndex];
          const progress = localTime / duration;
          const eased = progress * progress * (3 - 2 * progress);
          const comet = cycleIndex < 2;
          root.visible = true;
          root.scale.setScalar(
            comet ? (narrow ? 0.68 : 0.9) : narrow ? 0.24 : 0.32,
          );
          root.position.set(
            THREE.MathUtils.lerp(-58, 58, eased),
            (cycleIndex % 2 === 0 ? 18 : -16) +
              Math.sin(progress * Math.PI) * (comet ? 4 : 7),
            comet ? -118 : -108,
          );
          root.rotation.set(
            cycleIndex % 2 === 0 ? -0.08 : 0.14,
            0,
            cycleIndex % 2 === 0 ? -0.12 : 0.17,
          );
        }
      }

      if (outerSystemUfoRoot) {
        const ufoStart = 32;
        const ufoEnd = 43;
        const ufoVisible =
          livingOrbitTime >= ufoStart && livingOrbitTime <= ufoEnd;
        outerSystemUfoRoot.visible = ufoVisible;
        if (ufoVisible) {
          const ufoProgress =
            (livingOrbitTime - ufoStart) / (ufoEnd - ufoStart);
          const ufoFade = THREE.MathUtils.smoothstep(
            Math.min(ufoProgress / 0.16, (1 - ufoProgress) / 0.16),
            0,
            1,
          );
          const easedUfo = THREE.MathUtils.smoothstep(ufoProgress, 0, 1);
          outerSystemUfoRoot.scale.setScalar(narrow ? 1.7 : 2.5);
          outerSystemUfoRoot.position.set(
            THREE.MathUtils.lerp(-60, -34, easedUfo),
            (narrow ? 11 : 10) + Math.sin(ufoProgress * Math.PI) * 3.4,
            -112,
          );
          outerSystemUfoRoot.rotation.set(
            -0.04 + Math.sin(elapsed * 0.31) * 0.025 * motion,
            0.1 + Math.sin(elapsed * 0.22) * 0.08 * motion,
            -0.08 + Math.sin(elapsed * 0.47) * 0.055 * motion,
          );
          outerSystemUfoMaterials.forEach((material) => {
            material.opacity = ufoFade * 0.9;
            material.emissiveIntensity = 0.6 + ufoFade * 0.36;
          });
        }
      }

      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };

    const observer = new ResizeObserver(applyLayout);
    observer.observe(canvas);
    frame = requestAnimationFrame(render);

    return () => {
      stopped = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
      renderer.dispose();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => material.dispose());
      });
    };
  }, [scrollProgress]);

  return (
    <div className="orbit-scene" aria-hidden="true">
      <canvas ref={canvasRef} />
      {loadState === "loading" && (
        <div className="orbit-loader">
          <span />
          <small>CALIBRATING ORBITS</small>
        </div>
      )}
      {loadState === "error" && (
        <div className="orbit-loader orbit-loader-error">
          <small>PLANETARY SIGNAL LOST</small>
        </div>
      )}
    </div>
  );
}

function DayCard({
  index,
  tasks,
  date,
  onAdd,
  onToggle,
  onDelete,
}: {
  index: number;
  tasks: Task[];
  date: { number: string; month: string };
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const day = DAYS[index];
  const completed = tasks.filter((task) => task.done).length;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onAdd(text);
    setDraft("");
  };

  return (
    <article
      className="orbit-card"
      style={{ "--day-accent": day.accent } as React.CSSProperties}
    >
      <div className="orbit-card-top">
        <div className="orbit-day-number">
          <span>{date.month}</span>
          <strong>{date.number}</strong>
        </div>
        <div>
          <p>{day.eyebrow}</p>
          <h2>{day.day}</h2>
        </div>
        <div className="orbit-planet-label">
          <span>PLANET</span>
          <strong>{day.planet}</strong>
        </div>
      </div>

      <p className="orbit-note">{day.note}</p>

      <div className="orbit-list-head">
        <span>TODAY&apos;S MISSIONS</span>
        <b>
          {completed}/{tasks.length}
        </b>
      </div>

      <div className="orbit-task-list" aria-live="polite">
        {tasks.length === 0 ? (
          <div className="orbit-empty">
            <span>Clear skies.</span>
            <p>Add your first mission for {day.day}.</p>
          </div>
        ) : (
          tasks.map((task, taskIndex) => (
            <div
              className={`orbit-task ${task.done ? "is-done" : ""}`}
              key={task.id}
            >
              <button
                className="orbit-check"
                type="button"
                aria-label={`${task.done ? "Mark incomplete" : "Complete"}: ${task.text}`}
                aria-pressed={task.done}
                onClick={() => onToggle(task.id)}
              >
                <span>{task.done ? "✓" : ""}</span>
              </button>
              <span className="orbit-task-index">
                {String(taskIndex + 1).padStart(2, "0")}
              </span>
              <p>{task.text}</p>
              <button
                className="orbit-delete"
                type="button"
                aria-label={`Delete: ${task.text}`}
                onClick={() => onDelete(task.id)}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      <form className="orbit-add" onSubmit={submit}>
        <label className="sr-only" htmlFor={`task-${day.planet}`}>
          Add a task for {day.day}
        </label>
        <span aria-hidden="true">＋</span>
        <input
          id={`task-${day.planet}`}
          value={draft}
          maxLength={120}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={`Add a ${day.day.toLowerCase()} mission…`}
        />
        <button type="submit" disabled={!draft.trim()}>
          ADD
        </button>
      </form>
    </article>
  );
}

export default function OrbitWeek() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollProgress = useRef(0);
  const activeDayRef = useRef(0);
  const railWheelAccumulator = useRef(0);
  const railWheelLocked = useRef(false);
  const railWheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeDay, setActiveDay] = useState(0);
  const [tasks, setTasks] = useState<TaskMap>(EMPTY_TASKS);
  const [hydrated, setHydrated] = useState(false);
  const dates = useMemo(() => dayDates(), []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<TaskMap>;
          setTasks(normalizeTasks(parsed));
        }
      } catch (error) {
        console.warn("Orbit Week could not restore saved tasks", error);
      }
      setHydrated(true);
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [hydrated, tasks]);

  useEffect(
    () => () => {
      if (railWheelTimer.current) clearTimeout(railWheelTimer.current);
    },
    [],
  );

  const totals = useMemo(() => {
    const allTasks = Object.values(tasks).flat();
    return {
      total: allTasks.length,
      done: allTasks.filter((task) => task.done).length,
    };
  }, [tasks]);

  const onScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const height = Math.max(element.clientHeight, 1);
    const progress = element.scrollTop / height;
    scrollProgress.current = THREE.MathUtils.clamp(
      progress,
      0,
      DAYS.length - 1,
    );
    const next = Math.round(scrollProgress.current);
    activeDayRef.current = next;
    setActiveDay((current) => (current === next ? current : next));
  };

  const goToDay = (index: number) => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: index * element.clientHeight, behavior: "smooth" });
  };

  const onRailWheel = (event: React.WheelEvent<HTMLElement>) => {
    event.preventDefault();
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

    const element = scrollRef.current;
    if (!element) return;

    const delta =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? event.deltaY * 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? event.deltaY * element.clientHeight
          : event.deltaY;

    railWheelAccumulator.current += delta;
    if (
      railWheelLocked.current ||
      Math.abs(railWheelAccumulator.current) < 24
    ) {
      return;
    }

    const direction = railWheelAccumulator.current > 0 ? 1 : -1;
    const next = THREE.MathUtils.clamp(
      activeDayRef.current + direction,
      0,
      DAYS.length - 1,
    );

    railWheelAccumulator.current = 0;
    railWheelLocked.current = true;
    activeDayRef.current = next;
    setActiveDay(next);
    goToDay(next);

    if (railWheelTimer.current) clearTimeout(railWheelTimer.current);
    railWheelTimer.current = setTimeout(() => {
      railWheelLocked.current = false;
      railWheelAccumulator.current = 0;
    }, 420);
  };

  const updateDay = (
    planet: OrbitPlanet,
    updater: (current: Task[]) => Task[],
  ) => {
    setTasks((current) => ({
      ...current,
      [planet]: updater(current[planet]),
    }));
  };

  return (
    <main
      className="orbit-app"
      style={
        {
          "--space-background": `url(${ORBIT_WEEK_MINT_ASSETS.background})`,
          "--active-accent": DAYS[activeDay].accent,
        } as React.CSSProperties
      }
    >
      <OrbitScene scrollProgress={scrollProgress} />

      <header className="orbit-header">
        <button
          className="orbit-brand"
          type="button"
          onClick={() => goToDay(0)}
          aria-label="Orbit Week — go to Monday"
        >
          <span aria-hidden="true">OW</span>
          <div>
            <strong>ORBIT WEEK</strong>
            <small>PLAN YOUR UNIVERSE</small>
          </div>
        </button>

        <div className="orbit-week-progress">
          <div>
            <span>WEEKLY ORBIT</span>
            <strong>
              {totals.done} / {totals.total || 0} COMPLETE
            </strong>
          </div>
          <div className="orbit-progress-track">
            <i
              style={{
                width: `${totals.total ? (totals.done / totals.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        <div className="orbit-scroll-cue">
          <span>SCROLL TO ORBIT</span>
          <b aria-hidden="true">↓</b>
        </div>
      </header>

      <nav
        className="orbit-day-rail"
        aria-label="Days of the week. Hover and scroll to move between lists."
        onWheel={onRailWheel}
        onMouseLeave={() => {
          railWheelAccumulator.current = 0;
        }}
      >
        {DAYS.map((day, index) => (
          <button
            type="button"
            key={day.planet}
            className={index === activeDay ? "is-active" : ""}
            onClick={() => goToDay(index)}
            aria-label={`Go to ${day.day}, ${day.planet}`}
            aria-current={index === activeDay ? "step" : undefined}
          >
            <span>{day.short}</span>
            <i />
          </button>
        ))}
      </nav>

      <div className="orbit-scroll" ref={scrollRef} onScroll={onScroll}>
        {DAYS.map((day, index) => (
          <section
            className="orbit-day-section"
            key={day.planet}
            aria-label={`${day.day} tasks, represented by ${day.planet}`}
          >
            <DayCard
              index={index}
              date={dates[index]}
              tasks={tasks[day.planet]}
              onAdd={(text) =>
                updateDay(day.planet, (current) => [
                  ...current,
                  { id: createTaskId(), text, done: false },
                ])
              }
              onToggle={(id) =>
                updateDay(day.planet, (current) =>
                  current.map((task) =>
                    task.id === id ? { ...task, done: !task.done } : task,
                  ),
                )
              }
              onDelete={(id) =>
                updateDay(day.planet, (current) =>
                  current.filter((task) => task.id !== id),
                )
              }
            />
          </section>
        ))}
      </div>

      <div className="orbit-mint-credit">CELESTIAL ASSETS BY MINT</div>
    </main>
  );
}
