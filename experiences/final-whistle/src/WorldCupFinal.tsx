"use client";

import { useEffect, useRef, useState } from "react";
import {
  WORLD_CUP_MINT_ASSETS as ASSETS,
  type WorldCupCharacterKey,
  type WorldCupFanKey,
  type WorldCupStaffKey,
} from "./worldCupMintAssets";

type Phase = "loading" | "menu" | "playing" | "goal" | "finished" | "error";
type Team = "spain" | "argentina";
type Command = "up" | "down" | "left" | "right" | "sprint" | "shoot";
type Ui = {
  phase: Phase;
  spain: number;
  argentina: number;
  seconds: number;
  extraTime: boolean;
  status: string;
  loading: string;
  sound: boolean;
  shotCharge: number;
  stamina: number;
  activePlayer: number;
  possession: Team | "loose";
  winner: Team | "draw" | null;
};
type Controller = {
  start: () => void;
  restart: () => void;
  toggleSound: () => void;
  press: (command: Command) => void;
  release: (command: Command) => void;
  pass: () => void;
  throughPass: () => void;
  tackle: () => void;
  switchPlayer: () => void;
};

const MATCH_SECONDS = 150;
const FIELD_HALF_X = 18;
const FIELD_HALF_Z = 11.65;
const GOAL_HALF_Z = 2.15;
const KEEPER_X = FIELD_HALF_X - 1.2;
const STADIUM_WIDTH = 58;
const STADIUM_HEIGHT = 11;
const STADIUM_DEPTH = 44;
const INITIAL_UI: Ui = {
  phase: "loading",
  spain: 0,
  argentina: 0,
  seconds: MATCH_SECONDS,
  extraTime: false,
  status: "The final is assembling…",
  loading: "Loading Mint stadium assets…",
  sound: true,
  shotCharge: 0,
  stamina: 100,
  activePlayer: 7,
  possession: "loose",
  winner: null,
};

const formatTime = (seconds: number) => {
  if (seconds < 0) return "GOLDEN GOAL";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.max(0, seconds % 60).toString().padStart(2, "0")}`;
};

export default function WorldCupFinal() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<Controller | null>(null);
  const [ui, setUi] = useState<Ui>(INITIAL_UI);

  useEffect(() => {
    if (!canvasRef.current) return;
    let disposed = false;
    let animationFrame = 0;
    let runtimeCleanup = () => undefined;
    const timers: number[] = [];
    const held = new Set<Command>();

    const audio = Object.fromEntries(
      Object.entries(ASSETS.audio).map(([name, source]) => [name, new Audio(source)]),
    ) as Record<keyof typeof ASSETS.audio, HTMLAudioElement>;
    audio.crowd.loop = true;
    audio.crowd.volume = 0.28;
    audio.whistle.volume = 0.72;
    audio.kick.volume = 0.55;
    audio.goal.volume = 0.76;
    audio.save.volume = 0.72;
    audio.victory.volume = 0.66;
    let sound = true;
    const playSound = (name: keyof typeof ASSETS.audio, restart = true) => {
      if (!sound) return;
      const clip = audio[name];
      if (restart) clip.currentTime = 0;
      void clip.play().catch(() => undefined);
    };
    const later = (callback: () => void, delay: number) => {
      const id = window.setTimeout(callback, delay);
      timers.push(id);
      return id;
    };

    void (async () => {
      try {
        const THREE = await import("three");
        const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
        const { clone: cloneSkeleton } = await import("three/addons/utils/SkeletonUtils.js");
        if (disposed || !canvasRef.current) return;

        type Player = {
          team: Team;
          role: "outfield" | "goalkeeper";
          number: number;
          root: import("three").Group;
          mixer: import("three").AnimationMixer;
          actions: Record<string, import("three").AnimationAction>;
          currentAction: string;
          velocity: import("three").Vector3;
          facing: import("three").Vector3;
          home: import("three").Vector3;
          locomotionMoving: boolean;
          actionLock: number;
          possessionSince: number;
          cooldown: number;
        };
        type Spectator = {
          root: import("three").Group;
          mixer: import("three").AnimationMixer;
          actions: Record<string, import("three").AnimationAction>;
          currentAction: "idle" | "cheer";
        };
        type TechnicalAreaPerson = {
          root: import("three").Group;
          mixer: import("three").AnimationMixer;
        };

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x09162f);
        scene.fog = new THREE.Fog(0x09162f, 46, 96);
        const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 150);
        camera.position.set(-1, 39, 30);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({
          canvas: canvasRef.current,
          antialias: true,
          powerPreference: "high-performance",
        });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;

        scene.add(new THREE.HemisphereLight(0xffe3a1, 0x14224a, 2.15));
        const keyLight = new THREE.DirectionalLight(0xffd27c, 3.8);
        keyLight.position.set(-12, 25, 14);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(2048, 2048);
        keyLight.shadow.camera.left = -34;
        keyLight.shadow.camera.right = 34;
        keyLight.shadow.camera.top = 30;
        keyLight.shadow.camera.bottom = -26;
        scene.add(keyLight);
        const blueRim = new THREE.DirectionalLight(0x79bfff, 2.2);
        blueRim.position.set(16, 13, -20);
        scene.add(blueRim);
        const warmRim = new THREE.DirectionalLight(0xff665e, 1.35);
        warmRim.position.set(-20, 7, -10);
        scene.add(warmRim);

        const manager = new THREE.LoadingManager();
        manager.onProgress = (_url, loaded, total) => {
          if (!disposed) {
            setUi((value) => ({
              ...value,
              loading: `Opening the final · ${loaded}/${total} Mint assets`,
            }));
          }
        };
        const loader = new GLTFLoader(manager);
        const characterEntries = Object.entries(ASSETS.characters) as [
          WorldCupCharacterKey,
          (typeof ASSETS.characters)[WorldCupCharacterKey],
        ][];
        const fanEntries = Object.entries(ASSETS.fans) as [
          WorldCupFanKey,
          (typeof ASSETS.fans)[WorldCupFanKey],
        ][];
        const staffEntries = Object.entries(ASSETS.staff) as [
          WorldCupStaffKey,
          (typeof ASSETS.staff)[WorldCupStaffKey],
        ][];
        const paths: string[] = [
          ...Object.values(ASSETS.world),
          ...characterEntries.flatMap(([, character]) => [
            character.model,
            ...Object.values(character.animations),
          ]),
          ...fanEntries.flatMap(([, fan]) => [
            fan.model,
            ...Object.values(fan.animations),
          ]),
          ...staffEntries.flatMap(([, person]) => [person.model, person.animation]),
        ];
        const loaded = await Promise.all(
          [...new Set(paths)].map(async (path) => [path, await loader.loadAsync(path)] as const),
        );
        if (disposed) return;
        const gltfs = new Map(loaded);
        const sourceScene = (path: string) => cloneSkeleton(gltfs.get(path)!.scene);

        const prepare = <T extends import("three").Object3D>(object: T): T => {
          object.traverse((child) => {
            const mesh = child as import("three").Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.frustumCulled = false;
          });
          return object;
        };
        const fitWidth = (object: import("three").Object3D, width: number) => {
          const root = new THREE.Group();
          root.add(object);
          object.updateMatrixWorld(true);
          const before = new THREE.Box3().setFromObject(object);
          const scale = width / Math.max(before.getSize(new THREE.Vector3()).x, 0.001);
          object.scale.setScalar(scale);
          object.updateMatrixWorld(true);
          const after = new THREE.Box3().setFromObject(object);
          const center = after.getCenter(new THREE.Vector3());
          object.position.set(-center.x, -after.min.y, -center.z);
          return prepare(root);
        };
        const fitHeight = (object: import("three").Object3D, height: number) => {
          const root = new THREE.Group();
          root.add(object);
          object.updateMatrixWorld(true);
          const before = new THREE.Box3().setFromObject(object);
          const scale = height / Math.max(before.getSize(new THREE.Vector3()).y, 0.001);
          object.scale.setScalar(scale);
          object.updateMatrixWorld(true);
          const after = new THREE.Box3().setFromObject(object);
          const center = after.getCenter(new THREE.Vector3());
          object.position.set(-center.x, -after.min.y, -center.z);
          return prepare(root);
        };
        const fitLargest = (object: import("three").Object3D, size: number) => {
          const root = new THREE.Group();
          root.add(object);
          object.updateMatrixWorld(true);
          const before = new THREE.Box3().setFromObject(object);
          const extent = before.getSize(new THREE.Vector3());
          object.scale.setScalar(size / Math.max(extent.x, extent.y, extent.z, 0.001));
          object.updateMatrixWorld(true);
          const after = new THREE.Box3().setFromObject(object);
          const center = after.getCenter(new THREE.Vector3());
          object.position.set(-center.x, -after.min.y, -center.z);
          return prepare(root);
        };
        const fitDimensions = (
          object: import("three").Object3D,
          width: number,
          height: number,
          depth: number,
        ) => {
          const root = new THREE.Group();
          root.add(object);
          object.updateMatrixWorld(true);
          const before = new THREE.Box3().setFromObject(object);
          const extent = before.getSize(new THREE.Vector3());
          object.scale.set(
            width / Math.max(extent.x, 0.001),
            height / Math.max(extent.y, 0.001),
            depth / Math.max(extent.z, 0.001),
          );
          object.updateMatrixWorld(true);
          const after = new THREE.Box3().setFromObject(object);
          const center = after.getCenter(new THREE.Vector3());
          object.position.set(-center.x, -after.min.y, -center.z);
          return prepare(root);
        };

        const stadium = new THREE.Group();
        scene.add(stadium);
        const stadiumSource = sourceScene(ASSETS.world.integratedStadium);
        const stadiumSize = new THREE.Box3().setFromObject(stadiumSource).getSize(new THREE.Vector3());
        if (stadiumSize.z > stadiumSize.x) stadiumSource.rotation.y = Math.PI / 2;
        const stadiumShell = fitDimensions(
          stadiumSource,
          STADIUM_WIDTH,
          STADIUM_HEIGHT,
          STADIUM_DEPTH,
        );
        // Mint authored the marked pitch, runoff, fascia, seating tiers,
        // corners as one connected mesh. Its pitch plane is 2.86
        // units above the fitted model's base, so lower the shell until that
        // authoritative surface is world Y=0.
        stadiumShell.position.y = -2.86;
        stadiumShell.traverse((child) => {
          const mesh = child as import("three").Mesh;
          if (mesh.isMesh) mesh.castShadow = false;
        });
        stadium.add(stadiumShell);
        const tuneTurf = (
          object: import("three").Object3D,
          layer: number,
          flattenSurfaceNormals = false,
        ) => {
          object.traverse((child) => {
            const mesh = child as import("three").Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = false;
            mesh.renderOrder = layer;
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            const tuned = materials.map((material) => {
              const clone = material.clone();
              if (clone instanceof THREE.MeshStandardMaterial) {
                clone.roughness = 0.96;
                clone.metalness = 0;
                clone.envMapIntensity = 0.18;
                if (flattenSurfaceNormals) {
                  // The Mint pitch normal map pinches around the centre-circle
                  // UV fan and exposes large triangular lighting wedges. Keep
                  // the authored colour/line texture, but render this flat
                  // playing surface without that incompatible normal layer.
                  clone.normalMap = null;
                  clone.normalScale.set(0, 0);
                }
              }
              clone.transparent = false;
              clone.opacity = 1;
              clone.depthWrite = true;
              clone.polygonOffset = true;
              clone.polygonOffsetFactor = -layer;
              clone.polygonOffsetUnits = -layer;
              return clone;
            });
            mesh.material = Array.isArray(mesh.material) ? tuned : tuned[0];
          });
        };

        // Mint's final open-bowl mesh kept the successful connected seating
        // geometry but lost the clean preview's field markings and green
        // runoff material. Flush-inset the two already accepted Mint surfaces
        // so the stadium remains cohesive while gameplay retains a precise,
        // readable pitch.
        const runoff = fitDimensions(
          sourceScene(ASSETS.world.technicalAreaGrass),
          50,
          0.12,
          35,
        );
        runoff.position.set(0, -0.08, 0);
        tuneTurf(runoff, 1);
        stadium.add(runoff);

        const pitchSource = sourceScene(ASSETS.world.pitch);
        const pitchSize = new THREE.Box3().setFromObject(pitchSource).getSize(new THREE.Vector3());
        if (pitchSize.z > pitchSize.x) pitchSource.rotation.y = Math.PI / 2;
        const pitch = fitWidth(pitchSource, FIELD_HALF_X * 2);
        // The enlarged Mint pitch has a deep rounded base. Sink that base into
        // the bowl so only its marked top surface sits above the runoff.
        pitch.position.y = -1.66;
        tuneTurf(pitch, 2, true);
        stadium.add(pitch);
        pitch.updateMatrixWorld(true);
        const pitchSurfaceY = new THREE.Box3().setFromObject(pitch).max.y;
        const playerSurfaceY = pitchSurfaceY + 0.035;
        const ballGroundY = pitchSurfaceY + 0.07;

        const createGoal = (side: Team) => {
          const goal = fitHeight(sourceScene(ASSETS.world.goal), 2.45);
          const defendingLeftSide = side === "spain";
          goal.position.set(
            defendingLeftSide ? -(FIELD_HALF_X + 0.42) : FIELD_HALF_X + 0.42,
            pitchSurfaceY,
            0,
          );
          // The Mint goal's authored mouth faces +X. Mirror the right goal so
          // both openings face midfield, rotating each frame 90° from the
          // previous sideline-facing placement.
          goal.rotation.y = defendingLeftSide ? 0 : Math.PI;
          stadium.add(goal);
          return goal;
        };
        createGoal("spain");
        createGoal("argentina");

        for (const [x, z, rotation] of [
          [-(FIELD_HALF_X - 0.2), -(FIELD_HALF_Z - 0.25), 0],
          [-(FIELD_HALF_X - 0.2), FIELD_HALF_Z - 0.25, Math.PI / 2],
          [FIELD_HALF_X - 0.2, -(FIELD_HALF_Z - 0.25), -Math.PI / 2],
          [FIELD_HALF_X - 0.2, FIELD_HALF_Z - 0.25, Math.PI],
        ] as const) {
          const flag = fitHeight(sourceScene(ASSETS.world.cornerFlag), 1.25);
          flag.position.set(x, pitchSurfaceY + 0.02, z);
          flag.rotation.y = rotation;
          stadium.add(flag);
        }

        const addTeamBench = (
          asset: typeof ASSETS.world.spainTeamBench | typeof ASSETS.world.argentinaTeamBench,
          x: number,
        ) => {
          const bench = fitWidth(sourceScene(asset), 5.45);
          bench.scale.y = 0.68;
          bench.position.set(x, pitchSurfaceY + 0.02, -13.35);
          // Both Mint benches are authored along local X with their seats
          // facing +Z, directly toward the pitch from the far technical area.
          bench.rotation.y = 0;
          stadium.add(bench);
        };
        addTeamBench(ASSETS.world.spainTeamBench, -7.7);
        addTeamBench(ASSETS.world.argentinaTeamBench, 7.7);
        for (const x of [-12.4, 12.4]) {
          const equipment = fitHeight(sourceScene(ASSETS.world.equipmentStation), 1.7);
          equipment.position.set(x, pitchSurfaceY + 0.02, -13.35);
          equipment.rotation.y = 0;
          stadium.add(equipment);
        }

        const celebrationRoot = new THREE.Group();
        scene.add(celebrationRoot);
        const trophy = fitHeight(sourceScene(ASSETS.world.trophy), 2.6);
        trophy.position.set(0, pitchSurfaceY + 0.1, 0);
        celebrationRoot.add(trophy);
        const confettiLeft = fitLargest(sourceScene(ASSETS.world.confetti), 6.5);
        confettiLeft.position.set(-4.5, pitchSurfaceY + 2.8, 0);
        celebrationRoot.add(confettiLeft);
        const confettiRight = fitLargest(sourceScene(ASSETS.world.confetti), 6.5);
        confettiRight.position.set(4.5, pitchSurfaceY + 2.8, 0);
        confettiRight.rotation.y = Math.PI;
        celebrationRoot.add(confettiRight);
        celebrationRoot.visible = false;

        const normalizeClip = (clip: import("three").AnimationClip) => {
          const normalized = clip.clone();
          for (const track of normalized.tracks) {
            if (!/hips\.position$/i.test(track.name)) continue;
            const values = track.values;
            if (values.length < 3) continue;
            const x = values[0];
            const z = values[2];
            for (let index = 0; index < values.length; index += 3) {
              values[index] = x;
              values[index + 2] = z;
            }
          }
          return normalized;
        };
        const technicalAreaRoot = new THREE.Group();
        scene.add(technicalAreaRoot);
        const technicalAreaPeople: TechnicalAreaPerson[] = [];
        const createTechnicalAreaPerson = (
          key: WorldCupStaffKey,
          x: number,
          z: number,
          rotation: number,
          height: number,
          yOffset = 0,
        ) => {
          const person = ASSETS.staff[key];
          const root = fitHeight(sourceScene(person.model), height);
          root.position.set(x, playerSurfaceY + yOffset, z);
          root.rotation.y = rotation;
          technicalAreaRoot.add(root);
          const mixer = new THREE.AnimationMixer(root);
          const source = gltfs.get(person.animation)!.animations[0];
          const action = mixer.clipAction(normalizeClip(source), root);
          action.reset().play();
          action.time = technicalAreaPeople.length * 0.31;
          technicalAreaPeople.push({ root, mixer });
        };

        // Keep the technical area readable: standing staff nearest the
        // touchline and open occupied benches behind them. Phase offsets stop
        // the seated substitutes from moving in unison.
        createTechnicalAreaPerson("matchMedic", -10.45, -12.25, 0, 1.78);
        createTechnicalAreaPerson("spainCoach", -4.55, -12.2, 0, 1.86);
        createTechnicalAreaPerson("fourthOfficial", -2.55, -12.2, 0, 1.82);
        createTechnicalAreaPerson("argentinaCoach", 4.55, -12.2, 0, 1.86);
        createTechnicalAreaPerson("spainSubstitute", -8.65, -13.25, 0, 2.14);
        createTechnicalAreaPerson("spainSubstitute", -6.75, -13.25, 0, 2.14);
        createTechnicalAreaPerson("argentinaSubstitute", 6.75, -13.25, 0, 2.14);
        createTechnicalAreaPerson("argentinaSubstitute", 8.65, -13.25, 0, 2.14);

        const playerRoot = new THREE.Group();
        scene.add(playerRoot);
        const players: Player[] = [];
        const spectatorRoot = new THREE.Group();
        scene.add(spectatorRoot);
        const spectators: Spectator[] = [];
        const createPlayer = (
          key: WorldCupCharacterKey,
          team: Team,
          role: Player["role"],
          number: number,
          x: number,
          z: number,
        ) => {
          const character = ASSETS.characters[key];
          const root = fitHeight(sourceScene(character.model), role === "goalkeeper" ? 2.3 : 2.24);
          root.position.set(x, playerSurfaceY, z);
          root.rotation.y = team === "spain" ? Math.PI / 2 : -Math.PI / 2;
          playerRoot.add(root);
          const mixer = new THREE.AnimationMixer(root);
          const actions: Record<string, import("three").AnimationAction> = {};
          for (const [name, path] of Object.entries(character.animations)) {
            const source = gltfs.get(path)!.animations[0];
            const action = mixer.clipAction(normalizeClip(source), root);
            if (!["idle", "run"].includes(name)) {
              action.setLoop(THREE.LoopOnce, 1);
              action.clampWhenFinished = true;
            }
            actions[name] = action;
          }
          actions.idle.reset().play();
          const player: Player = {
            team,
            role,
            number,
            root,
            mixer,
            actions,
            currentAction: "idle",
            velocity: new THREE.Vector3(),
            facing: new THREE.Vector3(team === "spain" ? 1 : -1, 0, 0),
            home: new THREE.Vector3(x, playerSurfaceY, z),
            locomotionMoving: false,
            actionLock: 0,
            possessionSince: 0,
            cooldown: 0,
          };
          players.push(player);
          return player;
        };

        const spain = [
          createPlayer("spainOutfield", "spain", "outfield", 7, -6.6, 0),
          createPlayer("spainOutfield", "spain", "outfield", 10, -2.2, -5.9),
          createPlayer("spainOutfield", "spain", "outfield", 8, -2.2, 5.9),
          createPlayer("spainOutfield", "spain", "outfield", 4, -9.8, -6.4),
          createPlayer("spainOutfield", "spain", "outfield", 6, -9.8, 6.4),
        ];
        const argentina = [
          createPlayer("argentinaOutfield", "argentina", "outfield", 10, 6.5, 0),
          createPlayer("argentinaOutfield", "argentina", "outfield", 11, 2.3, -5.9),
          createPlayer("argentinaOutfield", "argentina", "outfield", 7, 2.3, 5.9),
          createPlayer("argentinaOutfield", "argentina", "outfield", 4, 9.8, 6.4),
          createPlayer("argentinaOutfield", "argentina", "outfield", 6, 9.8, -6.4),
        ];
        const spainKeeper = createPlayer("spainGoalkeeper", "spain", "goalkeeper", 1, -KEEPER_X, 0);
        const argentinaKeeper = createPlayer("argentinaGoalkeeper", "argentina", "goalkeeper", 23, KEEPER_X, 0);
        let controlled = spain[0];
        const selectionRing = fitLargest(sourceScene(ASSETS.world.playerSelectionRing), 1.12);
        selectionRing.position.set(controlled.root.position.x, pitchSurfaceY - 0.022, controlled.root.position.z);
        selectionRing.visible = false;
        scene.add(selectionRing);

        const fanKeys = Object.keys(ASSETS.fans) as WorldCupFanKey[];
        const createSpectator = (
          fanKey: WorldCupFanKey,
          x: number,
          y: number,
          z: number,
          rotation: number,
          height: number,
        ) => {
          const fan = ASSETS.fans[fanKey];
          const root = fitHeight(sourceScene(fan.model), height);
          root.position.set(x, y, z);
          root.rotation.y = rotation;
          spectatorRoot.add(root);
          const mixer = new THREE.AnimationMixer(root);
          const actions: Record<string, import("three").AnimationAction> = {};
          for (const name of ["idle", "cheer"] as const) {
            const source = gltfs.get(fan.animations[name])!.animations[0];
            const action = mixer.clipAction(normalizeClip(source), root);
            if (name === "cheer") {
              action.setLoop(THREE.LoopRepeat, 2);
              action.clampWhenFinished = true;
            }
            actions[name] = action;
          }
          actions.idle.reset().play();
          actions.idle.time = (spectators.length % 7) * 0.17;
          spectators.push({ root, mixer, actions, currentAction: "idle" });
        };
        const crowdNoise = (index: number, row: number, salt: number) =>
          (((index * 37 + row * 61 + salt * 29) % 101) / 100 - 0.5);
        const fanForSeat = (index: number, row: number, salt: number) =>
          fanKeys[Math.abs(index * 7 + row * 3 + salt * 5) % fanKeys.length];
        const supporterXs = Array.from({ length: 36 }, (_, index) => -17 + index * (34 / 35));
        const sideRows = [
          { farZ: -17.55, nearZ: 17.55, y: 1.35, height: 1.62 },
          { farZ: -18.75, nearZ: 18.75, y: 2.45, height: 1.65 },
          { farZ: -19.85, nearZ: 19.85, y: 3.6, height: 1.68 },
          { farZ: -20.85, nearZ: 20.85, y: 4.75, height: 1.71 },
        ] as const;
        sideRows.forEach((row, rowIndex) => {
          supporterXs.forEach((x, index) => {
            const farJitter = crowdNoise(index, rowIndex, 1);
            const nearJitter = crowdNoise(index, rowIndex, 2);
            createSpectator(
              fanForSeat(index, rowIndex, 1),
              x + farJitter * 0.16,
              row.y + Math.abs(farJitter) * 0.025,
              row.farZ + farJitter * 0.08,
              0,
              row.height * (1 + farJitter * 0.035),
            );
            createSpectator(
              fanForSeat(index, rowIndex, 2),
              x + nearJitter * 0.16,
              row.y + Math.abs(nearJitter) * 0.025,
              row.nearZ + nearJitter * 0.08,
              Math.PI,
              row.height * (1 + nearJitter * 0.035),
            );
          });
        });
        const endSupporterZs = Array.from({ length: 27 }, (_, index) => -10.15 + index * (20.3 / 26));
        const endRows = [
          { x: 23.8, y: 1.35, height: 1.62 },
          { x: 25.15, y: 2.55, height: 1.66 },
          { x: 26.45, y: 3.85, height: 1.7 },
        ] as const;
        endRows.forEach((row, rowIndex) => {
          endSupporterZs.forEach((z, index) => {
            const leftJitter = crowdNoise(index, rowIndex, 3);
            const rightJitter = crowdNoise(index, rowIndex, 4);
            createSpectator(
              fanForSeat(index, rowIndex, 3),
              -row.x,
              row.y + Math.abs(leftJitter) * 0.025,
              z + leftJitter * 0.12,
              Math.PI / 2,
              row.height * (1 + leftJitter * 0.035),
            );
            createSpectator(
              fanForSeat(index, rowIndex, 4),
              row.x,
              row.y + Math.abs(rightJitter) * 0.025,
              z + rightJitter * 0.12,
              -Math.PI / 2,
              row.height * (1 + rightJitter * 0.035),
            );
          });
        });
        const cornerCrowdRows = [
          { radiusX: 4.8, radiusZ: 3.6, y: 1.55, height: 1.62 },
          { radiusX: 5.8, radiusZ: 4.7, y: 2.7, height: 1.66 },
        ] as const;
        cornerCrowdRows.forEach((row, rowIndex) => {
          for (const sideSign of [-1, 1] as const) {
            for (const nearSign of [-1, 1] as const) {
              for (let seat = 1; seat <= 3; seat += 1) {
                const angle = (seat / 4) * (Math.PI / 2);
                const x = sideSign * (20.2 + Math.sin(angle) * row.radiusX);
                const z = nearSign * (15.1 + Math.cos(angle) * row.radiusZ);
                const index = rowIndex * 3 + seat;
                const salt = sideSign * 2 + nearSign + 9;
                const jitter = crowdNoise(index, rowIndex, salt);
                createSpectator(
                  fanForSeat(index, rowIndex, salt),
                  x + jitter * 0.06,
                  row.y + Math.abs(jitter) * 0.02,
                  z + jitter * 0.06,
                  Math.atan2(-x, -z),
                  row.height * (1 + jitter * 0.02),
                );
              }
            }
          }
        });
        const playSpectatorAction = (spectator: Spectator, name: "idle" | "cheer") => {
          if (spectator.currentAction === name) return;
          spectator.actions[name].reset().fadeIn(0.18).play();
          spectator.actions[spectator.currentAction]?.fadeOut(0.18);
          spectator.currentAction = name;
        };
        const setSpectatorMood = (celebrating: "all" | null) => {
          spectators.forEach((spectator) => {
            playSpectatorAction(spectator, celebrating ? "cheer" : "idle");
          });
        };

        const ball = fitLargest(sourceScene(ASSETS.world.football), 0.52);
        ball.position.set(0, ballGroundY, 0);
        scene.add(ball);
        const ballLocator = fitLargest(sourceScene(ASSETS.world.ballLocator), 0.9);
        ballLocator.position.set(0, pitchSurfaceY - 0.018, 0);
        ballLocator.visible = false;
        scene.add(ballLocator);
        const ballLight = new THREE.PointLight(0xffefaa, 1.7, 6.2, 2);
        scene.add(ballLight);
        const ballVelocity = new THREE.Vector3();
        let ballOwner: Player | null = null;
        let lastTouch: Team = "spain";
        let phase: Phase = "menu";
        let scores: Record<Team, number> = { spain: 0, argentina: 0 };
        let secondsLeft = MATCH_SECONDS;
        let extraTime = false;
        let goalPause = 0;
        let shotCharge = 0;
        let stamina = 100;
        let lastStaminaUi = 100;
        let lastUiSecond = MATCH_SECONDS;
        let clockAccumulator = 0;
        let elapsed = 0;
        let pickupLockUntil = 0;
        let assistedSpainShotUntil = 0;
        const activePressers: Record<Team, Player> = {
          spain: spain[3],
          argentina: argentina[3],
        };

        const actionDuration = (player: Player, name: string) =>
          player.actions[name]?.getClip().duration ?? 0.6;
        const playAction = (player: Player, name: string, lock = false) => {
          const next = player.actions[name];
          if (!next || player.currentAction === name) return;
          const previous = player.actions[player.currentAction];
          next.reset().fadeIn(0.12).play();
          previous?.fadeOut(0.12);
          player.currentAction = name;
          if (lock) player.actionLock = elapsed + Math.min(actionDuration(player, name), 1.2);
        };
        const updateMovementAction = (player: Player) => {
          if (player.actionLock > elapsed || phase === "finished") return;
          const speed = player.velocity.length();
          // Hysteresis prevents the run and idle clips from crossfading every
          // other frame while an AI player settles into a defensive lane.
          if (player.locomotionMoving ? speed < 0.22 : speed > 0.58) {
            player.locomotionMoving = !player.locomotionMoving;
          }
          playAction(player, player.locomotionMoving ? "run" : "idle");
        };
        const setFacing = (player: Player, direction: import("three").Vector3) => {
          if (direction.lengthSq() < 0.001) return;
          player.facing.copy(direction).setY(0).normalize();
          player.root.rotation.y = Math.atan2(player.facing.x, player.facing.z);
        };
        const moveToward = (player: Player, target: import("three").Vector3, speed: number, delta: number) => {
          if (player.actionLock > elapsed) {
            player.velocity.multiplyScalar(Math.exp(-14 * delta));
            return;
          }
          const direction = target.clone().sub(player.root.position).setY(0);
          const distance = direction.length();
          const desiredVelocity = new THREE.Vector3();
          if (distance > 0.18) {
            direction.normalize();
            const arrivalSpeed =
              speed * THREE.MathUtils.smoothstep(distance, 0.18, 1.35);
            desiredVelocity.copy(direction).multiplyScalar(arrivalSpeed);
          }
          const responsiveness = 1 - Math.exp(-9.5 * delta);
          player.velocity.lerp(desiredVelocity, responsiveness);
          if (player.velocity.lengthSq() < 0.012) player.velocity.set(0, 0, 0);
          player.root.position.addScaledVector(player.velocity, delta);
          if (player.velocity.lengthSq() > 0.035) setFacing(player, player.velocity);
        };
        const clampPlayer = (player: Player) => {
          const keeperLimit = player.role === "goalkeeper" ? GOAL_HALF_Z + 0.35 : FIELD_HALF_Z - 1.15;
          player.root.position.z = THREE.MathUtils.clamp(player.root.position.z, -keeperLimit, keeperLimit);
          if (player.role === "goalkeeper") {
            const anchor = player.team === "spain" ? -KEEPER_X : KEEPER_X;
            player.root.position.x = THREE.MathUtils.clamp(player.root.position.x, anchor - 0.55, anchor + 0.55);
          } else {
            player.root.position.x = THREE.MathUtils.clamp(
              player.root.position.x,
              -(FIELD_HALF_X - 1.25),
              FIELD_HALF_X - 1.25,
            );
          }
        };
        const nearest = (team: Team, target: import("three").Vector3, includeKeeper = false) =>
          players
            .filter((player) => player.team === team && (includeKeeper || player.role === "outfield"))
            .sort(
              (a, b) =>
                a.root.position.distanceToSquared(target) - b.root.position.distanceToSquared(target),
            )[0];
        const setControlled = (player: Player, status?: string) => {
          if (controlled !== player) controlled.velocity.set(0, 0, 0);
          controlled = player;
          setUi((value) => ({
            ...value,
            activePlayer: player.number,
            status: status ?? value.status,
          }));
        };
        const selectKeeperOutlet = (keeper: Player) => {
          const opposition: Team = keeper.team === "spain" ? "argentina" : "spain";
          const attackSign = keeper.team === "spain" ? 1 : -1;
          return players
            .filter((player) => player.team === keeper.team && player.role === "outfield")
            .sort((a, b) => {
              const aSpace = nearest(opposition, a.root.position).root.position.distanceTo(a.root.position);
              const bSpace = nearest(opposition, b.root.position).root.position.distanceTo(b.root.position);
              const aProgress = a.root.position.x * attackSign;
              const bProgress = b.root.position.x * attackSign;
              const aDistance = a.root.position.distanceTo(keeper.root.position);
              const bDistance = b.root.position.distanceTo(keeper.root.position);
              const aScore = aSpace * 1.6 + aProgress * 0.42 - aDistance * 0.08;
              const bScore = bSpace * 1.6 + bProgress * 0.42 - bDistance * 0.08;
              return bScore - aScore;
            })[0];
        };
        const giveBall = (player: Player, status?: string) => {
          const changedOwner = ballOwner !== player;
          ballOwner = player;
          player.possessionSince = elapsed;
          ballVelocity.set(0, 0, 0);
          lastTouch = player.team;
          if (changedOwner || status) {
            const teamName = player.team === "spain" ? "Spain" : "Argentina";
            if (player.team === "spain" && player.role === "outfield") {
              setControlled(player);
            } else if (player.team === "spain") {
              const outlet = selectKeeperOutlet(player);
              if (outlet) setControlled(outlet);
            } else {
              const defender = nearest("spain", player.root.position);
              if (defender) setControlled(defender);
            }
            setUi((value) => ({
              ...value,
              possession: player.team,
              status:
                status ??
                (player.role === "goalkeeper"
                  ? `${teamName} goalkeeper collects · outlet selected`
                  : player.team === "spain"
                    ? `Your ball · Spain #${player.number}`
                    : `Defend · ${teamName} #${player.number} has the ball`),
            }));
          }
        };
        const releaseBall = (
          player: Player,
          direction: import("three").Vector3,
          speed: number,
          lift = 0,
        ) => {
          if (ballOwner !== player) return;
          ballOwner = null;
          lastTouch = player.team;
          const normalized = direction.clone().setY(0).normalize();
          ball.position.copy(player.root.position).addScaledVector(normalized, 0.75);
          ball.position.y = ballGroundY + 0.05;
          ballVelocity.copy(normalized).multiplyScalar(speed);
          ballVelocity.y = lift;
          pickupLockUntil = elapsed + 0.16;
          playAction(player, "kick", true);
          playSound("kick");
          setUi((value) => ({ ...value, possession: "loose" }));
        };
        const readInputDirection = () =>
          new THREE.Vector3(
            (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0),
            0,
            (held.has("down") ? 1 : 0) - (held.has("up") ? 1 : 0),
          );
        const selectPassTarget = (player: Player, through: boolean) => {
          const attack = new THREE.Vector3(player.team === "spain" ? 1 : -1, 0, 0);
          const input = player === controlled ? readInputDirection() : attack.clone();
          const desired = input.lengthSq() > 0.01 ? input.normalize() : attack;
          return players
            .filter(
              (candidate) =>
                candidate.team === player.team &&
                candidate !== player &&
                candidate.role === "outfield",
            )
            .sort((a, b) => {
              const aVector = a.root.position.clone().sub(player.root.position).setY(0);
              const bVector = b.root.position.clone().sub(player.root.position).setY(0);
              const aForward = aVector.dot(desired);
              const bForward = bVector.dot(desired);
              const aAttack = aVector.dot(attack);
              const bAttack = bVector.dot(attack);
              const aScore = aForward + (through ? aAttack * 1.4 : -aVector.length() * 0.18);
              const bScore = bForward + (through ? bAttack * 1.4 : -bVector.length() * 0.18);
              return bScore - aScore;
            })[0];
        };
        const passBall = (player: Player, through = false) => {
          if (ballOwner !== player) return;
          const target = selectPassTarget(player, through);
          if (!target) return;
          const attack = new THREE.Vector3(player.team === "spain" ? 1 : -1, 0, 0);
          const lead = target.root.position
            .clone()
            .addScaledVector(target.velocity, through ? 0.62 : 0.24)
            .addScaledVector(attack, through ? 1.65 : 0);
          const distance = lead.distanceTo(player.root.position);
          releaseBall(
            player,
            lead.sub(player.root.position),
            through ? 10.2 : THREE.MathUtils.clamp(7.3 + distance * 0.22, 7.8, 9.5),
            through ? 0.24 : 0.12,
          );
          if (player.team === "spain") {
            setControlled(
              target,
              through ? `Run onto it · Spain #${target.number}` : `Receiver selected · Spain #${target.number}`,
            );
          }
        };
        const shootBall = (player: Player, charge: number) => {
          if (ballOwner !== player) return;
          const goalX = player.team === "spain" ? FIELD_HALF_X + 1 : -(FIELD_HALF_X + 1);
          const isShowcaseShot = player === controlled && player.team === "spain";
          const inputZ = readInputDirection().z;
          const assistedCorner =
            Math.abs(inputZ) > 0.1
              ? inputZ * 1.55
              : player.root.position.z >= 0
                ? -1.48
                : 1.48;
          const targetZ = THREE.MathUtils.clamp(
            isShowcaseShot
              ? assistedCorner + (Math.random() - 0.5) * 0.16
              : player.root.position.z * -0.24 +
                  inputZ * 1.15 +
                  (Math.random() - 0.5) * 0.72,
            -GOAL_HALF_Z + 0.3,
            GOAL_HALF_Z - 0.3,
          );
          const target = new THREE.Vector3(goalX, 0, targetZ);
          if (isShowcaseShot) assistedSpainShotUntil = elapsed + 3.2;
          releaseBall(
            player,
            target.sub(player.root.position),
            isShowcaseShot ? 27 + charge * 5 : 8.7 + charge * 5.1,
            isShowcaseShot ? 0.42 + charge * 0.36 : 0.7 + charge * 0.65,
          );
        };
        const tackle = (player: Player) => {
          if (player.actionLock > elapsed) return;
          playAction(player, "tackle", true);
          player.root.position.addScaledVector(player.facing, 0.46);
          if (ballOwner && ballOwner.team !== player.team) {
            const victim = ballOwner;
            const toVictim = victim.root.position.clone().sub(player.root.position).setY(0);
            const wellAimed =
              toVictim.length() < 1.48 &&
              toVictim.normalize().dot(player.facing) > 0.12 &&
              elapsed - victim.possessionSince > 0.28;
            if (!wellAimed) return;
            playAction(victim, "hit", true);
            ballOwner = null;
            ball.position.copy(victim.root.position);
            ball.position.y = ballGroundY;
            ballVelocity.copy(player.facing).multiplyScalar(2.8);
            pickupLockUntil = elapsed + 0.12;
            later(() => {
              if (
                phase === "playing" &&
                ballOwner === null &&
                player.root.position.distanceTo(ball.position) < 1.35
              ) {
                giveBall(player);
              }
            }, 170);
          }
        };

        const resetPositions = (kickoff: Team) => {
          for (const player of players) {
            player.root.position.copy(player.home);
            player.velocity.set(0, 0, 0);
            player.locomotionMoving = false;
            player.actionLock = 0;
            setFacing(player, new THREE.Vector3(player.team === "spain" ? 1 : -1, 0, 0));
          }
          ball.position.set(0, ballGroundY, 0);
          ballVelocity.set(0, 0, 0);
          setSpectatorMood(null);
          giveBall(kickoff === "spain" ? spain[0] : argentina[0]);
          setControlled(spain[0]);
        };
        const finishMatch = (winner: Team | "draw") => {
          phase = "finished";
          ballOwner = null;
          held.clear();
          celebrationRoot.visible = winner === "spain";
          setSpectatorMood(winner === "draw" ? null : "all");
          players.forEach((player) => {
            player.velocity.set(0, 0, 0);
            if (player.team === winner) playAction(player, "victory", true);
            else playAction(player, "hit", true);
          });
          playSound("whistle");
          if (winner === "spain") playSound("victory");
          setUi((value) => ({
            ...value,
            phase: "finished",
            winner,
            status:
              winner === "spain"
                ? "Spain are champions!"
                : winner === "argentina"
                  ? "Argentina take the trophy."
                  : "The final ends level.",
            shotCharge: 0,
            possession: "loose",
          }));
        };
        const scoreGoal = (team: Team) => {
          if (phase !== "playing") return;
          scores = { ...scores, [team]: scores[team] + 1 };
          phase = "goal";
          goalPause = elapsed + 2.25;
          ballOwner = null;
          ballVelocity.set(0, 0, 0);
          playSound("goal");
          setSpectatorMood("all");
          players
            .filter((player) => player.team === team && player.role === "outfield")
            .forEach((player) => playAction(player, "victory", true));
          setUi((value) => ({
            ...value,
            phase: "goal",
            spain: scores.spain,
            argentina: scores.argentina,
            status: team === "spain" ? "GOAL SPAIN!" : "GOAL ARGENTINA!",
            possession: "loose",
          }));
          if (extraTime) {
            later(() => finishMatch(team), 1550);
          }
        };
        const startMatch = (resetScore: boolean) => {
          if (resetScore) scores = { spain: 0, argentina: 0 };
          secondsLeft = MATCH_SECONDS;
          lastUiSecond = MATCH_SECONDS;
          clockAccumulator = 0;
          extraTime = false;
          stamina = 100;
          lastStaminaUi = 100;
          phase = "playing";
          celebrationRoot.visible = false;
          setSpectatorMood(null);
          resetPositions("spain");
          playSound("whistle");
          playSound("crowd", false);
          setUi((value) => ({
            ...value,
            phase: "playing",
            spain: scores.spain,
            argentina: scores.argentina,
            seconds: MATCH_SECONDS,
            extraTime: false,
            winner: null,
            status: "Kick-off — Spain attack to the right",
            shotCharge: 0,
            stamina: 100,
            possession: "spain",
          }));
        };

        const updateUser = (delta: number) => {
          const direction = readInputDirection();
          if (controlled.actionLock > elapsed) direction.set(0, 0, 0);
          const sprinting = held.has("sprint") && stamina > 2 && direction.lengthSq() > 0;
          if (direction.lengthSq() > 0) {
            direction.normalize();
            const speed = sprinting ? 5.85 : 4.45;
            const desiredVelocity = direction.clone().multiplyScalar(speed);
            controlled.velocity.lerp(desiredVelocity, 1 - Math.exp(-delta * 15));
            controlled.root.position.addScaledVector(controlled.velocity, delta);
            setFacing(controlled, controlled.velocity);
          } else {
            controlled.velocity.multiplyScalar(Math.max(0, 1 - delta * 11));
          }
          stamina = THREE.MathUtils.clamp(
            stamina + (sprinting ? -7 : 18) * delta,
            0,
            100,
          );
          if (
            Math.abs(stamina - lastStaminaUi) >= 2 ||
            (stamina === 0 && lastStaminaUi !== 0) ||
            (stamina === 100 && lastStaminaUi !== 100)
          ) {
            lastStaminaUi = stamina;
            setUi((value) => ({ ...value, stamina }));
          }
          clampPlayer(controlled);
          if (held.has("shoot") && ballOwner === controlled) {
            shotCharge = Math.min(1, shotCharge + delta * 0.78);
            setUi((value) =>
              Math.abs(value.shotCharge - shotCharge) > 0.04
                ? { ...value, shotCharge }
                : value,
            );
          }
        };
        const updateOutfieldAi = (delta: number) => {
          const looseTarget = ballOwner?.root.position ?? ball.position;
          for (const team of ["spain", "argentina"] as Team[]) {
            const squad = team === "spain" ? spain : argentina;
            const pressOptions = squad
              .filter((player) => player !== controlled)
              .sort(
                (a, b) =>
                  a.root.position.distanceToSquared(looseTarget) -
                  b.root.position.distanceToSquared(looseTarget),
              );
            const closest = pressOptions[0];
            const currentPresser = activePressers[team];
            if (
              closest &&
              (currentPresser === controlled ||
                currentPresser.root.position.distanceTo(looseTarget) >
                  closest.root.position.distanceTo(looseTarget) + 2.15)
            ) {
              activePressers[team] = closest;
            }
            const chaser = activePressers[team];
            for (const player of squad) {
              if (player === controlled) continue;
              player.cooldown = Math.max(0, player.cooldown - delta);
              if (ballOwner === player) {
                const goal = new THREE.Vector3(
                  team === "spain" ? FIELD_HALF_X + 0.5 : -(FIELD_HALF_X + 0.5),
                  0,
                  0,
                );
                const distance = Math.abs(goal.x - player.root.position.x);
                const opponent = nearest(team === "spain" ? "argentina" : "spain", player.root.position);
                const settledOnBall = elapsed - player.possessionSince > 0.95;
                if (distance < 4.9 && settledOnBall && player.cooldown <= 0) {
                  shootBall(player, 0.34 + Math.random() * 0.18);
                  player.cooldown = 2.35;
                } else if (
                  opponent.root.position.distanceTo(player.root.position) < 1.35 &&
                  settledOnBall &&
                  player.cooldown <= 0
                ) {
                  passBall(player);
                  player.cooldown = 1.55;
                } else {
                  const lane = goal.clone();
                  lane.z = THREE.MathUtils.clamp(player.root.position.z * 0.72, -6.8, 6.8);
                  moveToward(player, lane, 3.1, delta);
                }
              } else if (
                ballOwner &&
                ballOwner.team === team
              ) {
                const attackSign = team === "spain" ? 1 : -1;
                const target = player.home.clone();
                if (ballOwner.role === "goalkeeper") {
                  target.x = THREE.MathUtils.clamp(
                    player.home.x + attackSign * 1.45,
                    -(FIELD_HALF_X - 3),
                    FIELD_HALF_X - 3,
                  );
                  target.z = THREE.MathUtils.clamp(
                    player.home.z * 0.92,
                    -(FIELD_HALF_Z - 2),
                    FIELD_HALF_Z - 2,
                  );
                } else {
                  const ownerX = THREE.MathUtils.clamp(ballOwner.root.position.x, -10, 10);
                  target.x = THREE.MathUtils.clamp(
                    player.home.x + ownerX * 0.24 + attackSign * 1.15,
                    -(FIELD_HALF_X - 2.2),
                    FIELD_HALF_X - 2.2,
                  );
                  target.z = THREE.MathUtils.clamp(
                    player.home.z * 0.86 + ballOwner.root.position.z * 0.14,
                    -(FIELD_HALF_Z - 1.85),
                    FIELD_HALF_Z - 1.85,
                  );
                }
                moveToward(player, target, 3.35, delta);
              } else if (
                ballOwner &&
                ballOwner.team !== team &&
                player === chaser
              ) {
                const approachDirection = player.root.position
                  .clone()
                  .sub(ballOwner.root.position)
                  .setY(0);
                if (approachDirection.lengthSq() < 0.01) approachDirection.set(team === "spain" ? -1 : 1, 0, 0);
                const pressurePoint = ballOwner.root.position
                  .clone()
                  .addScaledVector(approachDirection.normalize(), 1.28);
                moveToward(player, pressurePoint, 3.6, delta);
                if (player.root.position.distanceTo(ballOwner.root.position) < 1.38 && player.cooldown <= 0) {
                  tackle(player);
                  player.cooldown = 2.25;
                }
              } else if (!ballOwner && player === chaser) {
                moveToward(player, ball.position, 4.1, delta);
              } else {
                const shift = THREE.MathUtils.clamp(ball.position.x * 0.22, -2.5, 2.5);
                const target = player.home.clone();
                target.x += shift;
                target.z = player.home.z * 0.88 + ball.position.z * 0.12;
                moveToward(player, target, 3.1, delta);
              }
              clampPlayer(player);
            }
          }
        };
        const updateKeeper = (keeper: Player, delta: number) => {
          keeper.cooldown = Math.max(0, keeper.cooldown - delta);
          const ownSide = keeper.team === "spain" ? -1 : 1;
          const target = new THREE.Vector3(
            ownSide * KEEPER_X,
            playerSurfaceY,
            THREE.MathUtils.clamp(ball.position.z, -1.85, 1.85),
          );
          if (ballOwner === keeper) {
            keeper.velocity.set(0, 0, 0);
            if (elapsed - keeper.possessionSince > 0.68) {
              const teammate = selectKeeperOutlet(keeper);
              if (!teammate) return;
              if (keeper.team === "spain") {
                setControlled(teammate, `Keeper releases to Spain #${teammate.number}`);
              }
              releaseBall(
                keeper,
                teammate.root.position.clone().sub(keeper.root.position),
                7.4,
                0.18,
              );
              keeper.cooldown = 1;
            }
          } else {
            moveToward(keeper, target, 3.5, delta);
            const distance = keeper.root.position.distanceTo(ball.position);
            const dangerous =
              (keeper.team === "spain" && ballVelocity.x < -0.4) ||
              (keeper.team === "argentina" && ballVelocity.x > 0.4) ||
              ballOwner?.team !== keeper.team;
            const saveRadius =
              keeper.team === "argentina" && elapsed < assistedSpainShotUntil ? 0.08 : 1.7;
            if (distance < saveRadius && dangerous && keeper.cooldown <= 0) {
              giveBall(keeper);
              playAction(keeper, "save", true);
              playSound("save");
              keeper.cooldown = 1.25;
            }
          }
          clampPlayer(keeper);
        };
        const placeRestart = (
          team: Team,
          position: import("three").Vector3,
          status: string,
          includeKeeper = false,
        ) => {
          const taker = nearest(team, position, includeKeeper);
          if (!taker) return;
          ballOwner = null;
          ballVelocity.set(0, 0, 0);
          taker.root.position.copy(position);
          taker.root.position.y = playerSurfaceY;
          clampPlayer(taker);
          const inward = new THREE.Vector3(
            Math.abs(taker.root.position.x) > FIELD_HALF_X - 3
              ? -Math.sign(taker.root.position.x)
              : 0,
            0,
            Math.abs(taker.root.position.z) > FIELD_HALF_Z - 3
              ? -Math.sign(taker.root.position.z)
              : 0,
          );
          if (inward.lengthSq() < 0.01) inward.set(team === "spain" ? 1 : -1, 0, 0);
          inward.normalize();
          let nearbyIndex = 0;
          for (const player of players) {
            if (player === taker || player.root.position.distanceTo(taker.root.position) >= 2.35) continue;
            const angle = (nearbyIndex % 2 === 0 ? 1 : -1) * (0.22 + Math.floor(nearbyIndex / 2) * 0.14);
            const clearance = player.team === team ? 1.65 : 2.2;
            player.root.position
              .copy(taker.root.position)
              .addScaledVector(inward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle), clearance);
            player.root.position.y = playerSurfaceY;
            clampPlayer(player);
            nearbyIndex += 1;
          }
          setFacing(taker, new THREE.Vector3(team === "spain" ? 1 : -1, 0, 0));
          giveBall(taker, status);
          if (team === "spain" && taker.role === "outfield") {
            setControlled(taker, status);
          }
          playSound("whistle");
        };
        const awardTouchlineRestart = () => {
          const team: Team = lastTouch === "spain" ? "argentina" : "spain";
          const teamName = team === "spain" ? "Spain" : "Argentina";
          placeRestart(
            team,
            new THREE.Vector3(
              THREE.MathUtils.clamp(
                ball.position.x,
                -(FIELD_HALF_X - 1.65),
                FIELD_HALF_X - 1.65,
              ),
              playerSurfaceY,
              Math.sign(ball.position.z || 1) * (FIELD_HALF_Z - 1.45),
            ),
            `${teamName} throw-in`,
          );
        };
        const awardEndlineRestart = (rightEnd: boolean) => {
          const defendingTeam: Team = rightEnd ? "argentina" : "spain";
          const attackingTeam: Team = rightEnd ? "spain" : "argentina";
          const goalKick = lastTouch === attackingTeam;
          if (goalKick) {
            const teamName = defendingTeam === "spain" ? "Spain" : "Argentina";
            placeRestart(
              defendingTeam,
              new THREE.Vector3(
                rightEnd ? FIELD_HALF_X - 1.3 : -(FIELD_HALF_X - 1.3),
                playerSurfaceY,
                0,
              ),
              `${teamName} goal kick`,
              true,
            );
            return;
          }
          const teamName = attackingTeam === "spain" ? "Spain" : "Argentina";
          placeRestart(
            attackingTeam,
            new THREE.Vector3(
              rightEnd ? FIELD_HALF_X - 1.45 : -(FIELD_HALF_X - 1.45),
              playerSurfaceY,
              Math.sign(ball.position.z || 1) * (FIELD_HALF_Z - 1.6),
            ),
            `${teamName} corner`,
          );
        };
        const updateBall = (delta: number) => {
          if (ballOwner) {
            const front = ballOwner.facing.clone().multiplyScalar(0.58);
            const footSide = new THREE.Vector3(-ballOwner.facing.z, 0, ballOwner.facing.x);
            const stride =
              ballOwner.velocity.lengthSq() > 0.3 ? Math.sin(elapsed * 10.5) * 0.085 : 0;
            ball.position
              .copy(ballOwner.root.position)
              .add(front)
              .addScaledVector(footSide, stride);
            ball.position.x = THREE.MathUtils.clamp(
              ball.position.x,
              -(FIELD_HALF_X - 0.55),
              FIELD_HALF_X - 0.55,
            );
            ball.position.z = THREE.MathUtils.clamp(
              ball.position.z,
              -(FIELD_HALF_Z - 0.55),
              FIELD_HALF_Z - 0.55,
            );
            ball.position.y =
              ballGroundY +
              (ballOwner.velocity.lengthSq() > 0.3 ? Math.abs(Math.sin(elapsed * 10.5)) * 0.018 : 0);
            ball.rotation.x += delta * ballOwner.velocity.length() * 2;
            return;
          }
          ballVelocity.y -= 5.6 * delta;
          ball.position.addScaledVector(ballVelocity, delta);
          ball.rotation.z -= ballVelocity.x * delta * 2.7;
          ball.rotation.x += ballVelocity.z * delta * 2.7;
          if (ball.position.y <= ballGroundY) {
            ball.position.y = ballGroundY;
            ballVelocity.y = Math.abs(ballVelocity.y) > 1.2 ? Math.abs(ballVelocity.y) * 0.34 : 0;
            const dragRate = elapsed < assistedSpainShotUntil ? 0.12 : 1.05;
            const drag = Math.max(0, 1 - delta * dragRate);
            ballVelocity.x *= drag;
            ballVelocity.z *= drag;
          }
          const inGoalMouth =
            Math.abs(ball.position.z) < GOAL_HALF_Z &&
            ball.position.y < pitchSurfaceY + 2.7;
          if (ball.position.x > FIELD_HALF_X + 0.18) {
            if (inGoalMouth) scoreGoal("spain");
            else awardEndlineRestart(true);
            return;
          } else if (ball.position.x < -FIELD_HALF_X - 0.18) {
            if (inGoalMouth) scoreGoal("argentina");
            else awardEndlineRestart(false);
            return;
          } else if (Math.abs(ball.position.z) > FIELD_HALF_Z) {
            awardTouchlineRestart();
            return;
          }
          if (phase !== "playing") return;
          const candidates = [...players].sort(
            (a, b) =>
              a.root.position.distanceToSquared(ball.position) -
              b.root.position.distanceToSquared(ball.position),
          );
          const candidate = candidates[0];
          if (
            candidate &&
            elapsed >= pickupLockUntil &&
            candidate.root.position.distanceTo(ball.position) < (candidate.role === "goalkeeper" ? 1 : 0.78) &&
            ball.position.y < ballGroundY + 0.75 &&
            ballVelocity.length() < 7.2
          ) {
            giveBall(candidate);
          }
        };
        const resolvePlayerSpacing = () => {
          for (let a = 0; a < players.length; a += 1) {
            for (let b = a + 1; b < players.length; b += 1) {
              const first = players[a];
              const second = players[b];
              const separation = second.root.position.clone().sub(first.root.position).setY(0);
              let distance = separation.length();
              if (distance < 0.001) {
                separation.set(a % 2 === 0 ? 1 : -1, 0, b % 2 === 0 ? 0.35 : -0.35);
                distance = separation.length();
              }
              const minimumDistance =
                first.role === "goalkeeper" || second.role === "goalkeeper"
                  ? 1.02
                  : first.team === second.team
                    ? 1.16
                    : 1.28;
              if (distance < minimumDistance) {
                const normal = separation.normalize();
                const correction = Math.min((minimumDistance - distance) * 0.42, 0.18);
                if (first.role === "outfield") {
                  first.root.position.addScaledVector(normal, -correction);
                  const inward = first.velocity.dot(normal);
                  if (inward > 0) first.velocity.addScaledVector(normal, -inward);
                }
                if (second.role === "outfield") {
                  second.root.position.addScaledVector(normal, correction);
                  const inward = second.velocity.dot(normal);
                  if (inward < 0) second.velocity.addScaledVector(normal, -inward);
                }
              }
            }
          }
          players.forEach(clampPlayer);
        };
        const updateClock = (delta: number) => {
          if (extraTime) return;
          clockAccumulator += delta;
          if (clockAccumulator < 1) return;
          const ticks = Math.floor(clockAccumulator);
          clockAccumulator -= ticks;
          secondsLeft = Math.max(0, secondsLeft - ticks);
          if (secondsLeft !== lastUiSecond) {
            lastUiSecond = secondsLeft;
            setUi((value) => ({ ...value, seconds: secondsLeft }));
          }
          if (secondsLeft === 0) {
            if (scores.spain === scores.argentina) {
              extraTime = true;
              playSound("whistle");
              setUi((value) => ({
                ...value,
                extraTime: true,
                seconds: -1,
                status: "Golden goal — next score wins!",
              }));
            } else {
              finishMatch(scores.spain > scores.argentina ? "spain" : "argentina");
            }
          }
        };
        const switchPlayer = () => {
          if (phase !== "playing") return;
          if (ballOwner?.team === "spain" && ballOwner.role === "outfield") {
            setControlled(ballOwner, `On the ball · Spain #${ballOwner.number}`);
            return;
          }
          const defensiveTarget = ballOwner?.root.position ?? ball.position;
          const options = [...spain].sort(
            (a, b) =>
              a.root.position.distanceToSquared(defensiveTarget) -
              b.root.position.distanceToSquared(defensiveTarget),
          );
          const next = options.find((player) => player !== controlled) ?? options[0];
          setControlled(next, `Now controlling Spain #${next.number}`);
        };

        controllerRef.current = {
          start: () => startMatch(true),
          restart: () => startMatch(true),
          toggleSound: () => {
            sound = !sound;
            if (!sound) {
              Object.values(audio).forEach((clip) => clip.pause());
            } else if (phase === "playing") {
              playSound("crowd", false);
            }
            setUi((value) => ({ ...value, sound }));
          },
          press: (command) => held.add(command),
          release: (command) => {
            held.delete(command);
            if (command === "shoot") {
              if (ballOwner === controlled) shootBall(controlled, Math.max(0.2, shotCharge));
              shotCharge = 0;
              setUi((value) => ({ ...value, shotCharge: 0 }));
            }
          },
          pass: () => passBall(controlled),
          throughPass: () => passBall(controlled, true),
          tackle: () => tackle(controlled),
          switchPlayer,
        };

        const keyMap: Record<string, Command | undefined> = {
          w: "up",
          arrowup: "up",
          s: "down",
          arrowdown: "down",
          a: "left",
          arrowleft: "left",
          d: "right",
          arrowright: "right",
          shift: "sprint",
          k: "shoot",
          " ": "shoot",
        };
        const onKeyDown = (event: KeyboardEvent) => {
          const key = event.key.toLowerCase();
          const command = keyMap[key];
          if (command) {
            event.preventDefault();
            held.add(command);
          }
          if (event.repeat) return;
          if (key === "j") passBall(controlled);
          if (key === "i") passBall(controlled, true);
          if (key === "l") tackle(controlled);
          if (key === "q") switchPlayer();
          if (new URLSearchParams(location.search).has("qa")) {
            if (key === "1") giveBall(spainKeeper, "QA · Spain goalkeeper possession");
            if (key === "2") giveBall(argentina[0], "QA · Argentina possession");
            if (key === "3") giveBall(spain[2], "QA · Spain possession");
            if (key === "g") scoreGoal("spain");
            if (key === "h") scoreGoal("argentina");
            if (key === "v") {
              scores = { spain: 2, argentina: 1 };
              setUi((value) => ({ ...value, spain: 2, argentina: 1 }));
              finishMatch("spain");
            }
            if (key === "x") {
              scores = { spain: 1, argentina: 1 };
              secondsLeft = 1;
              setUi((value) => ({ ...value, spain: 1, argentina: 1, seconds: 1 }));
            }
            if (key === "t") {
              placeRestart("spain", new THREE.Vector3(2, playerSurfaceY, FIELD_HALF_Z - 0.52), "Spain throw-in");
            }
            if (key === "c") {
              placeRestart(
                "spain",
                new THREE.Vector3(
                  FIELD_HALF_X - 1.45,
                  playerSurfaceY,
                  -(FIELD_HALF_Z - 1.6),
                ),
                "Spain corner",
              );
            }
            if (key === "b") {
              placeRestart(
                "argentina",
                new THREE.Vector3(FIELD_HALF_X - 1.3, playerSurfaceY, 0),
                "Argentina goal kick",
                true,
              );
            }
            if (key === "o") {
              ballOwner = null;
              ball.position.set(0, ballGroundY, 0);
              ballVelocity.set(0, 0, 0);
              setUi((value) => ({ ...value, possession: "loose", status: "Loose ball" }));
            }
          }
        };
        const onKeyUp = (event: KeyboardEvent) => {
          const command = keyMap[event.key.toLowerCase()];
          if (!command) return;
          held.delete(command);
          if (command === "shoot") {
            if (ballOwner === controlled) shootBall(controlled, Math.max(0.2, shotCharge));
            shotCharge = 0;
            setUi((value) => ({ ...value, shotCharge: 0 }));
          }
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);

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
        runtimeCleanup = () => {
          observer.disconnect();
          window.removeEventListener("keydown", onKeyDown);
          window.removeEventListener("keyup", onKeyUp);
          renderer.dispose();
        };

        setUi((value) => ({
          ...value,
          phase: "menu",
          loading: "Final ready",
          status: "A nation waits. One match decides everything.",
        }));

        let previousFrame = performance.now();
        const cameraTarget = new THREE.Vector3();
        const desiredCamera = new THREE.Vector3();
        const render = () => {
          if (disposed) return;
          animationFrame = requestAnimationFrame(render);
          const now = performance.now();
          const delta = Math.min((now - previousFrame) / 1000, 0.05);
          previousFrame = now;
          elapsed += delta;

          if (phase === "playing") {
            updateUser(delta);
            updateOutfieldAi(delta);
            updateKeeper(spainKeeper, delta);
            updateKeeper(argentinaKeeper, delta);
            updateBall(delta);
            resolvePlayerSpacing();
            updateClock(delta);
          } else if (phase === "goal" && elapsed >= goalPause) {
            phase = "playing";
            resetPositions(lastTouch === "spain" ? "argentina" : "spain");
            setUi((value) => ({
              ...value,
              phase: "playing",
              status: extraTime ? "Golden goal continues" : "Back to the centre",
            }));
          } else if (phase === "menu") {
            ball.rotation.y += delta * 0.8;
          }

          for (const player of players) {
            updateMovementAction(player);
            player.mixer.update(delta);
          }
          for (const spectator of spectators) {
            spectator.mixer.update(delta);
          }
          for (const person of technicalAreaPeople) {
            person.mixer.update(delta);
          }
          ballLight.position.copy(ball.position);
          ballLight.position.y += 0.65;
          selectionRing.visible = phase === "playing" || phase === "goal";
          selectionRing.position.set(
            controlled.root.position.x,
            pitchSurfaceY - 0.022,
            controlled.root.position.z,
          );
          selectionRing.rotation.y = controlled.root.rotation.y;
          const selectionPulse = 1 + Math.sin(elapsed * 4.5) * 0.045;
          selectionRing.scale.setScalar(selectionPulse);
          ballLocator.visible = phase === "playing" && ballOwner !== controlled;
          ballLocator.position.set(ball.position.x, pitchSurfaceY - 0.018, ball.position.z);
          const locatorPulse = 0.92 + Math.sin(elapsed * 6.2) * 0.1;
          ballLocator.scale.setScalar(locatorPulse);
          if (celebrationRoot.visible) {
            celebrationRoot.rotation.y = Math.sin(elapsed * 0.7) * 0.08;
          }

          const focusX =
            phase === "finished"
              ? 0
              : THREE.MathUtils.lerp(ball.position.x, controlled.root.position.x, 0.22);
          cameraTarget.x = THREE.MathUtils.lerp(
            cameraTarget.x,
            focusX,
            1 - Math.exp(-delta * 2.6),
          );
          cameraTarget.z = 0;
          if (phase === "finished") {
            desiredCamera.set(-11.5, 11.5, 17);
          } else if (phase === "menu") {
            desiredCamera.set(-1, 39, 30);
          } else {
            desiredCamera.set(
              THREE.MathUtils.clamp(cameraTarget.x * 0.07 - 0.18, -1.2, 1.1),
              39,
              30,
            );
          }
          camera.position.lerp(desiredCamera, 1 - Math.exp(-delta * 2.4));
          camera.lookAt(
            cameraTarget.x * 0.18,
            phase === "finished" ? pitchSurfaceY + 1.2 : pitchSurfaceY + 0.65,
            0,
          );
          renderer.render(scene, camera);
        };
        render();

      } catch (error) {
        console.error(error);
        if (!disposed) {
          setUi((value) => ({
            ...value,
            phase: "error",
            status: "The stadium could not open.",
            loading: error instanceof Error ? error.message : "Unknown loading error",
          }));
        }
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      runtimeCleanup();
      timers.forEach((timer) => clearTimeout(timer));
      Object.values(audio).forEach((clip) => {
        clip.pause();
        clip.src = "";
      });
      controllerRef.current = null;
    };
  }, []);

  const holdProps = (command: Command) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      controllerRef.current?.press(command);
    },
    onPointerUp: () => controllerRef.current?.release(command),
    onPointerCancel: () => controllerRef.current?.release(command),
    onPointerLeave: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.buttons === 0) controllerRef.current?.release(command);
    },
  });

  return (
    <main className="final-game">
      <canvas ref={canvasRef} className="final-canvas" aria-label="Spain versus Argentina 3D football final" />

      {ui.phase !== "loading" && ui.phase !== "menu" && ui.phase !== "error" && (
        <>
          <header className="final-scoreboard" aria-live="polite">
            <div className="final-team final-spain">
              <span className="final-flag" aria-hidden="true"><i /><i /><i /></span>
              <b>SPAIN</b>
              <strong>{ui.spain}</strong>
            </div>
            <div className="final-clock">
              <small>{ui.extraTime ? "FINAL · EXTRA TIME" : "WORLD FINAL"}</small>
              <b>{formatTime(ui.seconds)}</b>
            </div>
            <div className="final-team final-argentina">
              <strong>{ui.argentina}</strong>
              <b>ARGENTINA</b>
              <span className="final-flag" aria-hidden="true"><i /><i /><i /></span>
            </div>
          </header>
          <div className={`final-callout ${ui.phase === "goal" ? "is-goal" : ""}`}>{ui.status}</div>
          <button className="final-sound" onClick={() => controllerRef.current?.toggleSound()}>
            {ui.sound ? "SOUND ON" : "SOUND OFF"}
          </button>
          <div className="final-active">
            YOU CONTROL · SPAIN #{ui.activePlayer} ·{" "}
            {ui.possession === "spain"
              ? "ATTACK"
              : ui.possession === "argentina"
                ? "DEFEND"
                : "CHASE BALL"}
          </div>
          <div className="final-stamina" aria-label={`Stamina ${Math.round(ui.stamina)} percent`}>
            <small>STAMINA</small>
            <i><span style={{ width: `${Math.round(ui.stamina)}%` }} /></i>
          </div>
          <div className="final-charge" aria-label={`Shot power ${Math.round(ui.shotCharge * 100)} percent`}>
            <span style={{ width: `${Math.round(ui.shotCharge * 100)}%` }} />
          </div>

          <section className="final-touch" aria-label="Match controls">
            <div className="final-dpad">
              <button className="up" aria-label="Run forward" {...holdProps("up")}>▲</button>
              <button className="left" aria-label="Run left" {...holdProps("left")}>◀</button>
              <button className="right" aria-label="Run right" {...holdProps("right")}>▶</button>
              <button className="down" aria-label="Run back" {...holdProps("down")}>▼</button>
            </div>
            <div className="final-actions">
              <button className="switch" onClick={() => controllerRef.current?.switchPlayer()}>SWITCH<small>Q</small></button>
              <button className="pass" onClick={() => controllerRef.current?.pass()}>PASS<small>J</small></button>
              <button className="through" onClick={() => controllerRef.current?.throughPass()}>THROUGH<small>I</small></button>
              <button className="tackle" onClick={() => controllerRef.current?.tackle()}>TACKLE<small>L</small></button>
              <button className="shoot" {...holdProps("shoot")}>SHOOT<small>HOLD K</small></button>
            </div>
          </section>
        </>
      )}

      {ui.phase === "loading" && (
        <section className="final-overlay final-loading">
          <div className="final-ball-loader" aria-hidden="true">◆</div>
          <p>{ui.loading}</p>
        </section>
      )}

      {ui.phase === "menu" && (
        <section className="final-overlay final-menu">
          <p className="final-eyebrow">ONE NIGHT · ONE TROPHY · ONE FINAL</p>
          <h1><span>FINAL</span> WHISTLE</h1>
          <div className="final-versus">
            <strong className="spain">SPAIN</strong>
            <i>VS</i>
            <strong className="argentina">ARGENTINA</strong>
          </div>
          <p className="final-intro">
            Lead Spain through 150 seconds of expanded small-sided football. Hold formation,
            pass into space, manage your sprint, and charge your shot. A draw goes to golden goal.
          </p>
          <button className="final-primary" onClick={() => controllerRef.current?.start()}>
            PLAY THE FINAL
          </button>
          <p className="final-keys">WASD / ARROWS MOVE · SHIFT SPRINT · J PASS · I THROUGH BALL · HOLD K SHOOT · L TACKLE · Q SWITCH</p>
        </section>
      )}

      {ui.phase === "finished" && (
        <section className="final-overlay final-result">
          <p className="final-eyebrow">FULL TIME</p>
          <h1>
            {ui.winner === "spain"
              ? "SPAIN ARE CHAMPIONS"
              : ui.winner === "argentina"
                ? "ARGENTINA WIN THE FINAL"
                : "ALL SQUARE"}
          </h1>
          <div className="final-result-score">{ui.spain}<span>—</span>{ui.argentina}</div>
          <p>{ui.status}</p>
          <button className="final-primary" onClick={() => controllerRef.current?.restart()}>
            REMATCH
          </button>
        </section>
      )}

      {ui.phase === "error" && (
        <section className="final-overlay final-result">
          <p className="final-eyebrow">LOAD ERROR</p>
          <h1>THE FINAL NEEDS A RESTART</h1>
          <p>{ui.loading}</p>
          <button className="final-primary" onClick={() => location.reload()}>RELOAD STADIUM</button>
        </section>
      )}

      <footer className="final-credit">ORIGINAL GAME · WORLD, PLAYERS, ANIMATION & AUDIO CREATED WITH MINT</footer>
    </main>
  );
}
