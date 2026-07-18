import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Matrix4,
  Ray,
  Vector3,
} from "three";

import { buildWorldCollider, type WorldCollider } from "./world-collider";

export type SurfaceRegion = "tee" | "fairway" | "cup" | "green";

/** A transform-normalized hit on the authoritative playable surface. */
export type SurfaceHit = {
  point: Vector3;
  normal: Vector3;
  distance: number;
  collider: WorldCollider;
  triangleIndex?: number;
  /** True for a triangle synthesized while repairing an enclosed mesh gap. */
  repaired: boolean;
};

// Backward-compatible name used by the physics helpers.
export type SurfaceSample = SurfaceHit;

export type SurfaceQueryOptions = {
  /** How far above the seed to start the downward cast. */
  rise?: number;
  /** Highest accepted surface relative to the expected height. */
  maxAbove?: number;
  /** Lowest accepted surface relative to the expected height. */
  maxBelow?: number;
  /** Continuity hint used to reject canopies and lower shell layers. */
  previousSurfaceHeight?: number;
  expectedRegion?: SurfaceRegion;
};

export type PlayableProxyStats = {
  directVertices: number;
  repairedVertices: number;
  triangles: number;
  totalVertices: number;
  /** Median (visualY - colliderY) baked into the proxy, if measured. */
  visualBiasMeters: number | null;
  visualSamples: number;
};

/**
 * Optional one-time probe of the visible putting surface (e.g. a Gaussian
 * splat raycast). Used only while rebuilding the proxy so physics never
 * depends on live splat queries. Return null to keep the collider height.
 */
export type VisualHeightProbe = (
  x: number,
  z: number,
  colliderY: number,
) => number | null;

export type RebuildProxyOptions = {
  visualHeightAt?: VisualHeightProbe;
};

const SAMPLE_RISE = 2.5;
const SAMPLE_MAX_ABOVE = 0.55;
const SAMPLE_MAX_BELOW = 2.5;
const MIN_UP_DOT = 0.3;
const ANCHOR_MIN_UP_DOT = 0.55;

// Dense corridor over the tee→cup lane. Small enough to keep ramps, large
// enough that enclosed reconstruction gaps near the cup stay filled.
const PROXY_MARGIN = 1.35;
const PROXY_CELL = 0.1;
const PROXY_HEIGHT_BAND = 1.35;
const PROXY_REPAIR_PASSES = 6;
const PROXY_REPAIR_NEIGHBORS = 3;
const PROXY_MAX_NEIGHBOR_SPREAD = 0.4;
// Extra pad around the cup closes fall-through holes beside the pin.
const CUP_PAD_RADIUS = 0.95;
const CUP_PAD_CELL = 0.07;
// Accept splat visual heights only when they stay near the collider sample.
const VISUAL_BIAS_MIN = -0.2;
const VISUAL_BIAS_MAX = 0.55;
const VISUAL_OUTLIER_MAD = 0.1;
// The visual probe establishes one rigid vertical registration, not a
// splat-shaped floor. Sparse samples are enough for a robust median and avoid
// thousands of expensive Gaussian raycasts during hole load.
const VISUAL_PROBE_STRIDE = 4;

const scratchRay = new Ray();
const scratchDelta = new Vector3();
const scratchNormal = new Vector3();
const triangleEdgeA = new Vector3();
const triangleEdgeB = new Vector3();
const scratchLocal = new Vector3();

function expectedHeight(position: Vector3, up: Vector3) {
  return position.dot(up);
}

function surfaceHitOn(
  collider: WorldCollider,
  position: Vector3,
  up: Vector3,
  options: SurfaceQueryOptions = {},
): SurfaceHit | null {
  const rise = options.rise ?? SAMPLE_RISE;
  const maxAbove = options.maxAbove ?? SAMPLE_MAX_ABOVE;
  const maxBelow = options.maxBelow ?? SAMPLE_MAX_BELOW;
  const expected =
    options.previousSurfaceHeight ?? expectedHeight(position, up);
  const minUpDot =
    options.expectedRegion === "tee" ||
    options.expectedRegion === "cup" ||
    options.expectedRegion === "green"
      ? 0.5
      : options.expectedRegion === "fairway"
        ? 0.35
        : MIN_UP_DOT;

  scratchRay.origin.copy(position).addScaledVector(up, rise);
  scratchRay.direction.copy(up).negate();
  const hits = collider.bvh.raycast(scratchRay, DoubleSide);
  if (hits.length === 0) return null;

  let best: (typeof hits)[number] | null = null;
  let bestNormal: Vector3 | null = null;
  let bestScore = Infinity;

  for (const hit of hits) {
    const normal = (hit.face?.normal ?? up).clone();
    if (normal.dot(up) < 0) normal.negate();
    const upDot = normal.dot(up);
    if (upDot < minUpDot) continue;

    const height = hit.point.dot(up);
    const delta = height - expected;
    if (delta > maxAbove || delta < -maxBelow) continue;

    // Continuity is the primary selector. A small slope penalty breaks ties
    // in favor of a putting surface rather than a similarly high rock face.
    const slopePenalty = (1 - upDot) * 0.03;
    const score = Math.abs(delta) + slopePenalty;
    if (score < bestScore) {
      best = hit;
      bestNormal = normal;
      bestScore = score;
    }
  }
  if (!best || !bestNormal) return null;

  return {
    point: best.point.clone(),
    normal: bestNormal,
    distance: best.distance,
    collider,
    triangleIndex: best.faceIndex ?? undefined,
    repaired: collider.name === "playable-surface-proxy",
  };
}

function addUpwardTriangle(
  positions: number[],
  a: Vector3,
  b: Vector3,
  c: Vector3,
  up: Vector3,
) {
  triangleEdgeA.copy(b).sub(a);
  triangleEdgeB.copy(c).sub(a);
  scratchNormal.crossVectors(triangleEdgeA, triangleEdgeB);
  if (scratchNormal.dot(up) >= 0) {
    positions.push(...a.toArray(), ...b.toArray(), ...c.toArray());
  } else {
    positions.push(...a.toArray(), ...c.toArray(), ...b.toArray());
  }
}

function setHeightAlongUp(point: Vector3, height: number, up: Vector3) {
  if (Math.abs(up.y) > 0.999) {
    point.y = height / up.y;
    return;
  }
  point.addScaledVector(up, height - point.dot(up));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/**
 * Maps the Mint source root's local +Y (file down) through the root's world
 * matrix to the course's world-space up direction.
 */
export function courseUpFromRoot(root: Group): Vector3 {
  root.updateWorldMatrix(true, false);
  const up = new Vector3(0, -1, 0);
  up.transformDirection(root.matrixWorld);
  return up.normalize();
}

/**
 * Registered putting-surface proxy shared by placement and ball physics.
 *
 * The source world collider supplies topology. `rebuildProxy` samples that
 * mesh over the tee/cup lane, optionally lifts vertices to a one-time visual
 * height probe (splat registration), and closes only small enclosed holes.
 * Gaussian opacity and bounds never participate in live collision queries.
 */
export class PuttingSurface {
  readonly sourceCollider: WorldCollider;
  readonly up: Vector3;
  private proxy: WorldCollider | null = null;
  private repairedTriangles = new Set<number>();
  private stats: PlayableProxyStats | null = null;

  constructor(
    sourceCollider: WorldCollider,
    up: Vector3 = new Vector3(0, 1, 0),
  ) {
    this.sourceCollider = sourceCollider;
    this.up = up.clone().normalize();
  }

  get collider(): WorldCollider {
    return this.proxy ?? this.sourceCollider;
  }

  get proxyCollider(): WorldCollider | null {
    return this.proxy;
  }

  get proxyStats(): PlayableProxyStats | null {
    return this.stats;
  }

  get isReady(): boolean {
    return this.proxy !== null;
  }

  /**
   * Query the playable proxy using height continuity, then fall back to the
   * registered source collider outside the proxy. Both are in normalized hole
   * coordinates; callers must update world matrices before invoking this.
   */
  sample(
    position: Vector3,
    options: SurfaceQueryOptions = {},
  ): SurfaceHit | null {
    if (this.proxy) {
      const proxyHit = surfaceHitOn(this.proxy, position, this.up, options);
      if (proxyHit) {
        proxyHit.repaired =
          proxyHit.triangleIndex !== undefined &&
          this.repairedTriangles.has(proxyHit.triangleIndex);
        return proxyHit;
      }
    }
    return surfaceHitOn(this.sourceCollider, position, this.up, options);
  }

  /**
   * Nearest swept collision from both the repaired playable proxy and the raw
   * registered world mesh. The proxy closes floor gaps and carries visual
   * registration; the source preserves walls, curbs, rocks, and steep faces.
   */
  raycastMotion(ray: Ray, far: number) {
    const sourceHit = this.sourceCollider.bvh.raycastFirst(
      ray,
      DoubleSide,
      0,
      far,
    );
    const proxyHit = this.proxy?.bvh.raycastFirst(ray, DoubleSide, 0, far);
    if (!sourceHit) return proxyHit ?? null;
    if (!proxyHit) return sourceHit;

    const sourceNormal = sourceHit.face?.normal;
    const proxyNormal = proxyHit.face?.normal;
    const sourceIsFloor =
      sourceNormal !== undefined && Math.abs(sourceNormal.dot(this.up)) >= 0.55;
    const proxyIsFloor =
      proxyNormal !== undefined && Math.abs(proxyNormal.dot(this.up)) >= 0.55;

    // Prefer the visually registered floor when both hits are floor-like and
    // nearly coplanar; otherwise keep the nearer blocking surface (walls).
    if (
      sourceIsFloor &&
      proxyIsFloor &&
      Math.abs(proxyHit.distance - sourceHit.distance) < 0.35
    ) {
      return proxyHit;
    }
    return proxyHit.distance < sourceHit.distance ? proxyHit : sourceHit;
  }

  /**
   * Rebuild the hole-local proxy whenever the layout or visual registration
   * changes. Topology comes from the registered source mesh; optional visual
   * probes bake a splat-aligned height so contact matches the visible green
   * without using Gaussians as the live physics floor.
   */
  rebuildProxy(
    tee: { x: number; y: number; z: number },
    cup: { x: number; y: number; z: number },
    options: RebuildProxyOptions = {},
  ): PlayableProxyStats | null {
    const dx = cup.x - tee.x;
    const dz = cup.z - tee.z;
    const length = Math.hypot(dx, dz);
    const ux = length > 1e-6 ? dx / length : 0;
    const uz = length > 1e-6 ? dz / length : -1;
    const px = -uz;
    const pz = ux;
    const alongCells = Math.max(
      1,
      Math.ceil((length + PROXY_MARGIN * 2) / PROXY_CELL),
    );
    const acrossCells = Math.max(
      1,
      Math.ceil((PROXY_MARGIN * 2) / PROXY_CELL),
    );
    const alongStep = (length + PROXY_MARGIN * 2) / alongCells;
    const acrossStep = (PROXY_MARGIN * 2) / acrossCells;
    const nodes: (ProxyNode | null)[][] = [];
    const probe = new Vector3();
    const visualBiases: number[] = [];
    let directVertices = 0;

    const sampleCollider = (
      x: number,
      z: number,
      expectedY: number,
    ): SurfaceHit | null => {
      probe.set(x, expectedY, z);
      const hit = surfaceHitOn(this.sourceCollider, probe, this.up, {
        rise: 3.5,
        maxAbove: PROXY_HEIGHT_BAND,
        maxBelow: PROXY_HEIGHT_BAND,
        previousSurfaceHeight: expectedY,
        expectedRegion: "fairway",
      });
      if (!hit || hit.normal.dot(this.up) < ANCHOR_MIN_UP_DOT) return null;
      return hit;
    };

    // Pass 1: gather collider samples and optional visual (splat) heights.
    type Seed = { x: number; z: number; expectedY: number; hit: SurfaceHit };
    const corridorSeeds: Array<Seed | null> = [];
    for (let i = 0; i <= alongCells; i += 1) {
      const along = i * alongStep - PROXY_MARGIN;
      const t = length > 1e-6 ? Math.min(1, Math.max(0, along / length)) : 0;
      const expectedY = tee.y + (cup.y - tee.y) * t;
      for (let j = 0; j <= acrossCells; j += 1) {
        const across = j * acrossStep - PROXY_MARGIN;
        const x = tee.x + ux * along + px * across;
        const z = tee.z + uz * along + pz * across;
        const hit = sampleCollider(x, z, expectedY);
        if (!hit) {
          corridorSeeds.push(null);
          continue;
        }
        directVertices += 1;
        const visualY =
          i % VISUAL_PROBE_STRIDE === 0 &&
          j % VISUAL_PROBE_STRIDE === 0
            ? options.visualHeightAt?.(
                hit.point.x,
                hit.point.z,
                hit.point.y,
              )
            : undefined;
        if (visualY !== null && visualY !== undefined) {
          const bias = visualY - hit.point.y;
          if (bias >= VISUAL_BIAS_MIN && bias <= VISUAL_BIAS_MAX) {
            visualBiases.push(bias);
          }
        }
        corridorSeeds.push({ x, z, expectedY, hit });
      }
    }

    const cupPadCells = Math.max(
      1,
      Math.ceil((CUP_PAD_RADIUS * 2) / CUP_PAD_CELL),
    );
    const cupSeeds: Array<Seed | null> = [];
    for (let i = 0; i <= cupPadCells; i += 1) {
      const x = cup.x - CUP_PAD_RADIUS + (i / cupPadCells) * CUP_PAD_RADIUS * 2;
      for (let j = 0; j <= cupPadCells; j += 1) {
        const z =
          cup.z - CUP_PAD_RADIUS + (j / cupPadCells) * CUP_PAD_RADIUS * 2;
        if (Math.hypot(x - cup.x, z - cup.z) > CUP_PAD_RADIUS) {
          cupSeeds.push(null);
          continue;
        }
        const hit = sampleCollider(x, z, cup.y);
        if (!hit) {
          cupSeeds.push(null);
          continue;
        }
        directVertices += 1;
        const visualY =
          i % VISUAL_PROBE_STRIDE === 0 &&
          j % VISUAL_PROBE_STRIDE === 0
            ? options.visualHeightAt?.(
                hit.point.x,
                hit.point.z,
                hit.point.y,
              )
            : undefined;
        if (visualY !== null && visualY !== undefined) {
          const bias = visualY - hit.point.y;
          if (bias >= VISUAL_BIAS_MIN && bias <= VISUAL_BIAS_MAX) {
            visualBiases.push(bias);
          }
        }
        cupSeeds.push({ x, z, expectedY: cup.y, hit });
      }
    }

    // One stable bias for the hole's playable surface: median of inlier
    // visual-vs-collider samples. Applied uniformly so the proxy, ball, tee,
    // cup, and flag share a single vertical registration to the visible green.
    const biasMedian = median(visualBiases);
    const filtered =
      biasMedian === null
        ? []
        : visualBiases.filter(
            (bias) => Math.abs(bias - biasMedian) <= VISUAL_OUTLIER_MAD,
          );
    const stableBias =
      filtered.length >= 4 ? (median(filtered) ?? 0) : 0;
    const visualSamples = filtered.length;
    const appliedVisualBias =
      Math.abs(stableBias) > 0.004 ? stableBias : 0;

    const toNode = (seed: Seed | null): ProxyNode | null => {
      if (!seed) return null;
      const point = seed.hit.point.clone();
      if (appliedVisualBias !== 0) {
        setHeightAlongUp(
          point,
          seed.hit.point.y + appliedVisualBias,
          this.up,
        );
      }
      return { point, repaired: false };
    };

    for (let i = 0; i <= alongCells; i += 1) {
      const row: (ProxyNode | null)[] = [];
      for (let j = 0; j <= acrossCells; j += 1) {
        row.push(toNode(corridorSeeds[i * (acrossCells + 1) + j] ?? null));
      }
      nodes.push(row);
    }

    const cupPad: (ProxyNode | null)[][] = [];
    for (let i = 0; i <= cupPadCells; i += 1) {
      const row: (ProxyNode | null)[] = [];
      for (let j = 0; j <= cupPadCells; j += 1) {
        row.push(toNode(cupSeeds[i * (cupPadCells + 1) + j] ?? null));
      }
      cupPad.push(row);
    }

    let repairedVertices = 0;
    const neighborOffsets = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ] as const;

    const repairGrid = (
      grid: (ProxyNode | null)[][],
      alongCellsCount: number,
      acrossCellsCount: number,
      project: (i: number, j: number, height: number) => Vector3,
    ) => {
      for (let pass = 0; pass < PROXY_REPAIR_PASSES; pass += 1) {
        const repairs: Array<{ i: number; j: number; point: Vector3 }> = [];
        for (let i = 1; i < alongCellsCount; i += 1) {
          for (let j = 1; j < acrossCellsCount; j += 1) {
            if (grid[i]![j]) continue;
            const neighbors = neighborOffsets
              .map(([di, dj]) => grid[i + di]?.[j + dj] ?? null)
              .filter((node): node is ProxyNode => node !== null);
            if (neighbors.length < PROXY_REPAIR_NEIGHBORS) continue;
            const heights = neighbors.map((node) => node.point.dot(this.up));
            const spread = Math.max(...heights) - Math.min(...heights);
            if (spread > PROXY_MAX_NEIGHBOR_SPREAD) continue;
            const height =
              heights.reduce((sum, value) => sum + value, 0) / heights.length;
            repairs.push({ i, j, point: project(i, j, height) });
          }
        }
        if (repairs.length === 0) break;
        for (const repair of repairs) {
          grid[repair.i]![repair.j] = {
            point: repair.point,
            repaired: true,
          };
          repairedVertices += 1;
        }
      }
    };

    repairGrid(nodes, alongCells, acrossCells, (i, j, height) => {
      const along = i * alongStep - PROXY_MARGIN;
      const across = j * acrossStep - PROXY_MARGIN;
      const point = new Vector3(
        tee.x + ux * along + px * across,
        0,
        tee.z + uz * along + pz * across,
      );
      setHeightAlongUp(point, height, this.up);
      return point;
    });
    repairGrid(cupPad, cupPadCells, cupPadCells, (i, j, height) => {
      const point = new Vector3(
        cup.x - CUP_PAD_RADIUS + (i / cupPadCells) * CUP_PAD_RADIUS * 2,
        0,
        cup.z - CUP_PAD_RADIUS + (j / cupPadCells) * CUP_PAD_RADIUS * 2,
      );
      setHeightAlongUp(point, height, this.up);
      return point;
    });

    const positions: number[] = [];
    const repairedTriangleIndices = new Set<number>();
    const pushTriangle = (a: ProxyNode, b: ProxyNode, c: ProxyNode) => {
      const triangleIndex = positions.length / 9;
      addUpwardTriangle(positions, a.point, b.point, c.point, this.up);
      if (a.repaired || b.repaired || c.repaired) {
        repairedTriangleIndices.add(triangleIndex);
      }
    };
    const triangulate = (
      grid: (ProxyNode | null)[][],
      alongCellsCount: number,
      acrossCellsCount: number,
    ) => {
      for (let i = 0; i < alongCellsCount; i += 1) {
        for (let j = 0; j < acrossCellsCount; j += 1) {
          const a = grid[i]![j];
          const b = grid[i + 1]![j];
          const c = grid[i + 1]![j + 1];
          const d = grid[i]![j + 1];
          if (!a || !b || !c || !d) continue;
          pushTriangle(a, c, b);
          pushTriangle(a, d, c);
        }
      }
    };
    triangulate(nodes, alongCells, acrossCells);
    triangulate(cupPad, cupPadCells, cupPadCells);
    if (positions.length === 0) return null;

    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(positions), 3),
    );
    geometry.computeVertexNormals();
    const nextProxy = buildWorldCollider(
      [geometry],
      "playable-surface-proxy",
    );
    geometry.dispose();

    this.proxy?.dispose();
    this.proxy = nextProxy;
    this.repairedTriangles = repairedTriangleIndices;
    this.stats = {
      directVertices,
      repairedVertices,
      triangles: positions.length / 9,
      totalVertices:
        (alongCells + 1) * (acrossCells + 1) +
        (cupPadCells + 1) * (cupPadCells + 1),
      visualBiasMeters:
        appliedVisualBias === 0 ? null : appliedVisualBias,
      visualSamples,
    };
    return this.stats;
  }

  dispose() {
    this.proxy?.dispose();
    this.proxy = null;
    this.repairedTriangles.clear();
    this.stats = null;
  }
}

type ProxyNode = {
  point: Vector3;
  repaired: boolean;
};

/**
 * One reusable surface query for placement, ball spawn, and diagnostics.
 * World matrices for hole roots must already be up to date.
 */
export function samplePlayableSurface(
  surface: PuttingSurface,
  seedWorldPosition: Vector3,
  options: SurfaceQueryOptions = {},
): SurfaceHit | null {
  return surface.sample(seedWorldPosition, options);
}

/**
 * Center position for a sphere resting tangent on a sampled surface.
 */
export function ballCenterOn(
  sample: SurfaceSample,
  radius: number,
  contactSkin: number,
): Vector3 {
  return sample.point
    .clone()
    .addScaledVector(sample.normal, radius + contactSkin);
}

/** Signed normal distance from a point to a sampled surface. */
export function signedDistanceToSurface(
  point: Vector3,
  hit: SurfaceHit,
): number {
  return scratchDelta.copy(point).sub(hit.point).dot(hit.normal);
}

/**
 * Convert a world-space point into the local space of `root` after updating
 * that root's world matrix. Placement and markers under `holeRoot` need this
 * when a non-identity registration is applied.
 */
export function worldToHoleLocal(
  root: Group | null,
  worldPoint: Vector3,
  target: Vector3 = scratchLocal,
): Vector3 {
  if (!root) return target.copy(worldPoint);
  root.updateWorldMatrix(true, false);
  return target.copy(worldPoint).applyMatrix4(
    new Matrix4().copy(root.matrixWorld).invert(),
  );
}
