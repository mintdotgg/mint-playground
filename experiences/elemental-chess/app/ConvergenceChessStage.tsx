"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { Chess, type Move, type PieceSymbol, type Square } from "chess.js";
import {
  CONVERGENCE_FACTIONS,
  type FactionId,
  type WorldTransform,
} from "./convergenceChessMintAssets";

type Props = {
  home: FactionId;
  opponent: FactionId;
  fen: string;
  selected: Square | null;
  legalSquares: Square[];
  lastMove: Move | null;
  flipped: boolean;
  worldEnabled: boolean;
  worldTransform: WorldTransform;
  markerRootRef: RefObject<HTMLDivElement>;
  onSquare: (square: Square) => void;
  onWorldStatus: (status: string) => void;
};

const ROLE_FOR_PIECE: Record<PieceSymbol, "king" | "queen" | "bishop" | "knight" | "rook" | "pawn"> = {
  k: "king",
  q: "queen",
  b: "bishop",
  n: "knight",
  r: "rook",
  p: "pawn",
};

const HEIGHT_BY_ROLE = {
  pawn: 1.34,
  knight: 1.56,
  bishop: 1.72,
  rook: 1.62,
  queen: 1.92,
  king: 2.04,
} as const;

const squareToPosition = (square: Square, squareSize: number) => {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return {
    x: (file - 3.5) * squareSize,
    z: (3.5 - rank) * squareSize,
  };
};

const pointToSquare = (x: number, z: number, squareSize: number): Square | null => {
  const file = Math.floor(x / squareSize + 4);
  const rankFromTop = Math.floor(z / squareSize + 4);
  const rank = 7 - rankFromTop;
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return `${String.fromCharCode(97 + file)}${rank + 1}` as Square;
};

export default function ConvergenceChessStage({
  home,
  opponent,
  fen,
  selected,
  legalSquares,
  lastMove,
  flipped,
  worldEnabled,
  worldTransform,
  markerRootRef,
  onSquare,
  onWorldStatus,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({
    fen,
    selected,
    legalSquares,
    lastMove,
    flipped,
    worldEnabled,
    worldTransform,
    onSquare,
    onWorldStatus,
  });
  const [status, setStatus] = useState("Loading Mint board and character armies");

  useEffect(() => {
    propsRef.current = {
      fen,
      selected,
      legalSquares,
      lastMove,
      flipped,
      worldEnabled,
      worldTransform,
      onSquare,
      onWorldStatus,
    };
  }, [fen, flipped, lastMove, legalSquares, onSquare, onWorldStatus, selected, worldEnabled, worldTransform]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let frame = 0;
    let resizeObserver: ResizeObserver | null = null;
    let renderer: import("three").WebGLRenderer | null = null;
    let activePointer: { id: number; x: number; y: number; moved: boolean } | null = null;
    let cleanupInput = () => undefined;

    void (async () => {
      try {
        const THREE = await import("three");
        const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
        const { SparkRenderer, SplatMesh } = await import("@sparkjsdev/spark");
        if (disposed) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(CONVERGENCE_FACTIONS[home].clearColor);
        const camera = new THREE.PerspectiveCamera(40, 1, 0.04, 300);
        const target = new THREE.Vector3(0, 0.1, 0);
        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.12;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));

        // Spark and this capsule share Three.js at runtime, but Spark's declarations
        // can resolve the workspace's older hoisted @types/three package.
        const sparkRenderer = renderer as unknown as ConstructorParameters<
          typeof SparkRenderer
        >[0]["renderer"];
        const spark = new SparkRenderer({ renderer: sparkRenderer });
        scene.add(spark as unknown as import("three").Object3D);
        const hemi = new THREE.HemisphereLight(0xeef7ff, 0x2c241a, 2.6);
        scene.add(hemi);
        const key = new THREE.DirectionalLight(0xfff0d2, 5.4);
        key.position.set(-7, 14, 9);
        key.castShadow = true;
        key.shadow.mapSize.set(2048, 2048);
        key.shadow.camera.left = -12;
        key.shadow.camera.right = 12;
        key.shadow.camera.top = 12;
        key.shadow.camera.bottom = -12;
        scene.add(key);
        const rim = new THREE.DirectionalLight(
          new THREE.Color(CONVERGENCE_FACTIONS[home].accent),
          2.1,
        );
        rim.position.set(10, 7, -10);
        scene.add(rim);

        const loader = new GLTFLoader();
        const boardAsset = CONVERGENCE_FACTIONS[home].board;
        const solidCourtAsset = CONVERGENCE_FACTIONS[home].world.solidCourt;
        const homeAssets = CONVERGENCE_FACTIONS[home].pieces;
        const opponentAssets = CONVERGENCE_FACTIONS[opponent].pieces;
        const templateEntries = [
          ...Object.entries(homeAssets).map(([role, url]) => [`w:${role}`, url] as const),
          ...Object.entries(opponentAssets).map(([role, url]) => [`b:${role}`, url] as const),
        ];

        const [boardGltf, solidCourtGltf, ...templateGltfs] = await Promise.all([
          loader.loadAsync(boardAsset.url),
          solidCourtAsset ? loader.loadAsync(solidCourtAsset.url) : Promise.resolve(null),
          ...templateEntries.map(([, url]) => loader.loadAsync(url)),
        ]);
        if (disposed) return;

        const board = boardGltf.scene;
        const boardOrientation = new THREE.Group();
        const boardRoot = new THREE.Group();
        boardOrientation.add(board);
        boardRoot.add(boardOrientation);
        boardOrientation.rotation.x = THREE.MathUtils.degToRad(boardAsset.tiltX ?? 0);
        boardOrientation.updateMatrixWorld(true);
        const rawBoardBounds = new THREE.Box3().setFromObject(boardOrientation);
        if (rawBoardBounds.isEmpty()) throw new Error("Mint board has empty bounds");
        const rawBoardSize = rawBoardBounds.getSize(new THREE.Vector3());
        const boardScale = 12 / rawBoardSize.x;
        boardRoot.scale.set(boardScale, boardScale, boardScale * (boardAsset.depthScale ?? 1));
        board.traverse((child) => {
          if ((child as import("three").Mesh).isMesh) {
            const mesh = child as import("three").Mesh;
            mesh.castShadow = false;
            mesh.receiveShadow = true;
          }
        });
        scene.add(boardRoot);
        boardRoot.updateMatrixWorld(true);

        // Mint boards have decorative rims above the actual playing surface, so
        // the overall bounding-box maximum is not a reliable floor. Ground the
        // board from a downward ray through the center of its playable grid.
        const surfaceRay = new THREE.Raycaster(
          new THREE.Vector3(0, 40, 0),
          new THREE.Vector3(0, -1, 0),
        );
        const surfaceHit = surfaceRay.intersectObject(boardRoot, true)[0];
        if (!surfaceHit) throw new Error("Mint board has no playable center surface");
        boardRoot.position.y = -surfaceHit.point.y;
        boardRoot.updateMatrixWorld(true);

        if (solidCourtAsset && solidCourtGltf) {
          const court = solidCourtGltf.scene;
          const courtBounds = new THREE.Box3().setFromObject(court);
          if (courtBounds.isEmpty()) throw new Error("Mint solid court has empty bounds");
          const courtSize = courtBounds.getSize(new THREE.Vector3());
          const courtCenter = courtBounds.getCenter(new THREE.Vector3());
          const courtScale = solidCourtAsset.size / Math.max(courtSize.x, courtSize.z);
          const courtRoot = new THREE.Group();
          court.position.set(-courtCenter.x, 0, -courtCenter.z);
          courtRoot.add(court);
          courtRoot.scale.setScalar(courtScale);
          court.traverse((child) => {
            if ((child as import("three").Mesh).isMesh) {
              const mesh = child as import("three").Mesh;
              mesh.castShadow = false;
              mesh.receiveShadow = true;
            }
          });
          scene.add(courtRoot);
          courtRoot.updateMatrixWorld(true);
          const groundedBoardBounds = new THREE.Box3().setFromObject(boardRoot);
          courtRoot.position.y = solidCourtAsset.targetY - solidCourtAsset.surfaceY * courtScale;
          courtRoot.updateMatrixWorld(true);
          canvas.dataset.solidCourt = solidCourtAsset.url;
          canvas.dataset.boardBottom = groundedBoardBounds.min.y.toFixed(3);
          canvas.dataset.solidCourtY = courtRoot.position.y.toFixed(3);
          canvas.dataset.solidCourtScale = courtScale.toFixed(3);
          const finalCourtBounds = new THREE.Box3().setFromObject(courtRoot);
          canvas.dataset.solidCourtBounds = [
            ...finalCourtBounds.min.toArray(),
            ...finalCourtBounds.max.toArray(),
          ]
            .map((value) => value.toFixed(3))
            .join(",");
        }

        const boardSize = 12 * boardAsset.gridFraction;
        const squareSize = boardSize / 8;
        canvas.dataset.boardSize = boardSize.toFixed(3);
        canvas.dataset.squareSize = squareSize.toFixed(3);
        canvas.dataset.boardFaction = home;
        canvas.dataset.opponentFaction = opponent;

        const hitMaterial = new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const hitPlane = new THREE.Mesh(
          new THREE.PlaneGeometry(boardSize, boardSize),
          hitMaterial,
        );
        hitPlane.rotation.x = -Math.PI / 2;
        hitPlane.position.y = 0.04;
        scene.add(hitPlane);

        const templates = new Map<string, import("three").Object3D>();
        templateEntries.forEach(([keyName], index) => {
          const template = templateGltfs[index].scene;
          const bounds = new THREE.Box3().setFromObject(template);
          if (bounds.isEmpty()) throw new Error(`${keyName} Mint piece has empty bounds`);
          templates.set(keyName, template);
        });

        const pieceGroup = new THREE.Group();
        scene.add(pieceGroup);
        let renderedFen = "";
        let renderedSelected: Square | null = null;
        let landingSquare: Square | null = null;
        let landingStartedAt = 0;

        const buildPieces = (nextFen: string, move: Move | null) => {
          pieceGroup.clear();
          const position = new Chess(nextFen);
          const boardState = position.board();
          for (const row of boardState) {
            for (const piece of row) {
              if (!piece) continue;
              const role = ROLE_FOR_PIECE[piece.type];
              const template = templates.get(`${piece.color}:${role}`);
              if (!template) continue;
              const clone = template.clone(true);
              const contentBounds = new THREE.Box3().setFromObject(clone);
              const size = contentBounds.getSize(new THREE.Vector3());
              const center = contentBounds.getCenter(new THREE.Vector3());
              const pieceFaction = piece.color === "w" ? home : opponent;
              const isAirBishop = pieceFaction === "air" && role === "bishop";
              const maxFootprint = squareSize * (isAirBishop ? 0.9 : 0.76);
              const scale = Math.min(
                (HEIGHT_BY_ROLE[role] * (isAirBishop ? 1.24 : 1)) / Math.max(size.y, 0.001),
                maxFootprint / Math.max(size.x, size.z, 0.001),
              );
              clone.scale.setScalar(scale);
              clone.position.set(-center.x * scale, -contentBounds.min.y * scale, -center.z * scale);
              clone.traverse((child) => {
                if ((child as import("three").Mesh).isMesh) {
                  const mesh = child as import("three").Mesh;
                  mesh.castShadow = true;
                  mesh.receiveShadow = true;
                }
              });
              const root = new THREE.Group();
              root.add(clone);
              const point = squareToPosition(piece.square, squareSize);
              root.position.set(point.x, 0.035, point.z);
              // Mint's semantic forward is +Z. White advances toward -Z and
              // black advances toward +Z, so each army faces its opponent.
              root.rotation.y = piece.color === "w" ? Math.PI : 0;
              root.userData.square = piece.square;
              root.userData.baseY = 0.035;
              pieceGroup.add(root);
            }
          }
          if (move) {
            landingSquare = move.to;
            landingStartedAt = performance.now();
          }
          renderedFen = nextFen;
        };
        buildPieces(propsRef.current.fen, propsRef.current.lastMove);

        const worldRoot = new THREE.Group();
        scene.add(worldRoot);
        const world = CONVERGENCE_FACTIONS[home].world;
        const splat = new SplatMesh({ lod: false, paged: true, url: world.runtimeUrl });
        splat.visible = false;
        worldRoot.add(splat as unknown as import("three").Object3D);
        let worldReady = false;
        void Promise.all([splat.initialized, loader.loadAsync(world.colliderUrl)])
          .then(([, colliderGltf]) => {
            if (disposed) return;
            const collider = colliderGltf.scene;
            collider.visible = false;
            worldRoot.add(collider);
            const bounds = new THREE.Box3().setFromObject(collider);
            const size = bounds.getSize(new THREE.Vector3());
            worldReady = true;
            splat.visible = propsRef.current.worldEnabled;
            canvas.dataset.world = world.id;
            canvas.dataset.worldBounds = size.toArray().map((value) => value.toFixed(3)).join(",");
            propsRef.current.onWorldStatus(`${world.label} ready — move it, then save your placement`);
          })
          .catch((error) => {
            console.error(`Mint world failed to load: ${world.label}`, error);
            propsRef.current.onWorldStatus(`${world.label} could not be opened`);
          });

        let azimuth = propsRef.current.flipped ? Math.PI + 0.73 : 0.73;
        let desiredAzimuth = azimuth;
        let renderedFlipped = propsRef.current.flipped;
        let polar = 0.88;
        let radius = 29;
        const updateCamera = () => {
          azimuth += (desiredAzimuth - azimuth) * 0.12;
          camera.position.set(
            Math.sin(azimuth) * Math.sin(polar) * radius,
            Math.cos(polar) * radius + 1.1,
            Math.cos(azimuth) * Math.sin(polar) * radius,
          );
          camera.lookAt(target);
        };

        const resize = () => {
          if (!renderer) return;
          const width = Math.max(1, canvas.clientWidth);
          const height = Math.max(1, canvas.clientHeight);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.fov = camera.aspect < 0.7 ? 52 : 40;
          if (camera.aspect < 0.7) radius = Math.max(radius, 33);
          camera.updateProjectionMatrix();
        };
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(canvas);
        resize();

        const onPointerDown = (event: PointerEvent) => {
          activePointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
          canvas.setPointerCapture(event.pointerId);
        };
        const onPointerMove = (event: PointerEvent) => {
          if (!activePointer || activePointer.id !== event.pointerId) return;
          const dx = event.clientX - activePointer.x;
          const dy = event.clientY - activePointer.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) activePointer.moved = true;
          desiredAzimuth -= dx * 0.006;
          polar = THREE.MathUtils.clamp(polar + dy * 0.004, 0.48, 1.22);
          activePointer.x = event.clientX;
          activePointer.y = event.clientY;
        };
        const onPointerUp = (event: PointerEvent) => {
          if (!activePointer || activePointer.id !== event.pointerId) return;
          const moved = activePointer.moved;
          activePointer = null;
          if (moved) return;
          const rect = canvas.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointer, camera);

          // Select the sculpture itself before falling back to the board plane.
          // Projecting a tall piece down to the plane can otherwise resolve to
          // the square behind it, especially from a low orbit angle.
          const pieceIntersection = raycaster.intersectObject(pieceGroup, true)[0];
          if (pieceIntersection) {
            let node: import("three").Object3D | null = pieceIntersection.object;
            while (node && node.parent !== pieceGroup) node = node.parent;
            const pieceSquare = node?.userData.square as Square | undefined;
            if (pieceSquare) {
              propsRef.current.onSquare(pieceSquare);
              return;
            }
          }

          const intersection = raycaster.intersectObject(hitPlane, false)[0];
          if (!intersection) return;
          const square = pointToSquare(intersection.point.x, intersection.point.z, squareSize);
          if (square) propsRef.current.onSquare(square);
        };
        const onWheel = (event: WheelEvent) => {
          event.preventDefault();
          radius = THREE.MathUtils.clamp(radius + event.deltaY * 0.012, 11.8, 38);
        };
        canvas.addEventListener("pointerdown", onPointerDown);
        canvas.addEventListener("pointermove", onPointerMove);
        canvas.addEventListener("pointerup", onPointerUp);
        canvas.addEventListener("pointercancel", onPointerUp);
        canvas.addEventListener("wheel", onWheel, { passive: false });

        const updateMarkers = () => {
          const root = markerRootRef.current;
          if (!root) return;
          const rect = canvas.getBoundingClientRect();
          root.querySelectorAll<HTMLElement>("[data-square]").forEach((element) => {
            const square = element.dataset.square as Square;
            const position = squareToPosition(square, squareSize);
            const projected = new THREE.Vector3(position.x, 0.12, position.z).project(camera);
            if (projected.z < -1 || projected.z > 1) {
              element.style.display = "none";
              return;
            }
            element.style.display = "block";
            element.style.left = `${rect.left + (projected.x * 0.5 + 0.5) * rect.width}px`;
            element.style.top = `${rect.top + (-projected.y * 0.5 + 0.5) * rect.height}px`;
          });
        };

        setStatus("ready");
        canvas.dataset.mintAssets = "ready";
        const render = () => {
          if (disposed || !renderer) return;
          const current = propsRef.current;
          if (renderedFen !== current.fen) buildPieces(current.fen, current.lastMove);
          if (renderedSelected !== current.selected) renderedSelected = current.selected;
          if (renderedFlipped !== current.flipped) {
            desiredAzimuth += Math.PI;
            renderedFlipped = current.flipped;
          }

          const transform = current.worldTransform;
          worldRoot.position.set(transform.x, transform.y, transform.z);
          worldRoot.rotation.set(
            Math.PI,
            THREE.MathUtils.degToRad(-transform.yaw),
            0,
          );
          worldRoot.scale.setScalar(transform.scale);
          splat.visible = worldReady && current.worldEnabled;

          const now = performance.now();
          for (const child of pieceGroup.children) {
            const square = child.userData.square as Square;
            const selectedLift = square === current.selected ? 0.22 : 0;
            let landingLift = 0;
            if (square === landingSquare) {
              const phase = (now - landingStartedAt) / 480;
              if (phase < 1) landingLift = Math.sin(phase * Math.PI) * 0.38;
              else landingSquare = null;
            }
            child.position.y += (child.userData.baseY + selectedLift + landingLift - child.position.y) * 0.25;
            const targetScale = square === current.selected ? 1.075 : 1;
            child.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.22);
          }

          updateCamera();
          updateMarkers();
          renderer.render(scene, camera);
          frame = requestAnimationFrame(render);
        };
        frame = requestAnimationFrame(render);

        cleanupInput = () => {
          canvas.removeEventListener("pointerdown", onPointerDown);
          canvas.removeEventListener("pointermove", onPointerMove);
          canvas.removeEventListener("pointerup", onPointerUp);
          canvas.removeEventListener("pointercancel", onPointerUp);
          canvas.removeEventListener("wheel", onWheel);
        };
      } catch (error) {
        console.error("Convergence Chess 3D stage failed", error);
        setStatus("Mint assets could not be opened");
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cleanupInput();
      resizeObserver?.disconnect();
      renderer?.dispose();
    };
  }, [home, markerRootRef, opponent]);

  return (
    <div className="cc-stage" data-stage-status={status}>
      <canvas aria-label="3D elemental chess board" ref={canvasRef} />
      {status !== "ready" ? <div className="cc-stage-loading">{status}</div> : null}
    </div>
  );
}
