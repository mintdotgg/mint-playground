/* eslint-disable @next/next/no-img-element -- Portable Vite capsule has no Next Image runtime. */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { MAPLE_MINT_ASSETS as ASSETS } from "./mapleMintAssets";

type Phase = "loading" | "ready" | "playing" | "celebrating" | "won" | "error";

type SparkSplatObject = THREE.Object3D & {
  initialized?: Promise<unknown>;
};

type SparkRuntimeModule = {
  SparkRenderer: new (options: { renderer: THREE.WebGLRenderer }) => THREE.Object3D;
  SplatMesh: new (options: { url: string }) => SparkSplatObject;
};
type Direction = "forward" | "back" | "left" | "right";
// "apple" = Boulderberry, "orange" = Spikefruit, "parcel" = lost Dino Egg.
type ItemType = "apple" | "orange" | "shell" | "parcel" | "fish" | "bug";
type RequestChip = { villager: string; type: ItemType; count: number };
type Ui = {
  phase: Phase;
  coins: number;
  carried: ItemType[];
  houseBuilt: boolean;
  inside: boolean;
  sound: boolean;
  loading: string;
  toast: string;
  catchBanner: { emoji: string; line: string } | null;
  banter: { speaker: string; line: string } | null;
  requests: RequestChip[];
  titleOk: boolean;
};

const DAY_CYCLE = 240; // seconds per looping day-night cycle (ambience only, no fail state)
const HOUSE_COST = 420;
const ITEM_EMOJI: Record<ItemType, string> = { apple: "🍒", orange: "🍊", shell: "🐚", parcel: "🥚", fish: "🐟", bug: "🦋" };
const ITEM_NAME: Record<ItemType, string> = { apple: "boulderberry", orange: "spikefruit", shell: "ammonite", parcel: "dino egg", fish: "fish", bug: "dragonfly" };

const INITIAL_UI: Ui = {
  phase: "loading",
  coins: 0,
  carried: [],
  houseBuilt: false,
  inside: false,
  sound: true,
  loading: "Paddling to Boulder Cove…",
  toast: "",
  catchBanner: null,
  banter: null,
  requests: [],
  titleOk: true,
};

// Each villager stands out front of their own building, facing the paths.
const VILLAGERS = [
  {
    key: "triceratops", x: 3.4, z: 10.2, yaw: -2.68,
    chatter: [
      "Welcome to my coral hut — three horns, zero worries!",
      "I re-stacked every boulder in my hut. Twice.",
    ],
    thanks: [
      "Tri-riffic! That goes toward your hut!",
      "You're the best neighbor Boulder Cove ever hatched!",
    ],
  },
  {
    key: "stegosaurus", x: -11.8, z: -3.6, yaw: 1.16,
    chatter: [
      "My yellow hut catches the best morning sun on my plates.",
      "A dragonfly napped on my plates and so did I.",
    ],
    thanks: [
      "Stego-splendid! Your hut fund is growing!",
      "Plate-tastic! You'll be our neighbor in no time!",
    ],
  },
  {
    key: "trex", x: 18.4, z: -3.4, yaw: -1.24,
    chatter: [
      "I curate the bone museum — those ribs are my great-uncle's!",
      "Tiny arms, big dreams. That's the curator's motto.",
    ],
    thanks: [
      "ROAR-some! Adding it to your hut fund!",
      "Dino-mite! Your hut is nearly funded!",
    ],
  },
  {
    key: "ankylosaurus", x: -1.2, z: -11.6, yaw: 0.28,
    chatter: [
      "Keep the goods coming and I'll have your hut stacked in no time!",
      "The shop shelves are nearly empty — good sign!",
    ],
    thanks: [
      "Rock solid! I'll log it in the building book!",
      "Boulder Cove thanks you, little helper!",
    ],
  },
] as const;

const BUILDING_PLACEMENTS = [
  { key: "yellowCottage", x: -16, z: -7, size: 5.4, yaw: 1.16, blocker: 1.6 },
  { key: "coralCottage", x: 7, z: 14, size: 5.4, yaw: -2.68, blocker: 1.6 },
  { key: "shop", x: -4, z: -14, size: 6.4, yaw: 0.28, blocker: 2.2 },
  { key: "museum", x: 20, z: -7, size: 7.8, yaw: -1.24, blocker: 2.6 },
] as const;

// The player's future cottage: an empty plot until the house fund is full.
const PLOT = { x: -9, z: 12, size: 5.8, yaw: 2.5, blocker: 2.0 } as const;

// Door trigger points (building position + forward toward the door face).
// exitX/exitZ sit ~1.8 units out along the door's radial so leaving a house
// never lands back inside the door trigger (which caused a revolving door).
const DOORS = [
  { key: "yellow", x: -13.8, z: -6.0, exitX: -12.0, exitZ: -5.2, label: "Spike's hut" },
  { key: "coral", x: 5.9, z: 11.8, exitX: 5.1, exitZ: 10.2, label: "Trixie's hut" },
  { key: "own", x: -7.3, z: 9.9, exitX: -6.2, exitZ: 8.5, label: "your hut" },
  { key: "shop", x: -3.2, z: -11.2, exitX: -2.7, exitZ: -9.4, label: "Boulder's shop" },
  { key: "museum", x: 16.7, z: -5.9, exitX: 17.8, exitZ: -4.4, label: "the bone museum" },
] as const;

// Fish swim inside these water zones (river halves + south shore).
// AC-style: rod comes out near a fish, standing still casts, the fish is
// lured to the bobber — move and it flees.
const FISH_ZONES = [
  { x0: 11.0, x1: 14.8, z0: 3.0, z1: 24, y: 0.07 },
  { x0: 11.0, x1: 14.8, z0: -24, z1: -5.0, y: 0.07 },
  { x0: -10, x1: 10, z0: 30.2, z1: 33.5, y: -0.34 },
] as const;
const ROD_OUT_RANGE = 3.6;
const CAST_RANGE = 3.0;

function loadTransparentTitle(url: string, onReady: (dataUrl: string) => void, onError: () => void) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.onload = () => {
    const source = document.createElement("canvas");
    source.width = image.naturalWidth;
    source.height = image.naturalHeight;
    const context = source.getContext("2d", { willReadFrequently: true });
    if (!context) {
      onError();
      return;
    }
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, source.width, source.height);
    const samplePoints = [
      0,
      (source.width - 1) * 4,
      (source.height - 1) * source.width * 4,
      (source.height * source.width - 1) * 4,
    ];
    const background = samplePoints.reduce(
      (rgb, index) => [rgb[0] + pixels.data[index], rgb[1] + pixels.data[index + 1], rgb[2] + pixels.data[index + 2]],
      [0, 0, 0],
    ).map((channel) => channel / samplePoints.length);
    let left = source.width;
    let top = source.height;
    let right = 0;
    let bottom = 0;
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        const index = (y * source.width + x) * 4;
        const distance = Math.hypot(
          pixels.data[index] - background[0],
          pixels.data[index + 1] - background[1],
          pixels.data[index + 2] - background[2],
        );
        const alpha = Math.max(0, Math.min(255, ((distance - 18) / 28) * 255));
        pixels.data[index + 3] = alpha;
        if (alpha > 20) {
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
    }
    if (left > right || top > bottom) {
      onError();
      return;
    }
    context.putImageData(pixels, 0, 0);
    const margin = 4;
    const cropX = Math.max(0, left - margin);
    const cropY = Math.max(0, top - margin);
    const cropWidth = Math.min(source.width - cropX, right - left + 1 + margin * 2);
    const cropHeight = Math.min(source.height - cropY, bottom - top + 1 + margin * 2);
    const output = document.createElement("canvas");
    output.width = cropWidth;
    output.height = cropHeight;
    output.getContext("2d")?.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    onReady(output.toDataURL("image/png"));
  };
  image.onerror = onError;
  image.src = url;
  return () => {
    image.onload = null;
    image.onerror = null;
    image.src = "";
  };
}

// Catchable Mint dragonflies orbit these meadow anchors.
const DRAGONFLY_SPOTS = [
  { x: -5, z: 8 },
  { x: 17.5, z: 4 },
  { x: 2, z: -9 },
] as const;

// Soft soil patches where carried fruit can be planted to grow a new tree.
const SOIL_SPOTS = [
  { x: -14, z: 8 },
  { x: 3, z: 17.5 },
  { x: 21, z: 8.5 },
] as const;
const TREE_GROW_SECONDS = 45;

const PROP_PLACEMENTS = [
  { key: "well", x: 0, z: -3, size: 2.6, yaw: 0, blocker: 1.25 },
  { key: "signpost", x: 2.4, z: 0.8, size: 2.0, yaw: -0.4, blocker: 0.5 },
  { key: "bench", x: -2.8, z: -6.2, size: 1.7, yaw: 0.7, blocker: 0.8 },
  { key: "bench", x: 4.6, z: 6.6, size: 1.7, yaw: -2.4, blocker: 0.8 },
  { key: "lantern", x: -3.6, z: -1.8, size: 2.3, yaw: 0, blocker: 0.4 },
  { key: "lantern", x: 3.6, z: -4.6, size: 2.3, yaw: 0, blocker: 0.4 },
  { key: "lantern", x: 9.6, z: -3.4, size: 2.3, yaw: 0, blocker: 0.4 },
  { key: "lantern", x: 16.2, z: 0.6, size: 2.3, yaw: 0, blocker: 0.4 },
  { key: "mailbox", x: -7.2, z: 10.4, size: 1.5, yaw: 2.5, blocker: 0.4 },
  { key: "mailbox", x: 5.6, z: 12.6, size: 1.5, yaw: -2.7, blocker: 0.4 },
  { key: "fence", x: -11.5, z: 8.5, size: 2.2, yaw: 0.6, blocker: 0.9 },
  { key: "fence", x: -13.4, z: 6.5, size: 2.2, yaw: 0.6, blocker: 0.9 },
  { key: "fence", x: -7.9, z: -11.9, size: 2.2, yaw: 0.3, blocker: 0.9 },
  { key: "fence", x: -0.4, z: -16.1, size: 2.2, yaw: -0.2, blocker: 0.9 },
  { key: "giantFern", x: -19, z: -3, size: 2.2, yaw: 0.5, blocker: 0.6 },
  { key: "giantFern", x: 10.2, z: 10.6, size: 2.2, yaw: -1.1, blocker: 0.6 },
  { key: "giantFern", x: -8.5, z: -17.5, size: 2.2, yaw: 2.0, blocker: 0.6 },
  { key: "giantFern", x: 23.5, z: 3.5, size: 2.2, yaw: 0.9, blocker: 0.6 },
  { key: "tulips", x: -5, z: 8, size: 1.1, yaw: 0.4, blocker: 0 },
  { key: "tulips", x: 6, z: 9.5, size: 1.1, yaw: 1.4, blocker: 0 },
  { key: "tulips", x: -8, z: -6, size: 1.1, yaw: 2.2, blocker: 0 },
  { key: "tulips", x: 2, z: -9, size: 1.1, yaw: -0.8, blocker: 0 },
  { key: "tulips", x: 17.5, z: 4, size: 1.1, yaw: 0.9, blocker: 0 },
  { key: "tulips", x: 21, z: -1.5, size: 1.1, yaw: -1.7, blocker: 0 },
] as const;

const FRUIT_TREES = [
  { kind: "apple" as ItemType, x: -17, z: 3 },
  { kind: "apple" as ItemType, x: -12, z: 17 },
  { kind: "apple" as ItemType, x: -19, z: -13 },
  { kind: "orange" as ItemType, x: 19.5, z: 5.5 },
  { kind: "orange" as ItemType, x: 23.5, z: -2.5 },
  { kind: "orange" as ItemType, x: 17.5, z: 10.5 },
] as const;

const CEDARS = [
  [-22, -2], [-20, 10], [-14, -18], [4, -20], [9, -17], [22, 13], [-14, 19], [25, 7],
] as const;

const SHELL_SPOTS = [
  [-8, 26.2], [0, 27.2], [8, 26.4], [-17, 20.5], [16.5, 20.5],
] as const;

const PARCELS = [
  { x: 24, z: -13, addressee: 0 },
  { x: -6, z: -20, addressee: 2 },
  { x: -23, z: 7, addressee: 1 },
] as const;

// River band and bridge crossing lane (world units).
const RIVER_X0 = 10.4;
const RIVER_X1 = 15.4;
const BRIDGE_Z = -1.5;
const BRIDGE_HALF = 1.5; // deck width — rails keep the player on the planks
const ISLAND_WALK_RADIUS = 28.4;

type DayStop = { u: number; sky: number; sun: number; sunI: number; hemi: number };
const DAY_STOPS: DayStop[] = [
  { u: 0.0, sky: 0xaee8f7, sun: 0xfff3cf, sunI: 2.4, hemi: 2.1 },
  { u: 0.45, sky: 0x9edcf3, sun: 0xffeebb, sunI: 2.8, hemi: 2.3 },
  { u: 0.7, sky: 0xf8cf9e, sun: 0xffc078, sunI: 2.1, hemi: 1.8 },
  { u: 0.88, sky: 0xc793a4, sun: 0xff9a68, sunI: 1.4, hemi: 1.3 },
  { u: 1.0, sky: 0x606e9e, sun: 0x8fa0d0, sunI: 0.75, hemi: 0.9 },
];

export default function MapleCove() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<{ start: () => void; resume: () => void; action: () => void; toggleSound: () => void; setDirection: (d: Direction, v: boolean) => void } | null>(null);
  const [ui, setUi] = useState<Ui>(INITIAL_UI);
  const [titleSrc, setTitleSrc] = useState<string | null>(null);

  useEffect(
    () => loadTransparentTitle(
      ASSETS.images.title,
      setTitleSrc,
      () => setUi((value) => ({ ...value, titleOk: false })),
    ),
    [],
  );

  useEffect(() => {
    if (!canvasRef.current) return;
    let disposed = false;
    let animationFrame = 0;
    let cleanupRuntime: () => void = () => undefined;
    const pressed = { forward: false, back: false, left: false, right: false };
    let actionQueued = false;
    const timers: number[] = [];
    let banterTimer = 0;
    let toastTimer = 0;

    const audio = Object.fromEntries(
      Object.entries(ASSETS.audio).map(([key, source]) => [key, new Audio(source)]),
    ) as Record<keyof typeof ASSETS.audio, HTMLAudioElement>;
    audio.music.loop = true;
    audio.music.volume = 0.2;
    audio.shore.loop = true;
    audio.shore.volume = 0.16;
    audio.footsteps.loop = true;
    audio.footsteps.volume = 0.32;
    audio.babble.volume = 0.5;
    audio.coin.volume = 0.55;

    void (async () => {
      try {
        if (disposed || !canvasRef.current) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xaee8f7);
        scene.fog = new THREE.Fog(0xaee8f7, 95, 260);
        const camera = new THREE.PerspectiveCamera(48, 1, 0.08, 420);
        const renderer = new THREE.WebGLRenderer({
          canvas: canvasRef.current,
          antialias: true,
          powerPreference: "high-performance",
        });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.06;

        const hemi = new THREE.HemisphereLight(0xfff4d6, 0x3e5a44, 2.1);
        scene.add(hemi);
        const sun = new THREE.DirectionalLight(0xfff3cf, 2.4);
        sun.position.set(-16, 26, 12);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -36;
        sun.shadow.camera.right = 36;
        sun.shadow.camera.top = 36;
        sun.shadow.camera.bottom = -36;
        sun.shadow.camera.far = 90;
        scene.add(sun);

        const manager = new THREE.LoadingManager();
        manager.onProgress = (_url, loaded, total) => {
          if (!disposed) setUi((v) => ({ ...v, loading: `Gathering Mint assets · ${loaded}/${total}` }));
        };
        const loader = new GLTFLoader(manager);
        const allModelPaths = [
          ASSETS.player.model, ASSETS.player.idle, ASSETS.player.run, ASSETS.player.carry,
          ...ASSETS.villagers.flatMap((v) => [v.model, v.animation]),
          ...Object.values(ASSETS.buildings),
          ...Object.values(ASSETS.props),
        ];
        const uniquePaths = [...new Set<string>(allModelPaths)];
        const loaded = await Promise.all(
          uniquePaths.map(async (path) => [path, await loader.loadAsync(path)] as const),
        );
        const gltfs = new Map(loaded);
        if (disposed) return;

        const prepare = (object: THREE.Object3D) => {
          object.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              child.frustumCulled = false;
            }
          });
          return object;
        };
        const fitHeight = (object: THREE.Object3D, height: number) => {
          const root = new THREE.Group();
          root.add(object);
          object.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(object);
          const size = box.getSize(new THREE.Vector3());
          object.scale.setScalar(height / Math.max(size.y, 0.001));
          object.updateMatrixWorld(true);
          const fitted = new THREE.Box3().setFromObject(object);
          const center = fitted.getCenter(new THREE.Vector3());
          object.position.set(-center.x, -fitted.min.y, -center.z);
          return prepare(root);
        };
        const fitMax = (object: THREE.Object3D, maxSize: number) => {
          const root = new THREE.Group();
          root.add(object);
          object.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(object);
          const size = box.getSize(new THREE.Vector3());
          object.scale.setScalar(maxSize / Math.max(size.x, size.y, size.z, 0.001));
          object.updateMatrixWorld(true);
          const fitted = new THREE.Box3().setFromObject(object);
          const center = fitted.getCenter(new THREE.Vector3());
          object.position.set(-center.x, -fitted.min.y, -center.z);
          return prepare(root);
        };
        const sceneFor = (path: string) => cloneSkeleton(gltfs.get(path)!.scene);
        const disableShadowCast = (object: THREE.Object3D) => {
          object.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) child.castShadow = false;
          });
          return object;
        };

        // ---------- Island terrain (procedural — Mint worlds export as splats,
        // not playable collision meshes; see mint-assets.json) ----------
        const gameRoot = new THREE.Group();
        scene.add(gameRoot);

        // Segmented so the sea can roll — vertices are displaced AND tinted
        // every frame so the swell reads even in flat toon lighting.
        const waterGeo = new THREE.PlaneGeometry(480, 480, 96, 96);
        waterGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(waterGeo.attributes.position.count * 3).fill(1), 3));
        const water = new THREE.Mesh(
          waterGeo,
          new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.55, metalness: 0.02 }),
        );
        water.rotation.x = -Math.PI / 2;
        water.position.y = -0.52;
        water.receiveShadow = true;
        gameRoot.add(water);

        const grassGeo = new THREE.CircleGeometry(26, 96);
        {
          const colors: number[] = [];
          const base = new THREE.Color(0x79c06c);
          const alt = new THREE.Color(0x67ae5d);
          const pos = grassGeo.attributes.position;
          for (let i = 0; i < pos.count; i += 1) {
            const n = Math.sin(pos.getX(i) * 0.7) * Math.cos(pos.getY(i) * 0.8);
            const c = base.clone().lerp(alt, (n + 1) / 2);
            colors.push(c.r, c.g, c.b);
          }
          grassGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
        }
        const grass = new THREE.Mesh(grassGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
        grass.rotation.x = -Math.PI / 2;
        grass.receiveShadow = true;
        gameRoot.add(grass);

        const beach = new THREE.Mesh(
          new THREE.RingGeometry(25.5, 30, 96),
          new THREE.MeshStandardMaterial({ color: 0xecd9a8, roughness: 1 }),
        );
        beach.rotation.x = -Math.PI / 2;
        beach.position.y = -0.03;
        beach.receiveShadow = true;
        gameRoot.add(beach);

        const plaza = new THREE.Mesh(
          new THREE.CircleGeometry(6.2, 48),
          new THREE.MeshStandardMaterial({ color: 0xd9c391, roughness: 1 }),
        );
        plaza.rotation.x = -Math.PI / 2;
        plaza.position.set(0, 0.012, -1.5);
        plaza.receiveShadow = true;
        gameRoot.add(plaza);

        const riverGeo = new THREE.PlaneGeometry(RIVER_X1 - RIVER_X0, 58, 3, 44);
        riverGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(riverGeo.attributes.position.count * 3).fill(1), 3));
        const river = new THREE.Mesh(
          riverGeo,
          new THREE.MeshStandardMaterial({ color: 0xf2f7f9, vertexColors: true, roughness: 0.75, transparent: true, opacity: 0.9 }),
        );
        river.rotation.x = -Math.PI / 2;
        river.position.set((RIVER_X0 + RIVER_X1) / 2, 0.018, 0);
        gameRoot.add(river);

        // Illustrated wave glyphs — white arcs drawn ON TOP of the water,
        // fading in and out as they drift (the Animal Crossing sea look).
        const rand = (seed: number) => {
          const v = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
          return v - Math.floor(v);
        };
        type WaveGlyph = { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number; dur: number; seed: number };
        const glyphGeo = new THREE.TorusGeometry(1.5, 0.07, 6, 26, Math.PI * 0.5);
        const waveGlyphs: WaveGlyph[] = [];
        const respawnGlyph = (glyph: WaveGlyph) => {
          glyph.seed += 17.31;
          const angle = rand(glyph.seed) * Math.PI * 2;
          const radius = 33 + rand(glyph.seed + 1) * 34;
          glyph.mesh.position.set(Math.cos(angle) * radius, -0.4, Math.sin(angle) * radius);
          glyph.mesh.rotation.z = rand(glyph.seed + 2) * Math.PI * 2;
          glyph.dur = 3.5 + rand(glyph.seed + 3) * 2.5;
          glyph.t = 0;
          glyph.mesh.scale.setScalar(0.8 + rand(glyph.seed + 4) * 0.9);
        };
        for (let i = 0; i < 16; i += 1) {
          const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
          const mesh = new THREE.Mesh(glyphGeo, mat);
          mesh.rotation.x = -Math.PI / 2;
          gameRoot.add(mesh);
          const glyph: WaveGlyph = { mesh, mat, t: 0, dur: 4, seed: i * 3.7 };
          respawnGlyph(glyph);
          glyph.t = rand(i * 9.1) * glyph.dur; // desync starts
          waveGlyphs.push(glyph);
        }
        // Short white dashes drifting down the river current.
        const riverDashGeo = new THREE.PlaneGeometry(0.08, 0.9);
        const riverDashes: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; z: number; x: number; speed: number }[] = [];
        for (let i = 0; i < 5; i += 1) {
          const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });
          const mesh = new THREE.Mesh(riverDashGeo, mat);
          mesh.rotation.x = -Math.PI / 2;
          gameRoot.add(mesh);
          riverDashes.push({ mesh, mat, z: -26 + i * 11, x: RIVER_X0 + 1 + rand(i * 5.3) * 3, speed: 1.6 + rand(i * 2.9) * 0.9 });
        }
        // AC-style shore: staggered foam rings roll in toward the beach.
        type ShoreWave = { ring: THREE.Mesh; mat: THREE.MeshBasicMaterial; phase: number };
        const shoreWaves: ShoreWave[] = [0, 0.33, 0.66].map((phase) => {
          const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
          const ring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1.005, 96), mat);
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = -0.4;
          gameRoot.add(ring);
          return { ring, mat, phase };
        });

        // A background landscape of Mint assets rings the island: green
        // islets crowned with primeval trees and ferns at every horizon.
        const ISLETS: { x: number; z: number; r: number; trees: ("cedarTree" | "appleTree" | "orangeTree" | "giantFern")[] }[] = [
          { x: -70, z: -45, r: 10, trees: ["cedarTree", "cedarTree", "giantFern"] },
          { x: -82, z: 8, r: 12, trees: ["cedarTree", "appleTree", "cedarTree", "giantFern"] },
          { x: -58, z: 55, r: 8, trees: ["cedarTree", "giantFern"] },
          { x: -18, z: 74, r: 11, trees: ["appleTree", "cedarTree", "cedarTree"] },
          { x: 32, z: 68, r: 9, trees: ["cedarTree", "orangeTree", "giantFern"] },
          { x: 74, z: 40, r: 12, trees: ["cedarTree", "cedarTree", "appleTree", "giantFern"] },
          { x: 82, z: -18, r: 10, trees: ["orangeTree", "cedarTree", "giantFern"] },
          { x: 60, z: -58, r: 8, trees: ["cedarTree", "cedarTree"] },
          { x: 22, z: -66, r: 11, trees: ["cedarTree", "appleTree", "cedarTree", "giantFern"] },
          { x: -14, z: -72, r: 13, trees: ["cedarTree", "cedarTree", "orangeTree", "cedarTree"] },
          { x: -46, z: -62, r: 9, trees: ["cedarTree", "giantFern", "cedarTree"] },
        ];
        ISLETS.forEach((spec, isletIndex) => {
          const islet = new THREE.Group();
          const mound = new THREE.Mesh(
            new THREE.SphereGeometry(spec.r, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: 0x6fae63, roughness: 1 }),
          );
          mound.scale.y = 0.55;
          islet.add(mound);
          spec.trees.forEach((treeKey, treeIndex) => {
            const angle = isletIndex * 1.3 + treeIndex * 2.1;
            const radial = spec.r * (0.15 + 0.35 * ((treeIndex * 0.37) % 1));
            const tx = Math.cos(angle) * radial;
            const tz = Math.sin(angle) * radial;
            const surfaceY = Math.sqrt(Math.max(0, spec.r * spec.r - tx * tx - tz * tz)) * 0.55;
            const tree = fitHeight(sceneFor(ASSETS.props[treeKey]), treeKey === "giantFern" ? 3.4 : 6.5 + (treeIndex % 2) * 1.5);
            tree.position.set(tx, surfaceY - 0.4, tz);
            tree.rotation.y = angle * 2;
            disableShadowCast(tree);
            islet.add(tree);
          });
          islet.position.set(spec.x, -0.5, spec.z);
          gameRoot.add(islet);
        });

        // A distant smoking volcano sells the prehistoric horizon.
        const volcano = new THREE.Mesh(
          new THREE.ConeGeometry(16, 20, 24),
          new THREE.MeshStandardMaterial({ color: 0x7a6a5e, roughness: 1 }),
        );
        volcano.position.set(-72, 8.5, -48);
        gameRoot.add(volcano);
        const volcanoGlow = new THREE.Mesh(
          new THREE.ConeGeometry(4.2, 3.4, 20),
          new THREE.MeshBasicMaterial({ color: 0xff8a4d }),
        );
        volcanoGlow.position.set(-72, 18.4, -48);
        gameRoot.add(volcanoGlow);
        const smokePuffs: THREE.Mesh[] = [];
        const smokeMat = new THREE.MeshBasicMaterial({ color: 0xcfc4bd, transparent: true, opacity: 0.55 });
        for (let i = 0; i < 5; i += 1) {
          const puff = new THREE.Mesh(new THREE.SphereGeometry(2.4 + i * 0.5, 10, 8), smokeMat);
          puff.position.set(-72, 20 + i * 3.4, -48);
          gameRoot.add(puff);
          smokePuffs.push(puff);
        }

        // ---------- Mint buildings & props ----------
        type Blocker = { x: number; z: number; radius: number };
        const blockers: Blocker[] = [];
        const contentRoot = new THREE.Group();
        contentRoot.position.y = 0.015;
        gameRoot.add(contentRoot);

        for (const p of BUILDING_PLACEMENTS) {
          const building = fitMax(sceneFor(ASSETS.buildings[p.key as keyof typeof ASSETS.buildings]), p.size);
          building.position.set(p.x, 0, p.z);
          building.rotation.y = p.yaw;
          contentRoot.add(building);
          blockers.push({ x: p.x, z: p.z, radius: p.blocker });
        }
        const bridge = fitMax(sceneFor(ASSETS.buildings.bridge), 7.4);
        bridge.rotation.y = Math.PI / 2;
        bridge.position.set((RIVER_X0 + RIVER_X1) / 2, 0, BRIDGE_Z);
        contentRoot.add(bridge);

        // The player's own cottage: hidden on its plot until the fund is full.
        const ownHouse = fitMax(sceneFor(ASSETS.buildings.playerCottage), PLOT.size);
        ownHouse.position.set(PLOT.x, 0, PLOT.z);
        ownHouse.rotation.y = PLOT.yaw;
        ownHouse.visible = false;
        contentRoot.add(ownHouse);
        const plotSign = fitMax(sceneFor(ASSETS.props.signpost), 2.2);
        plotSign.position.set(PLOT.x, 0, PLOT.z);
        plotSign.rotation.y = PLOT.yaw;
        contentRoot.add(plotSign);
        const plotBlocker = { x: PLOT.x, z: PLOT.z, radius: 0.6 };
        blockers.push(plotBlocker);

        const lanternLights: THREE.PointLight[] = [];
        for (const p of PROP_PLACEMENTS) {
          const prop = fitMax(sceneFor(ASSETS.props[p.key as keyof typeof ASSETS.props]), p.size);
          prop.position.set(p.x, 0, p.z);
          prop.rotation.y = p.yaw;
          contentRoot.add(prop);
          if (p.blocker > 0) blockers.push({ x: p.x, z: p.z, radius: p.blocker });
          if (p.key === "lantern") {
            const light = new THREE.PointLight(0xffc46e, 0, 9, 2);
            light.position.set(p.x, 2.1, p.z);
            contentRoot.add(light);
            lanternLights.push(light);
          }
        }

        type FruitTree = { root: THREE.Object3D; kind: ItemType; x: number; z: number; stock: number; restockAt: number; shakeT: number };
        const fruitTrees: FruitTree[] = [];
        for (const t of FRUIT_TREES) {
          const path = t.kind === "apple" ? ASSETS.props.appleTree : ASSETS.props.orangeTree;
          const tree = fitHeight(sceneFor(path), 4.4);
          tree.position.set(t.x, 0, t.z);
          tree.rotation.y = Math.random() * Math.PI * 2;
          contentRoot.add(tree);
          blockers.push({ x: t.x, z: t.z, radius: 0.85 });
          fruitTrees.push({ root: tree, kind: t.kind, x: t.x, z: t.z, stock: 2, restockAt: 0, shakeT: 0 });
        }
        for (const [cx, cz] of CEDARS) {
          const cedar = fitHeight(sceneFor(ASSETS.props.cedarTree), 5);
          cedar.position.set(cx, 0, cz);
          cedar.rotation.y = Math.random() * Math.PI * 2;
          contentRoot.add(cedar);
          blockers.push({ x: cx, z: cz, radius: 0.9 });
        }

        // ---------- Player ----------
        const playerRoot = new THREE.Group();
        const playerModel = fitHeight(sceneFor(ASSETS.player.model), 1.25);
        playerRoot.add(playerModel);
        playerRoot.position.set(0, 0, 5);
        playerRoot.rotation.y = Math.PI;
        // Lives at scene root (not inside gameRoot) so it stays visible indoors.
        scene.add(playerRoot);

        let leftHand: THREE.Bone | null = null;
        let rightHand: THREE.Bone | null = null;
        let rightArm: THREE.Bone | null = null;
        playerModel.traverse((child) => {
          if (!(child as THREE.Bone).isBone) return;
          if (child.name === "LeftHand") leftHand = child as THREE.Bone;
          if (child.name === "RightHand") rightHand = child as THREE.Bone;
          if (child.name === "RightArm") rightArm = child as THREE.Bone;
        });
        if (!rightHand || !rightArm) throw new Error("Mint player rig is missing arm bones.");
        const rightHandBone: THREE.Bone = rightHand;
        const rightArmBone: THREE.Bone = rightArm;
        void leftHand;

        const playerMixer = new THREE.AnimationMixer(playerModel);
        const idleAction = playerMixer.clipAction(gltfs.get(ASSETS.player.idle)!.animations[0]);
        const runAction = playerMixer.clipAction(gltfs.get(ASSETS.player.run)!.animations[0]);
        idleAction.play();
        let playerAction = idleAction;
        const setPlayerAction = (next: THREE.AnimationAction) => {
          if (playerAction === next) return;
          next.reset().fadeIn(0.16).play();
          playerAction.fadeOut(0.16);
          playerAction = next;
        };
        // Procedural tool actions: a snappy 0.7s cast whip and 0.5s net sweep
        // applied directly to the arm bone after the mixer runs — always
        // visible, perfectly synced, no mocap wind-up theater.
        let toolAnimKind: "cast" | "swing" | null = null;
        let toolAnimT = 0;
        let toolAnimDur = 1;
        const startToolAnim = (kind: "cast" | "swing", dur: number) => {
          toolAnimKind = kind;
          toolAnimDur = dur;
          toolAnimT = dur;
        };
        const toolArmAxisX = new THREE.Vector3(1, 0, 0);
        const toolArmAxisY = new THREE.Vector3(0, 1, 0);
        const toolArmQuat = new THREE.Quaternion();
        const mixers: THREE.AnimationMixer[] = [playerMixer];

        // ---------- Villagers ----------
        type VillagerRuntime = {
          root: THREE.Object3D;
          data: (typeof VILLAGERS)[number];
          name: string;
          bubble: THREE.Group;
          bubbleItem: THREE.Object3D | null;
          request: { type: ItemType; count: number; createdAt: number } | null;
          nextRequestAt: number;
          bounceT: number;
          chatterAt: number;
        };
        const villagerRuntimes: VillagerRuntime[] = [];
        ASSETS.villagers.forEach((asset, index) => {
          const data = VILLAGERS[index];
          const root = fitHeight(sceneFor(asset.model), 1.12);
          root.position.set(data.x, 0, data.z);
          root.rotation.y = data.yaw;
          contentRoot.add(root);
          blockers.push({ x: data.x, z: data.z, radius: 0.7 });
          const mixer = new THREE.AnimationMixer(root);
          const clip = gltfs.get(asset.animation)!.animations[0].clone();
          // Gesture clips can carry root motion that slides or tips the whole
          // character — pin villagers by dropping hip/root translation tracks.
          clip.tracks = clip.tracks.filter((track) => !track.name.endsWith(".position"));
          const action = mixer.clipAction(clip);
          action.time = Math.random() * Math.max(clip.duration, 0.1);
          action.play();
          mixers.push(mixer);
          const bubble = new THREE.Group();
          bubble.position.set(data.x, 2.05, data.z);
          contentRoot.add(bubble);
          villagerRuntimes.push({
            root, data, name: asset.name, bubble, bubbleItem: null,
            request: null, nextRequestAt: 0, bounceT: 0, chatterAt: 0,
          });
        });

        // ---------- Collectible item templates & ground items ----------
        const templates: Record<ItemType, THREE.Object3D> = {
          apple: fitMax(sceneFor(ASSETS.props.apple), 0.42),
          orange: fitMax(sceneFor(ASSETS.props.orange), 0.42),
          shell: fitMax(sceneFor(ASSETS.props.shell), 0.5),
          parcel: fitMax(sceneFor(ASSETS.props.parcel), 0.55),
          fish: fitMax(sceneFor(ASSETS.props.fish), 0.58),
          bug: fitMax(sceneFor(ASSETS.props.dragonfly), 0.5),
        };

        // Stone-age tools are parented INTO the right hand bone so they move
        // with every animation frame instead of floating beside the player.
        const attachTool = (tool: THREE.Object3D, rot: [number, number, number], flip = false) => {
          prepare(tool);
          // Re-root the contents in a spin group so we can rotate around the
          // bbox center, stand the LONGEST axis up along +Y, then slide the
          // handle end down into the fist. No guessing about export axes.
          const spin = new THREE.Group();
          while (tool.children.length) spin.add(tool.children[0]);
          tool.add(spin);
          tool.updateMatrixWorld(true);
          // The models are exported at arbitrary diagonal orientations, so a
          // 90° axis swap isn't enough: find the true principal axis of the
          // vertex cloud (power iteration) and rotate it onto +Y.
          // Some Mint props export as little dioramas of disconnected parts —
          // keep the largest piece and its close neighbors, hide strays.
          const parts: { mesh: THREE.Mesh; center: THREE.Vector3; volume: number }[] = [];
          spin.updateMatrixWorld(true);
          spin.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh || !mesh.geometry?.attributes?.position) return;
            const bb = new THREE.Box3().setFromObject(mesh);
            const sz = bb.getSize(new THREE.Vector3());
            parts.push({ mesh, center: bb.getCenter(new THREE.Vector3()), volume: sz.x * sz.y * sz.z });
          });
          const main = parts.reduce((a, b) => (b.volume > a.volume ? b : a), parts[0]);
          if (main) {
            parts.forEach((part) => {
              if (part.mesh !== main.mesh && part.center.distanceTo(main.center) > 0.38) part.mesh.visible = false;
            });
          }
          const pts: THREE.Vector3[] = [];
          spin.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh || !mesh.visible || !mesh.geometry?.attributes?.position) return;
            const posAttr = mesh.geometry.attributes.position;
            const step = Math.max(1, Math.floor(posAttr.count / 250));
            for (let i = 0; i < posAttr.count; i += step) {
              pts.push(new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)).applyMatrix4(mesh.matrixWorld));
            }
          });
          const mean = new THREE.Vector3();
          pts.forEach((q) => mean.add(q));
          mean.multiplyScalar(1 / Math.max(1, pts.length));
          let axis = new THREE.Vector3(0.3, 1, 0.2).normalize();
          const scratch = new THREE.Vector3();
          for (let iter = 0; iter < 14; iter += 1) {
            const next = new THREE.Vector3();
            for (const q of pts) {
              scratch.copy(q).sub(mean);
              next.addScaledVector(scratch, scratch.dot(axis));
            }
            axis = next.normalize();
          }
          if (axis.y < 0) axis.multiplyScalar(-1);
          spin.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(axis, new THREE.Vector3(0, 1, 0)));
          if (flip) spin.rotateX(Math.PI); // business end up, handle down
          tool.updateMatrixWorld(true);
          const after = new THREE.Box3();
          spin.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh && mesh.visible) after.expandByObject(mesh);
          });
          spin.position.y -= after.min.y + 0.1; // grip: bottom 10cm sits in the hand
          spin.position.x -= (after.min.x + after.max.x) / 2;
          spin.position.z -= (after.min.z + after.max.z) / 2;
          rightHandBone.add(tool);
          const boneScale = rightHandBone.getWorldScale(new THREE.Vector3()).x || 1;
          tool.scale.setScalar(1 / boneScale);
          tool.rotation.set(rot[0], rot[1], rot[2]);
          tool.position.set(0.02, 0.04, 0.03); // nestle into the palm
          tool.visible = false;
          return tool;
        };
        const rodProp = attachTool(fitMax(sceneFor(ASSETS.props.fishingRod), 0.72), [0.35, 0.1, -0.3]);
        const netProp = attachTool(fitMax(sceneFor(ASSETS.props.bugNet), 0.66), [0.35, 0.1, -0.3], true);
        const saplingTemplate = fitHeight(sceneFor(ASSETS.props.sapling), 0.8);
        let netFlashT = 0;

        type GroundItem = {
          obj: THREE.Object3D; type: ItemType; state: "drop" | "idle";
          t: number; from: THREE.Vector3; to: THREE.Vector3;
          offset: number; addressee?: number; shellSpot?: number;
        };
        const itemRoot = new THREE.Group();
        contentRoot.add(itemRoot);
        let groundItems: GroundItem[] = [];
        const spawnItem = (type: ItemType, x: number, z: number, extra: Partial<GroundItem> = {}) => {
          const obj = templates[type].clone(true);
          obj.position.set(x, 0.03, z);
          itemRoot.add(obj);
          const item: GroundItem = {
            obj, type, state: "idle", t: 0,
            from: new THREE.Vector3(), to: new THREE.Vector3(x, 0.03, z),
            offset: Math.random() * Math.PI * 2, ...extra,
          };
          groundItems.push(item);
          return item;
        };
        const dropItem = (type: ItemType, fromX: number, fromZ: number, toX: number, toZ: number) => {
          const item = spawnItem(type, fromX, fromZ);
          item.state = "drop";
          item.from.set(fromX, 2.6, fromZ);
          item.to.set(toX, 0.03, toZ);
          item.obj.position.copy(item.from);
        };

        type ShellSpot = { x: number; z: number; respawnAt: number; filled: boolean };
        const shellSpots: ShellSpot[] = SHELL_SPOTS.map(([x, z]) => ({ x, z, respawnAt: 0, filled: false }));

        // ---------- Swimming fish (AC-style catching) ----------
        type SwimFish = {
          obj: THREE.Object3D; zone: (typeof FISH_ZONES)[number];
          x: number; z: number; angle: number; speed: number;
          state: "swim" | "lured" | "biting" | "gone"; stateT: number; respawnAt: number;
          nibbles: number; nextNibbleAt: number; biteUntil: number;
        };
        const fishTemplate = fitMax(sceneFor(ASSETS.props.fish), 0.62);
        const swimFish: SwimFish[] = [0, 1, 2, 0].map((zoneIndex, i) => {
          const zone = FISH_ZONES[zoneIndex];
          const obj = fishTemplate.clone(true);
          disableShadowCast(obj);
          gameRoot.add(obj);
          return {
            obj, zone,
            x: THREE.MathUtils.lerp(zone.x0, zone.x1, 0.3 + 0.4 * ((i * 0.37) % 1)),
            z: THREE.MathUtils.lerp(zone.z0, zone.z1, 0.2 + 0.6 * ((i * 0.61) % 1)),
            angle: i * 1.9, speed: 0.55 + (i % 3) * 0.18,
            state: "swim", stateT: 0, respawnAt: 0, nibbles: 0, nextNibbleAt: 0, biteUntil: 0,
          };
        });
        const bobber = new THREE.Group();
        {
          const ball = new THREE.Mesh(
            new THREE.SphereGeometry(0.09, 12, 10),
            new THREE.MeshStandardMaterial({ color: 0xfdf6e3, roughness: 0.6 }),
          );
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.14, 0.2, 20),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = -0.04;
          bobber.add(ball, ring);
        }
        bobber.visible = false;
        gameRoot.add(bobber);
        let luredFish: SwimFish | null = null;
        let lastCastPromptAt = -10;
        let bobberDipT = 0;
        let bobberBaseY = 0;
        const nibbleAudio = new Audio(ASSETS.audio.splash);
        nibbleAudio.volume = 0.16;

        // ---------- Catchable Mint dragonflies ----------
        type CatchableBug = { root: THREE.Object3D; anchor: { x: number; z: number }; caught: boolean; respawnAt: number; phase: number; alarm: number };
        const catchableBugs: CatchableBug[] = DRAGONFLY_SPOTS.map((s, i) => {
          const root = templates.bug.clone(true);
          root.scale.multiplyScalar(1.25);
          contentRoot.add(root);
          return { root, anchor: s, caught: false, respawnAt: 0, phase: i * 2.1, alarm: 0 };
        });

        // ---------- Soil patches: plant carried fruit, grow a new tree ----------
        type SoilSpot = {
          x: number; z: number; state: "empty" | "growing" | "grown";
          kind: "apple" | "orange" | null; plantedAt: number;
          marker: THREE.Mesh; sapling: THREE.Object3D | null;
        };
        const soilSpots: SoilSpot[] = SOIL_SPOTS.map((s) => {
          const marker = new THREE.Mesh(
            new THREE.CircleGeometry(0.95, 24),
            new THREE.MeshStandardMaterial({ color: 0x8a6b4d, roughness: 1 }),
          );
          marker.rotation.x = -Math.PI / 2;
          marker.position.set(s.x, 0.02, s.z);
          contentRoot.add(marker);
          return { x: s.x, z: s.z, state: "empty", kind: null, plantedAt: 0, marker, sapling: null };
        });
        type PlantedGrowth = { tree: THREE.Object3D; blocker: { x: number; z: number; radius: number }; spot: SoilSpot };
        const plantedGrowth: PlantedGrowth[] = [];

        // ---------- Carried items ----------
        // Pockets: unlimited invisible inventory — items vanish when picked
        // up and the character keeps their normal walk/run animation.
        let carried: ItemType[] = [];
        let carriedParcelAddressee: number | null = null;
        const refreshCarried = () => undefined;

        // ---------- Ambient life (procedural particles, flagged in manifest) ----------
        const butterflyRoot = new THREE.Group();
        contentRoot.add(butterflyRoot);
        type Flutter = { group: THREE.Group; wings: THREE.Mesh[]; anchor: THREE.Vector3; speed: number; phase: number; radius: number };
        const butterflies: Flutter[] = [];
        const tulipSpots = PROP_PLACEMENTS.filter((p) => p.key === "tulips");
        for (let i = 0; i < 6; i += 1) {
          const group = new THREE.Group();
          const wingGeo = new THREE.PlaneGeometry(0.14, 0.11);
          const wingMat = new THREE.MeshBasicMaterial({
            color: i % 2 ? 0xf28d77 : 0xf4c542, side: THREE.DoubleSide, transparent: true, opacity: 0.95,
          });
          const w1 = new THREE.Mesh(wingGeo, wingMat);
          const w2 = new THREE.Mesh(wingGeo, wingMat);
          w1.position.x = -0.07;
          w2.position.x = 0.07;
          group.add(w1, w2);
          butterflyRoot.add(group);
          const spot = tulipSpots[i % tulipSpots.length];
          butterflies.push({
            group, wings: [w1, w2],
            anchor: new THREE.Vector3(spot.x, 0.75, spot.z),
            speed: 0.5 + Math.random() * 0.5, phase: Math.random() * Math.PI * 2, radius: 0.7 + Math.random() * 0.7,
          });
        }

        type Leaf = { mesh: THREE.Mesh; tree: FruitTree; y: number; sway: number; speed: number };
        const leaves: Leaf[] = [];
        const leafGeo = new THREE.PlaneGeometry(0.1, 0.1);
        for (let i = 0; i < 14; i += 1) {
          const mesh = new THREE.Mesh(leafGeo, new THREE.MeshBasicMaterial({
            color: i % 3 ? 0x86c46f : 0xd8a24e, side: THREE.DoubleSide, transparent: true, opacity: 0.9,
          }));
          contentRoot.add(mesh);
          const tree = fruitTrees[i % fruitTrees.length];
          leaves.push({ mesh, tree, y: Math.random() * 3.4, sway: Math.random() * Math.PI * 2, speed: 0.35 + Math.random() * 0.3 });
        }

        type Gull = { group: THREE.Group; wings: THREE.Mesh[]; radius: number; height: number; speed: number; phase: number };
        const gulls: Gull[] = [];
        for (let i = 0; i < 3; i += 1) {
          const group = new THREE.Group();
          const wingGeo = new THREE.PlaneGeometry(0.7, 0.22);
          const wingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
          const w1 = new THREE.Mesh(wingGeo, wingMat);
          const w2 = new THREE.Mesh(wingGeo, wingMat);
          w1.position.x = -0.34;
          w2.position.x = 0.34;
          group.add(w1, w2);
          scene.add(group);
          gulls.push({ group, wings: [w1, w2], radius: 32 + i * 4, height: 13 + i * 2, speed: 0.1 + i * 0.03, phase: i * 2.1 });
        }

        const clouds: THREE.Group[] = [];
        for (let i = 0; i < 6; i += 1) {
          const group = new THREE.Group();
          const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88 });
          for (let j = 0; j < 3; j += 1) {
            const puff = new THREE.Mesh(new THREE.SphereGeometry(1.6 + Math.random() * 1.4, 12, 10), mat);
            puff.scale.y = 0.4;
            puff.position.set(j * 1.9 - 1.9, Math.random() * 0.4, Math.random() * 1.2);
            group.add(puff);
          }
          group.position.set(Math.random() * 120 - 60, 22 + Math.random() * 5, Math.random() * 120 - 60);
          scene.add(group);
          clouds.push(group);
        }

        type Firework = { points: THREE.Points; velocities: Float32Array; life: number };
        const fireworks: Firework[] = [];
        const spawnFirework = () => {
          const count = 130;
          const positions = new Float32Array(count * 3);
          const velocities = new Float32Array(count * 3);
          const cx = Math.random() * 20 - 10;
          const cy = 8 + Math.random() * 5;
          const cz = Math.random() * 16 - 10;
          for (let i = 0; i < count; i += 1) {
            positions[i * 3] = cx;
            positions[i * 3 + 1] = cy;
            positions[i * 3 + 2] = cz;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const speed = 3.2 + Math.random() * 2.6;
            velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
            velocities[i * 3 + 1] = Math.cos(phi) * speed;
            velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
          }
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
          const colorsPick = [0xf28d77, 0xf4c542, 0x6fbf73, 0x9ad0f0, 0xd88fd0];
          const mat = new THREE.PointsMaterial({
            color: colorsPick[Math.floor(Math.random() * colorsPick.length)],
            size: 0.5, transparent: true, opacity: 1,
          });
          const points = new THREE.Points(geo, mat);
          scene.add(points);
          fireworks.push({ points, velocities, life: 1.6 });
        };

        // ---------- Interior ("template house") mode ----------
        const INTERIOR_Y = 200;
        const interiorRoot = new THREE.Group();
        interiorRoot.position.set(0, INTERIOR_Y, 0);
        interiorRoot.visible = false;
        scene.add(interiorRoot);
        const interiorFloor = new THREE.Mesh(
          new THREE.CircleGeometry(3.2, 32),
          new THREE.MeshStandardMaterial({ color: 0xc9a97a, roughness: 0.9 }),
        );
        interiorFloor.rotation.x = -Math.PI / 2;
        interiorRoot.add(interiorFloor);
        const interiorLight = new THREE.PointLight(0xffd9a0, 30, 14, 2);
        interiorLight.position.set(0, 2.6, 0);
        interiorRoot.add(interiorLight);
        let insideDoor: (typeof DOORS)[number] | null = null;
        let doorCooldown = 0;
        // Every door leads into its OWN Mint world gaussian splat (SparkJS
        // paged RAD, integrationMode: remote_stream), loaded lazily on first
        // entry so the 40MB+ streams only start when a player steps inside.
        const INTERIOR_WORLDS: Record<string, string> = {
          own: "https://cdn.mint.gg/rad/prehistoric-cave-home-68a2597309f7e409-lod.rad",
          yellow: "https://cdn.mint.gg/rad/flintstones-stegosaurus-home-8d12bd231db84843-lod.rad",
          coral: "https://cdn.mint.gg/rad/triceratops-cave-home-3bddffa781b1c3b4-lod.rad",
          shop: "https://cdn.mint.gg/rad/stone-age-general-store-f19af1bb663ca7bf-lod.rad",
          museum: "https://cdn.mint.gg/rad/flintstones-fossil-hall-4c7a9bff29991c17-lod.rad",
        };
        // Invisible collider meshes shipped with each world — walkable bounds
        // come from the actual room geometry, not a guessed circle.
        const INTERIOR_COLLIDERS: Record<string, string> = {
          own: "https://cdn.mint.gg/worlds/flintstones-cave-home-collider-glb-362780d9a0eca593.glb",
          yellow: "https://cdn.mint.gg/worlds/flintstones-cave-home-collider-glb-58f1004e5e48a3e5.glb",
          coral: "https://cdn.mint.gg/worlds/triceratops-cave-home-collider-glb-588b89d56e56177f.glb",
          shop: "https://cdn.mint.gg/worlds/stone-age-general-store-collider-glb-f5b8a3436a3d3deb.glb",
          museum: "https://cdn.mint.gg/worlds/flintstones-fossil-hall-collider-glb-4d7a371579074853.glb",
        };
        const interiorColliders = new Map<string, THREE.Object3D>();
        const colliderLoader = new GLTFLoader();
        const loadInteriorCollider = (key: string) => {
          if (interiorColliders.has(key) || !INTERIOR_COLLIDERS[key]) return;
          colliderLoader.load(INTERIOR_COLLIDERS[key], (gltf) => {
            if (disposed) return;
            const collider = gltf.scene;
            collider.traverse((child) => {
              const mesh = child as THREE.Mesh;
              if (mesh.isMesh) {
                mesh.material = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
              }
            });
            collider.quaternion.set(1, 0, 0, 0); // same transform as the splat
            collider.position.set(0, 1.5, 0);
            roomFor(key).add(collider);
            interiorColliders.set(key, collider);
          }, undefined, (error) => console.warn("Interior collider failed:", key, error));
        };
        // Warm every room in the background shortly after the island loads —
        // first door entry becomes a reveal instead of a stall.
        Object.keys(INTERIOR_WORLDS).forEach((key, index) => {
          if (!INTERIOR_WORLDS[key]) return;
          const warmTimer = window.setTimeout(() => {
            if (!disposed) {
              loadInteriorCollider(key);
              warmSplat(key);
            }
          }, 4000 + index * 5000);
          timers.push(warmTimer);
        });
        // Exit doormat: you appear on it; step off, and step back on to leave.
        const exitPad = new THREE.Mesh(
          new THREE.RingGeometry(0.5, 0.72, 28),
          new THREE.MeshBasicMaterial({ color: 0xffd97a, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
        );
        exitPad.rotation.x = -Math.PI / 2;
        exitPad.position.set(0, 0.06, 0.8);
        interiorRoot.add(exitPad);
        let enteredAt = 0;
        let steppedOffPad = false;
        const floorRaycaster = new THREE.Raycaster();
        const floorRayOrigin = new THREE.Vector3();
        const FLOOR_DOWN = new THREE.Vector3(0, -1, 0);
        const interiorFloorY = (x: number, z: number): number | null => {
          const collider = insideDoor ? interiorColliders.get(insideDoor.key) : undefined;
          if (!collider) return null;
          floorRayOrigin.set(x, INTERIOR_Y + 1.25, z);
          floorRaycaster.set(floorRayOrigin, FLOOR_DOWN);
          floorRaycaster.far = 3.5;
          const hits = floorRaycaster.intersectObject(collider, true);
          return hits.length ? hits[0].point.y : null;
        };
        // Splat rooms are captured a bit oversized for a 1.25m kid — scale
        // each room (splat + collider together) down to child proportions.
        const INTERIOR_SCALE = 1.25;
        const interiorRooms = new Map<string, THREE.Group>();
        const roomFor = (key: string) => {
          let room = interiorRooms.get(key);
          if (!room) {
            room = new THREE.Group();
            room.scale.setScalar(INTERIOR_SCALE);
            interiorRoot.add(room);
            interiorRooms.set(key, room);
          }
          return room;
        };
        const interiorSplats = new Map<string, THREE.Object3D>();
        // Spark 2.1's emitted declarations use an older Three object shape.
        // Adapt its runtime constructors once so clean installs share this app's
        // exact Object3D and WebGLRenderer types without weakening scene code.
        let sparkModule: Promise<SparkRuntimeModule | null> | null = null;
        const loadSpark = () => {
          sparkModule ??= import("@sparkjsdev/spark")
            .then((spark) => {
              const mod = spark as unknown as SparkRuntimeModule;
              scene.add(new mod.SparkRenderer({ renderer }));
              return mod;
            })
            .catch((error) => {
              console.warn("Spark splat renderer unavailable:", error);
              return null;
            });
          return sparkModule;
        };
        const warmSplat = (key: string) => {
          if (interiorSplats.has(key) || !INTERIOR_WORLDS[key]) return;
          void loadSpark().then((mod) => {
            if (!mod || disposed || interiorSplats.has(key)) return;
            const splat = new mod.SplatMesh({ url: INTERIOR_WORLDS[key] });
            splat.quaternion.set(1, 0, 0, 0);
            splat.position.set(0, 1.5, 0);
            interiorSplats.set(key, splat);
            const room = roomFor(key);
            room.add(splat);
            room.visible = false;
          });
        };
        const showInterior = (key: string) => {
          interiorRooms.forEach((room, k) => { room.visible = k === key; });
          loadInteriorCollider(key);
          if (interiorSplats.has(key) || !INTERIOR_WORLDS[key]) return;
          void loadSpark().then((mod) => {
            if (!mod || disposed || interiorSplats.has(key)) return;
            const splat = new mod.SplatMesh({ url: INTERIOR_WORLDS[key] });
            splat.quaternion.set(1, 0, 0, 0); // splat convention: 180° X flip
            splat.position.set(0, 1.5, 0);
            interiorSplats.set(key, splat);
            roomFor(key).add(splat);
            // Keep the placeholder floor + light until the stream arrives, so
            // first entry is a cozy candle-lit wait instead of a black void.
            void splat.initialized?.then(() => {
              if (!disposed) interiorFloor.visible = false;
            });
            if (new URLSearchParams(location.search).has("qa")) {
              (window as unknown as Record<string, unknown>).__splat = splat;
            }
          });
        };
        // ---------- Game state ----------
        let phase: Phase = "ready";
        let running = false;
        let coins = 0;
        let soundOn = true;
        let elapsed = 0;
        let lastUiPush = 0;
        let celebrationEnd = 0;
        let nextFireworkAt = 0;
        let houseBuilt = false;
        let houseBuildT = 1;

        const requestChips = (): RequestChip[] =>
          villagerRuntimes
            .filter((v) => v.request)
            .map((v) => ({ villager: v.name, type: v.request!.type, count: v.request!.count }));

        const pushUi = (extra: Partial<Ui> = {}) => {
          if (disposed) return;
          setUi((value) => ({
            ...value,
            phase, coins, carried: [...carried], houseBuilt, inside: insideDoor !== null,
            sound: soundOn, loading: "Mint assets ready", requests: requestChips(), ...extra,
          }));
        };
        const play = (key: keyof typeof audio, restart = true) => {
          if (!soundOn) return;
          if (restart) audio[key].currentTime = 0;
          void audio[key].play().catch(() => undefined);
        };
        const toast = (message: string) => {
          window.clearTimeout(toastTimer);
          pushUi({ toast: message });
          toastTimer = window.setTimeout(() => pushUi({ toast: "" }), 2000);
          timers.push(toastTimer);
        };
        let bannerTimer = 0;
        const banner = (emoji: string, line: string) => {
          window.clearTimeout(bannerTimer);
          play("jingle");
          pushUi({ catchBanner: { emoji, line } });
          bannerTimer = window.setTimeout(() => pushUi({ catchBanner: null }), 3200);
          timers.push(bannerTimer);
        };
        const banter = (speaker: string, line: string) => {
          window.clearTimeout(banterTimer);
          pushUi({ banter: { speaker, line } });
          banterTimer = window.setTimeout(() => pushUi({ banter: null }), 3200);
          timers.push(banterTimer);
          play("babble");
        };

        const setBubble = (v: VillagerRuntime) => {
          while (v.bubble.children.length) v.bubble.remove(v.bubble.children[0]);
          v.bubbleItem = null;
          if (!v.request) return;
          const holder = new THREE.Group();
          for (let i = 0; i < v.request.count; i += 1) {
            const mini = templates[v.request.type].clone(true);
            disableShadowCast(mini);
            mini.scale.multiplyScalar(0.72);
            mini.position.x = (i - (v.request.count - 1) / 2) * 0.42;
            holder.add(mini);
          }
          v.bubble.add(holder);
          v.bubbleItem = holder;
        };
        const giveRequest = (v: VillagerRuntime, type: ItemType, count: number) => {
          v.request = { type, count, createdAt: elapsed };
          setBubble(v);
        };
        const randomRequest = (v: VillagerRuntime) => {
          const roll = Math.random();
          const type: ItemType =
            roll < 0.26 ? "apple" : roll < 0.46 ? "shell" : roll < 0.6 ? "orange" : roll < 0.82 ? "fish" : "bug";
          const single = type === "orange" || type === "fish" || type === "bug";
          giveRequest(v, type, single ? 1 : Math.random() < 0.45 ? 2 : 1);
        };

        const resetWorld = () => {
          groundItems.forEach((item) => itemRoot.remove(item.obj));
          groundItems = [];
          carried = [];
          carriedParcelAddressee = null;
          refreshCarried();
          shellSpots.forEach((spot) => {
            spawnItem("shell", spot.x, spot.z, { shellSpot: shellSpots.indexOf(spot) });
            spot.filled = true;
          });
          PARCELS.forEach((p) => spawnItem("parcel", p.x, p.z, { addressee: p.addressee }));
          fruitTrees.forEach((tree) => {
            tree.stock = 2;
            tree.restockAt = 0;
            tree.shakeT = 0;
          });
          villagerRuntimes.forEach((v, i) => {
            v.request = null;
            v.nextRequestAt = 0;
            v.bounceT = 0;
            setBubble(v);
            void i;
          });
          giveRequest(villagerRuntimes[0], "apple", 2);
          giveRequest(villagerRuntimes[2], "fish", 1);
          giveRequest(villagerRuntimes[1], "orange", 1);
          villagerRuntimes[3].nextRequestAt = 24;
          fireworks.forEach((f) => scene.remove(f.points));
          fireworks.length = 0;
          // New-mechanic state resets.
          luredFish = null;
          bobber.visible = false;
          netFlashT = 0;
          swimFish.forEach((fish) => {
            fish.state = "swim";
            fish.obj.visible = true;
            fish.respawnAt = 0;
          });
          catchableBugs.forEach((bug) => {
            bug.caught = false;
            bug.respawnAt = 0;
            bug.root.visible = true;
          });
          plantedGrowth.forEach((growth) => {
            contentRoot.remove(growth.tree);
            const bIndex = blockers.indexOf(growth.blocker);
            if (bIndex !== -1) blockers.splice(bIndex, 1);
            const tIndex = fruitTrees.findIndex((t) => t.root === growth.tree);
            if (tIndex !== -1) fruitTrees.splice(tIndex, 1);
          });
          plantedGrowth.length = 0;
          soilSpots.forEach((spot) => {
            if (spot.sapling) contentRoot.remove(spot.sapling);
            spot.sapling = null;
            spot.state = "empty";
            spot.kind = null;
            spot.plantedAt = 0;
          });
        };

        const begin = () => {
          phase = "playing";
          running = true;
          coins = 0;
          elapsed = 0;
          houseBuilt = false;
          houseBuildT = 1;
          ownHouse.visible = false;
          plotSign.visible = true;
          plotBlocker.radius = 0.6;
          insideDoor = null;
          interiorRoot.visible = false;
          gameRoot.visible = true;
          playerRoot.position.set(0, 0, 5);
          playerRoot.rotation.y = Math.PI;
          resetWorld();
          audio.music.currentTime = 0;
          play("music", false);
          play("shore", false);
          toast("Earn 420 coins helping the dinos to get your own boulder hut!");
          pushUi();
        };

        const collect = (item: GroundItem) => {
          if (!running) return false;
          carried.push(item.type);
          if (item.type === "parcel" && item.addressee !== undefined) {
            carriedParcelAddressee = item.addressee;
            toast(`A lost dino egg — return it to ${villagerRuntimes[item.addressee].name}!`);
          } else {
            toast(`${ITEM_EMOJI[item.type]} ${ITEM_NAME[item.type]} pocketed!`);
          }
          if (item.shellSpot !== undefined) {
            shellSpots[item.shellSpot].filled = false;
            shellSpots[item.shellSpot].respawnAt = elapsed + 22;
          }
          itemRoot.remove(item.obj);
          groundItems = groundItems.filter((g) => g !== item);
          refreshCarried();
          play("pickup");
          pushUi();
          return true;
        };

        const reachGoal = () => {
          if (houseBuilt) return;
          phase = "celebrating";
          houseBuilt = true;
          houseBuildT = 0;
          ownHouse.visible = true;
          ownHouse.scale.setScalar(0.001);
          plotSign.visible = false;
          plotBlocker.radius = PLOT.blocker;
          celebrationEnd = elapsed + 6;
          nextFireworkAt = 0;
          play("jingle");
          toast("THE FUND IS FULL — MAPLE IS RAISING YOUR COTTAGE!");
          pushUi();
        };

        const deliverTo = (v: VillagerRuntime) => {
          if (!running) return;
          // Parcels first: they beat regular requests when the addressee is near.
          const vIndex = villagerRuntimes.indexOf(v);
          if (carriedParcelAddressee === vIndex && carried.includes("parcel")) {
            carried.splice(carried.indexOf("parcel"), 1);
            carriedParcelAddressee = carried.includes("parcel") ? carriedParcelAddressee : null;
            coins += 80;
            v.bounceT = 0.5;
            refreshCarried();
            play("coin");
            play("jingle");
            banter(v.name, v.data.thanks[Math.floor(Math.random() * v.data.thanks.length)]);
            toast("Dino egg returned · +80 coins!");
            if (coins >= HOUSE_COST) reachGoal();
            pushUi();
            return;
          }
          if (!v.request) return;
          const type = v.request.type;
          let delivered = 0;
          while (v.request.count > 0 && carried.includes(type)) {
            carried.splice(carried.indexOf(type), 1);
            v.request.count -= 1;
            delivered += 1;
          }
          if (!delivered) return;
          const quick = elapsed - v.request.createdAt < 20 ? 30 : 0;
          coins += delivered * 60 + (v.request.count === 0 ? quick : 0);
          v.bounceT = 0.5;
          refreshCarried();
          play("coin");
          if (v.request.count === 0) {
            v.request = null;
            v.nextRequestAt = elapsed + 7;
            setBubble(v);
            play("jingle");
            banter(v.name, v.data.thanks[Math.floor(Math.random() * v.data.thanks.length)]);
            toast(quick ? `Wish granted fast · +${delivered * 60 + quick} coins!` : `Wish granted · +${delivered * 60} coins!`);
          } else {
            setBubble(v);
            toast(`${delivered} delivered · ${v.request.count} more ${ITEM_EMOJI[type]} to go`);
          }
          if (coins >= HOUSE_COST) reachGoal();
          pushUi();
        };

        if (new URLSearchParams(location.search).has("qa")) {
          (window as unknown as Record<string, unknown>).__mc = {
            player: playerRoot,
            pressed,
            villagers: villagerRuntimes,
            fish: swimFish,
            camera,
            rod: rodProp,
            net: netProp,
            setFreezeCam: (v: boolean) => { qaFreezeCam = v; },
            state: () => ({ phase, running, coins, houseBuilt, inside: insideDoor?.key ?? null, carried: [...carried] }),
          };
        }
        const resume = () => {
          phase = "playing";
          pushUi();
        };

        controllerRef.current = {
          start: begin,
          resume,
          action: () => { actionQueued = true; },
          toggleSound: () => {
            soundOn = !soundOn;
            if (!soundOn) Object.values(audio).forEach((a) => a.pause());
            else if (running) {
              play("music", false);
              play("shore", false);
            }
            pushUi();
          },
          setDirection: (direction, value) => { pressed[direction] = value; },
        };

        const keyMap: Record<string, Direction> = {
          w: "forward", arrowup: "forward",
          s: "back", arrowdown: "back",
          a: "left", arrowleft: "left",
          d: "right", arrowright: "right",
        };
        const onKey = (event: KeyboardEvent, down: boolean) => {
          const qa = new URLSearchParams(location.search).has("qa");
          const key = event.key.toLowerCase();
          if (down && qa && key === "q") {
            // Grab whatever the nearest open request needs.
            const wanting = villagerRuntimes.find((v) => v.request);
            if (wanting?.request) {
              const need = wanting.request.type;
              while (carried.filter((c) => c === need).length < wanting.request.count) carried.push(need);
              refreshCarried();
              pushUi();
            }
            return;
          }
          if (down && qa && key === "e") {
            let nearest: VillagerRuntime | null = null;
            let best = Infinity;
            villagerRuntimes.forEach((v) => {
              const d = Math.hypot(v.data.x - playerRoot.position.x, v.data.z - playerRoot.position.z);
              if (d < best) { best = d; nearest = v; }
            });
            if (nearest) deliverTo(nearest);
            return;
          }
          if (down && qa && key === "f") { elapsed = DAY_CYCLE / 2; return; }
          if (down && qa && key === "g") { playerRoot.position.set(18, 0, 2); return; }
          if (down && qa && key === "y") { coins += 200; if (coins >= HOUSE_COST) reachGoal(); pushUi(); return; }
          if (key === " " || key === "enter") {
            event.preventDefault();
            if (down && !event.repeat) actionQueued = true;
            return;
          }
          const direction = keyMap[key];
          if (!direction) return;
          event.preventDefault();
          pressed[direction] = down;
        };
        const keydown = (event: KeyboardEvent) => onKey(event, true);
        const keyup = (event: KeyboardEvent) => onKey(event, false);
        const release = () => (Object.keys(pressed) as Direction[]).forEach((k) => { pressed[k] = false; });
        window.addEventListener("keydown", keydown, { passive: false });
        window.addEventListener("keyup", keyup, { passive: false });
        window.addEventListener("blur", release);
        window.addEventListener("pointerup", release);

        const resize = () => {
          if (!canvasRef.current) return;
          const width = canvasRef.current.clientWidth;
          const height = canvasRef.current.clientHeight;
          renderer.setSize(width, height, false);
          camera.aspect = width / Math.max(height, 1);
          camera.updateProjectionMatrix();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(canvasRef.current);
        resize();
        phase = "ready";
        pushUi();

        const blocked = (x: number, z: number) => {
          if (insideDoor) {
            if (!interiorColliders.get(insideDoor.key)) return Math.hypot(x, z) > 2.6;
            const floorY = interiorFloorY(x, z);
            if (floorY === null) return true;
            return Math.abs(floorY - playerRoot.position.y) > 0.5;
          }
          if (Math.hypot(x, z) > ISLAND_WALK_RADIUS) return true;
          if (x > RIVER_X0 && x < RIVER_X1 && Math.abs(z - BRIDGE_Z) > BRIDGE_HALF) return true;
          return blockers.some((b) => Math.hypot(x - b.x, z - b.z) < b.radius + 0.42);
        };

        // The bridge deck is an arch; walking the river lane lifts the player over it.
        const bridgeY = (x: number, z: number) => {
          if (x > RIVER_X0 - 0.7 && x < RIVER_X1 + 0.7 && Math.abs(z - BRIDGE_Z) < BRIDGE_HALF + 0.4) {
            const t = THREE.MathUtils.clamp((x - (RIVER_X0 - 0.7)) / (RIVER_X1 - RIVER_X0 + 1.4), 0, 1);
            return Math.sin(Math.PI * t) * 1.35;
          }
          return 0;
        };

        let snapCameraNext = false;
        let doorBusy = false;
        // AC-style door transition: quick fade to dark, swap the world behind
        // the curtain, fade back in.
        const doorFade = (swap: () => void) => {
          if (doorBusy) return;
          doorBusy = true;
          const fade = document.getElementById("door-fade");
          if (fade) fade.style.opacity = "1";
          const swapTimer = window.setTimeout(() => {
            swap();
            snapCameraNext = true;
            pushUi();
            const fadeOutTimer = window.setTimeout(() => {
              const el = document.getElementById("door-fade");
              if (el) el.style.opacity = "0";
              doorBusy = false;
            }, 120);
            timers.push(fadeOutTimer);
          }, 270);
          timers.push(swapTimer);
        };
        const enterDoor = (door: (typeof DOORS)[number]) => {
          doorCooldown = 2.0;
          doorFade(() => {
            insideDoor = door;
            gameRoot.visible = false;
            interiorRoot.visible = true;
            showInterior(door.key);
            playerRoot.position.set(0, INTERIOR_Y, 0.8);
            playerRoot.rotation.y = Math.PI;
            enteredAt = elapsed;
            steppedOffPad = false;
            toast(`Welcome inside ${door.label} — step back on the glowing ring to leave`);
          });
        };
        const exitDoor = () => {
          if (!insideDoor) return;
          const door = insideDoor;
          doorCooldown = 2.0;
          doorFade(() => {
            insideDoor = null;
            gameRoot.visible = true;
            interiorRoot.visible = false;
            playerRoot.position.set(door.exitX, 0, door.exitZ);
            playerRoot.rotation.y = Math.atan2(-door.exitX, -door.exitZ);
          });
        };

        let qaFreezeCam = false;

        // ---------- Main loop ----------
        let last = performance.now();
        const move = new THREE.Vector3();
        const desiredCamera = new THREE.Vector3();
        const cameraTarget = new THREE.Vector3();
        const skyColor = new THREE.Color();
        const sunColor = new THREE.Color();
        const colorA = new THREE.Color();
        const colorB = new THREE.Color();
        camera.position.set(0, 6.6, 15);

        const dayLerp = (u: number) => {
          let a = DAY_STOPS[0];
          let b = DAY_STOPS[DAY_STOPS.length - 1];
          for (let i = 0; i < DAY_STOPS.length - 1; i += 1) {
            if (u >= DAY_STOPS[i].u && u <= DAY_STOPS[i + 1].u) {
              a = DAY_STOPS[i];
              b = DAY_STOPS[i + 1];
              break;
            }
          }
          const span = Math.max(b.u - a.u, 0.0001);
          const k = THREE.MathUtils.clamp((u - a.u) / span, 0, 1);
          skyColor.copy(colorA.setHex(a.sky)).lerp(colorB.setHex(b.sky), k);
          sunColor.copy(colorA.setHex(a.sun)).lerp(colorB.setHex(b.sun), k);
          return {
            sunI: THREE.MathUtils.lerp(a.sunI, b.sunI, k),
            hemiI: THREE.MathUtils.lerp(a.hemi, b.hemi, k),
          };
        };

        const render = (now: number) => {
          if (disposed) return;
          const dt = Math.min((now - last) / 1000, 0.05);
          last = now;
          elapsed += dt;

          // Looping ambient day-night cycle (no fail state): morning → dusk → morning.
          const dayU = 0.5 - 0.5 * Math.cos((elapsed / DAY_CYCLE) * Math.PI * 2);
          const light = dayLerp(dayU);
          if (insideDoor) {
            // Sealed in: everything beyond the splat room fades to cave dark,
            // so the outside of the splat is never visible.
            (scene.background as THREE.Color).setHex(0x241a13);
            scene.fog!.color.setHex(0x241a13);
            (scene.fog as THREE.Fog).near = 7;
            (scene.fog as THREE.Fog).far = 20;
          } else {
            (scene.background as THREE.Color).copy(skyColor);
            scene.fog!.color.copy(skyColor);
            (scene.fog as THREE.Fog).near = 95;
            (scene.fog as THREE.Fog).far = 260;
          }
          sun.color.copy(sunColor);
          sun.intensity = light.sunI;
          hemi.intensity = light.hemiI;
          sun.position.set(
            THREE.MathUtils.lerp(-16, 15, dayU),
            THREE.MathUtils.lerp(26, 12, dayU),
            THREE.MathUtils.lerp(12, -4, dayU),
          );
          // Physical decay (d²) means pools of light need high candela to read.
          const lanternGlow = Math.max(0, (dayU - 0.68) / 0.32) * 22;
          lanternLights.forEach((l) => { l.intensity = lanternGlow; });

          if (insideDoor) {
            const floorY = interiorFloorY(playerRoot.position.x, playerRoot.position.z);
            playerRoot.position.y = floorY !== null ? floorY + 0.02 : INTERIOR_Y;
          } else {
            playerRoot.position.y = bridgeY(playerRoot.position.x, playerRoot.position.z);
          }
          const dx = (pressed.right ? 1 : 0) - (pressed.left ? 1 : 0);
          const dz = (pressed.back ? 1 : 0) - (pressed.forward ? 1 : 0);
          const moving = running && Boolean(dx || dz) && toolAnimT <= 0;
          if (moving) {
            move.set(dx, 0, dz).normalize();
            const speed = 5.4;
            const nx = playerRoot.position.x + move.x * speed * dt;
            const nz = playerRoot.position.z + move.z * speed * dt;
            if (!blocked(nx, playerRoot.position.z)) playerRoot.position.x = nx;
            if (!blocked(playerRoot.position.x, nz)) playerRoot.position.z = nz;
            // Mint characters face local +Z; this yaw keeps W pointing north.
            const targetYaw = Math.atan2(move.x, move.z);
            playerRoot.rotation.y = THREE.MathUtils.lerp(playerRoot.rotation.y, targetYaw, Math.min(1, dt * 11));
          }
          if (soundOn && moving && audio.footsteps.paused) void audio.footsteps.play().catch(() => undefined);
          if ((!moving || !soundOn) && !audio.footsteps.paused) audio.footsteps.pause();

          // Doors: step up to a door to enter; walk back to it to leave.
          doorCooldown = Math.max(0, doorCooldown - dt);
          if (running && doorCooldown <= 0) {
            if (!insideDoor) {
              for (const door of DOORS) {
                if (door.key === "own" && !houseBuilt) continue;
                if (Math.hypot(door.x - playerRoot.position.x, door.z - playerRoot.position.z) < 1.25) {
                  if (!INTERIOR_WORLDS[door.key]) {
                    toast(`${door.label} is still being furnished…`);
                    doorCooldown = 3;
                  } else {
                    enterDoor(door);
                  }
                  break;
                }
              }
            } else {
              // Doormat exit: leave the ring first, then step back on it.
              const padD = Math.hypot(playerRoot.position.x - exitPad.position.x, playerRoot.position.z - exitPad.position.z);
              if (padD > 1.6) steppedOffPad = true;
              exitPad.material.opacity = 0.55 + Math.sin(elapsed * 4) * 0.25;
              if (steppedOffPad && elapsed - enteredAt > 2 && padD < 0.8) exitDoor();
            }
          }

          // House build-up animation after the fund fills.
          if (houseBuilt && houseBuildT < 1) {
            houseBuildT = Math.min(1, houseBuildT + dt / 1.4);
            const s = 1 - Math.pow(1 - houseBuildT, 3);
            ownHouse.scale.setScalar(Math.max(0.001, s));
          }

          if (moving) setPlayerAction(runAction);
          else setPlayerAction(idleAction);
          mixers.forEach((mixer) => mixer.update(dt));

          // Tool action overlay: windup-and-whip for the cast, a horizontal
          // sweep for the net — applied on top of the playing animation.
          if (toolAnimT > 0) {
            toolAnimT = Math.max(0, toolAnimT - dt);
            const progress = 1 - toolAnimT / toolAnimDur;
            if (toolAnimKind === "cast") {
              const angle = progress < 0.38
                ? -1.9 * (progress / 0.38)
                : -1.9 + 3.1 * Math.min(1, (progress - 0.38) / 0.42);
              toolArmQuat.setFromAxisAngle(toolArmAxisX, angle * (1 - Math.max(0, (progress - 0.8) / 0.2)));
              rightArmBone.quaternion.multiply(toolArmQuat);
            } else if (toolAnimKind === "swing") {
              const sweep = Math.sin(progress * Math.PI);
              toolArmQuat.setFromAxisAngle(toolArmAxisY, -1.3 * sweep);
              rightArmBone.quaternion.multiply(toolArmQuat);
              toolArmQuat.setFromAxisAngle(toolArmAxisX, -0.7 * sweep);
              rightArmBone.quaternion.multiply(toolArmQuat);
            }
          }

          // Fruit trees: shake on contact, drop fruit, restock over time.
          fruitTrees.forEach((tree) => {
            if (tree.shakeT > 0) {
              tree.shakeT = Math.max(0, tree.shakeT - dt);
              tree.root.rotation.z = Math.sin(tree.shakeT * 26) * 0.07 * (tree.shakeT / 0.6);
            }
            if (tree.stock === 0 && tree.restockAt > 0 && elapsed >= tree.restockAt) {
              tree.stock = 2;
              tree.restockAt = 0;
            }
            if (!running || insideDoor || tree.stock === 0 || tree.shakeT > 0) return;
            const d = Math.hypot(tree.x - playerRoot.position.x, tree.z - playerRoot.position.z);
            if (d < 1.7) {
              tree.shakeT = 0.6;
              const drops = tree.stock;
              tree.stock = 0;
              tree.restockAt = elapsed + 26;
              for (let i = 0; i < drops; i += 1) {
                const angle = Math.random() * Math.PI * 2;
                const radius = 1.5 + Math.random() * 0.7;
                dropItem(tree.kind, tree.x, tree.z, tree.x + Math.cos(angle) * radius, tree.z + Math.sin(angle) * radius);
              }
              toast(`${ITEM_EMOJI[tree.kind]} The tree shook loose some fruit!`);
            }
          });

          // Shell respawns keep the beach loop going.
          shellSpots.forEach((spot, index) => {
            if (!spot.filled && spot.respawnAt > 0 && elapsed >= spot.respawnAt) {
              spot.filled = true;
              spot.respawnAt = 0;
              spawnItem("shell", spot.x, spot.z, { shellSpot: index });
            }
          });

          // Fish wander their water zones. The rod comes out near one; standing
          // still casts a bobber; the fish is lured in — move and it flees.
          let nearestFish: SwimFish | null = null;
          let nearestFishD = Infinity;
          swimFish.forEach((fish) => {
            if (fish.state === "gone") {
              if (fish.respawnAt > 0 && elapsed >= fish.respawnAt) {
                fish.state = "swim";
                fish.obj.visible = true;
                fish.x = THREE.MathUtils.lerp(fish.zone.x0, fish.zone.x1, 0.15 + 0.7 * Math.abs(Math.sin(elapsed * 7 + fish.speed)));
                fish.z = THREE.MathUtils.lerp(fish.zone.z0, fish.zone.z1, 0.15 + 0.7 * Math.abs(Math.cos(elapsed * 5 + fish.speed)));
              }
              return;
            }
            if (fish.state === "swim") {
              fish.angle += Math.sin(elapsed * 0.7 + fish.speed * 13) * dt * 1.2;
              fish.x += Math.cos(fish.angle) * fish.speed * dt;
              fish.z += Math.sin(fish.angle) * fish.speed * dt;
              if (fish.x < fish.zone.x0 || fish.x > fish.zone.x1) {
                fish.angle = Math.PI - fish.angle;
                fish.x = THREE.MathUtils.clamp(fish.x, fish.zone.x0, fish.zone.x1);
              }
              if (fish.z < fish.zone.z0 || fish.z > fish.zone.z1) {
                fish.angle = -fish.angle;
                fish.z = THREE.MathUtils.clamp(fish.z, fish.zone.z0, fish.zone.z1);
              }
            } else if (fish.state === "lured") {
              if (moving || insideDoor || !running) {
                fish.state = "gone";
                fish.obj.visible = false;
                fish.respawnAt = elapsed + 8;
                bobber.visible = false;
                bobberDipT = 0;
                luredFish = null;
                toast("💨 It got away!");
              } else {
                const dxb = bobber.position.x - fish.x;
                const dzb = bobber.position.z - fish.z;
                const db = Math.hypot(dxb, dzb);
                fish.angle = Math.atan2(dzb, dxb);
                if (db > 0.5) {
                  fish.x = THREE.MathUtils.clamp(fish.x + (dxb / db) * 1.15 * dt, fish.zone.x0, fish.zone.x1);
                  fish.z = THREE.MathUtils.clamp(fish.z + (dzb / db) * 1.15 * dt, fish.zone.z0, fish.zone.z1);
                } else if (fish.nibbles > 0) {
                  // AC-style nibbles: the bobber dips a few times before the
                  // real bite — hook too early and it bolts.
                  if (elapsed >= fish.nextNibbleAt) {
                    fish.nibbles -= 1;
                    fish.nextNibbleAt = elapsed + 0.7 + (fish.speed * 10) % 0.6;
                    bobberDipT = 0.28;
                    nibbleAudio.currentTime = 0;
                    if (soundOn) void nibbleAudio.play().catch(() => undefined);
                  }
                } else {
                  // The REAL bite: a short window to press the action button.
                  fish.state = "biting";
                  fish.biteUntil = elapsed + 1.15;
                  nibbleAudio.currentTime = 0;
                  if (soundOn) void nibbleAudio.play().catch(() => undefined);
                  toast("❗ NOW! Press SPACE!");
                }
              }
            } else if (fish.state === "biting") {
              bobberDipT = 0.2; // bobber stays plunged through the window
              if (moving || insideDoor || !running || elapsed > fish.biteUntil) {
                fish.state = "gone";
                fish.obj.visible = false;
                fish.respawnAt = elapsed + 10;
                bobber.visible = false;
                luredFish = null;
                toast("💨 It slipped the hook…");
              }
            }
            fish.obj.position.set(fish.x, fish.zone.y + Math.sin(elapsed * 3 + fish.speed * 20) * 0.02, fish.z);
            fish.obj.rotation.y = Math.atan2(Math.cos(fish.angle), Math.sin(fish.angle));
            if (fish.state !== "gone" && !insideDoor) {
              const d = Math.hypot(fish.x - playerRoot.position.x, fish.z - playerRoot.position.z);
              if (d < nearestFishD) {
                nearestFishD = d;
                nearestFish = fish;
              }
            }
          });
          if (running && !insideDoor && !luredFish && nearestFish && nearestFishD < CAST_RANGE && elapsed - lastCastPromptAt > 5) {
            lastCastPromptAt = elapsed;
            toast("🎣 Press SPACE to cast!");
          }
          bobberDipT = Math.max(0, bobberDipT - dt);
          bobber.position.y = bobberBaseY + (bobberDipT > 0 ? -0.12 : 0) + Math.sin(elapsed * 5) * 0.015;
          rodProp.visible = Boolean(luredFish) || nearestFishD < ROD_OUT_RANGE;

          // Catchable dragonflies orbit the meadows; the net comes out nearby,
          // walk close to swing and store the catch.
          let nearestBugD = Infinity;
          let nearestBug: CatchableBug | null = null;
          catchableBugs.forEach((bug) => {
            if (bug.caught) {
              if (bug.respawnAt > 0 && elapsed >= bug.respawnAt) {
                bug.caught = false;
                bug.root.visible = true;
              }
              return;
            }
            const a = elapsed * 0.9 + bug.phase;
            bug.root.position.set(
              bug.anchor.x + Math.cos(a) * 1.3,
              0.9 + Math.sin(elapsed * 2.2 + bug.phase) * 0.25,
              bug.anchor.z + Math.sin(a) * 1.3,
            );
            bug.root.rotation.y = -a + Math.PI / 2;
            if (!running || insideDoor) return;
            const d = Math.hypot(bug.root.position.x - playerRoot.position.x, bug.root.position.z - playerRoot.position.z);
            if (d < nearestBugD) {
              nearestBugD = d;
              nearestBug = bug;
            }
            // AC-style sneaking: rushing straight in startles the dragonfly.
            // Creep in short bursts — alarm builds while you move nearby and
            // fades while you hold still.
            const towardBug = moving && (
              (move.x * (bug.root.position.x - playerRoot.position.x) + move.z * (bug.root.position.z - playerRoot.position.z)) / Math.max(d, 0.001) > 0.45
            );
            if (d < 2.6 && towardBug) bug.alarm = Math.min(1, bug.alarm + dt * 1.4);
            else bug.alarm = Math.max(0, bug.alarm - dt * 1.6);
            if (bug.alarm >= 1) {
              bug.caught = true;
              bug.root.visible = false;
              bug.respawnAt = elapsed + 7;
              bug.alarm = 0;
              toast("💨 The dragonfly darted away!");
              return;
            }
          });
          netFlashT = Math.max(0, netFlashT - dt);
          // Net is held whenever a catchable dragonfly is nearby (AC-style
          // tools-out), and swings during the catch flash. Rod wins if both.
          netProp.visible = !rodProp.visible && (netFlashT > 0 || nearestBugD < 4.5);

          // One action button, resolved by context (AC style): hook a biting
          // fish, swing the net, cast at a nearby fish, or whiff.
          if (actionQueued) {
            actionQueued = false;
            if (running && !insideDoor) {
              if (luredFish && luredFish.state === "biting") {
                const fish = luredFish;
                play("splash");
                fish.state = "gone";
                fish.obj.visible = false;
                fish.respawnAt = elapsed + 20;
                bobber.visible = false;
                luredFish = null;
                dropItem(
                  "fish", fish.x, fish.z,
                  playerRoot.position.x + (playerRoot.position.x - fish.x) * 0.25,
                  playerRoot.position.z + (playerRoot.position.z - fish.z) * 0.25,
                );
                banner("🐟", "I caught a prehistoric fish! It's positively ancient!");
              } else if (luredFish) {
                const fish = luredFish;
                fish.state = "gone";
                fish.obj.visible = false;
                fish.respawnAt = elapsed + 8;
                bobber.visible = false;
                luredFish = null;
                toast("💨 Too soon! It got away…");
              } else if (nearestBug && nearestBugD < 1.75) {
                const bug: CatchableBug = nearestBug;
                bug.caught = true;
                bug.root.visible = false;
                bug.respawnAt = elapsed + 30;
                bug.alarm = 0;
                netFlashT = 0.5;
                startToolAnim("swing", 0.5);
                play("swoosh");
                carried.push("bug");
                refreshCarried();
                play("pickup");
                banner("🦋", "I caught a giant dragonfly! Positively prehistoric!");
                pushUi();
              } else if (nearestFish && nearestFishD < CAST_RANGE) {
                const target: SwimFish = nearestFish;
                luredFish = target;
                target.state = "lured";
                target.stateT = 0;
                target.nibbles = 1 + Math.floor(((elapsed * 7) % 1) * 3);
                target.nextNibbleAt = 0;
                bobberBaseY = target.zone.y + 0.05;
                bobber.position.set(
                  THREE.MathUtils.clamp(THREE.MathUtils.lerp(playerRoot.position.x, target.x, 0.55), target.zone.x0 + 0.3, target.zone.x1 - 0.3),
                  bobberBaseY,
                  THREE.MathUtils.clamp(THREE.MathUtils.lerp(playerRoot.position.z, target.z, 0.55), target.zone.z0 + 0.3, target.zone.z1 - 0.3),
                );
                bobber.visible = true;
                startToolAnim("cast", 0.7);
                toast("🎣 Cast! Hold still and wait for the plunge…");
              } else if (nearestBug && nearestBugD < 4.5) {
                const bug: CatchableBug = nearestBug;
                netFlashT = 0.5;
                startToolAnim("swing", 0.5);
                play("swoosh");
                bug.alarm = Math.min(1, bug.alarm + 0.5);
                toast("💨 Swing and a miss!");
              }
            }
          }

          // Soil patches: plant carried fruit, saplings grow into real trees.
          soilSpots.forEach((spot) => {
            if (spot.state === "growing") {
              const progress = Math.min(1, (elapsed - spot.plantedAt) / TREE_GROW_SECONDS);
              if (spot.sapling) spot.sapling.scale.setScalar(0.6 + progress * 0.7);
              if (progress >= 1) {
                spot.state = "grown";
                if (spot.sapling) {
                  contentRoot.remove(spot.sapling);
                  spot.sapling = null;
                }
                const kind = spot.kind ?? "apple";
                const tree = fitHeight(sceneFor(kind === "apple" ? ASSETS.props.appleTree : ASSETS.props.orangeTree), 4.4);
                tree.position.set(spot.x, 0, spot.z);
                tree.rotation.y = spot.x;
                contentRoot.add(tree);
                const blocker = { x: spot.x, z: spot.z, radius: 0.85 };
                blockers.push(blocker);
                fruitTrees.push({ root: tree, kind, x: spot.x, z: spot.z, stock: 2, restockAt: 0, shakeT: 0 });
                plantedGrowth.push({ tree, blocker, spot });
                play("jingle");
                toast(`🌳 Your ${ITEM_NAME[kind]} tree grew in!`);
              }
              return;
            }
            if (spot.state !== "empty" || !running || insideDoor) return;
            const fruitIndex = carried.findIndex((c) => c === "apple" || c === "orange");
            if (fruitIndex === -1) return;
            const d = Math.hypot(spot.x - playerRoot.position.x, spot.z - playerRoot.position.z);
            if (d < 1.1) {
              const kind = carried[fruitIndex] as "apple" | "orange";
              carried.splice(fruitIndex, 1);
              refreshCarried();
              spot.state = "growing";
              spot.kind = kind;
              spot.plantedAt = elapsed;
              const sapling = saplingTemplate.clone(true);
              sapling.position.set(spot.x, 0, spot.z);
              contentRoot.add(sapling);
              spot.sapling = sapling;
              play("pickup");
              toast(`🌱 Planted a ${ITEM_NAME[kind]} — it'll grow into a tree!`);
              pushUi();
            }
          });

          // Ground items: drop arcs, idle bobbing, pickup.
          groundItems.forEach((item) => {
            if (item.state === "drop") {
              item.t = Math.min(1, item.t + dt / 0.55);
              item.obj.position.lerpVectors(item.from, item.to, item.t);
              item.obj.position.y += Math.sin(item.t * Math.PI) * 0.9;
              if (item.t >= 1) item.state = "idle";
              return;
            }
            item.obj.rotation.y += dt * 0.9;
            item.obj.position.y = item.to.y + Math.sin(elapsed * 2.4 + item.offset) * 0.03 + 0.02;
            if (!running || insideDoor) return;
            const d = Math.hypot(item.obj.position.x - playerRoot.position.x, item.obj.position.z - playerRoot.position.z);
            if (d < 1.05) collect(item);
          });

          // Villagers: bubbles bob, deliveries, idle chatter, request refills.
          villagerRuntimes.forEach((v) => {
            v.bubble.position.y = 2.05 + Math.sin(elapsed * 2.4 + v.data.x) * 0.07;
            if (v.bubbleItem) v.bubbleItem.rotation.y += dt * 1.4;
            if (v.bounceT > 0) {
              v.bounceT = Math.max(0, v.bounceT - dt);
              const s = 1 + Math.sin((1 - v.bounceT / 0.5) * Math.PI) * 0.12;
              v.root.scale.setScalar(s);
            }
            if (!running) return;
            if (!v.request && v.nextRequestAt > 0 && elapsed >= v.nextRequestAt) {
              v.nextRequestAt = 0;
              randomRequest(v);
              pushUi();
            }
            if (insideDoor) return;
            const d = Math.hypot(v.data.x - playerRoot.position.x, v.data.z - playerRoot.position.z);
            if (d < 1.9) {
              deliverTo(v);
              if (elapsed - v.chatterAt > 9 && !ui.banter) {
                v.chatterAt = elapsed;
                banter(v.name, v.data.chatter[Math.floor(Math.random() * v.data.chatter.length)]);
              }
            }
          });

          // Ambient life.
          butterflies.forEach((b) => {
            const a = elapsed * b.speed + b.phase;
            b.group.position.set(
              b.anchor.x + Math.cos(a) * b.radius,
              b.anchor.y + Math.sin(elapsed * 2 + b.phase) * 0.18,
              b.anchor.z + Math.sin(a) * b.radius,
            );
            b.group.rotation.y = -a;
            const flap = Math.sin(elapsed * 14 + b.phase) * 0.7;
            b.wings[0].rotation.y = flap;
            b.wings[1].rotation.y = -flap;
          });
          leaves.forEach((leaf) => {
            leaf.y -= dt * leaf.speed;
            if (leaf.y <= 0.05) leaf.y = 2.6 + Math.random() * 1.2;
            leaf.sway += dt * 1.8;
            leaf.mesh.position.set(
              leaf.tree.x + Math.sin(leaf.sway) * 0.9,
              leaf.y,
              leaf.tree.z + Math.cos(leaf.sway * 0.8) * 0.9,
            );
            leaf.mesh.rotation.set(leaf.sway, leaf.sway * 1.3, 0);
          });
          gulls.forEach((gull) => {
            const a = elapsed * gull.speed + gull.phase;
            gull.group.position.set(Math.cos(a) * gull.radius, gull.height + Math.sin(elapsed * 0.7 + gull.phase) * 0.8, Math.sin(a) * gull.radius);
            gull.group.rotation.y = -a - Math.PI / 2;
            const flap = Math.sin(elapsed * 6 + gull.phase) * 0.5;
            gull.wings[0].rotation.z = flap;
            gull.wings[1].rotation.z = -flap;
          });
          clouds.forEach((cloud) => {
            cloud.position.x += dt * 0.5;
            if (cloud.position.x > 70) cloud.position.x = -70;
          });
          smokePuffs.forEach((puff, index) => {
            puff.position.y += dt * 1.1;
            puff.position.x += dt * 0.7;
            if (puff.position.y > 40 + index * 2) {
              puff.position.set(-72, 20, -48);
            }
            (puff.material as THREE.MeshBasicMaterial).opacity = 0.55 * Math.max(0, 1 - (puff.position.y - 20) / 24);
          });
          // Illustrated wave glyphs fade, drift, respawn.
          waveGlyphs.forEach((glyph) => {
            glyph.t += dt;
            if (glyph.t >= glyph.dur) respawnGlyph(glyph);
            const progress = glyph.t / glyph.dur;
            glyph.mat.opacity = Math.sin(Math.PI * progress) * 0.6;
            glyph.mesh.position.x += dt * 0.25;
          });
          riverDashes.forEach((dash) => {
            dash.z += dash.speed * dt;
            if (dash.z > 27) dash.z = -27;
            dash.mesh.position.set(dash.x, 0.05, dash.z);
            dash.mat.opacity = 0.18 + Math.sin(elapsed * 2 + dash.x) * 0.1;
          });
          // Shore waves roll in toward the beach and dissolve.
          shoreWaves.forEach((wave) => {
            const progress = (elapsed * 0.22 + wave.phase) % 1;
            const radius = 33.5 - progress * 3.6;
            wave.ring.scale.setScalar(radius);
            wave.mat.opacity = Math.sin(Math.PI * progress) * 0.42;
          });
          // Rolling water: displaced swells + moving two-tone bands so the
          // motion reads clearly in flat toon lighting.
          {
            const pos = waterGeo.attributes.position;
            const col = waterGeo.attributes.color;
            for (let i = 0; i < pos.count; i += 1) {
              const wx = pos.getX(i);
              const wy = pos.getY(i);
              // One long swell train rolling steadily from the north-east —
              // coherent parallel crests like a real current, gentle tint.
              const phase = (wx * 0.62 + wy * 0.78) * 0.075 - elapsed * 0.55;
              const swell = Math.sin(phase) + Math.sin(phase * 0.47 + 1.7) * 0.55;
              pos.setZ(i, swell * 0.09);
              const k = 0.5 + swell * 0.03;
              // base #4fa3c9 → light #86cde2
              col.setXYZ(i, 0.31 + 0.215 * k, 0.64 + 0.165 * k, 0.79 + 0.095 * k);
            }
            pos.needsUpdate = true;
            col.needsUpdate = true;
            waterGeo.computeVertexNormals();
            const rpos = riverGeo.attributes.position;
            const rcol = riverGeo.attributes.color;
            for (let i = 0; i < rpos.count; i += 1) {
              const ry = rpos.getY(i);
              const flow = Math.sin(ry * 0.42 - elapsed * 1.5) + Math.sin(ry * 0.9 - elapsed * 2.1) * 0.35;
              rpos.setZ(i, flow * 0.014);
              const k = 0.5 + flow * 0.075;
              // base #58b4d6 → light #93dcee
              rcol.setXYZ(i, 0.345 + 0.23 * k, 0.705 + 0.155 * k, 0.84 + 0.095 * k);
            }
            rpos.needsUpdate = true;
            rcol.needsUpdate = true;
            riverGeo.computeVertexNormals();
          }

          // Fireworks during the celebration and on the win screen.
          if (phase === "celebrating" || phase === "won") {
            if (elapsed >= nextFireworkAt) {
              spawnFirework();
              nextFireworkAt = elapsed + 0.5 + Math.random() * 0.4;
            }
            if (phase === "celebrating" && elapsed >= celebrationEnd) {
              phase = "won";
              pushUi({ toast: "" });
            }
          }
          for (let i = fireworks.length - 1; i >= 0; i -= 1) {
            const fw = fireworks[i];
            fw.life -= dt;
            const positions = fw.points.geometry.attributes.position as THREE.BufferAttribute;
            for (let j = 0; j < positions.count; j += 1) {
              positions.setXYZ(
                j,
                positions.getX(j) + fw.velocities[j * 3] * dt,
                positions.getY(j) + (fw.velocities[j * 3 + 1] -= 3.4 * dt) * dt,
                positions.getZ(j) + fw.velocities[j * 3 + 2] * dt,
              );
            }
            positions.needsUpdate = true;
            (fw.points.material as THREE.PointsMaterial).opacity = Math.max(0, fw.life / 1.6);
            if (fw.life <= 0) {
              scene.remove(fw.points);
              fw.points.geometry.dispose();
              fireworks.splice(i, 1);
            }
          }

          if (running && elapsed - lastUiPush > 0.15) {
            lastUiPush = elapsed;
            pushUi();
          }

          // Camera: tight indoors, skyward during the fireworks celebration.
          const skyward = phase === "celebrating" || phase === "won";
          const py = insideDoor ? INTERIOR_Y : bridgeY(playerRoot.position.x, playerRoot.position.z);
          if (insideDoor) {
            desiredCamera.set(playerRoot.position.x * 0.35, py + 1.6, playerRoot.position.z + 3.0);
            cameraTarget.set(playerRoot.position.x * 0.5, py + 0.9, playerRoot.position.z - 0.6);
          } else {
            desiredCamera.set(playerRoot.position.x, py + (skyward ? 4.6 : 6.0), playerRoot.position.z + (skyward ? 11.5 : 9.9));
            cameraTarget.set(playerRoot.position.x, py + (skyward ? 7.5 : 1.7), playerRoot.position.z - (skyward ? 9 : 2.6));
          }
          if (!qaFreezeCam) {
            if (snapCameraNext) {
              snapCameraNext = false;
              camera.position.copy(desiredCamera);
            } else {
              camera.position.lerp(desiredCamera, 1 - Math.pow(0.001, dt));
            }
            camera.lookAt(cameraTarget);
          }
          renderer.render(scene, camera);
          animationFrame = requestAnimationFrame(render);
        };
        animationFrame = requestAnimationFrame(render);

        cleanupRuntime = () => {
          observer.disconnect();
          window.removeEventListener("keydown", keydown);
          window.removeEventListener("keyup", keyup);
          window.removeEventListener("blur", release);
          window.removeEventListener("pointerup", release);
          renderer.dispose();
        };
      } catch (error) {
        console.error(error);
        if (!disposed) setUi((value) => ({
          ...value,
          phase: "error",
          loading: "Boulder Cove could not open.",
          toast: "A Mint asset failed to load.",
        }));
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(banterTimer);
      window.clearTimeout(toastTimer);
      Object.values(audio).forEach((item) => { item.pause(); item.src = ""; });
      cleanupRuntime();
      controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hold = (direction: Direction, value: boolean) => controllerRef.current?.setDirection(direction, value);
  const modal = ui.phase === "loading" || ui.phase === "ready" || ui.phase === "won" || ui.phase === "error";
  const title = ui.titleOk && titleSrc
    ? <img src={titleSrc} alt="Boulder Cove" onError={() => setUi((v) => ({ ...v, titleOk: false }))} />
    : <span className="title-fallback">BOULDER COVE</span>;

  return (
    <main className="maple-game">
      <canvas ref={canvasRef} className="game-canvas" aria-label="Boulder Cove 3D game" tabIndex={0} />
      <header className="game-header">
        <div>
          {title}
          <div className="mint-credit">BROUGHT TO YOU BY MINT</div>
        </div>
        <div className="header-spacer" />
        <div className="coin-chip"><span className="coin-dot" /><b>{ui.coins}</b><span>/ {HOUSE_COST}</span></div>
        <button onClick={() => controllerRef.current?.toggleSound()}>{ui.sound ? "SOUND ON" : "SOUND OFF"}</button>
      </header>
      {(ui.phase === "playing" || ui.phase === "celebrating") && ui.requests.length > 0 && (
        <div className="request-row">
          {ui.requests.map((request) => (
            <div className="request-chip" key={request.villager}>
              <small>{request.villager} WISHES FOR</small>
              {ITEM_EMOJI[request.type]} ×{request.count}
            </div>
          ))}
        </div>
      )}
      <section className="fund-card">
        <span>HUT FUND</span>
        <strong>{ui.houseBuilt ? "HUT BUILT!" : `${ui.coins} / ${HOUSE_COST} coins`}</strong>
        <div className="meter"><i style={{ width: `${Math.min(100, (ui.coins / HOUSE_COST) * 100)}%` }} /></div>
      </section>
      <div className="carry-row">
        {(Object.keys(ITEM_EMOJI) as ItemType[])
          .map((type) => [type, ui.carried.filter((c) => c === type).length] as const)
          .filter(([, count]) => count > 0)
          .map(([type, count]) => (
            <div key={type} className="carry-slot">
              {ITEM_EMOJI[type]}<b>×{count}</b>
            </div>
          ))}
      </div>
      <div id="door-fade" className="door-fade" />
      {ui.catchBanner && (
        <div className="catch-banner"><span>{ui.catchBanner.emoji}</span>{ui.catchBanner.line}</div>
      )}
      {ui.toast && <div className="game-toast">{ui.toast}</div>}
      {ui.banter && <div className="npc-banter"><b>{ui.banter.speaker}</b><span>“{ui.banter.line}”</span></div>}
      <div className="keyboard-hint">
        <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>
        <span>MOVE ·</span>
        <kbd>SPACE</kbd>
        <span>CAST & SWING · EARN YOUR HUT</span>
      </div>
      <button className="action-btn" onPointerDown={() => controllerRef.current?.action()} aria-label="Cast or swing">A</button>
      <div className="touch-controls" aria-label="Touch controls">
        <button onPointerDown={() => hold("forward", true)} onPointerUp={() => hold("forward", false)} aria-label="Move forward">▲</button>
        <div>
          <button onPointerDown={() => hold("left", true)} onPointerUp={() => hold("left", false)} aria-label="Move left">◀</button>
          <button onPointerDown={() => hold("back", true)} onPointerUp={() => hold("back", false)} aria-label="Move backward">▼</button>
          <button onPointerDown={() => hold("right", true)} onPointerUp={() => hold("right", false)} aria-label="Move right">▶</button>
        </div>
      </div>
      {modal && (
        <div className="game-modal">
          <div className="modal-card">
            {title}
            <p className="modal-kicker">AN ORIGINAL MINT-GENERATED PREHISTORIC ISLAND LIFE GAME</p>
            <p>
              {ui.phase === "loading"
                ? ui.loading
                : ui.phase === "won"
                  ? "Your boulder hut is built — fireworks over Boulder Cove! Walk up to your new front door to step inside, and keep helping the dinos as long as you like."
                  : "You've just paddled up to Boulder Cove — but you don't have a hut yet! Shake berry trees, fish the ripples, net giant dragonflies, plant fruit in soft soil, return lost dino eggs, and bring the dino villagers what they wish for. Fill the 420-coin hut fund and Boulder will stack your very own boulder hut."}
            </p>
            {ui.phase !== "loading" && (
              <button
                disabled={ui.phase === "error"}
                onClick={() => (ui.phase === "won" ? controllerRef.current?.resume() : controllerRef.current?.start())}
              >
                {ui.phase === "won" ? "KEEP PLAYING" : ui.phase === "error" ? "COVE CLOSED" : "MOVE TO BOULDER COVE"}
              </button>
            )}
            <small>WASD / ARROWS TO MOVE · EVERY VISIBLE AND AUDIBLE ASSET MADE IN MINT</small>
          </div>
        </div>
      )}
    </main>
  );
}
