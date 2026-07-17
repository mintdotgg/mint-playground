/* eslint-disable @next/next/no-img-element -- Portable Vite capsule has no Next Image runtime. */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  REEF_RIVALS_MINT_ASSETS as ASSETS,
  type ReefCharacterKey,
} from "./reefRivalsMintAssets";

type Phase = "loading" | "menu" | "player" | "projectile" | "enemy" | "upgrade" | "won" | "lost" | "error";
type Ammo = "coconut" | "pineapple" | "volley";
type Upgrade = "power" | "patch" | "armor";
type Ui = {
  phase: Phase;
  round: number;
  playerHp: number;
  enemyHp: number;
  enemyMax: number;
  angle: number;
  power: number;
  ammo: Ammo;
  pineapple: number;
  volley: number;
  shells: number;
  status: string;
  loading: string;
  sound: boolean;
};
type Controller = {
  start: () => void;
  fire: () => void;
  setAngle: (value: number) => void;
  setPower: (value: number) => void;
  setAmmo: (ammo: Ammo) => void;
  chooseUpgrade: (upgrade: Upgrade) => void;
  toggleSound: () => void;
};

const INITIAL_UI: Ui = {
  phase: "loading",
  round: 1,
  playerHp: 100,
  enemyHp: 55,
  enemyMax: 55,
  angle: 35,
  power: 68,
  ammo: "coconut",
  pineapple: 0,
  volley: 0,
  shells: 0,
  status: "Loading the Treasure Tide…",
  loading: "Calling in Mint's reef fleet…",
  sound: true,
};

const ROUND_DATA = [
  { hp: 55, enemies: ["captain"] as ReefCharacterKey[], name: "Brinebeard's Welcome Party" },
  { hp: 92, enemies: ["patch", "pearl"] as ReefCharacterKey[], name: "The Pearl Poachers" },
  { hp: 138, enemies: ["captain", "patch", "tiki"] as ReefCharacterKey[], name: "Treasure Tide Showdown" },
] as const;

const AMMO_INFO: Record<Ammo, { label: string; damage: number; model: keyof typeof ASSETS.world }> = {
  coconut: { label: "Coconut", damage: 24, model: "coconut" },
  pineapple: { label: "Pineapple", damage: 39, model: "pineapple" },
  volley: { label: "Pebble Volley", damage: 29, model: "volley" },
};

export default function ReefRivals() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<Controller | null>(null);
  const [ui, setUi] = useState<Ui>(INITIAL_UI);

  useEffect(() => {
    if (!canvasRef.current) return;
    canvasRef.current.dataset.assetState = "loading";
    canvasRef.current.dataset.assetCount = "75";
    let disposed = false;
    let frame = 0;
    const timers: number[] = [];

    const audio = Object.fromEntries(
      Object.entries(ASSETS.audio).map(([key, source]) => [key, new Audio(source)]),
    ) as Record<keyof typeof ASSETS.audio, HTMLAudioElement>;
    audio.music.loop = true;
    audio.music.volume = 0.24;
    audio.launch.volume = 0.72;
    audio.impact.volume = 0.82;
    audio.splash.volume = 0.8;
    let sound = true;
    const playSound = (key: keyof typeof ASSETS.audio) => {
      if (!sound) return;
      const clip = audio[key];
      clip.currentTime = 0;
      void clip.play().catch(() => undefined);
    };
    const later = (fn: () => void, delay: number) => {
      const id = window.setTimeout(fn, delay);
      timers.push(id);
      return id;
    };

    void (async () => {
      try {
        const THREE = await import("three");
        const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
        const { clone: cloneSkeleton } = await import("three/addons/utils/SkeletonUtils.js");
        if (disposed || !canvasRef.current) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x8ed7df);
        scene.fog = new THREE.Fog(0x8ed7df, 34, 76);
        const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
        camera.position.set(0, 13.5, 34);
        camera.lookAt(0, 3.2, 0);

        const renderer = new THREE.WebGLRenderer({
          canvas: canvasRef.current,
          antialias: true,
          powerPreference: "high-performance",
          alpha: false,
        });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;

        scene.add(new THREE.HemisphereLight(0xfff2c4, 0x236d78, 2.35));
        const sun = new THREE.DirectionalLight(0xffe6a8, 3.2);
        sun.position.set(-12, 24, 18);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -26;
        sun.shadow.camera.right = 26;
        sun.shadow.camera.top = 20;
        sun.shadow.camera.bottom = -12;
        scene.add(sun);
        const rim = new THREE.DirectionalLight(0x82f4ff, 1.4);
        rim.position.set(14, 7, -12);
        scene.add(rim);

        const manager = new THREE.LoadingManager();
        manager.onProgress = (_url, loaded, total) => {
          if (!disposed) setUi((value) => ({ ...value, loading: `Unpacking Mint assets · ${loaded}/${total}` }));
        };
        const loader = new GLTFLoader(manager);
        const textureLoader = new THREE.TextureLoader(manager);
        const characterEntries = Object.entries(ASSETS.characters) as [ReefCharacterKey, (typeof ASSETS.characters)[ReefCharacterKey]][];
        const allPaths = [
          ...Object.values(ASSETS.world),
          ...characterEntries.flatMap(([, character]) => [character.model, character.idle, character.throw, character.hit, character.fall, character.victory]),
        ];
        const [loaded, [waterBaseColor, waterNormal, waterRoughness]] = await Promise.all([
          Promise.all(
            [...new Set(allPaths)].map(async (path) => [path, await loader.loadAsync(path)] as const),
          ),
          Promise.all([
            textureLoader.loadAsync(ASSETS.materials.waterBaseColor),
            textureLoader.loadAsync(ASSETS.materials.waterNormal),
            textureLoader.loadAsync(ASSETS.materials.waterRoughness),
          ]),
        ]);
        const gltfs = new Map<string, (typeof loaded)[number][1]>(loaded);
        if (disposed) return;

        [waterBaseColor, waterNormal, waterRoughness].forEach((texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set(3.2, 3.2);
          texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
          texture.flipY = false;
        });
        waterBaseColor.colorSpace = THREE.SRGBColorSpace;

        function prepare<T extends import("three").Object3D>(object: T): T {
          object.traverse((child) => {
            const mesh = child as import("three").Mesh;
            if (mesh.isMesh) {
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              mesh.frustumCulled = false;
            }
          });
          return object;
        }
        const sceneFor = (path: string) => cloneSkeleton(gltfs.get(path)!.scene);
        const fit = (object: import("three").Object3D, maxSize: number) => {
          const root = new THREE.Group();
          root.add(object);
          object.updateMatrixWorld(true);
          const bounds = new THREE.Box3().setFromObject(object);
          const size = bounds.getSize(new THREE.Vector3());
          object.scale.setScalar(maxSize / Math.max(size.x, size.y, size.z, 0.001));
          object.updateMatrixWorld(true);
          const fitted = new THREE.Box3().setFromObject(object);
          const center = fitted.getCenter(new THREE.Vector3());
          object.position.set(-center.x, -fitted.min.y, -center.z);
          return prepare(root);
        };
        const fitHeight = (object: import("three").Object3D, height: number) => {
          const root = new THREE.Group();
          root.add(object);
          object.updateMatrixWorld(true);
          const bounds = new THREE.Box3().setFromObject(object);
          const size = bounds.getSize(new THREE.Vector3());
          object.scale.setScalar(height / Math.max(size.y, 0.001));
          object.updateMatrixWorld(true);
          const fitted = new THREE.Box3().setFromObject(object);
          const center = fitted.getCenter(new THREE.Vector3());
          object.position.set(-center.x, -fitted.min.y, -center.z);
          return prepare(root);
        };

        const worldRoot = new THREE.Group();
        scene.add(worldRoot);
        const ocean = fit(sceneFor(ASSETS.world.ocean), 50);
        ocean.position.y = -2.02;
        ocean.traverse((child) => {
          const mesh = child as import("three").Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = false;
          mesh.material = new THREE.MeshStandardMaterial({
            map: waterBaseColor,
            normalMap: waterNormal,
            normalScale: new THREE.Vector2(0.16, 0.16),
            roughnessMap: waterRoughness,
            roughness: 0.72,
            metalness: 0,
            color: 0xa4d9dc,
          });
        });
        worldRoot.add(ocean);

        const scenicWorld = new THREE.Group();
        worldRoot.add(scenicWorld);
        const rearBeachHorizon = fit(sceneFor(ASSETS.world.beachHorizon), 37);
        rearBeachHorizon.position.set(7.4, -0.28, -17.2);
        rearBeachHorizon.rotation.y = -0.03;
        scenicWorld.add(rearBeachHorizon);
        const beachHorizon = fit(sceneFor(ASSETS.world.beachHorizon), 40);
        beachHorizon.position.set(0, -1.55, -14.5);
        scenicWorld.add(beachHorizon);
        const backgroundSandIslet = fit(sceneFor(ASSETS.world.backgroundSandIslet), 10.5);
        backgroundSandIslet.position.set(3.7, 1.55, -13.3);
        backgroundSandIslet.rotation.y = 0.04;
        scenicWorld.add(backgroundSandIslet);
        const leftCloudBank = fit(sceneFor(ASSETS.world.leftCloudBank), 11.5);
        leftCloudBank.position.set(-12.8, 8.2, -18.5);
        leftCloudBank.rotation.y = 0.05;
        scenicWorld.add(leftCloudBank);
        const centerCloudBank = fit(sceneFor(ASSETS.world.centerCloudBank), 12.5);
        centerCloudBank.position.set(-0.5, 10.2, -20);
        scenicWorld.add(centerCloudBank);
        const rightCloudBank = fit(sceneFor(ASSETS.world.rightCloudBank), 10.8);
        rightCloudBank.position.set(12.8, 8.6, -18.8);
        rightCloudBank.rotation.y = -0.06;
        scenicWorld.add(rightCloudBank);
        scenicWorld.traverse((child) => {
          const mesh = child as import("three").Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = false;
          mesh.receiveShadow = false;
        });

        const sandbar = fit(sceneFor(ASSETS.world.sandbar), 9.5);
        sandbar.position.set(-13.5, -0.2, -0.7);
        sandbar.rotation.y = 0.3;
        worldRoot.add(sandbar);
        const islet = fit(sceneFor(ASSETS.world.volcanicIslet), 10);
        islet.position.set(13.5, -0.28, -0.7);
        islet.rotation.y = -0.4;
        worldRoot.add(islet);

        const treasure = fit(sceneFor(ASSETS.world.treasure), 3.2);
        treasure.position.set(-15.4, 0.58, -0.7);
        treasure.rotation.y = 0.35;
        worldRoot.add(treasure);

        const heroFloat = new THREE.Group();
        heroFloat.position.set(-9.8, 1.1, 0.8);
        worldRoot.add(heroFloat);
        const kaiTube = fit(sceneFor(ASSETS.world.heroTubeKai), 3.65);
        kaiTube.position.set(-0.8, -0.38, 0.65);
        kaiTube.rotation.y = 0.12;
        heroFloat.add(kaiTube);
        const niaTube = fit(sceneFor(ASSETS.world.heroTubeNia), 3.5);
        niaTube.position.set(-3.55, -0.4, -0.45);
        niaTube.rotation.y = -0.16;
        heroFloat.add(niaTube);

        const rivalFloat = new THREE.Group();
        rivalFloat.position.set(10.8, 1.05, 0.75);
        worldRoot.add(rivalFloat);
        const rivalRaft = fit(sceneFor(ASSETS.world.rivalRaft), 6.8);
        rivalRaft.rotation.y = -Math.PI / 2;
        rivalFloat.add(rivalRaft);

        const coral = fit(sceneFor(ASSETS.world.coral), 3.4);
        coral.position.set(-6.2, 0.1, 0.1);
        coral.rotation.y = 0.2;
        worldRoot.add(coral);
        const driftwood = fit(sceneFor(ASSETS.world.driftwood), 3.5);
        driftwood.position.set(6.2, 0.05, 0.2);
        driftwood.rotation.y = -0.15;
        worldRoot.add(driftwood);

        const buoy = fit(sceneFor(ASSETS.world.buoy), 2.6);
        buoy.position.set(0, 0.05, 0.2);
        worldRoot.add(buoy);
        const shellCoin = fit(sceneFor(ASSETS.world.shell), 1.25);
        shellCoin.position.set(0, 4.05, 0.15);
        worldRoot.add(shellCoin);

        const heroBlaster = fit(sceneFor(ASSETS.world.heroBlaster), 3.05);
        heroBlaster.position.set(0.85, 0.4, 1.35);
        heroFloat.add(heroBlaster);
        const rivalBlaster = fit(sceneFor(ASSETS.world.rivalBlaster), 3.15);
        rivalBlaster.position.set(-2.45, 1.55, 2.65);
        rivalBlaster.rotation.y = Math.PI;
        rivalFloat.add(rivalBlaster);

        const aimMarker = fit(sceneFor(ASSETS.world.aim), 2.55);
        aimMarker.position.set(-7.2, 3.45, 0.1);
        aimMarker.rotation.z = -0.55;
        worldRoot.add(aimMarker);

        type CharacterRuntime = {
          root: import("three").Group;
          source: import("three").Object3D;
          mixer: import("three").AnimationMixer;
          clips: Record<"idle" | "throw" | "hit" | "fall" | "victory", import("three").AnimationClip>;
          action: import("three").AnimationAction | null;
          play: (name: "idle" | "throw" | "hit" | "fall" | "victory") => void;
        };
        const stabilizeIdleFacing = (sourceClip: import("three").AnimationClip) => {
          const clip = sourceClip.clone();
          clip.tracks
            .filter((track) => track.name.endsWith(".quaternion") && track.values.length >= 4)
            .forEach((rotationTrack) => {
              const firstPose = Array.from(rotationTrack.values.slice(0, 4));
              for (let index = 0; index < rotationTrack.values.length; index += 4) {
                rotationTrack.values[index] = firstPose[0];
                rotationTrack.values[index + 1] = firstPose[1];
                rotationTrack.values[index + 2] = firstPose[2];
                rotationTrack.values[index + 3] = firstPose[3];
              }
            });
          return clip;
        };
        const characters = {} as Record<ReefCharacterKey, CharacterRuntime>;
        for (const [key, asset] of characterEntries) {
          const source = sceneFor(asset.model);
          const root = fitHeight(source, key === "nia" ? 2.65 : key === "kai" ? 2.75 : key === "captain" ? 3.15 : 2.95);
          const mixer = new THREE.AnimationMixer(source);
          const clips = {
            idle: stabilizeIdleFacing(gltfs.get(asset.idle)!.animations[0]),
            throw: gltfs.get(asset.throw)!.animations[0],
            hit: gltfs.get(asset.hit)!.animations[0],
            fall: gltfs.get(asset.fall)!.animations[0],
            victory: gltfs.get(asset.victory)!.animations[0],
          };
          const runtime: CharacterRuntime = {
            root,
            source,
            mixer,
            clips,
            action: null,
            play(name) {
              runtime.action?.fadeOut(0.12);
              const action = mixer.clipAction(clips[name], source);
              action.reset().fadeIn(0.12);
              if (name === "idle") {
                action.setLoop(THREE.LoopRepeat, Infinity);
              } else {
                action.setLoop(THREE.LoopOnce, 1);
                action.clampWhenFinished = true;
              }
              action.play();
              runtime.action = action;
              if (name !== "idle" && name !== "fall") later(() => !disposed && runtime.play("idle"), Math.min(1700, clips[name].duration * 900));
            },
          };
          characters[key] = runtime;
          runtime.play("idle");
        }

        characters.kai.root.position.set(-0.8, 0.02, 0.65);
        characters.kai.root.rotation.y = 0.2;
        heroFloat.add(characters.kai.root);
        characters.nia.root.position.set(-3.55, 0.0, -0.45);
        characters.nia.root.rotation.y = 0.2;
        heroFloat.add(characters.nia.root);

        const heroKeys: ReefCharacterKey[] = ["kai", "nia"];
        const enemyKeys: ReefCharacterKey[] = ["captain", "patch", "pearl", "tiki"];
        enemyKeys.forEach((key) => {
          characters[key].root.rotation.y = -0.2;
          rivalFloat.add(characters[key].root);
        });

        type Effect = {
          root: import("three").Group;
          age: number;
          duration: number;
          delay: number;
          peakScale: number;
          startY: number;
          rise: number;
          spin: number;
        };
        type OverboardFlight = {
          key: ReefCharacterKey;
          start: import("three").Vector3;
          age: number;
          duration: number;
          direction: -1 | 1;
        };
        type Projectile = {
          root: import("three").Group;
          velocity: import("three").Vector3;
          owner: "player" | "enemy";
          ammo: Ammo;
          damage: number;
        };
        const effects: Effect[] = [];
        const overboardFlights: OverboardFlight[] = [];
        let projectile: Projectile | null = null;
        let phase: Phase = "menu";
        let round = 1;
        let playerHp = 100;
        let enemyHp: number = ROUND_DATA[0].hp;
        let enemyMax: number = ROUND_DATA[0].hp;
        let angle = 35;
        let power = 68;
        let ammo: Ammo = "coconut";
        let pineapple = 0;
        let volley = 0;
        let shells = 0;
        let damageBonus = 0;
        let armor = 0;
        let heroShot = 0;
        let coralHp = 2;
        let driftwoodHp = 2;
        let activeEnemies: ReefCharacterKey[] = ROUND_DATA[0].enemies.slice();
        let enemyAboard: ReefCharacterKey[] = activeEnemies.slice();
        let heroAboard: ReefCharacterKey[] = heroKeys.slice();

        const sync = (status: string) => {
          if (disposed) return;
          setUi({
            phase,
            round,
            playerHp: Math.max(0, Math.ceil(playerHp)),
            enemyHp: Math.max(0, Math.ceil(enemyHp)),
            enemyMax,
            angle: Math.round(angle),
            power: Math.round(power),
            ammo,
            pineapple,
            volley,
            shells,
            status,
            loading: "Ready",
            sound,
          });
        };
        const setPhase = (next: Phase, status: string) => {
          phase = next;
          aimMarker.visible = next === "player";
          sync(status);
        };
        const resetCharacter = (key: ReefCharacterKey, position: import("three").Vector3, facing: number) => {
          const character = characters[key];
          character.root.position.copy(position);
          character.root.rotation.set(0, facing, 0);
          character.root.visible = true;
          character.play("idle");
        };
        const placeHeroes = () => {
          const count = Math.max(1, Math.ceil(playerHp / 50));
          heroAboard = heroKeys.slice(0, count);
          resetCharacter("kai", new THREE.Vector3(-0.8, -0.06, 0.65), 0.2);
          resetCharacter("nia", new THREE.Vector3(-3.55, -0.08, -0.45), 0.2);
          heroKeys.forEach((key) => (characters[key].root.visible = heroAboard.includes(key)));
        };
        const placeEnemies = () => {
          enemyAboard = activeEnemies.slice();
          enemyKeys.forEach((key) => (characters[key].root.visible = false));
          const slots = activeEnemies.length === 1 ? [0.25] : activeEnemies.length === 2 ? [-0.9, 1] : [-1.55, 0.15, 1.65];
          activeEnemies.forEach((key, index) => resetCharacter(key, new THREE.Vector3(slots[index], 1.82, 2.05 + (index % 2) * 0.18), -0.2));
        };
        const setupRound = () => {
          const data = ROUND_DATA[round - 1];
          enemyMax = data.hp;
          enemyHp = data.hp;
          activeEnemies = data.enemies.slice();
          pineapple = round >= 2 ? 2 : 0;
          volley = round >= 3 ? 2 : 0;
          ammo = "coconut";
          coralHp = 2;
          driftwoodHp = 2;
          coral.visible = true;
          driftwood.visible = true;
          rivalFloat.visible = true;
          overboardFlights.length = 0;
          placeHeroes();
          placeEnemies();
        };
        const showEffect = (kind: "impact" | "splash", position: import("three").Vector3) => {
          const root = fit(sceneFor(kind === "impact" ? ASSETS.world.impact : ASSETS.world.splash), kind === "impact" ? 2.4 : 2.9);
          root.position.copy(position);
          root.scale.setScalar(0.12);
          scene.add(root);
          effects.push({ root, age: 0, duration: 0.72, delay: 0, peakScale: 1.35, startY: position.y, rise: 0.14, spin: 2.8 });
        };
        const showOverboardSplash = (position: import("three").Vector3) => {
          const pieces = [
            { x: 0, z: 0, size: 4.4, delay: 0, peakScale: 1.52, rise: 0.7, spin: 3.4 },
            { x: -0.78, z: 0.12, size: 2.55, delay: 0.07, peakScale: 1.28, rise: 0.46, spin: -4.2 },
            { x: 0.78, z: -0.08, size: 2.55, delay: 0.13, peakScale: 1.28, rise: 0.46, spin: 4.2 },
          ];
          pieces.forEach((piece) => {
            const root = fit(sceneFor(ASSETS.world.splash), piece.size);
            root.position.copy(position).add(new THREE.Vector3(piece.x, 0, piece.z));
            root.scale.setScalar(0.04);
            scene.add(root);
            effects.push({
              root,
              age: 0,
              duration: 0.92,
              delay: piece.delay,
              peakScale: piece.peakScale,
              startY: position.y,
              rise: piece.rise,
              spin: piece.spin,
            });
          });
        };
        const knockOverboard = (key: ReefCharacterKey, direction: -1 | 1) => {
          const character = characters[key];
          overboardFlights.splice(0, overboardFlights.length, ...overboardFlights.filter((flight) => flight.key !== key));
          character.play("fall");
          overboardFlights.push({
            key,
            start: character.root.position.clone(),
            age: 0,
            duration: 1.35,
            direction,
          });
        };
        const removeProjectile = () => {
          if (!projectile) return;
          scene.remove(projectile.root);
          projectile = null;
        };
        const lose = () => {
          removeProjectile();
          playerHp = 0;
          enemyAboard.forEach((key) => characters[key].play("victory"));
          playSound("defeat");
          setPhase("lost", "The rivals found the treasure first!");
        };
        const winGame = () => {
          removeProjectile();
          enemyHp = 0;
          heroAboard.forEach((key) => characters[key].play("victory"));
          playSound("victory");
          setPhase("won", "Treasure Tide champions!");
        };
        const finishRound = () => {
          enemyHp = 0;
          rivalFloat.visible = false;
          shells += 12 + round * 4;
          heroAboard.forEach((key) => characters[key].play("victory"));
          if (round >= ROUND_DATA.length) winGame();
          else setPhase("upgrade", `Round ${round} cleared — choose a float upgrade`);
        };
        const startPlayerTurn = () => setPhase("player", "Your turn — set angle and power");
        const startEnemyTurn = () => {
          if (enemyAboard.length === 0) return;
          setPhase("enemy", "Rivals are lining up a shot…");
          later(() => {
            if (disposed || phase !== "enemy") return;
            const enemy = enemyAboard[Math.floor(Math.random() * enemyAboard.length)];
            characters[enemy].play("throw");
            const aiAngle = 31 + Math.random() * 5;
            const aiPower = Math.min(92, 66 + round * 3 + (Math.random() - 0.5) * 6);
            spawnProjectile("enemy", "coconut", aiAngle, aiPower, 13 + round * 4);
          }, 1050);
        };
        const endFlight = (message: string, delay = 780) => {
          removeProjectile();
          sync(message);
          later(() => {
            if (disposed || phase === "won" || phase === "lost" || phase === "upgrade") return;
            if (phase === "projectile") startEnemyTurn();
            else startPlayerTurn();
          }, delay);
        };
        const spawnProjectile = (owner: "player" | "enemy", shotAmmo: Ammo, shotAngle: number, shotPower: number, damage: number) => {
          removeProjectile();
          const root = fit(sceneFor(ASSETS.world[AMMO_INFO[shotAmmo].model]), shotAmmo === "pineapple" ? 1.05 : 0.82);
          const start = new THREE.Vector3(owner === "player" ? -7.55 : 7.55, 3.55, 0.75);
          root.position.copy(start);
          scene.add(root);
          const radians = THREE.MathUtils.degToRad(shotAngle);
          const speed = 9.2 + shotPower * 0.086;
          projectile = {
            root,
            velocity: new THREE.Vector3((owner === "player" ? 1 : -1) * Math.cos(radians) * speed, Math.sin(radians) * speed, 0),
            owner,
            ammo: shotAmmo,
            damage,
          };
          playSound("launch");
          phase = owner === "player" ? "projectile" : "enemy";
          aimMarker.visible = false;
          sync(owner === "player" ? `${AMMO_INFO[shotAmmo].label} away!` : "Incoming!");
        };
        const hitTeam = (target: "player" | "enemy") => {
          if (!projectile) return;
          const hitPosition = projectile.root.position.clone();
          const damage = projectile.damage + (projectile.ammo === "pineapple" ? 5 : 0);
          showEffect("impact", hitPosition);
          playSound("impact");
          if (target === "enemy") {
            enemyHp -= damage;
            const hitKey = enemyAboard[Math.floor(Math.random() * enemyAboard.length)];
            const targetCount = Math.max(0, Math.ceil((Math.max(0, enemyHp) / enemyMax) * activeEnemies.length));
            const knocked = enemyAboard.length > targetCount;
            if (knocked) {
              enemyAboard = enemyAboard.filter((key) => key !== hitKey);
              knockOverboard(hitKey, 1);
            } else {
              characters[hitKey].play("hit");
            }
            if (enemyHp <= 0) {
              removeProjectile();
              setPhase("projectile", `${ASSETS.characters[hitKey].name} went overboard!`);
              later(() => !disposed && finishRound(), 1380);
              return;
            }
            endFlight(knocked ? `${ASSETS.characters[hitKey].name} knocked overboard!` : `Direct hit! ${Math.round(damage)} damage`, knocked ? 1480 : 780);
          } else {
            const reduced = Math.max(7, damage - armor);
            playerHp -= reduced;
            const hitKey = heroAboard[Math.floor(Math.random() * heroAboard.length)];
            const targetCount = Math.max(0, Math.ceil((Math.max(0, playerHp) / 100) * heroKeys.length));
            const knocked = heroAboard.length > targetCount;
            if (knocked) {
              heroAboard = heroAboard.filter((key) => key !== hitKey);
              knockOverboard(hitKey, -1);
            } else {
              characters[hitKey].play("hit");
            }
            if (playerHp <= 0) {
              removeProjectile();
              setPhase("enemy", `${ASSETS.characters[hitKey].name} went overboard!`);
              later(() => !disposed && lose(), 1380);
              return;
            }
            endFlight(knocked ? `${ASSETS.characters[hitKey].name} knocked overboard!` : `Ouch! The tube team took ${Math.round(reduced)} damage`, knocked ? 1480 : 780);
          }
        };

        controllerRef.current = {
          start() {
            round = 1;
            playerHp = 100;
            shells = 0;
            damageBonus = 0;
            armor = 0;
            setupRound();
            if (sound) void audio.music.play().catch(() => undefined);
            startPlayerTurn();
          },
          fire() {
            if (phase !== "player") return;
            if (ammo === "pineapple" && pineapple <= 0) return;
            if (ammo === "volley" && volley <= 0) return;
            const firedAmmo = ammo;
            if (firedAmmo === "pineapple") pineapple -= 1;
            if (firedAmmo === "volley") volley -= 1;
            if ((firedAmmo === "pineapple" && pineapple <= 0) || (firedAmmo === "volley" && volley <= 0)) ammo = "coconut";
            if (heroAboard.length === 0) return;
            const thrower = characters[heroAboard[heroShot++ % heroAboard.length]];
            thrower.play("throw");
            spawnProjectile("player", firedAmmo, angle, power, AMMO_INFO[firedAmmo].damage + damageBonus);
          },
          setAngle(value) {
            if (phase !== "player") return;
            angle = THREE.MathUtils.clamp(value, 15, 76);
            heroBlaster.rotation.z = THREE.MathUtils.degToRad(angle - 35) * 0.55;
            aimMarker.rotation.z = THREE.MathUtils.degToRad(angle - 72);
            sync("Your turn — set angle and power");
          },
          setPower(value) {
            if (phase !== "player") return;
            power = THREE.MathUtils.clamp(value, 35, 100);
            sync("Your turn — set angle and power");
          },
          setAmmo(nextAmmo) {
            if (phase !== "player") return;
            if (nextAmmo === "pineapple" && pineapple <= 0) return;
            if (nextAmmo === "volley" && volley <= 0) return;
            ammo = nextAmmo;
            sync(`${AMMO_INFO[nextAmmo].label} selected`);
          },
          chooseUpgrade(upgrade) {
            if (phase !== "upgrade") return;
            if (upgrade === "power") damageBonus += 8;
            if (upgrade === "patch") playerHp = Math.min(100, playerHp + 34);
            if (upgrade === "armor") armor += 4;
            round += 1;
            setupRound();
            startPlayerTurn();
          },
          toggleSound() {
            sound = !sound;
            if (sound && phase !== "menu" && phase !== "loading") void audio.music.play().catch(() => undefined);
            if (!sound) Object.values(audio).forEach((clip) => clip.pause());
            sync(sound ? "Sound on" : "Sound off");
          },
        };

        const resize = () => {
          if (!canvasRef.current) return;
          const width = canvasRef.current.clientWidth;
          const height = canvasRef.current.clientHeight;
          renderer.setSize(width, height, false);
          camera.aspect = width / Math.max(height, 1);
          camera.updateProjectionMatrix();
        };
        const onKeyDown = (event: KeyboardEvent) => {
          if (event.repeat) return;
          if (event.code === "Space") {
            event.preventDefault();
            controllerRef.current?.fire();
          }
          if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") controllerRef.current?.setAngle(angle + 2);
          if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") controllerRef.current?.setAngle(angle - 2);
          if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") controllerRef.current?.setPower(power + 3);
          if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") controllerRef.current?.setPower(power - 3);
          if (event.key === "1") controllerRef.current?.setAmmo("coconut");
          if (event.key === "2") controllerRef.current?.setAmmo("pineapple");
          if (event.key === "3") controllerRef.current?.setAmmo("volley");
        };
        window.addEventListener("resize", resize);
        window.addEventListener("keydown", onKeyDown);
        resize();
        canvasRef.current.dataset.assetState = "ready";
        const qaParams = new URLSearchParams(window.location.search);
        if (qaParams.get("qa-no-scenery") === "1") scenicWorld.visible = false;
        const qaRound = Number(qaParams.get("qa-round"));
        const qaPlayerHp = Number(qaParams.get("qa-player-hp"));
        if (qaParams.get("qa-upgrade") === "1") {
          round = Number.isInteger(qaRound) && qaRound >= 1 && qaRound < ROUND_DATA.length ? qaRound : 1;
          setupRound();
          setPhase("upgrade", `Round ${round} cleared — choose a float upgrade`);
        } else if (Number.isInteger(qaRound) && qaRound >= 1 && qaRound <= ROUND_DATA.length) {
          round = qaRound;
          if (Number.isFinite(qaPlayerHp) && qaPlayerHp > 0 && qaPlayerHp <= 100) playerHp = qaPlayerHp;
          setupRound();
          if (qaParams.get("qa-no-cover") === "1") {
            coral.visible = false;
            driftwood.visible = false;
          }
          startPlayerTurn();
          const qaSplash = qaParams.get("qa-splash");
          if (qaSplash === "hero" || qaSplash === "rival") {
            const requestedSplashDelay = Number(qaParams.get("qa-splash-delay"));
            const splashDelay = Number.isFinite(requestedSplashDelay)
              ? THREE.MathUtils.clamp(requestedSplashDelay, 300, 10000)
              : 650;
            later(() => {
              const key = qaSplash === "hero" ? heroAboard.at(-1) : enemyAboard[0];
              if (key) knockOverboard(key, qaSplash === "hero" ? -1 : 1);
            }, splashDelay);
          }
        } else {
          setupRound();
          setPhase("menu", "Three rounds stand between you and the treasure");
        }

        let lastFrameTime = performance.now();
        let elapsed = 0;
        const animate = () => {
          if (disposed) return;
          frame = requestAnimationFrame(animate);
          const now = performance.now();
          const dt = Math.min((now - lastFrameTime) / 1000, 0.04);
          lastFrameTime = now;
          elapsed += dt;
          characterEntries.forEach(([key]) => characters[key].mixer.update(dt));

          ocean.position.y = -2.02 + Math.sin(elapsed * 0.55) * 0.035;
          waterBaseColor.offset.set(elapsed * 0.003, elapsed * -0.0015);
          waterNormal.offset.set(elapsed * -0.004, elapsed * 0.002);
          waterRoughness.offset.copy(waterBaseColor.offset);
          leftCloudBank.position.y = 8.2 + Math.sin(elapsed * 0.12) * 0.12;
          centerCloudBank.position.y = 10.2 + Math.sin(elapsed * 0.1 + 1.8) * 0.1;
          rightCloudBank.position.y = 8.6 + Math.sin(elapsed * 0.11 + 3.1) * 0.12;
          heroFloat.position.y = 1.1 + Math.sin(elapsed * 1.35) * 0.11;
          heroFloat.rotation.z = Math.sin(elapsed * 1.15) * 0.018;
          kaiTube.rotation.z = Math.sin(elapsed * 1.55) * 0.035;
          niaTube.rotation.z = Math.sin(elapsed * 1.4 + 1.1) * 0.038;
          rivalFloat.position.y = 1.05 + Math.sin(elapsed * 1.25 + 1.7) * 0.12;
          rivalFloat.rotation.z = Math.sin(elapsed * 1.05 + 1.4) * 0.02;
          buoy.position.y = 0.05 + Math.sin(elapsed * 1.7) * 0.13;
          buoy.rotation.y += dt * 0.3;
          shellCoin.rotation.y += dt * 1.55;
          shellCoin.position.y = 4.05 + Math.sin(elapsed * 2.2) * 0.22;
          treasure.rotation.y = 0.35 + Math.sin(elapsed * 0.7) * 0.035;

          if (projectile) {
            projectile.velocity.y -= 9.35 * dt;
            projectile.root.position.addScaledVector(projectile.velocity, dt);
            projectile.root.rotation.x += dt * 4.2;
            projectile.root.rotation.z += dt * 5.4;
            const p = projectile.root.position;
            const owner = projectile.owner;
            if (p.distanceTo(new THREE.Vector3(0, 3.1, 0.2)) < 1.35) {
              shells += 5;
              showEffect("impact", p.clone());
              playSound("bonus");
              endFlight("Star buoy! +5 golden shells");
            } else if (owner === "player" && p.distanceTo(new THREE.Vector3(10.8, 3.6, 0.7)) < 3.05) {
              hitTeam("enemy");
            } else if (owner === "enemy" && p.distanceTo(new THREE.Vector3(-10.8, 3.55, 0.7)) < 3.05) {
              hitTeam("player");
            } else if (owner === "player" && driftwood.visible && p.distanceTo(new THREE.Vector3(6.2, 1.45, 0.2)) < 1.8) {
              driftwoodHp -= 1;
              showEffect("impact", p.clone());
              playSound("impact");
              if (driftwoodHp <= 0) driftwood.visible = false;
              endFlight(driftwood.visible ? "The driftwood blocked it" : "Driftwood cover smashed!");
            } else if (owner === "enemy" && coral.visible && p.distanceTo(new THREE.Vector3(-6.2, 1.6, 0.2)) < 1.8) {
              coralHp -= 1;
              showEffect("impact", p.clone());
              playSound("impact");
              if (coralHp <= 0) coral.visible = false;
              endFlight(coral.visible ? "The coral saved the tube team" : "Coral cover shattered!");
            } else if (p.y < 0.05 || Math.abs(p.x) > 25 || p.y > 22) {
              showEffect("splash", new THREE.Vector3(THREE.MathUtils.clamp(p.x, -23, 23), 0.02, 0.3));
              playSound("splash");
              endFlight(owner === "player" ? "Splash! The rivals are laughing" : "Their shot found the fish");
            }
          }

          for (let index = overboardFlights.length - 1; index >= 0; index -= 1) {
            const flight = overboardFlights[index];
            flight.age += dt;
            const progress = Math.min(1, flight.age / flight.duration);
            const character = characters[flight.key].root;
            character.position.set(
              flight.start.x + flight.direction * progress * 3.25,
              flight.start.y + Math.sin(progress * Math.PI) * 2.7 - progress * 2.85,
              flight.start.z + progress * 1.15,
            );
            character.rotation.x = progress * 0.7;
            character.rotation.z = flight.direction * progress * 1.45;
            if (progress >= 1) {
              const splashPosition = character.getWorldPosition(new THREE.Vector3());
              splashPosition.y = 0.04;
              showOverboardSplash(splashPosition);
              playSound("splash");
              character.visible = false;
              overboardFlights.splice(index, 1);
            }
          }

          for (let index = effects.length - 1; index >= 0; index -= 1) {
            const effect = effects[index];
            effect.age += dt;
            if (effect.age < effect.delay) {
              effect.root.visible = false;
              continue;
            }
            effect.root.visible = true;
            const progress = (effect.age - effect.delay) / effect.duration;
            const burst = Math.sin(Math.min(1, progress) * Math.PI);
            effect.root.scale.setScalar(burst * effect.peakScale + 0.04);
            effect.root.position.y = effect.startY + burst * effect.rise;
            effect.root.rotation.y += dt * effect.spin;
            if (progress >= 1) {
              scene.remove(effect.root);
              effects.splice(index, 1);
            }
          }

          renderer.render(scene, camera);
        };
        animate();

        return () => {
          window.removeEventListener("resize", resize);
          window.removeEventListener("keydown", onKeyDown);
          renderer.dispose();
        };
      } catch (error) {
        console.error(error);
        if (canvasRef.current) canvasRef.current.dataset.assetState = "error";
        if (!disposed) setUi((value) => ({ ...value, phase: "error", status: "A Mint asset failed to load. Refresh to retry." }));
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
      Object.values(audio).forEach((clip) => {
        clip.pause();
        clip.src = "";
      });
      controllerRef.current = null;
    };
  }, []);

  const canControl = ui.phase === "player";
  const playerPct = Math.max(0, Math.min(100, ui.playerHp));
  const enemyPct = Math.max(0, Math.min(100, (ui.enemyHp / ui.enemyMax) * 100));

  return (
    <main
      className="reef-game"
      style={{ "--reef-hud-sprite": `url(${ASSETS.images.hud})` } as CSSProperties}
    >
      <canvas ref={canvasRef} className="reef-canvas" aria-label="Reef Rivals 3D game" />

      <header className="reef-topbar">
        <img src={ASSETS.images.title} alt="Reef Rivals: Treasure Tide" className="reef-mini-logo" />
        <div className="reef-round-chip">ROUND {ui.round}/3</div>
        <button className="reef-sound" onClick={() => controllerRef.current?.toggleSound()} aria-label="Toggle sound">
          {ui.sound ? "SOUND ON" : "SOUND OFF"}
        </button>
      </header>

      <section className="reef-health reef-health-player" aria-label="Player health">
        <div className="reef-health-copy"><span>TIDE TEAM</span><strong>{ui.playerHp}</strong></div>
        <div className="reef-health-track"><i style={{ width: `${playerPct}%` }} /></div>
      </section>
      <section className="reef-health reef-health-enemy" aria-label="Rival health">
        <div className="reef-health-copy"><span>REEF RIVALS</span><strong>{ui.enemyHp}</strong></div>
        <div className="reef-health-track"><i style={{ width: `${enemyPct}%` }} /></div>
      </section>

      <div className={`reef-status reef-status-${ui.phase}`}>{ui.status}</div>
      <div className="reef-shells"><span className="reef-icon reef-icon-shell" />{ui.shells}</div>

      {ui.phase === "loading" && (
        <section className="reef-overlay reef-loading">
          <div className="reef-spinner"><span /></div>
          <p>{ui.loading}</p>
        </section>
      )}

      {ui.phase === "menu" && (
        <section className="reef-overlay reef-menu">
          <img src={ASSETS.images.title} alt="Reef Rivals: Treasure Tide" />
          <p>Three turn-based tube-and-raft battles. Set the angle, charge the shot, smash cover, and claim the treasure.</p>
          <button className="reef-primary" onClick={() => controllerRef.current?.start()}>START THE TIDE</button>
          <small>W/S angle · A/D power · 1/2/3 ammo · Space to fire</small>
        </section>
      )}

      {ui.phase === "upgrade" && (
        <section className="reef-overlay reef-upgrade">
          <span className="reef-kicker">ROUND {ui.round} CLEARED</span>
          <h1>Pick one float upgrade</h1>
          <div className="reef-upgrade-grid">
            <button onClick={() => controllerRef.current?.chooseUpgrade("power")}>
              <span className="reef-upgrade-art" style={{ backgroundImage: `url(${ASSETS.images.upgradePower})` }} aria-hidden="true" />
              <b>HOT COCONUTS</b><span className="reef-upgrade-copy">+8 damage to every shot</span>
            </button>
            <button onClick={() => controllerRef.current?.chooseUpgrade("patch")}>
              <span className="reef-upgrade-art" style={{ backgroundImage: `url(${ASSETS.images.upgradePatch})` }} aria-hidden="true" />
              <b>HEART PATCH</b><span className="reef-upgrade-copy">Restore 34 team health</span>
            </button>
            <button onClick={() => controllerRef.current?.chooseUpgrade("armor")}>
              <span className="reef-upgrade-art" style={{ backgroundImage: `url(${ASSETS.images.upgradeArmor})` }} aria-hidden="true" />
              <b>CORAL ARMOR</b><span className="reef-upgrade-copy">Reduce every rival hit by 4</span>
            </button>
          </div>
        </section>
      )}

      {(ui.phase === "won" || ui.phase === "lost" || ui.phase === "error") && (
        <section className={`reef-overlay reef-result reef-result-${ui.phase}`}>
          <span className={`reef-result-icon reef-icon reef-icon-${ui.phase === "won" ? "star" : "heart"}`} />
          <h1>{ui.phase === "won" ? "TREASURE TIDE CHAMPIONS!" : ui.phase === "lost" ? "TUBES TIPPED!" : "THE TIDE GOT STUCK"}</h1>
          <p>{ui.status}</p>
          <strong>{ui.shells} GOLDEN SHELLS</strong>
          {ui.phase !== "error" && <button className="reef-primary" onClick={() => controllerRef.current?.start()}>PLAY AGAIN</button>}
        </section>
      )}

      <section className={`reef-controls ${canControl ? "is-ready" : "is-locked"}`}>
        <div className="reef-control-block">
          <label htmlFor="angle">ANGLE <b>{ui.angle}°</b></label>
          <input id="angle" type="range" min="15" max="76" value={ui.angle} disabled={!canControl}
            onChange={(event) => controllerRef.current?.setAngle(Number(event.target.value))} />
        </div>
        <div className="reef-control-block">
          <label htmlFor="power">POWER <b>{ui.power}%</b></label>
          <input id="power" type="range" min="35" max="100" value={ui.power} disabled={!canControl}
            onChange={(event) => controllerRef.current?.setPower(Number(event.target.value))} />
        </div>
        <div className="reef-ammo" aria-label="Choose ammo">
          <button className={ui.ammo === "coconut" ? "is-active" : ""} disabled={!canControl}
            onClick={() => controllerRef.current?.setAmmo("coconut")}><span className="reef-icon reef-icon-coconut" /><b>∞</b></button>
          <button className={ui.ammo === "pineapple" ? "is-active" : ""} disabled={!canControl || ui.pineapple <= 0}
            onClick={() => controllerRef.current?.setAmmo("pineapple")}><span className="reef-icon reef-icon-pineapple" /><b>{ui.pineapple}</b></button>
          <button className={ui.ammo === "volley" ? "is-active" : ""} disabled={!canControl || ui.volley <= 0}
            onClick={() => controllerRef.current?.setAmmo("volley")}><span className="reef-icon reef-icon-volley" /><b>{ui.volley}</b></button>
        </div>
        <button className="reef-fire" disabled={!canControl} onClick={() => controllerRef.current?.fire()}>
          <span>FIRE!</span><small>SPACE</small>
        </button>
      </section>
      <div className="reef-credit">BROUGHT TO YOU BY MINT</div>
    </main>
  );
}
