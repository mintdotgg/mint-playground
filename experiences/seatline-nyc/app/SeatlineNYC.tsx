"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildSeats,
  DATES,
  getSightline,
  THEATERS,
  type Seat,
  type Theater,
} from "./seatlineData";
import { SEATLINE_MINT_ASSETS as ASSETS } from "./seatlineMintAssets";

const TRAILER_URL =
  "/_experiences/seatline-nyc/media/odyssey-trailer.mp4";

type SceneController = {
  focusSeat: (seatId: string) => void;
};

function TheaterPreview({
  theater,
  seats,
  selectedSeatId,
  onSelectSeat,
}: {
  theater: Theater;
  seats: Seat[];
  selectedSeatId: string;
  onSelectSeat: (seatId: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controllerRef = useRef<SceneController | null>(null);
  const [initialSeatId] = useState(selectedSeatId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isTrailerPlaying, setIsTrailerPlaying] = useState(false);

  const toggleTrailer = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      void video.play().catch((reason) => {
        console.error("The Odyssey trailer could not be played.", reason);
        setIsTrailerPlaying(false);
      });
      return;
    }

    video.pause();
  }, []);

  useEffect(() => {
    controllerRef.current?.focusSeat(selectedSeatId);
  }, [selectedSeatId]);

  useEffect(() => {
    if (!canvasRef.current || !videoRef.current) return;
    let disposed = false;
    let frame = 0;
    let cleanup = () => undefined;
    const canvas = canvasRef.current;
    const trailerVideo = videoRef.current;
    setLoading(true);
    setError("");

    void (async () => {
      try {
        const THREE = await import("three");
        const { GLTFLoader } = await import(
          "three/addons/loaders/GLTFLoader.js"
        );
        if (disposed) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x07090e);
        scene.fog = new THREE.FogExp2(0x07090e, 0.018);

        const camera = new THREE.PerspectiveCamera(50, 1, 0.08, 120);
        const renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          powerPreference: "high-performance",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.24;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.localClippingEnabled = true;
        const screenPlaneZ = theater.screenZ + theater.screenWallOffset;

        scene.add(new THREE.AmbientLight(0x7181aa, 2));
        scene.add(new THREE.HemisphereLight(0xa9bce4, 0x321916, 2.15));
        const warmLight = new THREE.DirectionalLight(0xffc786, 3.2);
        warmLight.position.set(-8, theater.roomHeight, 10);
        warmLight.castShadow = true;
        warmLight.shadow.mapSize.set(1024, 1024);
        scene.add(warmLight);
        const rimLight = new THREE.DirectionalLight(0x6c7dff, 2);
        rimLight.position.set(10, 8, -8);
        scene.add(rimLight);

        const loader = new GLTFLoader();
        const [shellGltf, screenGltf, chairGltf, beaconGltf] =
          await Promise.all([
            loader.loadAsync(ASSETS.shells[theater.shell]),
            loader.loadAsync(ASSETS.screens[theater.screen]),
            loader.loadAsync(ASSETS.chairs[theater.chair]),
            loader.loadAsync(ASSETS.fixtures.aisleBeacon),
          ]);
        if (disposed) return;

        const prepare = (object: import("three").Object3D) => {
          object.traverse((child) => {
            const mesh = child as import("three").Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.frustumCulled = false;
          });
          return object;
        };

        const fitWidth = (
          object: import("three").Object3D,
          width: number,
        ) => {
          const root = new THREE.Group();
          root.add(object);
          object.updateMatrixWorld(true);
          const before = new THREE.Box3().setFromObject(object);
          const size = before.getSize(new THREE.Vector3());
          object.scale.setScalar(width / Math.max(size.x, 0.001));
          object.updateMatrixWorld(true);
          const after = new THREE.Box3().setFromObject(object);
          const center = after.getCenter(new THREE.Vector3());
          object.position.set(-center.x, -after.min.y, -center.z);
          return prepare(root);
        };

        const shell = fitWidth(shellGltf.scene, theater.roomWidth);
        shell.rotation.y = Math.PI;
        shell.traverse((child) => {
          const mesh = child as import("three").Mesh;
          if (!mesh.isMesh) return;
          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          materials.forEach((material) => {
            material.side = THREE.DoubleSide;
            material.needsUpdate = true;
          });
        });
        scene.add(shell);
        shell.updateMatrixWorld(true);

        const floorRaycaster = new THREE.Raycaster();
        const floorOrigin = new THREE.Vector3();
        const floorDirection = new THREE.Vector3(0, -1, 0);
        const floorAt = (x: number, z: number, fallback: number) => {
          floorOrigin.set(x, theater.roomHeight * 0.76, z);
          floorRaycaster.set(floorOrigin, floorDirection);
          floorRaycaster.near = 0;
          floorRaycaster.far = theater.roomHeight;
          const hit = floorRaycaster
            .intersectObject(shell, true)
            .find(
              (entry) =>
                entry.point.y >= 0 &&
                entry.point.y < theater.roomHeight * 0.72,
            );
          return hit ? hit.point.y + 0.04 : fallback;
        };

        const screenHeight = theater.screenWidth / theater.screenAspect;
        const screen = fitWidth(screenGltf.scene, theater.screenWidth);
        const authoredScreenAspect = theater.screen === "imax" ? 1.481 : 1.448;
        screen.scale.y *= authoredScreenAspect / theater.screenAspect;
        screen.scale.z = theater.screenDepthScale;
        screen.position.set(0, theater.screenBaseY, screenPlaneZ);
        screen.traverse((child) => {
          const mesh = child as import("three").Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = theater.screenDepthScale > 0.1;
          mesh.receiveShadow = false;
          mesh.renderOrder = 1;
          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          materials.forEach((material) => {
            material.depthTest = true;
            material.depthWrite = true;
            material.polygonOffset = true;
            material.polygonOffsetFactor = 2;
            material.polygonOffsetUnits = 2;
            material.clippingPlanes = theater.screenBottomCrop
              ? [
                  new THREE.Plane(
                    new THREE.Vector3(0, 1, 0),
                    -(theater.screenBaseY +
                      screenHeight * theater.screenBottomCrop),
                  ),
                ]
              : null;
            material.needsUpdate = true;
          });
        });
        scene.add(screen);
        screen.updateMatrixWorld(true);
        const screenBounds = new THREE.Box3().setFromObject(screen);
        screen.visible = false;

        const visibleScreenHeight =
          screenHeight * (1 - theater.screenBottomCrop);
        const projectionCenterY =
          theater.screenBaseY +
          screenHeight * theater.screenBottomCrop +
          visibleScreenHeight * 0.5;
        const screenPadding = 0.96;
        const trailerAspect = 16 / 9;
        let trailerWidth = theater.screenWidth * screenPadding;
        let trailerHeight = trailerWidth / trailerAspect;
        const maxTrailerHeight = visibleScreenHeight * screenPadding;
        if (trailerHeight > maxTrailerHeight) {
          trailerHeight = maxTrailerHeight;
          trailerWidth = trailerHeight * trailerAspect;
        }

        const projectionZ = screenBounds.max.z + 0.012;
        const playingMatteOverscan = 1.025;
        const projectionMatte = new THREE.Mesh(
          new THREE.PlaneGeometry(
            theater.screenWidth * playingMatteOverscan,
            visibleScreenHeight * playingMatteOverscan,
          ),
          new THREE.MeshBasicMaterial({
            color: 0x010101,
            side: THREE.DoubleSide,
            toneMapped: false,
          }),
        );
        projectionMatte.position.set(0, projectionCenterY, projectionZ);
        projectionMatte.renderOrder = 3;
        projectionMatte.visible = false;
        scene.add(projectionMatte);

        const pausedProjection = new THREE.Mesh(
          new THREE.PlaneGeometry(
            theater.screenWidth * 0.98,
            visibleScreenHeight * 0.98,
          ),
          new THREE.MeshBasicMaterial({
            color: 0xf2efe7,
            side: THREE.DoubleSide,
            toneMapped: false,
          }),
        );
        pausedProjection.position.set(
          0,
          projectionCenterY,
          projectionZ + 0.006,
        );
        pausedProjection.renderOrder = 4;
        scene.add(pausedProjection);

        const trailerTexture = new THREE.VideoTexture(trailerVideo);
        trailerTexture.colorSpace = THREE.SRGBColorSpace;
        trailerTexture.minFilter = THREE.LinearFilter;
        trailerTexture.magFilter = THREE.LinearFilter;
        trailerTexture.generateMipmaps = false;

        const trailerSurface = new THREE.Mesh(
          new THREE.PlaneGeometry(trailerWidth, trailerHeight),
          new THREE.MeshBasicMaterial({
            map: trailerTexture,
            side: THREE.DoubleSide,
            toneMapped: false,
          }),
        );
        trailerSurface.position.set(0, projectionCenterY, projectionZ + 0.018);
        trailerSurface.renderOrder = 5;
        trailerSurface.visible = false;
        trailerSurface.userData.trailerSurface = true;
        scene.add(trailerSurface);

        const makeTrailerControlTexture = (mode: "play" | "pause") => {
          const controlCanvas = document.createElement("canvas");
          controlCanvas.width = 768;
          controlCanvas.height = 420;
          const context = controlCanvas.getContext("2d");
          if (!context) {
            throw new Error("Trailer controls require a canvas context.");
          }

          context.clearRect(0, 0, controlCanvas.width, controlCanvas.height);
          context.shadowColor = "rgba(0, 0, 0, 0.24)";
          context.shadowBlur = 34;
          context.fillStyle = "#111216";
          context.beginPath();
          context.arc(384, 166, 80, 0, Math.PI * 2);
          context.fill();
          context.shadowBlur = 0;
          context.lineWidth = 3;
          context.strokeStyle = "#d6a85f";
          context.stroke();

          context.fillStyle = "#f2efe7";
          if (mode === "play") {
            context.beginPath();
            context.moveTo(366, 126);
            context.lineTo(430, 166);
            context.lineTo(366, 206);
            context.closePath();
            context.fill();
          } else {
            context.fillRect(356, 128, 19, 76);
            context.fillRect(393, 128, 19, 76);
          }

          context.fillStyle = "#17181d";
          context.font = "700 35px Arial, sans-serif";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(mode === "play" ? "PLAY TRAILER" : "PAUSE", 384, 310);

          const texture = new THREE.CanvasTexture(controlCanvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.generateMipmaps = false;
          return texture;
        };

        const playControlTexture = makeTrailerControlTexture("play");
        const pauseControlTexture = makeTrailerControlTexture("pause");
        const trailerControlMaterial = new THREE.MeshBasicMaterial({
          map: playControlTexture,
          transparent: true,
          side: THREE.DoubleSide,
          toneMapped: false,
          depthWrite: false,
        });
        const trailerControlWidth = Math.min(trailerWidth * 0.28, 5.8);
        const trailerControl = new THREE.Mesh(
          new THREE.PlaneGeometry(
            trailerControlWidth,
            trailerControlWidth * (420 / 768),
          ),
          trailerControlMaterial,
        );
        trailerControl.position.set(
          0,
          projectionCenterY,
          projectionZ + 0.034,
        );
        trailerControl.renderOrder = 6;
        trailerControl.userData.trailerControl = true;
        scene.add(trailerControl);

        let trailerHovered = false;
        let trailerSceneIsPlaying: boolean | null = null;
        const syncTrailerScene = () => {
          const isPlaying = !trailerVideo.paused && !trailerVideo.ended;
          if (trailerSceneIsPlaying !== isPlaying) {
            trailerSceneIsPlaying = isPlaying;
            projectionMatte.visible = isPlaying;
            pausedProjection.visible = !isPlaying;
            trailerSurface.visible = isPlaying;
            trailerControlMaterial.map = isPlaying
              ? pauseControlTexture
              : playControlTexture;
            trailerControlMaterial.needsUpdate = true;
          }
          trailerControl.visible = !isPlaying || trailerHovered;
        };
        trailerVideo.addEventListener("play", syncTrailerScene);
        trailerVideo.addEventListener("pause", syncTrailerScene);
        trailerVideo.addEventListener("ended", syncTrailerScene);
        syncTrailerScene();

        const chairTemplate = fitWidth(chairGltf.scene, theater.chairWidth);
        chairTemplate.updateMatrixWorld(true);
        const chairTopOffset = new THREE.Box3()
          .setFromObject(chairTemplate)
          .max.y;
        const seatRoots = new Map<string, import("three").Object3D>();
        const seatPositions = new Map<string, import("three").Vector3>();
        for (const seat of seats) {
          const chair = chairTemplate.clone(true);
          const groundY = floorAt(seat.x, seat.z, seat.y);
          chair.position.set(seat.x, groundY, seat.z);
          seatPositions.set(seat.id, chair.position.clone());
          chair.userData.seatId = seat.id;
          chair.userData.baseScale = 1;
          chair.traverse((child) => {
            const mesh = child as import("three").Mesh;
            if (mesh.isMesh) mesh.renderOrder = 2;
            child.userData.seatId = seat.id;
            child.userData.selectable = seat.status !== "occupied";
          });
          const occupiedAngle =
            seat.status === "occupied"
              ? ((seat.columnIndex % 3) - 1) * 0.018
              : 0;
          const chairFacing = theater.chair === "cinema" ? 0 : Math.PI;
          chair.rotation.y = chairFacing + occupiedAngle;
          seatRoots.set(seat.id, chair);
          scene.add(chair);
        }

        const beaconTemplate = fitWidth(beaconGltf.scene, 0.27);
        for (let row = 1; row < theater.rows; row += 2) {
          const y = theater.seatBaseY + row * theater.rowRise;
          const z = theater.baseZ + row * theater.rowSpacing - 0.25;
          for (const x of [-theater.roomWidth * 0.43, theater.roomWidth * 0.43]) {
            const beacon = beaconTemplate.clone(true);
            beacon.position.set(x, y, z);
            beacon.traverse((child) => {
              const mesh = child as import("three").Mesh;
              if (mesh.isMesh) mesh.renderOrder = 2;
            });
            scene.add(beacon);
            const light = new THREE.PointLight(0xffb65b, 1.6, 2.8, 2);
            light.position.set(x, y + 0.25, z);
            scene.add(light);
          }
        }

        const targetPosition = new THREE.Vector3();
        const targetLook = new THREE.Vector3();
        const currentLook = new THREE.Vector3();
        const screenCenterY =
          theater.screenBaseY +
          screenHeight * (0.5 + theater.screenBottomCrop * 0.5);
        const isTallScreen = theater.screenAspect <= 1.5;
        const selectedLight = new THREE.PointLight(0xffc46a, 0, 3.2, 2);
        scene.add(selectedLight);

        const focusSeat = (seatId: string, instant = false) => {
          const seat = seats.find((candidate) => candidate.id === seatId);
          if (!seat) return;
          const seatPosition =
            seatPositions.get(seatId) ??
            new THREE.Vector3(seat.x, seat.y, seat.z);
          const cameraZ = seatPosition.z - 0.22;
          const screenBottomY =
            theater.screenBaseY + screenHeight * theater.screenBottomCrop;
          const baseEyeHeight = isTallScreen ? 1.88 : 1.68;
          const seatBackClearance = isTallScreen ? 0.16 : 0.12;
          let cameraY = seatPosition.y + baseEyeHeight;

          const blockingSeat = seats
            .filter(
              (candidate) => candidate.rowIndex === seat.rowIndex - 1,
            )
            .reduce<Seat | null>((closest, candidate) => {
              if (!closest) return candidate;
              return Math.abs(candidate.x - seatPosition.x) <
                Math.abs(closest.x - seatPosition.x)
                ? candidate
                : closest;
            }, null);
          if (blockingSeat) {
            const blockingPosition = seatPositions.get(blockingSeat.id);
            if (blockingPosition) {
              const sightlineProgress =
                (cameraZ - blockingPosition.z) /
                Math.max(cameraZ - screenPlaneZ, 0.001);
              if (sightlineProgress > 0 && sightlineProgress < 1) {
                const blockingTop = blockingPosition.y + chairTopOffset;
                const requiredCameraY =
                  (blockingTop +
                    seatBackClearance -
                    sightlineProgress * screenBottomY) /
                  (1 - sightlineProgress);
                cameraY = Math.max(cameraY, requiredCameraY);
              }
            }
          }

          const screenBottomTarget = new THREE.Vector3(
            0,
            screenBottomY,
            screenPlaneZ + 0.08,
          );
          const sightlineOrigin = new THREE.Vector3(
            seatPosition.x,
            cameraY,
            cameraZ,
          );
          const sightlineDirection = new THREE.Vector3();
          const sightlineRaycaster = new THREE.Raycaster();
          const sightlineOccluders = [
            shell,
            ...Array.from(seatRoots.entries())
              .filter(([id]) => id !== seatId)
              .map(([, root]) => root),
          ];
          const sightlineLiftStep = 0.08;
          const maxSightlineLift = 1.44;
          let sightlineLift = 0;
          scene.updateMatrixWorld(true);

          while (sightlineLift <= maxSightlineLift) {
            sightlineOrigin.y = cameraY + sightlineLift;
            sightlineDirection
              .subVectors(screenBottomTarget, sightlineOrigin)
              .normalize();
            const screenDistance = sightlineOrigin.distanceTo(
              screenBottomTarget,
            );
            sightlineRaycaster.set(sightlineOrigin, sightlineDirection);
            sightlineRaycaster.near = 0.12;
            sightlineRaycaster.far = Math.max(screenDistance - 0.32, 0.12);
            if (
              sightlineRaycaster.intersectObjects(
                sightlineOccluders,
                true,
              ).length === 0
            ) {
              break;
            }
            sightlineLift += sightlineLiftStep;
          }
          cameraY += Math.min(sightlineLift, maxSightlineLift);

          targetPosition.set(seatPosition.x, cameraY, cameraZ);
          targetLook.set(0, screenCenterY, screenPlaneZ);
          camera.fov = isTallScreen ? 72 : 66;
          camera.updateProjectionMatrix();
          selectedLight.position.set(
            seatPosition.x,
            seatPosition.y + 0.75,
            seatPosition.z - 0.3,
          );
          selectedLight.intensity = 6;
          seatRoots.forEach((root, id) => {
            root.userData.targetScale = id === seatId ? 1.08 : 1;
            root.visible = id !== seatId;
          });
          if (instant) {
            camera.position.copy(targetPosition);
            currentLook.copy(targetLook);
          }
        };

        controllerRef.current = {
          focusSeat: (seatId) => focusSeat(seatId),
        };
        focusSeat(initialSeatId, true);

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        const getPointerHits = (event: PointerEvent) => {
          const bounds = canvas.getBoundingClientRect();
          pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
          pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
          raycaster.setFromCamera(pointer, camera);
          return raycaster.intersectObjects(scene.children, true);
        };
        const handlePointerMove = (event: PointerEvent) => {
          const hits = getPointerHits(event);
          const isPlaying = !trailerVideo.paused && !trailerVideo.ended;
          const overTrailer = hits.some(
            (entry) =>
              entry.object.userData.trailerControl ||
              entry.object.userData.trailerSurface,
          );
          trailerHovered = isPlaying && overTrailer;
          trailerControl.visible = !isPlaying || trailerHovered;
          canvas.style.cursor = hits.some(
            (entry) =>
              entry.object.userData.trailerControl ||
              entry.object.userData.trailerSurface ||
              entry.object.userData.selectable,
          )
            ? "pointer"
            : "default";
        };
        const handlePointerLeave = () => {
          trailerHovered = false;
          syncTrailerScene();
          canvas.style.cursor = "default";
        };
        const handlePointer = (event: PointerEvent) => {
          const hits = getPointerHits(event);
          const trailerHit = hits.find(
            (entry) =>
              entry.object.userData.trailerControl ||
              (!trailerVideo.paused && entry.object.userData.trailerSurface),
          );
          if (trailerHit) {
            toggleTrailer();
            return;
          }

          const seatHit = hits.find((entry) => entry.object.userData.selectable);
          const seatId = seatHit?.object.userData.seatId as string | undefined;
          if (seatId) onSelectSeat(seatId);
        };
        canvas.addEventListener("pointerdown", handlePointer);
        canvas.addEventListener("pointermove", handlePointerMove);
        canvas.addEventListener("pointerleave", handlePointerLeave);

        const resize = () => {
          const bounds = canvas.getBoundingClientRect();
          if (!bounds.width || !bounds.height) return;
          renderer.setSize(bounds.width, bounds.height, false);
          camera.aspect = bounds.width / bounds.height;
          camera.updateProjectionMatrix();
        };
        window.addEventListener("resize", resize);
        resize();

        let lastFrameTime = performance.now();
        const render = () => {
          if (disposed) return;
          const frameTime = performance.now();
          const delta = Math.min((frameTime - lastFrameTime) / 1000, 0.05);
          lastFrameTime = frameTime;
          const smoothing = 1 - Math.exp(-delta * 5.4);
          camera.position.lerp(targetPosition, smoothing);
          currentLook.lerp(targetLook, smoothing);
          camera.lookAt(currentLook);
          seatRoots.forEach((root) => {
            const target = (root.userData.targetScale as number | undefined) ?? 1;
            const next = THREE.MathUtils.lerp(root.scale.x, target, smoothing);
            root.scale.setScalar(next);
          });
          syncTrailerScene();
          renderer.render(scene, camera);
          frame = requestAnimationFrame(render);
        };
        render();
        setLoading(false);

        cleanup = () => {
          window.removeEventListener("resize", resize);
          canvas.removeEventListener("pointerdown", handlePointer);
          canvas.removeEventListener("pointermove", handlePointerMove);
          canvas.removeEventListener("pointerleave", handlePointerLeave);
          trailerVideo.removeEventListener("play", syncTrailerScene);
          trailerVideo.removeEventListener("pause", syncTrailerScene);
          trailerVideo.removeEventListener("ended", syncTrailerScene);
          cancelAnimationFrame(frame);
          trailerVideo.pause();
          trailerTexture.dispose();
          playControlTexture.dispose();
          pauseControlTexture.dispose();
          scene.traverse((object) => {
            const mesh = object as import("three").Mesh;
            if (!mesh.isMesh) return;
            mesh.geometry?.dispose();
            const materials = Array.isArray(mesh.material)
              ? mesh.material
              : [mesh.material];
            materials.forEach((material) => material.dispose());
          });
          renderer.dispose();
        };
      } catch (reason) {
        console.error(reason);
        if (!disposed) {
          setError("The 3D auditorium could not be opened.");
          setLoading(false);
        }
      }
    })();

    return () => {
      disposed = true;
      controllerRef.current = null;
      cleanup();
    };
  }, [initialSeatId, onSelectSeat, seats, theater, toggleTrailer]);

  return (
    <div className="seatline-preview">
      <canvas
        ref={canvasRef}
        className="seatline-canvas"
        aria-label={`Interactive 3D sightline preview for ${theater.name}`}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          toggleTrailer();
        }}
      />
      <video
        ref={videoRef}
        className="seatline-trailer-source"
        src={TRAILER_URL}
        preload="auto"
        playsInline
        aria-hidden="true"
        tabIndex={-1}
        onPlay={() => setIsTrailerPlaying(true)}
        onPause={() => setIsTrailerPlaying(false)}
        onEnded={(event) => {
          event.currentTarget.currentTime = 0;
          setIsTrailerPlaying(false);
        }}
      />
      <button
        className="seatline-trailer-accessible-control"
        type="button"
        aria-label={
          isTrailerPlaying
            ? "Pause The Odyssey trailer"
            : "Play The Odyssey trailer"
        }
        aria-pressed={isTrailerPlaying}
        onClick={toggleTrailer}
      >
        {isTrailerPlaying ? "Pause trailer" : "Play trailer"}
      </button>
      {loading && (
        <div className="seatline-loading">
          <span />
          <p>Opening {theater.auditorium}</p>
          <small>Loading Mint theater assets</small>
        </div>
      )}
      {error && <div className="seatline-error">{error}</div>}
    </div>
  );
}

export default function SeatlineNYC() {
  const [introVisible, setIntroVisible] = useState(true);
  const [theaterId, setTheaterId] = useState(THEATERS[0].id);
  const theater = THEATERS.find((entry) => entry.id === theaterId) ?? THEATERS[0];
  const seats = useMemo(() => buildSeats(theater), [theater]);
  const [showtimeId, setShowtimeId] = useState(theater.showtimes[1].id);
  const [selectedSeatId, setSelectedSeatId] = useState(theater.defaultSeat);
  const [dateId, setDateId] = useState<(typeof DATES)[number]["id"]>(DATES[0].id);
  const [bookingOpen, setBookingOpen] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const introTimer = window.setTimeout(
      () => setIntroVisible(false),
      reduceMotion ? 650 : 3800,
    );

    return () => window.clearTimeout(introTimer);
  }, []);

  const selectedSeat =
    seats.find((seat) => seat.id === selectedSeatId) ??
    seats.find((seat) => seat.status !== "occupied")!;
  const showtime =
    theater.showtimes.find((entry) => entry.id === showtimeId) ??
    theater.showtimes[0];
  const selectedDate =
    DATES.find((entry) => entry.id === dateId) ?? DATES[0];
  const sightline = getSightline(theater, selectedSeat);
  const seatGridTemplate = Array.from(
    { length: theater.columns },
    (_, columnIndex) =>
      theater.aislesAfter.includes(columnIndex)
        ? "calc(var(--seat-width) + var(--aisle-gap))"
        : "var(--seat-width)",
  ).join(" ");

  const handleTheater = (next: Theater) => {
    setTheaterId(next.id);
    setSelectedSeatId(next.defaultSeat);
    setShowtimeId(next.showtimes[Math.min(1, next.showtimes.length - 1)].id);
    setBookingOpen(false);
  };

  const handleSeat = useCallback((seatId: string) => {
    const seat = seats.find((entry) => entry.id === seatId);
    if (!seat || seat.status === "occupied") return;
    setSelectedSeatId(seatId);
  }, [seats]);

  const taxes = 3.18;
  const total = showtime.price + taxes;

  return (
    <main className="seatline-app">
      {introVisible && (
        <section
          className="seatline-intro"
          aria-label="Seatline NYC presents The Odyssey"
        >
          <button
            className="seatline-intro-skip"
            type="button"
            onClick={() => setIntroVisible(false)}
          >
            SKIP INTRO
          </button>

          <div className="seatline-intro-scan" aria-hidden="true" />
          <div className="seatline-intro-orbit" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>

          <div className="seatline-intro-title">
            <div className="seatline-intro-mark" aria-hidden="true"><span>S</span></div>
            <p>SEATLINE NYC PRESENTS</p>
            <h1>THE ODYSSEY</h1>
            <span className="seatline-intro-rule" aria-hidden="true" />
            <strong>CHOOSE YOUR SEAT. SEE YOUR JOURNEY.</strong>
          </div>

          <div className="seatline-intro-foot">
            <span>NEW YORK</span>
            <i aria-hidden="true" />
            <span>JUL 22</span>
          </div>
        </section>
      )}

      <section className="seatline-immersive">
        <aside
          className="seatline-booking-sidebar"
          aria-label="Book a seat for The Odyssey"
        >
          <header className="seatline-rail-header">
            <span className="seatline-rail-mark" aria-hidden="true">
              <i>S</i>
            </span>
            <div className="seatline-rail-title">
              <span>NOW PLAYING</span>
              <h1>THE ODYSSEY</h1>
              <p>2 HR 52 MIN · R · 2026</p>
            </div>
          </header>

          <div className="seatline-booking-flow">
            <section className="seatline-booking-step" aria-labelledby="theater-step-title">
              <header className="seatline-step-header">
                <span>01</span>
                <div>
                  <h2 id="theater-step-title">Theater</h2>
                  <p>{theater.neighborhood} · {theater.distance}</p>
                </div>
              </header>
              <div className="seatline-theater-list">
                {THEATERS.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={entry.id === theater.id ? "is-active" : ""}
                    aria-pressed={entry.id === theater.id}
                    onClick={() => handleTheater(entry)}
                  >
                    <span className="seatline-radio" aria-hidden="true" />
                    <strong>{entry.shortName}</strong>
                    <small>{entry.distance}</small>
                    <b>{entry.format}</b>
                  </button>
                ))}
              </div>
              <p className="seatline-selected-format">
                {theater.auditorium} · {theater.formatNote}
              </p>
            </section>

            <section className="seatline-booking-step" aria-labelledby="showtime-step-title">
              <header className="seatline-step-header">
                <span>02</span>
                <div>
                  <h2 id="showtime-step-title">Showtime</h2>
                  <p>{selectedDate.day}, JUL {selectedDate.date} · {showtime.time} {showtime.period}</p>
                </div>
              </header>
              <div className="seatline-date-strip" aria-label="Select date">
                {DATES.map((date) => (
                  <button
                    key={date.id}
                    type="button"
                    className={dateId === date.id ? "is-active" : ""}
                    aria-pressed={dateId === date.id}
                    onClick={() => setDateId(date.id)}
                  >
                    {date.day} <strong>{date.date}</strong>
                  </button>
                ))}
              </div>
              <div className="seatline-time-strip" aria-label="Select showtime">
                {theater.showtimes.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={entry.id === showtime.id ? "is-active" : ""}
                    aria-pressed={entry.id === showtime.id}
                    onClick={() => setShowtimeId(entry.id)}
                  >
                    <strong>{entry.time}</strong> {entry.period}
                  </button>
                ))}
              </div>
            </section>

            <section
              className="seatline-booking-step seatline-seat-step"
              aria-labelledby="seat-step-title"
            >
              <header className="seatline-step-header">
                <span>03</span>
                <div>
                  <h2 id="seat-step-title">Seat</h2>
                  <p>{selectedSeat.id} · {sightline.rating} · {sightline.distance} FT</p>
                </div>
              </header>
              <div className="seatline-screen-label">
                <span />
                <small>SCREEN</small>
              </div>
              <div className="seatline-seat-map-wrap">
                <div
                  className="seatline-seat-map"
                  style={
                    {
                      "--seat-columns": theater.columns,
                      gridTemplateColumns: seatGridTemplate,
                    } as React.CSSProperties
                  }
                >
                  {seats.map((seat) => (
                    <button
                      key={seat.id}
                      type="button"
                      className={[
                        `is-${seat.status}`,
                        seat.id === selectedSeatId ? "is-selected" : "",
                        theater.aislesAfter.includes(seat.columnIndex)
                          ? "is-after-aisle"
                          : "",
                      ].join(" ")}
                      disabled={seat.status === "occupied"}
                      aria-label={`Row ${seat.row}, seat ${seat.number}, ${seat.status}`}
                      aria-pressed={seat.id === selectedSeatId}
                      onClick={() => handleSeat(seat.id)}
                    >
                      <span>{seat.number}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="seatline-legend">
                <span><i className="available" />AVAILABLE</span>
                <span><i className="selected" />SELECTED</span>
                <span><i className="occupied" />TAKEN</span>
                <span><i className="accessible" />ACCESSIBLE</span>
              </div>
              <div className="seatline-seat-quality">
                <span>{sightline.centering}% centered</span>
                <span>{sightline.screenFill}% screen fill</span>
              </div>
            </section>
          </div>

          <footer className="seatline-reservation">
            <div>
              <small>{selectedDate.day} · JUL {selectedDate.date} · {showtime.time} {showtime.period}</small>
              <p>
                <strong>{selectedSeat.id}</strong>
                <span>{theater.shortName}</span>
                <b>${showtime.price.toFixed(2)}</b>
              </p>
            </div>
            <button type="button" onClick={() => setBookingOpen(true)}>
              RESERVE {selectedSeat.id}
            </button>
          </footer>
        </aside>

        <div className="seatline-experience">
          <TheaterPreview
            key={theater.id}
            theater={theater}
            seats={seats}
            selectedSeatId={selectedSeatId}
            onSelectSeat={handleSeat}
          />
        </div>

      </section>

      {bookingOpen && (
        <div className="seatline-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title">
          <button
            className="seatline-modal-backdrop"
            type="button"
            aria-label="Close booking summary"
            onClick={() => setBookingOpen(false)}
          />
          <div className="seatline-modal-card">
            <button
              className="seatline-modal-close"
              type="button"
              onClick={() => setBookingOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
            <p>YOUR ODYSSEY AWAITS</p>
            <h2 id="booking-title">SEAT {selectedSeat.id} LOOKS GREAT.</h2>
            <div className="seatline-ticket">
              <div>
                <small>THE ODYSSEY</small>
                <strong>{theater.name}</strong>
                <span>{theater.auditorium} · {theater.format}</span>
              </div>
              <div>
                <small>JUL {selectedDate.date} · {showtime.time} {showtime.period}</small>
                <strong>ROW {selectedSeat.row} / SEAT {selectedSeat.number}</strong>
                <span>{sightline.rating} sightline · {sightline.centering}% centered</span>
              </div>
            </div>
            <div className="seatline-total">
              <span>Ticket <b>${showtime.price.toFixed(2)}</b></span>
              <span>Estimated taxes & fees <b>${taxes.toFixed(2)}</b></span>
              <strong>ESTIMATED TOTAL <b>${total.toFixed(2)}</b></strong>
            </div>
            <a href={theater.sourceUrl} target="_blank" rel="noreferrer">
              CHECK LIVE SEATS AT THE THEATER ↗
            </a>
            <small className="seatline-modal-note">
              Seatline is a 3D preview. Final inventory, price, and checkout are provided by the theater.
            </small>
          </div>
        </div>
      )}
    </main>
  );
}
