"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { SparkRenderer, SplatFileType, SplatMesh } from "@sparkjsdev/spark";
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Focus,
  LoaderCircle,
  Target,
  X,
} from "lucide-react";
import {
  ACESFilmicToneMapping,
  Box3,
  Color,
  Group,
  Object3D,
  Quaternion,
  Raycaster,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type InstancedMesh,
  type Intersection,
  type Material,
  type Mesh,
  type MeshBasicMaterial,
  type PerspectiveCamera,
} from "three";
import {
  getMintWorldRuntime,
  type MintWorldRuntime,
} from "@/lib/mint-world-runtime";
import { warmMintWorldRuntime } from "@/lib/mint-world-preload";
import {
  analyzeSplatOccupancy,
  type SplatOccupancyAnalysis,
} from "@/lib/splat-occupancy";
import {
  flyWithinWorld,
  groundLevelBelow,
  loadWorldCollider,
  pickWorldPoint,
  type WorldCollider,
} from "@/lib/world-collider";
import {
  BALL_RADIUS,
  createBall,
  placeBallOnSurface,
  stepBall,
  strokeBall,
  strokeSpeed,
  type PuttBall,
} from "@/lib/putt-physics";
import {
  PuttingSurface,
  samplePlayableSurface,
  worldToHoleLocal,
} from "@/lib/putting-surface";
import {
  getHoleRootRegistration,
  mintSourceToWorldMatrix,
} from "@/lib/hole-coordinate-system";
import {
  defaultHoleLayout,
  type DefaultHoleLayout,
} from "@/lib/default-hole-layout";
import { AUTHORED_HOLE_LAYOUTS } from "@/lib/hole-layouts.generated";
import { getGameAudio } from "@/lib/game-audio";
import { HOLES } from "@/lib/course-data";
import {
  courseScoreTotals,
  createCourseScorecard,
  describeCourseDiff,
  recordCourseHole,
  type CourseScorecard,
} from "@/lib/course-round";
import {
  beginCharge,
  cancelCharge,
  commitStroke,
  type PuttPhase,
} from "@/lib/putt-stroke-fsm";

const HOLE_NUMBERS = HOLES.map((hole) => hole.number);

const MIN_RESIDENT_SPLATS = 65_536;
const SETTLE_DELAY_MS = 500;
const SETTLE_DEADLINE_MS = 5_000;
const VERIFY_WAIT_FRAMES = 3;
const MAX_VERIFY_PASSES = 12;
// From the center of a world splat the view should be wrapped in splat
// content in every direction, so require most of the frame to be occupied.
const MIN_INSIDE_COVERAGE = 0.65;
const CAMERA_FOV = 70;
const CAMERA_NEAR = 0.05;
// Keep the orbit pivot a hair in front of the camera so the controls rotate
// the view in place, panorama style, instead of orbiting a distant target.
const LOOK_TARGET = [0, 0, -0.01] as const;
// Fly speed scales with the world so small dioramas and 500 m coastlines both
// take a similar time to cross; Shift boosts it.
const FLY_SPEED_PER_SPAN = 0.014;
const FLY_SPEED_MIN = 1;
const FLY_SPEED_MAX = 7;
const FLY_BOOST = 3;
// Clamp frame delta so a background tab regaining focus cannot teleport the
// camera across the world in one step.
const FLY_DELTA_MAX = 0.1;
// Roam sphere around the authored start point. Mint worlds are captured
// from their start, so splat density fades with distance from it; the
// radius scales with world size and is capped where capture quality ends.
const FLY_ROAM_PER_SPAN = 0.12;
const FLY_ROAM_MIN = 12;
const FLY_ROAM_MAX = 32;

type CenterStatus = "loading" | "centering" | "ready" | "error";

type MarkerKind = "tee" | "cup";

type MarkerPoint = { x: number; y: number; z: number };

// Clicks are separated from drag-look by movement and duration; anything
// beyond these thresholds is treated as a camera drag, not a placement.
const CLICK_MAX_MOVE_PX = 6;
const CLICK_MAX_MS = 600;

type PuttHud = { phase: PuttPhase; strokes: number; note: string | null };
type ExperienceMode = "game" | "admin";
type RoundPhase =
  | "loading"
  | "flyover"
  | "putting"
  | "hole-complete"
  | "course-complete";

// Holding Space this long charges a full-power stroke.
const CHARGE_FULL_MS = 1400;
// Where the camera settles for each stroke: behind the ball on the cup line,
// close and low so the ball reads at putting scale.
const PERCH_BACK = 1.9;
const PERCH_UP = 0.9;
const PERCH_GLIDE_MS = 800;
// Scroll-wheel zoom. In fly mode a wheel notch dollies the camera this many
// meters along the look direction (collision-contained); in putt mode the
// orbit zoom dollies toward the ball between these distances.
const WHEEL_ZOOM_METERS = 0.012;
const WHEEL_ZOOM_MAX_STEP = 2.5;
const PUTT_ZOOM_MIN = 0.4;
const PUTT_ZOOM_MAX = 12;
const FLYOVER_MS = 3_200;
const REDUCED_MOTION_FLYOVER_MS = 650;
const HOLE_RESULT_MS = 3_200;

type FlightState = {
  // Flight unlocks only after the inside-view verification passes, so key
  // presses during the centering check can never move the camera.
  enabled: boolean;
  speed: number;
  // Radius of the roam sphere around the authored start point.
  roamRadius: number | null;
  // The world's collider mesh. Movement raycasts against it and slides along
  // surfaces, so terrain, trees, and walls physically contain the camera.
  // Flight stays locked until it has loaded — without it the mesh guarantee
  // would not hold.
  collider: WorldCollider | null;
  // One registered playable proxy shared by ball physics and marker contact.
  surface: PuttingSurface | null;
  // The splat is visual-only; it never participates in surface queries.
  splat: SplatMesh | null;
  // Authoritative roots exposed for transform diagnostics.
  holeRoot: Group | null;
  splatRoot: Group | null;
  // While a putt round is running the scroll wheel belongs to the orbit
  // zoom around the ball, not the fly-mode dolly.
  puttActive?: boolean;
};

type BoundsDescription = {
  min: readonly [number, number, number];
  max: readonly [number, number, number];
  center: readonly [number, number, number];
  size: readonly [number, number, number];
};

type InsideViewCheck = SplatOccupancyAnalysis & {
  verifyPasses: number;
  insideAccepted: boolean;
};

type CenteringSnapshot = {
  hole: number;
  status: CenterStatus;
  residentSplats: number;
  // Bounds are camera-relative: the camera sits at the origin, which is the
  // center of the splat after placement.
  worldBounds: BoundsDescription;
  spanMeters: number;
  view: InsideViewCheck | null;
};

type VerifyCycle = {
  hole: number;
  pass: number;
  waitFrames: number;
  startedAt: number;
};

type CenterLogEntry = {
  at: string;
  event: string;
  payload: unknown;
};

type CenterDebugWindow = Window & {
  __CENTERED_WORLD_DIAGNOSTICS__?: unknown;
  __CENTERED_WORLD_LOG__?: CenterLogEntry[];
  __THREE_SCENE_DIAGNOSTICS__?: unknown;
  __HOLE_MARKERS__?: { tee: MarkerPoint | null; cup: MarkerPoint | null };
  __HOLE_MARKER_SEATING__?: {
    teeAuthored: MarkerPoint | null;
    cupAuthored: MarkerPoint | null;
    teeWorld: readonly [number, number, number] | null;
    cupWorld: readonly [number, number, number] | null;
  };
  __PUTT_STATE__?: {
    phase: PuttPhase;
    strokes: number;
    power: number;
    ball: readonly [number, number, number];
    distanceToCup: number;
    cameraToBall: number;
  };
};

function describeBounds(bounds: Box3): BoundsDescription {
  return {
    min: bounds.min.toArray(),
    max: bounds.max.toArray(),
    center: bounds.getCenter(new Vector3()).toArray(),
    size: bounds.getSize(new Vector3()).toArray(),
  };
}

function logCentering(event: string, payload: unknown) {
  if (typeof window === "undefined") return;
  const debugWindow = window as CenterDebugWindow;
  const entries = debugWindow.__CENTERED_WORLD_LOG__ ?? [];
  const entry = { at: new Date().toISOString(), event, payload };
  entries.push(entry);
  if (entries.length > 300) entries.splice(0, entries.length - 300);
  debugWindow.__CENTERED_WORLD_LOG__ = entries;
  console.info(`[World Center][${event}]`, payload);
}

function MintSparkRenderer() {
  const { gl, invalidate, scene } = useThree();

  useEffect(() => {
    const spark = new SparkRenderer({
      renderer: gl,
      enableLod: true,
      // Quality budget for flying through the world: render up to ~1.5M
      // splats and keep up to ~4.2M resident so close-up detail pages in
      // instead of staying at the coarse distant LOD.
      lodSplatCount: 1_572_864,
      maxPagedSplats: 4_194_304,
      numLodFetchers: 4,
      // Depth contract with the gameplay meshes, stated explicitly: the
      // ball, tee, cup, and depth mask render in the opaque pass and write
      // depth; splats render in the transparent pass, test against that
      // depth (so they never draw over nearer gameplay geometry), and do
      // not write depth themselves (most of each Gaussian is transparent).
      transparent: true,
      depthTest: true,
      depthWrite: false,
      onDirty: invalidate,
    });
    spark.name = "mint-splat-renderer";
    scene.add(spark);

    return () => {
      spark.enableLodFetching = false;
      scene.remove(spark);
    };
  }, [gl, invalidate, scene]);

  return null;
}

function FlyControls({ flightRef }: { flightRef: { current: FlightState } }) {
  const { camera, controls, gl } = useThree();
  const pressed = useRef(new Set<string>());

  useEffect(() => {
    const keys = pressed.current;
    const flyKeys = new Set([
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "KeyQ",
      "KeyE",
      "ShiftLeft",
      "ShiftRight",
    ]);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (!flyKeys.has(event.code)) return;
      keys.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
    const onBlur = () => keys.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      keys.clear();
    };
  }, []);

  // Scroll wheel zooms by dollying along the look direction, with the same
  // mesh containment as WASD flight. Putt mode owns the wheel instead (it
  // zooms the orbit around the ball).
  useEffect(() => {
    const canvas = gl.domElement;
    const onWheel = (event: WheelEvent) => {
      const { enabled, collider, roamRadius, puttActive } = flightRef.current;
      if (!enabled || !collider || puttActive) return;
      event.preventDefault();
      const step = Math.max(
        -WHEEL_ZOOM_MAX_STEP,
        Math.min(WHEEL_ZOOM_MAX_STEP, -event.deltaY * WHEEL_ZOOM_METERS),
      );
      if (step === 0) return;
      const move = new Vector3(0, 0, -1)
        .applyQuaternion(camera.quaternion)
        .multiplyScalar(step);

      const previous = camera.position.clone();
      flyWithinWorld(camera.position, move, collider, roamRadius);
      const applied = camera.position.clone().sub(previous);
      const look = controls as unknown as {
        target: Vector3;
        update: () => void;
      } | null;
      if (look) {
        look.target.add(applied);
        look.update();
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [camera, controls, flightRef, gl]);

  useFrame((_, delta) => {
    const { enabled, speed, collider } = flightRef.current;
    if (!enabled || !collider) return;
    const keys = pressed.current;
    if (keys.size === 0) return;

    const move = new Vector3(
      (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
      (keys.has("KeyE") ? 1 : 0) - (keys.has("KeyQ") ? 1 : 0),
      (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0),
    );
    if (move.lengthSq() === 0) return;

    const boost =
      keys.has("ShiftLeft") || keys.has("ShiftRight") ? FLY_BOOST : 1;
    // Move in camera space: W follows the look direction (including pitch),
    // so climbing is looking up and flying forward; Q/E move straight up/down.
    move
      .normalize()
      .applyQuaternion(camera.quaternion)
      .multiplyScalar(speed * boost * Math.min(delta, FLY_DELTA_MAX));

    const previous = camera.position.clone();
    // Mesh collision keeps the camera out of terrain and walls, the roam
    // sphere caps travel through open sky and toward the faded world rim,
    // and the descent ratchet stops it from sinking through unmeshed gaps
    // (water, chasms) into the void under the world.
    flyWithinWorld(
      camera.position,
      move,
      collider,
      flightRef.current.roamRadius,
    );

    // Carry the panorama look pivot along by the movement that actually
    // happened so drag-look keeps rotating the view in place.
    const applied = camera.position.clone().sub(previous);
    const look = controls as unknown as {
      target: Vector3;
      update: () => void;
    } | null;
    if (look) {
      look.target.add(applied);
      look.update();
    }
  });

  return null;
}

function PlacementControls({
  flightRef,
  mode,
  onPlace,
}: {
  flightRef: { current: FlightState };
  mode: MarkerKind | null;
  onPlace: (marker: MarkerKind, point: MarkerPoint) => void;
}) {
  const { camera, gl } = useThree();
  const stateRef = useRef({ mode, onPlace });

  useEffect(() => {
    stateRef.current = { mode, onPlace };
  }, [mode, onPlace]);

  useEffect(() => {
    const canvas = gl.domElement;
    const raycaster = new Raycaster();
    let press: { x: number; y: number; at: number } | null = null;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !stateRef.current.mode) return;
      press = { x: event.clientX, y: event.clientY, at: performance.now() };
    };

    const onPointerUp = (event: PointerEvent) => {
      const start = press;
      press = null;
      const marker = stateRef.current.mode;
      if (!start || !marker || event.button !== 0) return;
      const moved = Math.hypot(
        event.clientX - start.x,
        event.clientY - start.y,
      );
      if (
        moved > CLICK_MAX_MOVE_PX ||
        performance.now() - start.at > CLICK_MAX_MS
      ) {
        return;
      }
      const { collider, surface, holeRoot, splatRoot } = flightRef.current;
      if (!collider) return;
      holeRoot?.updateWorldMatrix(true, true);
      splatRoot?.updateWorldMatrix(true, true);

      const rect = canvas.getBoundingClientRect();
      const ndc = new Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const pick = pickWorldPoint(
        collider,
        raycaster.ray.origin,
        raycaster.ray.direction,
      );
      if (!pick) return;
      const snapped = surface
        ? samplePlayableSurface(surface, pick.point, {
            expectedRegion: marker === "cup" ? "cup" : "tee",
            previousSurfaceHeight: pick.point.y,
            maxAbove: 2.5,
            maxBelow: 4,
            rise: 3.5,
          })
        : null;
      const point = snapped?.point ?? pick.point;
      const placed = { x: point.x, y: point.y, z: point.z };
      logCentering("layout:placed", {
        marker,
        ...placed,
        distance: pick.distance,
        snapped: Boolean(snapped),
        collider: snapped?.collider.name ?? collider.name,
      });
      stateRef.current.onPlace(marker, placed);
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
    };
  }, [camera, flightRef, gl]);

  return null;
}

// Computes a playable default tee and cup from the verified start view so a
// hole with no authored layout can be putted immediately. Runs once per
// hole, when the view is ready and the collider has loaded.
function AutoLayout({
  flightRef,
  active,
  onLayout,
}: {
  flightRef: { current: FlightState };
  active: boolean;
  onLayout: (layout: DefaultHoleLayout) => void;
}) {
  const { camera } = useThree();
  const doneRef = useRef(false);

  useFrame(() => {
    if (!active || doneRef.current) return;
    const collider = flightRef.current.collider;
    if (!collider) return;
    doneRef.current = true;
    const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const layout = defaultHoleLayout(collider, camera.position, forward);
    if (layout) {
      logCentering("layout:auto", { tee: layout.tee, cup: layout.cup });
      onLayout(layout);
    } else {
      logCentering("layout:auto-failed", {});
    }
  });

  return null;
}

function MarkerBeacon({ color }: { color: string }) {
  // A tall translucent beam so a placed marker can be spotted from across
  // the world, plus markers stay findable behind small terrain bumps.
  return (
    <mesh position={[0, 3.2, 0]}>
      <cylinderGeometry args={[0.022, 0.022, 6.4, 8, 1, true]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.18}
        depthWrite={false}
      />
    </mesh>
  );
}

// Local-Y-up alignment scratch for anchored marker groups.
const MARKER_UP = new Vector3(0, 1, 0);
const markerScratchPoint = new Vector3();
const markerScratchWorld = new Vector3();
const markerScratchQuat = new Quaternion();
// Lift flat decals this far along the surface normal so they never z-fight
// the depth mask or opaque geometry hugging the ground.
const DECAL_LIFT = 0.004;

/**
 * Seat a marker group on the putting surface: its origin moves to the
 * sampled surface point under the authored (x, z) and its local +Y aligns
 * with the sampled surface normal, so children authored with their bases at
 * local y=0 touch the visible green even on slopes. Falls back to the
 * authored point while the surface is still loading.
 */
function anchorMarkerGroup(
  group: Group | null,
  point: MarkerPoint,
  surface: PuttingSurface | null,
  holeRoot: Group | null = null,
) {
  if (!group) return;
  markerScratchPoint.set(point.x, point.y, point.z);
  // Prefer continuity from the last seated height when available; otherwise
  // cast generously so stale authored Y values (pre-registration layouts)
  // still snap onto the playable proxy.
  const sample = surface
    ? samplePlayableSurface(surface, markerScratchPoint, {
        expectedRegion: "tee",
        previousSurfaceHeight: point.y,
        maxAbove: 2.5,
        maxBelow: 4,
        rise: 3.5,
      })
    : null;
  if (sample) {
    // Authored layouts and the collider/proxy share normalized hole space.
    // holeRoot applies only the documented registration (identity today), so
    // sample points are already the correct local positions for children.
    if (holeRoot) {
      worldToHoleLocal(holeRoot, sample.point, group.position);
    } else {
      group.position.copy(sample.point);
    }
    group.quaternion.copy(
      markerScratchQuat.setFromUnitVectors(MARKER_UP, sample.normal),
    );
  } else {
    group.position.set(point.x, point.y, point.z);
    group.quaternion.identity();
  }
  group.updateMatrixWorld(true);
}

function HoleMarkers({
  tee,
  cup,
  flightRef,
  showTeeMarker,
}: {
  tee: MarkerPoint | null;
  cup: MarkerPoint | null;
  flightRef: { current: FlightState };
  /** Hidden while a putt round runs so it cannot intersect the physics ball. */
  showTeeMarker: boolean;
}) {
  const teeRef = useRef<Group>(null);
  const cupRef = useRef<Group>(null);

  useEffect(() => {
    const debugWindow = window as CenterDebugWindow;
    debugWindow.__HOLE_MARKERS__ = { tee, cup };
  }, [tee, cup]);

  // Re-anchor every frame: cheap (two BVH queries) and self-heals when the
  // collider or rebuilt playable proxy lands.
  useFrame(() => {
    const { surface, holeRoot } = flightRef.current;
    holeRoot?.updateWorldMatrix(true, true);
    if (tee) anchorMarkerGroup(teeRef.current, tee, surface, holeRoot);
    if (cup) anchorMarkerGroup(cupRef.current, cup, surface, holeRoot);
    const debugWindow = window as CenterDebugWindow;
    debugWindow.__HOLE_MARKER_SEATING__ = {
      teeAuthored: tee,
      cupAuthored: cup,
      teeWorld: teeRef.current
        ? (teeRef.current
            .getWorldPosition(markerScratchWorld)
            .toArray() as [number, number, number])
        : null,
      cupWorld: cupRef.current
        ? (cupRef.current
            .getWorldPosition(markerScratchWorld)
            .toArray() as [number, number, number])
        : null,
    };
  });

  // Do not pass position= props here: R3F would re-apply the authored
  // coordinates after useFrame and undo surface anchoring. Pose is owned
  // entirely by anchorMarkerGroup.
  return (
    <>
      {tee && showTeeMarker && (
        <group ref={teeRef}>
          {/* Tee pad: 3 cm tall cylinder whose pivot is its center, so its
              base touches the surface at local y=0 (plus an anti-z-fight
              hair). */}
          <mesh position={[0, 0.015 + 0.001, 0]}>
            <cylinderGeometry args={[0.085, 0.1, 0.03, 24]} />
            <meshBasicMaterial color="#38b97c" depthWrite depthTest />
          </mesh>
          {/* Stem grows from the pad top (0.03) to 0.08. */}
          <mesh position={[0, 0.055, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.05, 8]} />
            <meshBasicMaterial color="#f2f4ed" depthWrite depthTest />
          </mesh>
          {/* Preview ball resting on the stem top. */}
          <mesh position={[0, 0.08 + BALL_RADIUS, 0]}>
            <sphereGeometry args={[BALL_RADIUS, 20, 16]} />
            <meshBasicMaterial color="#ffffff" depthWrite depthTest />
          </mesh>
          <MarkerBeacon color="#83f3b9" />
        </group>
      )}
      {cup && (
        <group ref={cupRef}>
          {/* Dark interior so the cup reads as a hole the ball can drop into.
              Flat decals ride a few millimeters up the surface normal so they
              never z-fight the green. */}
          <mesh position={[0, DECAL_LIFT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.066, 28]} />
            <meshBasicMaterial color="#04120b" depthWrite depthTest />
          </mesh>
          <mesh
            position={[0, DECAL_LIFT + 0.004, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[0.07, 0.012, 10, 32]} />
            <meshBasicMaterial color="#f2f4ed" depthWrite depthTest />
          </mesh>
          {/* Short pin so the flag stays inside the close putting view. */}
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.011, 0.011, 1.1, 12]} />
            <meshBasicMaterial color="#f2f4ed" depthWrite depthTest />
          </mesh>
          <mesh position={[0.105, 1.03, 0]}>
            <boxGeometry args={[0.19, 0.11, 0.012]} />
            <meshBasicMaterial color="#ff8e7f" depthWrite depthTest />
          </mesh>
          <MarkerBeacon color="#ff8e7f" />
        </group>
      )}
    </>
  );
}

const splatProbeRaycaster = new Raycaster();
const splatProbeOrigin = new Vector3();
const splatProbeDown = new Vector3(0, -1, 0);

/**
 * One-time visual height probe against the Gaussian splat. Used only while
 * rebuilding the playable proxy so live physics never raycasts splats.
 *
 * Gaussians are fuzzy: the nearest hit is often the upper shell. Among hits
 * near the collider we take the lower quartile so the proxy seats on the
 * visible putting surface rather than floating on the fluff.
 */
function probeSplatVisualHeight(
  splat: SplatMesh,
  x: number,
  z: number,
  colliderY: number,
): number | null {
  const previous = splat.raycastable;
  splat.raycastable = true;
  splat.updateMatrixWorld(true);
  splatProbeOrigin.set(x, colliderY + 2.75, z);
  splatProbeRaycaster.set(splatProbeOrigin, splatProbeDown);
  splatProbeRaycaster.near = 0;
  splatProbeRaycaster.far = 8;
  const hits: Intersection[] = [];
  splat.raycast(splatProbeRaycaster, hits);
  splat.raycastable = previous;
  if (hits.length === 0) return null;
  const band = hits
    .map((hit) => hit.point.y)
    .filter((y) => {
      const bias = y - colliderY;
      return bias >= -0.2 && bias <= 0.55;
    })
    .sort((a, b) => a - b);
  if (band.length === 0) return null;
  const lowerQuartile = band[Math.floor((band.length - 1) * 0.25)]!;
  return lowerQuartile;
}

/**
 * Rebuilds the registered playable-surface proxy once per layout. Source
 * collision geometry supplies topology; a one-time splat height probe bakes
 * visual registration into the proxy so contact matches the visible green.
 */
function PlayableSurfaceRegistration({
  flightRef,
  tee,
  cup,
  active,
}: {
  flightRef: { current: FlightState };
  tee: MarkerPoint | null;
  cup: MarkerPoint | null;
  active: boolean;
}) {
  const stateRef = useRef<{
    key: string;
    surface: PuttingSurface | null;
    visualAligned: boolean;
  }>({ key: "", surface: null, visualAligned: false });

  useFrame(() => {
    if (!active || !tee || !cup) return;
    const { surface, splat, holeRoot, splatRoot } = flightRef.current;
    if (!surface) return;

    const layoutKey = [tee.x, tee.y, tee.z, cup.x, cup.y, cup.z]
      .map((value) => value.toFixed(3))
      .join("|");
    const state = stateRef.current;
    const layoutChanged =
      state.surface !== surface || state.key !== layoutKey;
    if (layoutChanged) {
      state.visualAligned = false;
    }

    // Always build a topology proxy from the collider first so placement and
    // physics have a floor even before splat raycasts are ready.
    if (layoutChanged || !surface.isReady) {
      const stats = surface.rebuildProxy(tee, cup);
      state.surface = surface;
      state.key = layoutKey;
      logCentering("surface:proxy-ready", {
        stats,
        phase: "collider",
        sourceCollider: surface.sourceCollider.name,
        proxyCollider: surface.proxyCollider?.name ?? null,
        tee,
        cup,
      });
    }

    if (!splat || state.visualAligned) return;

    holeRoot?.updateWorldMatrix(true, true);
    splatRoot?.updateWorldMatrix(true, true);
    splat.updateMatrixWorld(true);

    try {
      const stats = surface.rebuildProxy(tee, cup, {
        visualHeightAt: (x, z, colliderY) =>
          probeSplatVisualHeight(splat, x, z, colliderY),
      });
      splat.raycastable = false;
      // Require a real consensus before locking — otherwise keep retrying
      // as paged splat residency improves.
      if ((stats?.visualSamples ?? 0) < 8) return;
      state.visualAligned = true;
      state.surface = surface;
      state.key = layoutKey;
      logCentering("surface:proxy-ready", {
        stats,
        phase: "visual",
        sourceCollider: surface.sourceCollider.name,
        proxyCollider: surface.proxyCollider?.name ?? null,
        visualBiasMeters: stats?.visualBiasMeters ?? null,
        visualSamples: stats?.visualSamples ?? 0,
        tee,
        cup,
      });
    } catch (error) {
      splat.raycastable = false;
      logCentering("surface:visual-align-error", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return null;
}
/**
 * Spark is a transparent pass and intentionally does not write depth. If an
 * opaque marker renders first, Gaussian tails can blend over its surface even
 * when the marker is geometrically tangent to the proxy. Keep gameplay in the
 * transparent queue after Spark while retaining normal depth testing and each
 * material's authored depth-write behavior. This is targeted composition, not
 * the depth-disabled "objects on top" diagnostic used during triage.
 */
function SplatCompositedGameplay({
  rootRef,
}: {
  rootRef: { current: Group | null };
}) {
  const compositedMaterials = useRef(new WeakSet<Material>());

  useFrame(() => {
    const root = rootRef.current;
    if (!root) return;
    root.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      mesh.renderOrder = Math.max(mesh.renderOrder, 2);
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials) {
        if (compositedMaterials.current.has(material)) continue;
        compositedMaterials.current.add(material);
        material.transparent = true;
        material.depthTest = true;
        material.needsUpdate = true;
      }
    });
  });

  return null;
}

// Sink celebration: a confetti burst out of the cup plus expanding ground
// rings, launched imperatively at the exact frame the physics confirm the
// ball dropped. Purely visual — it never touches the putt state.
const CONFETTI_COUNT = 110;
const CONFETTI_COLORS = ["#83f3b9", "#38b97c", "#f2f4ed", "#ff8e7f", "#ffd166"];
const CELEBRATION_MS = 2600;
// Paper-like fall: soft gravity plus heavy drag reads as fluttering
// confetti instead of ballistic gravel.
const CONFETTI_GRAVITY = 4.6;
const CONFETTI_DRAG = 0.55;
const RING_MS = 1050;
const RING_STAGGER_MS = 220;
const RING_MAX_RADIUS = 1.15;

type ConfettiSeed = {
  velocity: Vector3;
  spinAxis: Vector3;
  spinSpeed: number;
  scale: number;
  landed: boolean;
};

function CupCelebration({
  cup,
  launchRef,
}: {
  cup: Vector3;
  // PuttMode triggers the burst through this ref (flightRef pattern), so
  // the launch happens without any state round trip.
  launchRef: { current: (() => void) | null };
}) {
  const confettiRef = useRef<InstancedMesh>(null);
  const ringARef = useRef<Mesh>(null);
  const ringBRef = useRef<Mesh>(null);
  const burst = useRef<{
    start: number;
    seeds: ConfettiSeed[];
    positions: Vector3[];
  } | null>(null);
  const dummy = useMemo(() => new Object3D(), []);

  useEffect(() => {
    // Per-piece colors from the course palette, set once.
    const mesh = confettiRef.current;
    if (!mesh) return;
    const color = new Color();
    for (let i = 0; i < CONFETTI_COUNT; i += 1) {
      mesh.setColorAt(i, color.set(CONFETTI_COLORS[i % CONFETTI_COLORS.length]));
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  useEffect(() => {
    const launch = () => {
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const seeds: ConfettiSeed[] = [];
      const positions: Vector3[] = [];
      // Reduced motion keeps the quiet ring pulse but skips the particle
      // storm.
      const count = reduced ? 0 : CONFETTI_COUNT;
      for (let i = 0; i < count; i += 1) {
        const azimuth = Math.random() * Math.PI * 2;
        const elevation = (0.35 + Math.random() * 0.5) * (Math.PI / 2);
        const speed = 1.1 + Math.random() * 1.7;
        const horizontal = Math.cos(elevation) * speed;
        seeds.push({
          velocity: new Vector3(
            Math.cos(azimuth) * horizontal,
            Math.sin(elevation) * speed,
            Math.sin(azimuth) * horizontal,
          ),
          spinAxis: new Vector3(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5,
          ).normalize(),
          spinSpeed: 6 + Math.random() * 14,
          scale: 0.7 + Math.random() * 0.7,
          landed: false,
        });
        positions.push(new Vector3(0, 0.02, 0));
      }
      burst.current = { start: performance.now(), seeds, positions };
    };
    launchRef.current = launch;
    return () => {
      if (launchRef.current === launch) launchRef.current = null;
    };
  }, [cup, launchRef]);

  useFrame((_, delta) => {
    const active = burst.current;
    const confetti = confettiRef.current;
    const rings = [ringARef.current, ringBRef.current];
    if (!confetti) return;
    if (!active) {
      confetti.count = 0;
      for (const ring of rings) {
        if (ring) ring.visible = false;
      }
      return;
    }

    const elapsed = performance.now() - active.start;
    if (elapsed > CELEBRATION_MS) {
      burst.current = null;
      return;
    }

    // Confetti: integrate a floaty fall, land on the green, fade out late.
    const drag = Math.exp(-CONFETTI_DRAG * delta);
    const groundY = 0.006;
    for (let i = 0; i < active.seeds.length; i += 1) {
      const seed = active.seeds[i];
      const position = active.positions[i];
      if (!seed.landed) {
        seed.velocity.y -= CONFETTI_GRAVITY * delta;
        seed.velocity.multiplyScalar(drag);
        position.addScaledVector(seed.velocity, delta);
        if (position.y <= groundY && seed.velocity.y < 0) {
          position.y = groundY;
          seed.landed = true;
        }
      }
      dummy.position.copy(position);
      if (seed.landed) {
        dummy.rotation.set(-Math.PI / 2, 0, seed.spinSpeed);
      } else {
        const angle = (elapsed / 1000) * seed.spinSpeed;
        dummy.rotation.set(0, 0, 0);
        dummy.rotateOnAxis(seed.spinAxis, angle);
      }
      dummy.scale.setScalar(seed.scale);
      dummy.updateMatrix();
      confetti.setMatrixAt(i, dummy.matrix);
    }
    confetti.count = active.seeds.length;
    confetti.instanceMatrix.needsUpdate = true;
    const fade = Math.min(1, Math.max(0, (CELEBRATION_MS - elapsed) / 700));
    (confetti.material as MeshBasicMaterial).opacity = fade;

    // Ground rings: two staggered pulses expanding out of the cup.
    rings.forEach((ring, index) => {
      if (!ring) return;
      const t = (elapsed - index * RING_STAGGER_MS) / RING_MS;
      if (t < 0 || t > 1) {
        ring.visible = false;
        return;
      }
      const eased = 1 - (1 - t) * (1 - t);
      ring.visible = true;
      ring.scale.setScalar(0.1 + eased * RING_MAX_RADIUS);
      (ring.material as MeshBasicMaterial).opacity = 0.55 * (1 - eased);
    });
  });

  return (
    <group position={cup}>
      <instancedMesh
        ref={confettiRef}
        args={[undefined, undefined, CONFETTI_COUNT]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.03, 0.004, 0.018]} />
        <meshBasicMaterial transparent depthWrite={false} />
      </instancedMesh>
      <mesh
        ref={ringARef}
        visible={false}
        position={[0, 0.008, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.82, 1, 48]} />
        <meshBasicMaterial
          color="#83f3b9"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      <mesh
        ref={ringBRef}
        visible={false}
        position={[0, 0.012, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.82, 1, 48]} />
        <meshBasicMaterial
          color="#f2f4ed"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

type LookControls = { target: Vector3; update: () => void } | null;

type OrbitZoom = {
  enableZoom?: boolean;
  zoomSpeed?: number;
  minDistance?: number;
  maxDistance?: number;
} | null;

// Putt mode hands the scroll wheel to the orbit's dolly-zoom around the
// ball; fly mode takes it back for the forward/back dolly.
function setOrbitZoom(orbit: OrbitZoom, enabled: boolean) {
  if (!orbit) return;
  orbit.enableZoom = enabled;
  orbit.zoomSpeed = 1.4;
  orbit.minDistance = enabled ? PUTT_ZOOM_MIN : 0;
  orbit.maxDistance = enabled ? PUTT_ZOOM_MAX : Infinity;
}

function setPuttActive(flight: FlightState, active: boolean) {
  flight.puttActive = active;
}

// Camera spot for a stroke: behind the ball on the ball–cup line, pulled in
// if terrain intervenes and lifted clear of the ground. `back` carries the
// player's scroll-zoom preference between strokes.
function strokePerch(
  ball: Vector3,
  cup: Vector3,
  collider: WorldCollider,
  back: number = PERCH_BACK,
): Vector3 {
  const line = new Vector3(cup.x - ball.x, 0, cup.z - ball.z);
  if (line.lengthSq() < 1e-6) line.set(0, 0, -1);
  line.normalize();
  const perch = ball
    .clone()
    .addScaledVector(line, -back)
    .add(new Vector3(0, PERCH_UP * (back / PERCH_BACK), 0));

  const eye = ball.clone().add(new Vector3(0, 0.3, 0));
  const toPerch = perch.clone().sub(eye);
  const span = toPerch.length();
  const hit = pickWorldPoint(collider, eye, toPerch);
  if (hit && hit.distance < span + 0.6) {
    perch
      .copy(eye)
      .addScaledVector(toPerch.divideScalar(span), Math.max(0.6, hit.distance - 0.6));
  }
  const ground = groundLevelBelow(perch, collider);
  if (ground !== null && perch.y < ground + 0.45) perch.y = ground + 0.45;
  return perch;
}

type FlyoverPlan = {
  startedAt: number;
  duration: number;
  from: Vector3;
  control: Vector3;
  to: Vector3;
  lookFrom: Vector3;
  lookTo: Vector3;
  done: boolean;
};

/**
 * A short authored camera pass from the cup end of the green back to the
 * tee. Putting is not mounted until this completes, so input can never skip
 * the course read or accidentally strike the ball during the flyover.
 */
function HoleFlyover({
  flightRef,
  tee,
  cup,
  onComplete,
}: {
  flightRef: { current: FlightState };
  tee: MarkerPoint;
  cup: MarkerPoint;
  onComplete: () => void;
}) {
  const { camera, controls } = useThree();
  const planRef = useRef<FlyoverPlan | null>(null);
  const pointRef = useRef(new Vector3());
  const targetRef = useRef(new Vector3());
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const flight = flightRef.current;
    setPuttActive(flight, true);
    return () => setPuttActive(flight, false);
  }, [flightRef]);

  useFrame(() => {
    const flight = flightRef.current;
    const { collider, surface } = flight;
    if (!collider || !surface) return;

    let plan = planRef.current;
    if (!plan) {
      const teeSample = surface.sample(new Vector3(tee.x, tee.y, tee.z), {
        expectedRegion: "tee",
        previousSurfaceHeight: tee.y,
        maxAbove: 2,
        maxBelow: 3,
      });
      const cupSample = surface.sample(new Vector3(cup.x, cup.y, cup.z), {
        expectedRegion: "cup",
        previousSurfaceHeight: cup.y,
        maxAbove: 2,
        maxBelow: 3,
      });
      const teeWorld = teeSample?.point.clone() ?? new Vector3(tee.x, tee.y, tee.z);
      const cupWorld = cupSample?.point.clone() ?? new Vector3(cup.x, cup.y, cup.z);
      const line = cupWorld.clone().sub(teeWorld);
      line.y = 0;
      const span = Math.max(2.5, line.length());
      if (line.lengthSq() < 1e-6) line.set(0, 0, -1);
      line.normalize();
      const right = new Vector3(-line.z, 0, line.x);
      const height = Math.min(6, Math.max(2.6, span * 0.48));
      const from = cupWorld
        .clone()
        .addScaledVector(line, Math.min(1.4, span * 0.18))
        .addScaledVector(right, span * 0.32);
      from.y += height;
      const control = teeWorld
        .clone()
        .lerp(cupWorld, 0.5)
        .addScaledVector(right, span * 0.18);
      control.y += height * 1.18;

      plan = {
        startedAt: performance.now(),
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? REDUCED_MOTION_FLYOVER_MS
          : FLYOVER_MS,
        from,
        control,
        to: strokePerch(teeWorld, cupWorld, collider),
        lookFrom: cupWorld,
        lookTo: teeWorld,
        done: false,
      };
      planRef.current = plan;
      camera.position.copy(from);
    }

    if (plan.done) return;
    const raw = Math.min(1, (performance.now() - plan.startedAt) / plan.duration);
    const t = raw * raw * (3 - 2 * raw);
    const inverse = 1 - t;
    const point = pointRef.current;
    const target = targetRef.current;
    point
      .copy(plan.from)
      .multiplyScalar(inverse * inverse)
      .addScaledVector(plan.control, 2 * inverse * t)
      .addScaledVector(plan.to, t * t);
    target.lerpVectors(plan.lookFrom, plan.lookTo, t);
    target.y += 0.12;
    camera.position.copy(point);

    const look = controls as unknown as LookControls;
    if (look) {
      look.target.copy(target);
      look.update();
    } else {
      camera.lookAt(target);
    }

    if (raw >= 1) {
      plan.done = true;
      onCompleteRef.current();
    }
  });

  return null;
}

function PuttMode({
  flightRef,
  tee,
  cup,
  onHud,
  onStroke,
  onHoled,
}: {
  flightRef: { current: FlightState };
  tee: MarkerPoint;
  cup: MarkerPoint;
  onHud: (hud: PuttHud) => void;
  /** Fired once, at the exact moment the stroke impulse is applied. */
  onStroke: (power: number) => void;
  /** Fired once, when the physics confirm the ball dropped into the cup. */
  onHoled: (strokes: number) => void;
}) {
  const { camera, controls, gl } = useThree();
  const ballMeshRef = useRef<Group>(null);
  const aimRef = useRef<Group>(null);
  const celebrateRef = useRef<(() => void) | null>(null);
  const cupVec = useMemo(() => new Vector3(cup.x, cup.y, cup.z), [cup]);
  const cupLocal = useMemo(() => new Vector3(cup.x, cup.y, cup.z), [cup]);
  const ballLocal = useMemo(() => new Vector3(), []);
  const aimForwardLocal = useMemo(() => new Vector3(), []);
  const aimForwardWorldPoint = useMemo(() => new Vector3(), []);
  const state = useRef<{
    phase: PuttPhase;
    strokes: number;
    power: number;
    chargeStart: number;
    note: string | null;
    ball: PuttBall;
    strokeStart: Vector3;
    glide: { fromPos: Vector3; fromTarget: Vector3; toPos: Vector3; start: number } | null;
    drop: { from: Vector3; start: number } | null;
    // How far behind the ball the camera perches; scroll zoom adjusts it
    // and the preference carries to the next stroke's glide.
    viewBack: number;
    // Whether the ball has been seated on the sampled putting surface.
    // Seating happens on the first frame that has the surface (refs cannot
    // be read during render), and re-runs if the surface loads late.
    seated: boolean;
  } | null>(null);
  if (state.current === null) {
    const ball = createBall(new Vector3(tee.x, tee.y, tee.z));
    state.current = {
      phase: "aim",
      strokes: 0,
      power: 0,
      chargeStart: 0,
      note: null,
      ball,
      strokeStart: ball.position.clone(),
      glide: null,
      drop: null,
      viewBack: PERCH_BACK,
      seated: false,
    };
  }

  const publish = useCallback(() => {
    const putt = state.current;
    if (!putt) return;
    onHud({ phase: putt.phase, strokes: putt.strokes, note: putt.note });
  }, [onHud]);

  const glideTo = useCallback(
    (perch: Vector3) => {
      const putt = state.current;
      const look = controls as unknown as LookControls;
      if (!putt || !look) return;
      putt.glide = {
        fromPos: camera.position.clone(),
        fromTarget: look.target.clone(),
        toPos: perch,
        start: performance.now(),
      };
    },
    [camera, controls],
  );

  // Enter: settle the camera behind the tee'd ball facing the cup, and hand
  // the scroll wheel to the orbit zoom around the ball.
  useEffect(() => {
    const putt = state.current;
    const flight = flightRef.current;
    const collider = flight.collider;
    if (putt && collider) {
      glideTo(strokePerch(putt.ball.position, cupVec, collider));
    }
    publish();

    setPuttActive(flight, true);
    const orbit = controls as unknown as OrbitZoom;
    setOrbitZoom(orbit, true);

    // Exit: back to panorama-style look controls (pivot just ahead of the
    // camera) instead of orbiting the last ball position.
    const look = controls as unknown as LookControls;
    return () => {
      setPuttActive(flight, false);
      setOrbitZoom(orbit, false);
      if (!look) return;
      const forward = new Vector3(0, 0, -1)
        .applyQuaternion(camera.quaternion)
        .multiplyScalar(0.01);
      look.target.copy(camera.position).add(forward);
      look.update();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const chargeLevel = () => {
      const putt = state.current;
      if (!putt) return 0;
      return Math.min(1, (performance.now() - putt.chargeStart) / CHARGE_FULL_MS);
    };

    const beginCurrentCharge = () => {
      const putt = state.current;
      if (!putt) return false;
      const next = beginCharge(putt.phase);
      if (next === putt.phase) return false;
      putt.phase = next;
      putt.chargeStart = performance.now();
      putt.power = 0;
      publish();
      return true;
    };

    const commitCurrentStroke = () => {
      const putt = state.current;
      if (!putt) return;
      // The FSM guarantees one committed stroke per charge: a stray keyup,
      // a cancelled charge, or a rolling/holed ball commits nothing.
      const commit = commitStroke(putt.phase, chargeLevel());
      if (commit.committedPower === null) return;
      putt.power = commit.committedPower;

      const direction = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      direction.y = 0;
      if (direction.lengthSq() < 1e-4) {
        // Looking straight up/down: fall back to the cup line.
        direction.set(
          cupVec.x - putt.ball.position.x,
          0,
          cupVec.z - putt.ball.position.z,
        );
      }
      strokeBall(putt.ball, direction, strokeSpeed(putt.power));
      // The stroke impulse was just applied — this is the putt-sound moment.
      onStroke(putt.power);
      putt.strokeStart = putt.ball.position.clone();
      putt.strokes += 1;
      putt.phase = commit.phase;
      putt.note = null;
      // A perch glide still in flight would fight the follow cam, so the
      // stroke takes the camera over from wherever the glide has reached.
      putt.glide = null;
      logCentering("putt:stroke", {
        stroke: putt.strokes,
        power: Number(putt.power.toFixed(2)),
        speed: Number(strokeSpeed(putt.power).toFixed(2)),
      });
      publish();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      event.preventDefault();
      if (event.repeat) return;
      beginCurrentCharge();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      event.preventDefault();
      commitCurrentStroke();
    };

    const onBlur = () => {
      const putt = state.current;
      if (!putt) return;
      const next = cancelCharge(putt.phase);
      if (next === putt.phase) return;
      putt.phase = next;
      putt.power = 0;
      publish();
    };

    // Touch keeps drag-to-aim intact: a short/moving gesture belongs to the
    // orbit controls, while a still press becomes the same charge intent as
    // Space. Releasing commits through the exact same stroke path.
    let touch:
      | {
          id: number;
          startX: number;
          startY: number;
          timer: number;
          charging: boolean;
        }
      | null = null;

    const clearTouch = (cancel: boolean) => {
      if (!touch) return;
      window.clearTimeout(touch.timer);
      if (cancel && touch.charging) onBlur();
      touch = null;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || !event.isPrimary || touch) return;
      const pending = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        timer: 0,
        charging: false,
      };
      pending.timer = window.setTimeout(() => {
        if (!touch || touch.id !== pending.id) return;
        touch.charging = beginCurrentCharge();
      }, 180);
      touch = pending;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!touch || event.pointerId !== touch.id) return;
      if (
        Math.hypot(event.clientX - touch.startX, event.clientY - touch.startY) >
        10
      ) {
        clearTouch(true);
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!touch || event.pointerId !== touch.id) return;
      const shouldCommit = touch.charging;
      clearTouch(false);
      if (shouldCommit) {
        event.preventDefault();
        commitCurrentStroke();
      }
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (touch && event.pointerId === touch.id) clearTouch(true);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    gl.domElement.addEventListener("pointerdown", onPointerDown);
    gl.domElement.addEventListener("pointermove", onPointerMove);
    gl.domElement.addEventListener("pointerup", onPointerUp);
    gl.domElement.addEventListener("pointercancel", onPointerCancel);
    return () => {
      clearTouch(true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      gl.domElement.removeEventListener("pointerdown", onPointerDown);
      gl.domElement.removeEventListener("pointermove", onPointerMove);
      gl.domElement.removeEventListener("pointerup", onPointerUp);
      gl.domElement.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [camera, cupVec, gl, onStroke, publish]);

  useFrame((_, delta) => {
    const putt = state.current;
    const { collider, surface, holeRoot } = flightRef.current;
    if (!putt || !collider || !surface) return;

    const cupSurface = surface.sample(
      markerScratchPoint.set(cup.x, cup.y, cup.z),
      {
        expectedRegion: "cup",
        previousSurfaceHeight: cup.y,
        maxAbove: 2,
        maxBelow: 3,
      },
    );
    if (cupSurface) cupVec.copy(cupSurface.point);

    // First frame with the surface: seat the untouched ball tangent to it
    // (spawn placement — center at surfacePoint + normal * (radius + skin)).
    if (!putt.seated) {
      putt.seated = true;
      if (putt.strokes === 0 && putt.phase === "aim") {
        placeBallOnSurface(
          putt.ball,
          surface,
          new Vector3(tee.x, tee.y, tee.z),
        );
        putt.strokeStart = putt.ball.position.clone();
      }
    }

    // Camera glide toward the current stroke perch, looking at the ball.
    const look = controls as unknown as LookControls;
    if (putt.glide && look) {
      const t = Math.min(1, (performance.now() - putt.glide.start) / PERCH_GLIDE_MS);
      const eased = t * t * (3 - 2 * t);
      camera.position.lerpVectors(putt.glide.fromPos, putt.glide.toPos, eased);
      look.target.lerpVectors(putt.glide.fromTarget, putt.ball.position, eased);
      look.update();
      if (t >= 1) putt.glide = null;
    }

    if (putt.phase === "charging") {
      putt.power = Math.min(1, (performance.now() - putt.chargeStart) / CHARGE_FULL_MS);
    }

    if (putt.phase === "rolling") {
      const ballBefore = putt.ball.position.clone();
      const result = stepBall(putt.ball, delta, surface, cupVec);

      // Follow cam: carry the camera and its orbit pivot along with the
      // ball's motion, so the framing chosen at stroke time (distance,
      // height, angle) chases the ball while it rolls. Dragging still
      // orbits around the moving ball; the ground clamp below keeps the
      // chase out of the terrain.
      if (look && !putt.glide) {
        const ballDelta = putt.ball.position.clone().sub(ballBefore);
        if (ballDelta.lengthSq() > 0) {
          camera.position.add(ballDelta);
          look.target.copy(putt.ball.position);
          look.update();
        }
      }

      if (result === "holed") {
        putt.phase = "holed";
        putt.drop = { from: putt.ball.position.clone(), start: performance.now() };
        // Confirmed sink: physics returned "holed" (a rim graze or lip-out
        // returns "rolling"/"settled" and never reaches this branch).
        celebrateRef.current?.();
        onHoled(putt.strokes);
        logCentering("putt:holed", { strokes: putt.strokes });
        publish();
      } else if (result === "settled") {
        putt.phase = "aim";
        putt.power = 0;
        putt.note = putt.ball.lipped
          ? "Lipped out — too much pace at the cup."
          : null;
        glideTo(strokePerch(putt.ball.position, cupVec, collider, putt.viewBack));
        publish();
      } else if (result === "lost") {
        // Replace on the surface below where the stroke started.
        putt.ball = createBall(putt.strokeStart.clone(), surface);
        putt.phase = "aim";
        putt.power = 0;
        putt.note = "Out of bounds — ball replaced, no penalty.";
        glideTo(strokePerch(putt.ball.position, cupVec, collider, putt.viewBack));
        publish();
      }

      // Roll the ball visual to match its travel over the ground.
      const ballGroup = ballMeshRef.current;
      const speed = putt.ball.velocity.length();
      if (ballGroup && putt.ball.grounded && speed > 1e-4) {
        const axis = new Vector3(0, 1, 0).cross(putt.ball.velocity).normalize();
        if (axis.lengthSq() > 0.5) {
          ballGroup.rotateOnWorldAxis(axis, (speed * delta) / BALL_RADIUS);
        }
      }
    }

    // Sink the holed ball into the cup instead of teleporting it.
    if (putt.phase === "holed" && putt.drop) {
      const t = Math.min(1, (performance.now() - putt.drop.start) / 350);
      putt.ball.position.lerpVectors(
        putt.drop.from,
        new Vector3(cupVec.x, cupVec.y - 0.04, cupVec.z),
        t * t,
      );
      if (t >= 1) putt.drop = null;
    }

    // Remember the scroll-zoomed distance while aiming so the next stroke's
    // perch keeps it, and keep the orbit/zoom camera out of the terrain.
    if (!putt.glide) {
      if (putt.phase === "aim" || putt.phase === "charging") {
        // strokePerch treats `back` as the horizontal offset and adds a
        // proportional lift, so convert the eye distance to that base.
        const distance =
          camera.position.distanceTo(putt.ball.position) /
          Math.hypot(1, PERCH_UP / PERCH_BACK);
        putt.viewBack = Math.min(
          PUTT_ZOOM_MAX,
          Math.max(PUTT_ZOOM_MIN, distance),
        );
      }
      const ground = groundLevelBelow(camera.position, collider);
      if (ground !== null && camera.position.y < ground + 0.32) {
        camera.position.setY(ground + 0.32);
      }
    }

    // Imperative visuals: ball, aim line, and the fast-changing HUD numbers.
    worldToHoleLocal(holeRoot, putt.ball.position, ballLocal);
    ballMeshRef.current?.position.copy(ballLocal);
    worldToHoleLocal(holeRoot, cupVec, cupLocal);

    const aim = aimRef.current;
    if (aim) {
      const aiming = putt.phase === "aim" || putt.phase === "charging";
      aim.visible = aiming;
      if (aiming) {
        const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        aim.position.copy(ballLocal);
        aimForwardWorldPoint.copy(putt.ball.position).add(forward);
        worldToHoleLocal(holeRoot, aimForwardWorldPoint, aimForwardLocal)
          .sub(ballLocal)
          .normalize();
        aim.rotation.y = Math.atan2(-aimForwardLocal.x, -aimForwardLocal.z);
        aim.scale.z = 0.6 + putt.power * 2.6;
      }
    }

    const distanceToCup = Math.hypot(
      putt.ball.position.x - cupVec.x,
      putt.ball.position.z - cupVec.z,
    );
    const distanceOut = document.getElementById("putt-distance");
    if (distanceOut) {
      distanceOut.textContent =
        putt.phase === "holed" ? "In the cup" : `${distanceToCup.toFixed(1)} m`;
    }
    const powerFill = document.getElementById("putt-power-fill");
    if (powerFill) powerFill.style.width = `${Math.round(putt.power * 100)}%`;

    (window as CenterDebugWindow).__PUTT_STATE__ = {
      phase: putt.phase,
      strokes: putt.strokes,
      power: putt.power,
      ball: putt.ball.position.toArray(),
      distanceToCup,
      cameraToBall: camera.position.distanceTo(putt.ball.position),
    };
  });

  return (
    <>
      <group ref={ballMeshRef}>
        <mesh>
          <sphereGeometry args={[BALL_RADIUS, 24, 18]} />
          <meshBasicMaterial color="#ffffff" depthWrite depthTest />
        </mesh>
        {/* Band around the ball so its roll is visible. */}
        <mesh>
          <torusGeometry args={[BALL_RADIUS * 0.99, BALL_RADIUS * 0.2, 8, 28]} />
          <meshBasicMaterial color="#38b97c" depthWrite depthTest />
        </mesh>
      </group>
      <group ref={aimRef}>
        {/* Transparent, so it shares the pass with the splats: renderOrder
            puts it after them and depthWrite off keeps it from occluding. */}
        <mesh position={[0, 0.014, -0.5]} renderOrder={2}>
          <boxGeometry args={[0.02, 0.008, 1]} />
          <meshBasicMaterial
            color="#83f3b9"
            transparent
            opacity={0.9}
            depthWrite={false}
          />
        </mesh>
      </group>
      <CupCelebration cup={cupLocal} launchRef={celebrateRef} />
    </>
  );
}

function InsideSplat({
  runtime,
  flightRef,
  holeRootRef,
  onSnapshot,
  onStatus,
}: {
  runtime: MintWorldRuntime;
  flightRef: { current: FlightState };
  holeRootRef: { current: Group | null };
  onSnapshot: (snapshot: CenteringSnapshot) => void;
  onStatus: (status: CenterStatus) => void;
}) {
  const { camera, gl, invalidate } = useThree();
  const splatRef = useRef<SplatMesh | null>(null);
  const rootRef = useRef<Group | null>(null);
  const boundsRef = useRef<Box3 | null>(null);
  const residentSplatsRef = useRef(0);
  const readyRef = useRef(false);
  const verifyRef = useRef<VerifyCycle | null>(null);

  useEffect(() => {
    let cancelled = false;
    const flightState = flightRef.current;

    // Bake source conversion plus the documented hole registration into the
    // collider once. The splat receives the exact same transforms through its
    // source root + holeRoot; gameplay queries operate in registered world
    // coordinates and rendered children convert back through holeRoot.
    loadWorldCollider(
      runtime.colliderUrl,
      mintSourceToWorldMatrix(runtime.holeNumber),
    )
      .then((collider) => {
        if (cancelled) {
          collider.dispose();
          return;
        }
        flightState.collider = collider;
        const holeRoot = holeRootRef.current;
        holeRoot?.updateWorldMatrix(true, true);
        flightState.surface = new PuttingSurface(
          collider,
          holeRoot
            ? new Vector3(0, 1, 0).transformDirection(holeRoot.matrixWorld)
            : new Vector3(0, 1, 0),
        );
        logCentering("collider:loaded", {
          hole: runtime.holeNumber,
          triangles: collider.triangles,
          bounds: describeBounds(collider.bounds),
          registration: getHoleRootRegistration(runtime.holeNumber),
          sourceToWorld: mintSourceToWorldMatrix(runtime.holeNumber).toArray(),
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // Without the mesh the containment guarantee is gone, so flight
        // simply stays locked; looking around still works.
        logCentering("collider:error", {
          hole: runtime.holeNumber,
          colliderUrl: runtime.colliderUrl,
          message: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      cancelled = true;
      flightState.surface?.dispose();
      flightState.surface = null;
      flightState.collider?.dispose();
      flightState.collider = null;
    };
  }, [flightRef, holeRootRef, runtime]);

  const buildSnapshot = useCallback(
    (
      status: CenterStatus,
      view: InsideViewCheck | null = null,
    ): CenteringSnapshot | null => {
      const bounds = boundsRef.current;
      if (!bounds) return null;
      return {
        hole: runtime.holeNumber,
        status,
        residentSplats: residentSplatsRef.current,
        worldBounds: describeBounds(bounds),
        spanMeters: bounds.getSize(new Vector3()).length(),
        view,
      };
    },
    [runtime.holeNumber],
  );

  useFrame(() => {
    const verify = verifyRef.current;
    if (!verify) return;
    if (verify.waitFrames > 0) {
      verify.waitFrames -= 1;
      return;
    }

    const width = gl.domElement.width;
    const height = gl.domElement.height;
    const context = gl.getContext() as WebGL2RenderingContext;
    const pixels = new Uint8Array(width * height * 4);
    // Spark leaves a PIXEL_PACK buffer bound for its own async readbacks,
    // which turns a plain readPixels into an INVALID_OPERATION no-op.
    // Unbind it for the sample and restore it afterwards.
    const packBuffer = context.getParameter(
      context.PIXEL_PACK_BUFFER_BINDING,
    ) as WebGLBuffer | null;
    if (packBuffer) context.bindBuffer(context.PIXEL_PACK_BUFFER, null);
    context.readPixels(
      0,
      0,
      width,
      height,
      context.RGBA,
      context.UNSIGNED_BYTE,
      pixels,
    );
    if (packBuffer) {
      context.bindBuffer(context.PIXEL_PACK_BUFFER, packBuffer);
    }
    const analysis = analyzeSplatOccupancy(pixels, width, height);
    const insideAccepted = Boolean(
      analysis &&
        analysis.centerOccupied &&
        analysis.coverageRatio >= MIN_INSIDE_COVERAGE,
    );
    const view: InsideViewCheck | null = analysis
      ? { ...analysis, verifyPasses: verify.pass, insideAccepted }
      : null;

    logCentering("inside-verify:sampled", {
      hole: verify.hole,
      pass: verify.pass,
      drawingBuffer: [width, height],
      occupiedPixels: analysis?.occupiedPixels ?? 0,
      coverageRatio: analysis?.coverageRatio ?? 0,
      centerOccupied: analysis?.centerOccupied ?? false,
      insideAccepted,
    });

    if (insideAccepted) {
      readyRef.current = true;
      verifyRef.current = null;
      const snapshot = buildSnapshot("ready", view);
      if (!snapshot) return;
      flightRef.current.roamRadius = Math.min(
        FLY_ROAM_MAX,
        Math.max(FLY_ROAM_MIN, snapshot.spanMeters * FLY_ROAM_PER_SPAN),
      );
      flightRef.current.enabled = true;
      flightRef.current.speed = Math.min(
        FLY_SPEED_MAX,
        Math.max(FLY_SPEED_MIN, snapshot.spanMeters * FLY_SPEED_PER_SPAN),
      );
      onSnapshot(snapshot);
      onStatus("ready");
      logCentering("inside-verify:accepted", {
        ...snapshot,
        elapsedMs: performance.now() - verify.startedAt,
      });
      invalidate();
      return;
    }

    if (verify.pass >= MAX_VERIFY_PASSES) {
      verifyRef.current = null;
      const snapshot = buildSnapshot("error", view);
      if (snapshot) onSnapshot(snapshot);
      onStatus("error");
      logCentering("inside-verify:failed", {
        hole: verify.hole,
        passes: verify.pass,
        coverageRatio: analysis?.coverageRatio ?? 0,
      });
      return;
    }

    verify.pass += 1;
    verify.waitFrames = VERIFY_WAIT_FRAMES;
    const snapshot = buildSnapshot("centering", view);
    if (snapshot) onSnapshot(snapshot);
  });

  useEffect(() => {
    let cancelled = false;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
    let lastResidentSplats = 0;
    const flightState = flightRef.current;

    const holeRoot = holeRootRef.current;
    if (!holeRoot) return undefined;
    const root = new Group();
    root.name = "mint-source-root";
    // Splat files are stored Y-down; flip them so the sky points up before
    // the camera is dropped into the middle of the world.
    root.rotation.x = Math.PI;
    holeRoot.add(root);
    readyRef.current = false;
    verifyRef.current = null;
    boundsRef.current = null;
    flightState.enabled = false;
    flightState.roamRadius = null;
    flightState.holeRoot = holeRoot;
    flightState.splatRoot = root;

    const splat = new SplatMesh({
      url: runtime.runtimeUrl,
      fileType: SplatFileType.RAD,
      paged: true,
      // Visual-only. Collision and placement always use the registered proxy.
      raycastable: false,
      onFrame: ({ mesh }) => {
        if (cancelled) return;
        const residentSplats =
          mesh.paged?.numSplats ?? mesh.splats?.getNumSplats() ?? 0;
        if (residentSplats <= 0) return;
        residentSplatsRef.current = residentSplats;
        if (residentSplats === lastResidentSplats) return;
        lastResidentSplats = residentSplats;

        if (readyRef.current || verifyRef.current) return;
        onStatus("centering");
        logCentering("splat:residency", {
          hole: runtime.holeNumber,
          residentSplats,
          stableMinimum: MIN_RESIDENT_SPLATS,
        });
        if (residentSplats < MIN_RESIDENT_SPLATS) return;

        if (!deadlineTimer) {
          deadlineTimer = setTimeout(settleIntoCenter, SETTLE_DEADLINE_MS);
        }
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(settleIntoCenter, SETTLE_DELAY_MS);
      },
    });
    root.add(splat);
    splatRef.current = splat;
    rootRef.current = root;
    flightState.splat = splat;

    const placeCameraAtCenter = () => {
      root.updateMatrixWorld(true);
      splat.updateMatrixWorld(true);
      const localBounds = splat.getBoundingBox(true);
      if (localBounds.isEmpty()) return false;

      // The camera stays at the world origin: Mint worlds are generated from
      // a viewpoint at their file origin, so that point is the authored
      // center of the world and is guaranteed to sit inside the splat. The
      // pixel verification below still proves it every time.
      const worldBounds = localBounds.clone().applyMatrix4(splat.matrixWorld);
      boundsRef.current = worldBounds;

      const span = worldBounds.getSize(new Vector3()).length();
      const perspective = camera as PerspectiveCamera;
      perspective.near = CAMERA_NEAR;
      perspective.far = Math.max(300, span * 1.8);
      perspective.updateProjectionMatrix();
      return true;
    };

    function settleIntoCenter() {
      if (
        cancelled ||
        readyRef.current ||
        verifyRef.current ||
        residentSplatsRef.current < MIN_RESIDENT_SPLATS
      ) {
        return;
      }
      if (!placeCameraAtCenter()) return;
      verifyRef.current = {
        hole: runtime.holeNumber,
        pass: 0,
        waitFrames: VERIFY_WAIT_FRAMES,
        startedAt: performance.now(),
      };
      const snapshot = buildSnapshot("centering");
      if (snapshot) {
        onSnapshot(snapshot);
        logCentering("inside:placed", snapshot);
      }
      invalidate();
    }

    onStatus("loading");
    logCentering("splat:load-start", {
      hole: runtime.holeNumber,
      runtimeUrl: runtime.runtimeUrl,
      byteSize: runtime.byteSize,
    });
    void splat.initialized.catch((error) => {
      if (cancelled) return;
      onStatus("error");
      logCentering("splat:error", {
        hole: runtime.holeNumber,
        message: error instanceof Error ? error.message : String(error),
      });
    });

    return () => {
      cancelled = true;
      if (settleTimer) clearTimeout(settleTimer);
      if (deadlineTimer) clearTimeout(deadlineTimer);
      verifyRef.current = null;
      readyRef.current = false;
      residentSplatsRef.current = 0;
      boundsRef.current = null;
      splatRef.current = null;
      rootRef.current = null;
      flightState.splat = null;
      flightState.splatRoot = null;
      flightState.holeRoot = null;
      flightState.enabled = false;
      root.remove(splat);
      splat.dispose();
      holeRoot.remove(root);
    };
  }, [
    buildSnapshot,
    camera,
    flightRef,
    invalidate,
    onSnapshot,
    onStatus,
    runtime,
    holeRootRef,
  ]);

  return null;
}

function RendererDiagnostics({
  snapshot,
  flightRef,
}: {
  snapshot: CenteringSnapshot | null;
  flightRef: { current: FlightState };
}) {
  const { gl, scene, size } = useThree();

  useFrame(({ camera }) => {
    if (!snapshot) return;
    const view = snapshot.view;
    const diagnostics = {
      hole: snapshot.hole,
      status: snapshot.status,
      residentSplats: snapshot.residentSplats,
      worldBounds: snapshot.worldBounds,
      spanMeters: snapshot.spanMeters,
      verification: view
        ? {
            insideAccepted: view.insideAccepted,
            coverageRatio: view.coverageRatio,
            occupiedPixels: view.occupiedPixels,
            centerOccupied: view.centerOccupied,
            centerPatchOccupancy: view.centerPatchOccupancy,
            verifyPasses: view.verifyPasses,
          }
        : null,
      renderer: {
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        drawingBuffer: [gl.domElement.width, gl.domElement.height],
        cssSize: [gl.domElement.clientWidth, gl.domElement.clientHeight],
        viewport: [size.width, size.height],
        dpr: gl.getPixelRatio(),
        toneMapping: "ACESFilmic",
        outputColorSpace: "srgb",
      },
      scene: {
        objects: scene.children.length,
        canvases: document.querySelectorAll("canvas").length,
      },
      camera: {
        type: camera.type,
        position: camera.position.toArray(),
        quaternion: camera.quaternion.toArray(),
        up: camera.up.toArray(),
        near: camera.near,
        far: camera.far,
      },
      flight: {
        enabled: flightRef.current.enabled,
        speed: flightRef.current.speed,
        colliderTriangles: flightRef.current.collider?.triangles ?? 0,
        colliderActive: Boolean(flightRef.current.collider),
        colliderFloorY: flightRef.current.collider?.bounds.min.y ?? null,
        roamRadius: flightRef.current.roamRadius,
        surfaceActive: Boolean(flightRef.current.surface),
        surfaceReady: flightRef.current.surface?.isReady ?? false,
        surfaceProxy: flightRef.current.surface?.proxyStats ?? null,
        splatActive: Boolean(flightRef.current.splat),
        holeRootWorldMatrix:
          flightRef.current.holeRoot?.matrixWorld.toArray() ?? null,
        splatRootWorldMatrix:
          flightRef.current.splatRoot?.matrixWorld.toArray() ?? null,
      },
    };
    const output = document.getElementById("center-diagnostics");
    if (output) output.textContent = JSON.stringify(diagnostics);
    const debugWindow = window as CenterDebugWindow;
    debugWindow.__CENTERED_WORLD_DIAGNOSTICS__ = diagnostics;
    const api = {
      live: () => debugWindow.__CENTERED_WORLD_DIAGNOSTICS__,
      logs: () => debugWindow.__CENTERED_WORLD_LOG__ ?? [],
    };
    debugWindow.__THREE_SCENE_DIAGNOSTICS__ = api;
  });

  return null;
}

function InsideWorldCanvas({
  runtime,
  snapshot,
  status,
  placementMode,
  markers,
  flyover,
  putt,
  wantsAutoLayout,
  onAutoLayout,
  onPuttHud,
  onStroke,
  onHoled,
  onFlyoverComplete,
  onPlace,
  onSnapshot,
  onStatus,
}: {
  runtime: MintWorldRuntime;
  snapshot: CenteringSnapshot | null;
  status: CenterStatus;
  placementMode: MarkerKind | null;
  markers: { tee: MarkerPoint | null; cup: MarkerPoint | null };
  flyover: { active: boolean; session: number };
  putt: { active: boolean; session: number };
  wantsAutoLayout: boolean;
  onAutoLayout: (layout: DefaultHoleLayout) => void;
  onPuttHud: (hud: PuttHud) => void;
  onStroke: (power: number) => void;
  onHoled: (strokes: number) => void;
  onFlyoverComplete: () => void;
  onPlace: (marker: MarkerKind, point: MarkerPoint) => void;
  onSnapshot: (snapshot: CenteringSnapshot) => void;
  onStatus: (status: CenterStatus) => void;
}) {
  const flightRef = useRef<FlightState>({
    enabled: false,
    speed: FLY_SPEED_MIN,
    roamRadius: null,
    collider: null,
    surface: null,
    splat: null,
    holeRoot: null,
    splatRoot: null,
  });
  const holeRootRef = useRef<Group>(null);
  const gameplayRootRef = useRef<Group>(null);
  const registration = getHoleRootRegistration(runtime.holeNumber);

  return (
    <div
      className={`world-canvas ${status === "ready" ? "is-ready" : ""} ${
        placementMode ? "is-placing" : ""
      }`}
    >
      <output id="center-diagnostics" hidden />
      {/* Each hole gets its own canvas: a fresh Spark renderer so paged
          fetches from an abandoned world can never starve the next one, and
          a fresh camera and controls so every hole starts at the center
          facing the authored direction instead of the last dragged view. */}
      <Canvas
        key={runtime.holeNumber}
        camera={{
          position: [0, 0, 0],
          fov: CAMERA_FOV,
          near: CAMERA_NEAR,
          far: 1000,
        }}
        // Render at device resolution (capped at 2x) so splats stay crisp on
        // retina displays instead of being upscaled from a 1x buffer.
        dpr={[1, 2]}
        frameloop="always"
        gl={{
          antialias: false,
          alpha: true,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = SRGBColorSpace;
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.04;
          gl.setClearColor(new Color("#020705"), 1);
        }}
      >
        <OrbitControls
          makeDefault
          target={LOOK_TARGET}
          enabled={!flyover.active}
          enablePan={false}
          enableZoom={false}
          rotateSpeed={-0.4}
          enableDamping
          dampingFactor={0.08}
        />
        <MintSparkRenderer />
        <FlyControls flightRef={flightRef} />
        <PlacementControls
          flightRef={flightRef}
          mode={status === "ready" ? placementMode : null}
          onPlace={onPlace}
        />
        <AutoLayout
          flightRef={flightRef}
          active={status === "ready" && wantsAutoLayout}
          onLayout={onAutoLayout}
        />
        {status === "ready" &&
          flyover.active &&
          markers.tee &&
          markers.cup && (
            <HoleFlyover
              key={flyover.session}
              flightRef={flightRef}
              tee={markers.tee}
              cup={markers.cup}
              onComplete={onFlyoverComplete}
            />
          )}
        <PlayableSurfaceRegistration
          flightRef={flightRef}
          tee={markers.tee}
          cup={markers.cup}
          active={status === "ready"}
        />
        <group
          ref={holeRootRef}
          name={`hole-${runtime.holeNumber}-root`}
          position={registration.position}
          quaternion={registration.quaternion}
          scale={registration.scale}
        >
          <InsideSplat
            runtime={runtime}
            flightRef={flightRef}
            holeRootRef={holeRootRef}
            onSnapshot={onSnapshot}
            onStatus={onStatus}
          />
          <group ref={gameplayRootRef} name="hole-gameplay-root">
            <SplatCompositedGameplay rootRef={gameplayRootRef} />
            {status === "ready" && (
              <HoleMarkers
                tee={markers.tee}
                cup={markers.cup}
                flightRef={flightRef}
                showTeeMarker={!putt.active}
              />
            )}
            {status === "ready" && putt.active && markers.tee && markers.cup && (
              <PuttMode
                key={putt.session}
                flightRef={flightRef}
                tee={markers.tee}
                cup={markers.cup}
                onHud={onPuttHud}
                onStroke={onStroke}
                onHoled={onHoled}
              />
            )}
          </group>
        </group>
        <RendererDiagnostics snapshot={snapshot} flightRef={flightRef} />
      </Canvas>
    </div>
  );
}

function formatMeters(a: MarkerPoint, b: MarkerPoint) {
  return `${Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z).toFixed(1)} m`;
}

function RoundScoreProgress({
  scorecard,
  currentHole,
}: {
  scorecard: CourseScorecard;
  currentHole: number;
}) {
  const totals = courseScoreTotals(scorecard);

  return (
    <div
      className="round-scorecard"
      aria-label={`Round scorecard, ${describeCourseDiff(totals.diff)} through ${totals.completed} holes`}
    >
      <div className="round-score-total">
        <span>Round total</span>
        <strong data-testid="round-score-total">
          {describeCourseDiff(totals.diff)}
        </strong>
        <small>
          Through {totals.completed} of {HOLES.length} holes
        </small>
      </div>
      <ol className="round-score-progress">
        {HOLES.map((hole, index) => {
          const score = scorecard[index];
          return (
            <li
              key={hole.number}
              className={`${score ? "is-complete" : ""} ${
                currentHole === hole.number ? "is-current" : ""
              }`}
              aria-label={`Hole ${hole.number}: ${score ? `${score.strokes} strokes` : "not played"}`}
            >
              <span>{hole.number}</span>
              <strong>{score?.strokes ?? "—"}</strong>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function FinalScorecard({
  scorecard,
  onPlayAgain,
}: {
  scorecard: CourseScorecard;
  onPlayAgain: () => void;
}) {
  const totals = courseScoreTotals(scorecard);

  return (
    <section
      className="course-scorecard"
      aria-labelledby="course-scorecard-title"
      data-testid="course-scorecard"
    >
      <header>
        <span>18 holes complete</span>
        <h1 id="course-scorecard-title">Your scorecard</h1>
      </header>
      <ol>
        {HOLES.map((hole, index) => {
          const score = scorecard[index];
          return (
            <li key={hole.number}>
              <span>Hole {String(hole.number).padStart(2, "0")}</span>
              <strong>{score?.strokes ?? "—"}</strong>
              <small>Par {hole.par}</small>
            </li>
          );
        })}
      </ol>
      <footer>
        <div>
          <span>Strokes</span>
          <strong>{totals.strokes}</strong>
        </div>
        <div>
          <span>Par</span>
          <strong>{totals.par}</strong>
        </div>
        <div>
          <span>To par</span>
          <strong>{describeCourseDiff(totals.diff)}</strong>
        </div>
        <button type="button" onClick={onPlayAgain}>
          Play 18 again
        </button>
      </footer>
    </section>
  );
}

export function CenteredWorldExperience({
  mode = "game",
}: {
  mode?: ExperienceMode;
}) {
  const isAdmin = mode === "admin";
  const [selectedHole, setSelectedHole] = useState(1);
  const [status, setStatus] = useState<CenterStatus>("loading");
  const [snapshot, setSnapshot] = useState<CenteringSnapshot | null>(null);
  const [placementMode, setPlacementMode] = useState<MarkerKind | null>(null);
  const [roundPhase, setRoundPhase] = useState<RoundPhase>("loading");
  const [scorecard, setScorecard] = useState<CourseScorecard>(() =>
    createCourseScorecard(),
  );
  const [flyoverSession, setFlyoverSession] = useState(0);
  const [puttSession, setPuttSession] = useState(0);
  const [puttHud, setPuttHud] = useState<PuttHud>({
    phase: "aim",
    strokes: 0,
    note: null,
  });
  // Local admin-session overrides. A null draft means "cleared locally"; a
  // missing key defers to the authored static layout bundled for publication.
  const [draft, setDraft] = useState<
    Partial<Record<MarkerKind, MarkerPoint | null>>
  >({});
  // Fallback layout computed from the verified start view, so a hole is
  // puttable before anything has been authored for it.
  const [autoLayout, setAutoLayout] = useState<DefaultHoleLayout | null>(null);
  const startedHoleRef = useRef<number | null>(null);
  const completedHoleRef = useRef<number | null>(null);
  const runtime = useMemo(
    () => getMintWorldRuntime(selectedHole).runtime,
    [selectedHole],
  );
  const currentHole = HOLES[selectedHole - 1];
  const flyoverActive = !isAdmin && roundPhase === "flyover";
  const puttActive =
    !isAdmin &&
    (roundPhase === "putting" || roundPhase === "hole-complete");

  const layout = AUTHORED_HOLE_LAYOUTS[selectedHole];

  // Game audio: one shared manager (window singleton). initialize() is safe
  // before any gesture — the context unlocks on the first pointer/key input.
  useEffect(() => {
    getGameAudio()?.initialize();
  }, []);

  // Decode this hole's completion accent before its first putt can end, and
  // warm the next hole's accent in the background.
  useEffect(() => {
    void getGameAudio()?.loadHoleSounds(
      selectedHole,
      selectedHole === 18 ? 1 : selectedHole + 1,
    );
  }, [selectedHole]);

  const handleStroke = useCallback((power: number) => {
    getGameAudio()?.playPutt(power);
  }, []);

  const handleStatus = useCallback((nextStatus: CenterStatus) => {
    setStatus(nextStatus);
    if (nextStatus === "loading") setSnapshot(null);
  }, []);

  const handleSnapshot = useCallback((nextSnapshot: CenteringSnapshot) => {
    setSnapshot((current) =>
      JSON.stringify(current) === JSON.stringify(nextSnapshot)
        ? current
        : nextSnapshot,
    );
  }, []);

  const selectHole = useCallback((holeNumber: number) => {
    setStatus("loading");
    setSnapshot(null);
    setPlacementMode(null);
    setDraft({});
    setAutoLayout(null);
    setRoundPhase("loading");
    startedHoleRef.current = null;
    completedHoleRef.current = null;
    setSelectedHole(holeNumber);
    // Changing holes cancels any scheduled completion accent; the sink
    // guard re-arms when a putt round actually starts on the new hole.
    getGameAudio()?.cancelScheduledSounds();
  }, []);

  const handleFlyoverComplete = useCallback(() => {
    setPuttSession((session) => session + 1);
    setRoundPhase("putting");
  }, []);

  const handleHoled = useCallback(
    (strokes: number) => {
      if (completedHoleRef.current === selectedHole) return;
      completedHoleRef.current = selectedHole;
      getGameAudio()?.playSinkSequence(selectedHole);
      setScorecard((current) =>
        recordCourseHole(current, selectedHole, strokes),
      );
      setRoundPhase("hole-complete");
    },
    [selectedHole],
  );

  const handlePlace = useCallback(
    (marker: MarkerKind, point: MarkerPoint) => {
      setDraft((current) => ({ ...current, [marker]: point }));
    },
    [],
  );

  const handleClear = useCallback(
    (marker: MarkerKind) => {
      setDraft((current) => ({ ...current, [marker]: null }));
    },
    [],
  );

  useEffect(() => {
    if (!placementMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Escape") setPlacementMode(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [placementMode]);

  // Authored markers (with local admin-session overrides), before fallback.
  const saved = useMemo(
    () => ({
      tee: draft.tee !== undefined ? draft.tee : (layout?.tee ?? null),
      cup: draft.cup !== undefined ? draft.cup : (layout?.cup ?? null),
    }),
    [draft, layout],
  );
  // Effective markers: authored placements win, auto layout fills the gaps.
  const markers = useMemo(
    () => ({
      tee: saved.tee ?? autoLayout?.tee ?? null,
      cup: saved.cup ?? autoLayout?.cup ?? null,
    }),
    [saved, autoLayout],
  );
  const wantsAutoLayout = saved.tee === null || saved.cup === null;

  // A ready hole owns the screen, plays its flyover once, then hands camera
  // and input directly to putting. There is no intermediary start control.
  useEffect(() => {
    if (
      isAdmin ||
      roundPhase !== "loading" ||
      status !== "ready" ||
      !markers.tee ||
      !markers.cup ||
      startedHoleRef.current === selectedHole
    ) {
      return;
    }

    startedHoleRef.current = selectedHole;
    // This effect advances the explicit loading -> flyover state machine once
    // the external scene loader reports the authored hole as ready.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPuttHud({ phase: "aim", strokes: 0, note: null });
    setFlyoverSession((session) => session + 1);
    getGameAudio()?.beginHoleAttempt(selectedHole);
    setRoundPhase("flyover");
  }, [isAdmin, markers.cup, markers.tee, roundPhase, selectedHole, status]);

  // Hold the completed-hole card long enough to read, then load exactly one
  // next hole. Hole 18 resolves to the full scorecard instead of wrapping.
  useEffect(() => {
    if (isAdmin || roundPhase !== "hole-complete") return;
    const nextHole = selectedHole + 1;
    if (nextHole <= HOLES.length) warmMintWorldRuntime(nextHole);

    const timeout = window.setTimeout(() => {
      if (selectedHole === HOLES.length) {
        setRoundPhase("course-complete");
      } else {
        selectHole(nextHole);
      }
    }, HOLE_RESULT_MS);
    return () => window.clearTimeout(timeout);
  }, [isAdmin, roundPhase, selectHole, selectedHole]);

  const playAgain = useCallback(() => {
    setScorecard(createCourseScorecard());
    selectHole(1);
  }, [selectHole]);

  const previousHole = () =>
    selectHole(selectedHole === 1 ? 18 : selectedHole - 1);
  const nextHole = () =>
    selectHole(selectedHole === 18 ? 1 : selectedHole + 1);
  const view = snapshot?.view;
  const coveragePercent = view ? view.coverageRatio * 100 : null;
  const completedScore = scorecard[selectedHole - 1];

  return (
    <main className={`world-shell mode-${mode}`}>
      {isAdmin ? (
        <header className="world-header admin-header">
          <div className="world-brand">
            <div className="world-brand-mark">
              <Flag size={18} />
            </div>
            <div>
              <strong>Course admin</strong>
              <span>Tee, pin &amp; cup setup</span>
            </div>
          </div>
          <div className="world-title">
            <span>Hole {String(selectedHole).padStart(2, "0")}</span>
            <strong>{currentHole.name}</strong>
          </div>
          <div className={`center-status status-${status}`}>
            {status === "ready" ? (
              <Focus size={14} />
            ) : (
              <LoaderCircle size={14} className="status-spinner" />
            )}
            {status === "ready"
              ? "Inside splat"
              : status === "error"
                ? "Center check failed"
                : "Entering splat"}
          </div>
        </header>
      ) : (
        <header className="game-hole-header">
          <span>
            Hole {String(selectedHole).padStart(2, "0")} / {HOLES.length}
          </span>
          <strong>{currentHole.name}</strong>
          <small>{currentHole.displayLocation}</small>
        </header>
      )}

      <section
        className="world-viewport"
        aria-label={`Hole ${selectedHole}: ${currentHole.name}, ${currentHole.displayLocation}`}
      >
        <InsideWorldCanvas
          runtime={runtime}
          snapshot={snapshot}
          status={status}
          placementMode={isAdmin ? placementMode : null}
          markers={markers}
          flyover={{ active: flyoverActive, session: flyoverSession }}
          putt={{ active: puttActive, session: puttSession }}
          wantsAutoLayout={wantsAutoLayout}
          onAutoLayout={setAutoLayout}
          onPuttHud={setPuttHud}
          onStroke={handleStroke}
          onHoled={handleHoled}
          onFlyoverComplete={handleFlyoverComplete}
          onPlace={handlePlace}
          onSnapshot={handleSnapshot}
          onStatus={handleStatus}
        />

        {status !== "ready" && (
          <div className="centering-screen" role="status">
            <LoaderCircle className="centering-spinner" />
            <strong>Loading hole {String(selectedHole).padStart(2, "0")}</strong>
          </div>
        )}

        {isAdmin && (
          <>
            <aside
              className="alignment-readout"
              aria-label="Live center view readout"
            >
              <span>Center view check</span>
              <strong>
                {status === "ready" ? "Inside the splat" : "Measuring"}
              </strong>
              <dl>
                <div>
                  <dt>Coverage</dt>
                  <dd>
                    {coveragePercent != null
                      ? `${coveragePercent.toFixed(1)}%`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Splats</dt>
                  <dd>
                    {snapshot ? snapshot.residentSplats.toLocaleString() : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Span</dt>
                  <dd>
                    {snapshot ? `${snapshot.spanMeters.toFixed(0)} m` : "—"}
                  </dd>
                </div>
              </dl>
              <p>Drag to look. Fly with WASD and Q/E. Scroll to zoom.</p>
            </aside>

            <aside className="layout-editor" aria-label="Hole layout editor">
              <span>Hole layout</span>
              <div className="editor-buttons">
                <button
                  type="button"
                  className={placementMode === "tee" ? "armed" : ""}
                  aria-pressed={placementMode === "tee"}
                  disabled={status !== "ready"}
                  onClick={() =>
                    setPlacementMode((current) =>
                      current === "tee" ? null : "tee",
                    )
                  }
                >
                  <Target size={13} />
                  Place tee
                </button>
                <button
                  type="button"
                  className={placementMode === "cup" ? "armed" : ""}
                  aria-pressed={placementMode === "cup"}
                  disabled={status !== "ready"}
                  onClick={() =>
                    setPlacementMode((current) =>
                      current === "cup" ? null : "cup",
                    )
                  }
                >
                  <Flag size={13} />
                  Place cup
                </button>
              </div>
              <dl>
                <div>
                  <dt>Tee</dt>
                  <dd data-testid="tee-state">
                    {saved.tee ? "Saved" : markers.tee ? "Auto" : "Not placed"}
                    {saved.tee && (
                      <button
                        type="button"
                        className="editor-clear"
                        aria-label="Clear tee"
                        onClick={() => handleClear("tee")}
                      >
                        <X size={11} />
                      </button>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Cup</dt>
                  <dd data-testid="cup-state">
                    {saved.cup ? "Saved" : markers.cup ? "Auto" : "Not placed"}
                    {saved.cup && (
                      <button
                        type="button"
                        className="editor-clear"
                        aria-label="Clear cup"
                        onClick={() => handleClear("cup")}
                      >
                        <X size={11} />
                      </button>
                    )}
                  </dd>
                </div>
                {markers.tee && markers.cup && (
                  <div>
                    <dt>Tee to cup</dt>
                    <dd>{formatMeters(markers.tee, markers.cup)}</dd>
                  </div>
                )}
              </dl>
              <p>
                {placementMode
                  ? `Click the ground to place the ${placementMode}. Esc to finish.`
                  : "Choose a marker, then place it directly in the splat."}
              </p>
            </aside>

            <div className="world-navigation">
              <button
                type="button"
                onClick={previousHole}
                aria-label="Previous hole"
              >
                <ChevronLeft size={18} />
              </button>
              <nav aria-label="Select a hole">
                {HOLE_NUMBERS.map((holeNumber) => (
                  <button
                    key={holeNumber}
                    type="button"
                    aria-label={`Select hole ${holeNumber}`}
                    aria-current={
                      selectedHole === holeNumber ? "page" : undefined
                    }
                    className={selectedHole === holeNumber ? "active" : ""}
                    onFocus={() => warmMintWorldRuntime(holeNumber)}
                    onPointerEnter={() => warmMintWorldRuntime(holeNumber)}
                    onClick={() => selectHole(holeNumber)}
                  >
                    {String(holeNumber).padStart(2, "0")}
                  </button>
                ))}
              </nav>
              <button type="button" onClick={nextHole} aria-label="Next hole">
                <ChevronRight size={18} />
              </button>
            </div>
          </>
        )}

        {!isAdmin && roundPhase === "flyover" && (
          <div className="flyover-status" role="status">
            <span>Hole flyover</span>
            <strong>Reading the green</strong>
          </div>
        )}

        {!isAdmin && roundPhase === "putting" && (
          <aside className="putt-hud" aria-label="Putting">
            <span>Putting</span>
            <dl>
              <div>
                <dt>Strokes</dt>
                <dd data-testid="putt-strokes">{puttHud.strokes}</dd>
              </div>
              <div>
                <dt>Par</dt>
                <dd>{currentHole.par}</dd>
              </div>
              <div>
                <dt>To cup</dt>
                <dd>
                  <span id="putt-distance">—</span>
                </dd>
              </div>
            </dl>
            <div
              className={`putt-power ${puttHud.phase === "charging" ? "charging" : ""}`}
              aria-hidden
            >
              <div id="putt-power-fill" />
            </div>
            <p data-testid="putt-phase">
              {puttHud.phase === "rolling"
                  ? "Rolling…"
                  : puttHud.phase === "charging"
                    ? "Release Space to putt."
                    : (puttHud.note ??
                      "Drag to aim · Hold Space or press and hold to putt")}
            </p>
          </aside>
        )}

        {!isAdmin && roundPhase === "hole-complete" && completedScore && (
          <div
            className={`score-card hole-result-card score-${completedScore.tone}`}
            role="status"
            aria-live="polite"
            data-testid="score-card"
          >
            <span className="score-eyebrow">
              Hole {String(selectedHole).padStart(2, "0")} · Par{" "}
              {completedScore.par}
            </span>
            <strong className="score-label">{completedScore.label}</strong>
            <span className="score-detail" data-testid="score-detail">
              {completedScore.strokes}{" "}
              {completedScore.strokes === 1 ? "stroke" : "strokes"} ·{" "}
              {completedScore.relative}
            </span>
            <RoundScoreProgress
              scorecard={scorecard}
              currentHole={selectedHole}
            />
          </div>
        )}

        {!isAdmin && roundPhase === "course-complete" && (
          <div className="course-scorecard-backdrop">
            <FinalScorecard scorecard={scorecard} onPlayAgain={playAgain} />
          </div>
        )}
      </section>
    </main>
  );
}
