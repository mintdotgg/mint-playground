"use client";

import { useEffect, useRef, useState } from "react";
import { POGO_MAN_MINT_ASSETS as ASSETS } from "./pogoManMintAssets";
import {
  AUTO_HOP_VELOCITY,
  MAX_JUMPS_PER_LANDING,
  POGO_GRAVITY,
  TRAFFIC_GAME_SPECS,
  airborneJumpVelocity,
  bounceVelocityForCharge,
  canUseJump,
  clamp,
  immediateJumpVelocity,
  jumpsAfterAttempt,
  nextSpawnInterval,
  trafficKindAt,
  trafficSpeedAt,
  type TrafficKind,
} from "./pogoManGameMath";
import "./pogo-man.css";

type Phase = "loading" | "ready" | "countdown" | "playing" | "gameover" | "error";
type UiState = {
  phase: Phase;
  loading: string;
  score: number;
  best: number;
  combo: number;
  distance: number;
  charge: number;
  jumpsRemaining: number;
  sound: boolean;
  toast: string;
  countdown: number;
};
type Controller = {
  start: () => void;
  setBoost: (pressed: boolean) => void;
  toggleSound: () => void;
};

const INITIAL_UI: UiState = {
  phase: "loading",
  loading: "Opening downtown…",
  score: 0,
  best: 0,
  combo: 0,
  distance: 0,
  charge: 0,
  jumpsRemaining: MAX_JUMPS_PER_LANDING,
  sound: true,
  toast: "",
  countdown: 0,
};

export default function PogoMan() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<Controller | null>(null);
  const [ui, setUi] = useState<UiState>(INITIAL_UI);

  useEffect(() => {
    if (!canvasRef.current) return;
    let disposed = false;
    let frame = 0;
    let controller: Controller | null = null;
    let cleanupRuntime = () => undefined;

    const audio = {
      music: new Audio(ASSETS.audio.music),
      boing: new Audio(ASSETS.audio.boing),
      crash: new Audio(ASSETS.audio.crash),
      clear: new Audio(ASSETS.audio.clear),
    };
    audio.music.loop = true;
    audio.music.volume = 0.22;
    audio.boing.volume = 0.72;
    audio.crash.volume = 0.78;
    audio.clear.volume = 0.52;

    void (async () => {
      try {
        const THREE = await import("three");
        const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
        if (disposed || !canvasRef.current) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x71c8f4);
        scene.fog = new THREE.Fog(0x71c8f4, 24, 38);

        const camera = new THREE.OrthographicCamera(-8, 8, 5.2, -4.8, 0.1, 80);
        camera.position.set(0, 3.25, 18);
        camera.lookAt(0, 3.1, -2);

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
        renderer.toneMappingExposure = 1.12;

        scene.add(new THREE.HemisphereLight(0xfff0d1, 0x34526f, 2.65));
        const sun = new THREE.DirectionalLight(0xffd09b, 3.2);
        sun.position.set(-7, 13, 11);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -12;
        sun.shadow.camera.right = 12;
        sun.shadow.camera.top = 12;
        sun.shadow.camera.bottom = -5;
        scene.add(sun);

        const manager = new THREE.LoadingManager();
        manager.onProgress = (_url, loaded, total) => {
          if (!disposed) {
            setUi((value) => ({
              ...value,
              loading: `Gathering Mint assets · ${loaded}/${total}`,
            }));
          }
        };
        const loader = new GLTFLoader(manager);
        const paths = [
          ASSETS.hero.integrated,
          ASSETS.world.buildings,
          ASSETS.world.road,
          ASSETS.world.clouds,
          ...Object.values(ASSETS.traffic),
        ];
        const loaded = await Promise.all(
          paths.map(async (path) => [path, await loader.loadAsync(path)] as const),
        );
        if (disposed) return;
        const gltfs = new Map<string, (typeof loaded)[number][1]>(loaded);
        const sceneFor = (path: string) => gltfs.get(path)!.scene.clone(true);

        const prepare = (object: import("three").Object3D, large = false) => {
          object.traverse((child) => {
            const mesh = child as import("three").Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = !large;
            mesh.receiveShadow = true;
            mesh.frustumCulled = false;
          });
          return object;
        };

        const fitBy = (
          object: import("three").Object3D,
          target: number,
          axis: "x" | "y",
          large = false,
        ) => {
          const root = new THREE.Group();
          root.add(object);
          object.updateMatrixWorld(true);
          const initial = new THREE.Box3().setFromObject(object);
          const size = initial.getSize(new THREE.Vector3());
          object.scale.setScalar(target / Math.max(axis === "x" ? size.x : size.y, 0.001));
          object.updateMatrixWorld(true);
          const fitted = new THREE.Box3().setFromObject(object);
          const center = fitted.getCenter(new THREE.Vector3());
          object.position.set(-center.x, -fitted.min.y, -center.z);
          prepare(root, large);
          root.updateMatrixWorld(true);
          return root;
        };

        const roadRoot = fitBy(sceneFor(ASSETS.world.road), 36, "x", true);
        roadRoot.scale.set(1, 0.02, 0.018);
        roadRoot.rotation.x = Math.PI / 2;
        roadRoot.updateMatrixWorld(true);
        const roadBounds = new THREE.Box3().setFromObject(roadRoot);
        roadRoot.position.set(0, 0.18 - roadBounds.max.y, 4.5);
        scene.add(roadRoot);

        const cityRoot = new THREE.Group();
        scene.add(cityRoot);
        const buildingHeight = 4.9;
        const firstBuilding = fitBy(
          sceneFor(ASSETS.world.buildings),
          buildingHeight,
          "y",
          true,
        );
        firstBuilding.updateMatrixWorld(true);
        const buildingWidth = new THREE.Box3()
          .setFromObject(firstBuilding)
          .getSize(new THREE.Vector3()).x;
        const buildingCount = 6;
        const buildingStride = buildingWidth;
        for (let index = 0; index < buildingCount; index += 1) {
          const segment =
            index === 0
              ? firstBuilding
              : fitBy(
                  sceneFor(ASSETS.world.buildings),
                  buildingHeight,
                  "y",
                  true,
                );
          segment.position.set(
            (index - (buildingCount - 1) / 2) * buildingStride,
            0.16,
            -3.7,
          );
          cityRoot.add(segment);
        }

        const cloudRoot = new THREE.Group();
        scene.add(cloudRoot);
        const cloudSpecs = [
          { x: -11, y: 4.55, width: 3.7, speed: 0.075, z: -7.8 },
          { x: -2.5, y: 5.05, width: 4.6, speed: 0.095, z: -7.2 },
          { x: 6.8, y: 4.35, width: 3.2, speed: 0.065, z: -8.1 },
          { x: 14, y: 5.15, width: 4.15, speed: 0.085, z: -7.5 },
        ];
        const clouds = cloudSpecs.map((spec) => {
          const cloud = fitBy(sceneFor(ASSETS.world.clouds), spec.width, "x", true);
          cloud.position.set(spec.x, spec.y, spec.z);
          cloudRoot.add(cloud);
          return { root: cloud, speed: spec.speed };
        });

        const heroRoot = new THREE.Group();
        heroRoot.position.set(-4.35, 0.18, 4.5);
        scene.add(heroRoot);

        const heroVisual = fitBy(sceneFor(ASSETS.hero.integrated), 1.42, "y");
        heroVisual.position.set(0, 0, 0);
        heroRoot.add(heroVisual);

        const heroVisualBounds = new THREE.Box3().setFromObject(heroVisual);
        const heroVisualSize = heroVisualBounds.getSize(new THREE.Vector3());

        const trafficRoot = new THREE.Group();
        const hitboxRoot = new THREE.Group();
        scene.add(trafficRoot);
        scene.add(hitboxRoot);
        const trafficSpecs = {
          taxi: { path: ASSETS.traffic.taxi, ...TRAFFIC_GAME_SPECS.taxi },
          sedan: { path: ASSETS.traffic.sedan, ...TRAFFIC_GAME_SPECS.sedan },
          bus: { path: ASSETS.traffic.bus, ...TRAFFIC_GAME_SPECS.bus },
        } as const;
        type Obstacle = {
          root: import("three").Group;
          kind: TrafficKind;
          width: number;
          height: number;
          passed: boolean;
          points: number;
          collisionBox: import("three").Box3;
          hitbox: import("three").Box3Helper;
        };
        const obstacles: Obstacle[] = [];
        let showHitboxes = false;
        const heroCollisionBox = new THREE.Box3();
        const heroHitbox = new THREE.Box3Helper(heroCollisionBox, 0x00ff88);
        heroHitbox.visible = showHitboxes;
        hitboxRoot.add(heroHitbox);

        const buildObstacle = (kind: TrafficKind, x: number) => {
          const spec = trafficSpecs[kind];
          const root = fitBy(sceneFor(spec.path), spec.width, "x");
          root.position.set(x, 0.18, 4.85);
          root.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          const collisionBox = new THREE.Box3();
          const hitbox = new THREE.Box3Helper(collisionBox, 0xff315c);
          hitbox.visible = showHitboxes;
          trafficRoot.add(root);
          hitboxRoot.add(hitbox);
          obstacles.push({
            root,
            kind,
            width: size.x,
            height: size.y,
            passed: false,
            points: spec.points,
            collisionBox,
            hitbox,
          });
        };

        let phase: Phase = "ready";
        let boostHeld = false;
        let sound = true;
        let score = 0;
        let combo = 0;
        let distance = 0;
        let best = Number(localStorage.getItem("pogo-man-best") || 0);
        let heroY = 0.18;
        let heroVelocity = 0;
        let charge = 0;
        let jumpsRemaining = MAX_JUMPS_PER_LANDING;
        let spawnTimer = 2.5;
        let toastTimer = 0;
        let countdownEndsAt = 0;
        let countdownShown = 0;
        let crashed = false;
        let lastUiUpdate = 0;
        let lastSpawnKind: TrafficKind = "taxi";
        const HERO_X = -4.35;
        const FLOOR_Y = 0.18;

        const playOne = (element: HTMLAudioElement) => {
          if (!sound) return;
          element.currentTime = 0;
          void element.play().catch(() => undefined);
        };

        const showToast = (toast: string) => {
          toastTimer = 1.05;
          setUi((value) => ({ ...value, toast }));
        };

        const clearObstacles = () => {
          for (const obstacle of obstacles) {
            trafficRoot.remove(obstacle.root);
            hitboxRoot.remove(obstacle.hitbox);
          }
          obstacles.length = 0;
        };

        const resetRound = (withPreviewTraffic = false) => {
          clearObstacles();
          score = 0;
          combo = 0;
          distance = 0;
          charge = 0;
          jumpsRemaining = MAX_JUMPS_PER_LANDING;
          heroY = FLOOR_Y;
          heroVelocity = AUTO_HOP_VELOCITY;
          spawnTimer = 3.4;
          lastSpawnKind = "taxi";
          countdownEndsAt = 0;
          countdownShown = 0;
          crashed = false;
          boostHeld = false;
          heroRoot.position.set(HERO_X, heroY, 4.5);
          heroRoot.rotation.set(0, 0, 0);
          if (withPreviewTraffic) buildObstacle("taxi", 5.25);
        };

        const startGame = () => {
          if (phase === "playing" || phase === "countdown") return;
          resetRound(false);
          countdownEndsAt = performance.now() + 3000;
          countdownShown = 3;
          phase = "countdown";
          if (sound) void audio.music.play().catch(() => undefined);
          setUi((value) => ({
            ...value,
            phase,
            score: 0,
            combo: 0,
            distance: 0,
            charge: 0,
            jumpsRemaining: MAX_JUMPS_PER_LANDING,
            toast: "",
            countdown: 3,
          }));
        };

        const crash = () => {
          if (crashed) return;
          crashed = true;
          phase = "gameover";
          boostHeld = false;
          combo = 0;
          audio.music.pause();
          playOne(audio.crash);
          best = Math.max(best, score);
          localStorage.setItem("pogo-man-best", String(best));
          setUi((value) => ({
            ...value,
            phase,
            score,
            best,
            combo: 0,
            distance: Math.floor(distance),
            charge: 0,
            jumpsRemaining: 0,
            toast: "BONK!",
            countdown: 0,
          }));
        };

        const randomKind = (): TrafficKind => trafficKindAt(distance, Math.random());

        resetRound(true);
        setUi((value) => ({ ...value, phase: "ready", best, loading: "" }));

        const setBoost = (pressed: boolean) => {
          if (pressed && phase === "gameover") startGame();
          if (pressed && phase === "playing" && !boostHeld) {
            if (!canUseJump(jumpsRemaining)) {
              showToast("LAND TO RECHARGE");
              return;
            }
            charge = Math.max(charge, 0.34);
            const isAirJump = jumpsRemaining === 1;
            heroVelocity = isAirJump
              ? airborneJumpVelocity(charge)
              : immediateJumpVelocity(heroVelocity, charge);
            jumpsRemaining = jumpsAfterAttempt(jumpsRemaining);
            setUi((value) => ({ ...value, charge, jumpsRemaining }));
            playOne(audio.boing);
          }
          boostHeld = pressed;
        };

        controller = {
          start: startGame,
          setBoost,
          toggleSound: () => {
            sound = !sound;
            if (!sound) audio.music.pause();
            else if (phase === "playing") void audio.music.play().catch(() => undefined);
            setUi((value) => ({ ...value, sound }));
          },
        };
        controllerRef.current = controller;

        const resize = () => {
          if (!canvasRef.current) return;
          const width = canvasRef.current.clientWidth;
          const height = canvasRef.current.clientHeight;
          if (!width || !height) return;
          renderer.setSize(width, height, false);
          const aspect = width / height;
          const isNarrow = aspect < 0.78;
          const vertical = isNarrow ? 8.4 : 5.05;
          const horizontalCenter = isNarrow ? -1.5 : 0;
          camera.top = vertical;
          camera.bottom = -vertical;
          camera.left = horizontalCenter - vertical * aspect;
          camera.right = horizontalCenter + vertical * aspect;
          if (aspect > 1.55) {
            camera.left = -8.25;
            camera.right = 8.25;
            camera.top = 5.15;
            camera.bottom = -5.15;
          }
          camera.updateProjectionMatrix();
        };
        resize();
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(canvasRef.current);

        const keyDown = (event: KeyboardEvent) => {
          if (event.code === "Space" || event.code === "ArrowUp") {
            event.preventDefault();
            if (phase === "ready" || phase === "gameover") startGame();
            if (!event.repeat) setBoost(true);
          }
          if (event.code === "KeyM") controller?.toggleSound();
          if (event.code === "Digit1" && phase === "playing") buildObstacle("taxi", 8.3);
          if (event.code === "Digit2" && phase === "playing") buildObstacle("sedan", 8.3);
          if (event.code === "Digit3" && phase === "playing") buildObstacle("bus", 8.3);
          if (event.code === "KeyK" && phase === "playing") crash();
          if (event.code === "KeyH") {
            showHitboxes = !showHitboxes;
            heroHitbox.visible = showHitboxes;
            obstacles.forEach((obstacle) => {
              obstacle.hitbox.visible = showHitboxes;
            });
          }
        };
        const keyUp = (event: KeyboardEvent) => {
          if (event.code === "Space" || event.code === "ArrowUp") {
            event.preventDefault();
            setBoost(false);
          }
        };
        window.addEventListener("keydown", keyDown);
        window.addEventListener("keyup", keyUp);

        let previous = performance.now();
        const tick = (now: number) => {
          if (disposed) return;
          frame = requestAnimationFrame(tick);
          const dt = Math.min((now - previous) / 1000, 0.04);
          previous = now;

          if (phase === "ready" || phase === "countdown") {
            heroRoot.position.y = FLOOR_Y + Math.abs(Math.sin(now * 0.0042)) * 0.32;
          }

          if (phase === "countdown") {
            const millisecondsRemaining = Math.max(0, countdownEndsAt - now);
            const nextCount = Math.max(0, Math.ceil(millisecondsRemaining / 1000));
            if (nextCount !== countdownShown) {
              countdownShown = nextCount;
              setUi((value) => ({ ...value, countdown: nextCount }));
            }
            if (millisecondsRemaining <= 0) {
              buildObstacle("taxi", 11.5);
              lastSpawnKind = "taxi";
              phase = "playing";
              showToast("GO!");
              setUi((value) => ({ ...value, phase, countdown: 0 }));
            }
          }

          if (phase === "playing") {
            const speed = trafficSpeedAt(distance);
            distance += speed * dt;
            charge = boostHeld
              ? clamp(charge + dt * 1.42, 0, 1)
              : clamp(charge - dt * 2.4, 0, 1);

            heroVelocity -= POGO_GRAVITY * dt;
            heroY += heroVelocity * dt;
            if (heroY <= FLOOR_Y) {
              heroY = FLOOR_Y;
              if (jumpsRemaining !== MAX_JUMPS_PER_LANDING) {
                jumpsRemaining = MAX_JUMPS_PER_LANDING;
                setUi((value) => ({ ...value, jumpsRemaining }));
              }
              heroVelocity = boostHeld
                ? bounceVelocityForCharge(charge)
                : AUTO_HOP_VELOCITY;
              charge = boostHeld ? 0.12 : 0;
              playOne(audio.boing);
            }
            heroRoot.position.y = heroY;
            heroRoot.rotation.z = clamp(-heroVelocity * 0.009, -0.075, 0.055);

            cityRoot.children.forEach((segment) => {
              segment.position.x -= speed * dt * 0.42;
              if (segment.position.x < -buildingStride * (buildingCount / 2 + 0.5)) {
                segment.position.x += buildingStride * buildingCount;
              }
            });
            clouds.forEach((cloud) => {
              cloud.root.position.x -= speed * dt * cloud.speed;
              if (cloud.root.position.x < -13.5) {
                cloud.root.position.x += 28;
              }
            });

            spawnTimer -= dt;
            if (spawnTimer <= 0) {
              const nextKind = randomKind();
              buildObstacle(nextKind, 9.25);
              spawnTimer = nextSpawnInterval(
                distance,
                lastSpawnKind,
                nextKind,
                Math.random(),
              );
              lastSpawnKind = nextKind;
            }

            const heroLeft = HERO_X - 0.22;
            const heroRight = HERO_X + 0.22;
            const heroBottom = heroY + 0.12;
            const heroTop = heroY + heroVisualSize.y * 0.93;
            heroCollisionBox.min.set(heroLeft, heroBottom, 4.15);
            heroCollisionBox.max.set(heroRight, heroTop, 4.85);
            for (let index = obstacles.length - 1; index >= 0; index -= 1) {
              const obstacle = obstacles[index];
              obstacle.root.position.x -= speed * dt;
              const obstacleHalfWidth = obstacle.width * 0.36;
              const obstacleLeft = obstacle.root.position.x - obstacleHalfWidth;
              const obstacleRight = obstacle.root.position.x + obstacleHalfWidth;
              const obstacleTop = FLOOR_Y + obstacle.height * 0.64;
              obstacle.collisionBox.min.set(obstacleLeft, FLOOR_Y, 4.55);
              obstacle.collisionBox.max.set(obstacleRight, obstacleTop, 5.15);
              const overlapsX = heroRight > obstacleLeft && heroLeft < obstacleRight;
              const overlapsY = heroTop > FLOOR_Y && heroBottom < obstacleTop;
              if (overlapsX && overlapsY) {
                crash();
                break;
              }
              if (!obstacle.passed && obstacleRight < heroLeft) {
                obstacle.passed = true;
                combo += 1;
                score += obstacle.points * combo;
                playOne(audio.clear);
                showToast(combo > 1 ? `${combo}× STREET STREAK` : "CLEAN CLEAR!");
              }
              if (obstacle.root.position.x < -11) {
                trafficRoot.remove(obstacle.root);
                hitboxRoot.remove(obstacle.hitbox);
                obstacles.splice(index, 1);
              }
            }

            if (now - lastUiUpdate > 70) {
              lastUiUpdate = now;
              setUi((value) => ({
                ...value,
                score,
                best,
                combo,
                distance: Math.floor(distance),
                charge,
                jumpsRemaining,
              }));
            }
          }

          if (phase === "gameover") {
            heroRoot.rotation.z = clamp(heroRoot.rotation.z + dt * 0.65, 0, 1.16);
          }

          if (toastTimer > 0) {
            toastTimer -= dt;
            if (toastTimer <= 0) setUi((value) => ({ ...value, toast: "" }));
          }

          renderer.render(scene, camera);
        };
        frame = requestAnimationFrame(tick);

        cleanupRuntime = () => {
          resizeObserver.disconnect();
          window.removeEventListener("keydown", keyDown);
          window.removeEventListener("keyup", keyUp);
          renderer.dispose();
        };
      } catch (error) {
        console.error(error);
        if (!disposed) {
          setUi((value) => ({
            ...value,
            phase: "error",
            loading: "A Mint asset could not be loaded.",
          }));
        }
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cleanupRuntime();
      controllerRef.current = null;
      Object.values(audio).forEach((element) => {
        element.pause();
        element.src = "";
      });
    };
  }, []);

  const press = (event: React.PointerEvent) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    controllerRef.current?.setBoost(true);
  };
  const release = (event: React.PointerEvent) => {
    event.preventDefault();
    controllerRef.current?.setBoost(false);
  };

  return (
    <main className="pogo-game" aria-label="Pogo Man 3D arcade game">
      <canvas
        ref={canvasRef}
        className="pogo-canvas"
        onPointerDown={ui.phase === "playing" ? press : undefined}
        onPointerUp={ui.phase === "playing" ? release : undefined}
        onPointerCancel={ui.phase === "playing" ? release : undefined}
        onContextMenu={(event) => event.preventDefault()}
      />

      <header className="pogo-header">
        <div className="pogo-brand">
          <p>Mint Arcade No. 01</p>
          <h1>POGO <span>MAN</span></h1>
          <small>Downtown traffic division</small>
        </div>
        <div className="pogo-scoreboard" aria-live="polite">
          <div><span>Score</span><strong>{ui.score.toLocaleString()}</strong></div>
          <div><span>Street</span><strong>{ui.distance}m</strong></div>
          <div className={ui.combo > 1 ? "is-hot" : ""}>
            <span>Streak</span><strong>{Math.max(1, ui.combo)}×</strong>
          </div>
        </div>
        <button
          className="pogo-sound"
          type="button"
          onClick={() => controllerRef.current?.toggleSound()}
          aria-label={ui.sound ? "Mute sound" : "Turn sound on"}
          aria-pressed={ui.sound}
        >
          {ui.sound ? "SOUND ON" : "SOUND OFF"}
        </button>
      </header>

      <aside className="pogo-objective">
        <span>HOW TO RIDE</span>
        <strong>Two jumps per landing.</strong>
        <p>Tap once to jump, then once more in the air. Touch down to recharge both.</p>
        <kbd>SPACE</kbd>
      </aside>

      <div className={`pogo-toast ${ui.toast ? "is-visible" : ""}`} aria-live="assertive">
        {ui.toast}
      </div>

      <div
        className="pogo-charge"
        aria-label={`Pogo charge ${Math.round(ui.charge * 100)} percent; ${ui.jumpsRemaining} jumps remaining`}
      >
        <span>{ui.jumpsRemaining}/2 jumps</span>
        <div><i style={{ transform: `scaleX(${ui.charge})` }} /></div>
        <b>{Math.round(ui.charge * 100)}%</b>
      </div>

      {ui.phase === "playing" && (
        <button
          type="button"
          className="pogo-hold"
          onPointerDown={press}
          onPointerUp={release}
          onPointerCancel={release}
          onPointerLeave={(event) => {
            if (event.buttons) controllerRef.current?.setBoost(false);
          }}
        >
          TAP TO JUMP
        </button>
      )}

      {ui.phase === "countdown" && (
        <div className="pogo-countdown" aria-live="assertive" aria-label={`Starting in ${ui.countdown}`}>
          <span>{ui.countdown || "GO"}</span>
          <small>GET READY</small>
        </div>
      )}

      {ui.phase === "loading" && (
        <section className="pogo-modal">
          <p>Mint built this block</p>
          <h2>Warming the spring…</h2>
          <div className="pogo-loader"><i /></div>
          <small>{ui.loading}</small>
        </section>
      )}

      {ui.phase === "ready" && (
        <section className="pogo-modal pogo-modal--ready">
          <p>A one-button downtown bounce</p>
          <h2>Traffic never stops.<br />Neither do you.</h2>
          <button type="button" onClick={() => controllerRef.current?.start()}>
            START BOUNCING
          </button>
          <small>Space / tap = instant jump · Best {ui.best.toLocaleString()}</small>
        </section>
      )}

      {ui.phase === "gameover" && (
        <section className="pogo-modal pogo-modal--over">
          <p>That bumper had your name on it</p>
          <h2>BIG CITY. BIG BONK.</h2>
          <div className="pogo-results">
            <span><small>Score</small>{ui.score.toLocaleString()}</span>
            <span><small>Best</small>{ui.best.toLocaleString()}</span>
            <span><small>Distance</small>{ui.distance}m</span>
          </div>
          <button type="button" onClick={() => controllerRef.current?.start()}>
            RIDE AGAIN
          </button>
        </section>
      )}

      {ui.phase === "error" && (
        <section className="pogo-modal">
          <p>Downtown is closed</p>
          <h2>{ui.loading}</h2>
          <button type="button" onClick={() => location.reload()}>TRY AGAIN</button>
        </section>
      )}

      <footer className="pogo-credit">All 3D art + sound generated with Mint</footer>
    </main>
  );
}
