import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Matrix4,
  Ray,
  Vector3,
  type Mesh,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshBVH } from "three-mesh-bvh";

import { MINT_SOURCE_TO_HOLE } from "./hole-coordinate-system";

// Minimum gap kept between the camera and any collider surface, in meters.
// Splat surfaces render as a fuzzy volume around the mesh, so this stays
// large enough that the camera never sits inside the fuzz.
export const COLLIDER_CLEARANCE = 1.75;

export type WorldCollider = {
  /** Stable diagnostic label for surface-hit reports. */
  name: string;
  bvh: MeshBVH;
  /** Triangle soup owned by this collider and indexed by `bvh`. */
  geometry: BufferGeometry;
  bounds: Box3;
  triangles: number;
  dispose: () => void;
};

export function buildWorldCollider(
  geometries: readonly BufferGeometry[],
  name = "world-collider",
): WorldCollider {
  let vertexCount = 0;
  for (const geometry of geometries) {
    vertexCount += geometry.getAttribute("position").count;
  }
  const positions = new Float32Array(vertexCount * 3);
  let offset = 0;
  for (const geometry of geometries) {
    const position = geometry.getAttribute("position");
    for (let index = 0; index < position.count; index += 1) {
      positions[offset] = position.getX(index);
      positions[offset + 1] = position.getY(index);
      positions[offset + 2] = position.getZ(index);
      offset += 3;
    }
  }

  const merged = new BufferGeometry();
  merged.setAttribute("position", new BufferAttribute(positions, 3));
  const bvh = new MeshBVH(merged);
  merged.computeBoundingBox();

  return {
    name,
    bvh,
    geometry: merged,
    bounds: (merged.boundingBox as Box3).clone(),
    triangles: vertexCount / 3,
    dispose: () => merged.dispose(),
  };
}

export async function loadWorldCollider(
  url: string,
  sourceToHole: Matrix4 = MINT_SOURCE_TO_HOLE,
): Promise<WorldCollider> {
  const gltf = await new GLTFLoader().loadAsync(url);
  gltf.scene.updateMatrixWorld(true);

  const geometries: BufferGeometry[] = [];
  gltf.scene.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    // Expand to triangle soup so every 3 consecutive vertices form one
    // triangle regardless of indexing or interleaving in the source file.
    const geometry = mesh.geometry.index
      ? mesh.geometry.toNonIndexed()
      : mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    // Normalize source coordinates exactly once at import. The splat uses
    // this same matrix through its source root; gameplay never flips again.
    geometry.applyMatrix4(sourceToHole);
    geometries.push(geometry);
  });
  if (geometries.length === 0) {
    throw new Error(`World collider has no mesh geometry: ${url}`);
  }

  const collider = buildWorldCollider(geometries, "world-collider");
  for (const geometry of geometries) geometry.dispose();
  return collider;
}

const scratchRay = new Ray();
const scratchNormal = new Vector3();

/** Y of the nearest world surface directly beneath `position`, if any. */
export function groundLevelBelow(
  position: Vector3,
  collider: WorldCollider,
): number | null {
  scratchRay.origin.copy(position);
  scratchRay.direction.set(0, -1, 0);
  const hit = collider.bvh.raycastFirst(scratchRay, DoubleSide);
  return hit ? position.y - hit.distance : null;
}

export type WorldPick = { point: Vector3; distance: number };

/** Nearest world surface along a ray, e.g. from a click through the camera. */
export function pickWorldPoint(
  collider: WorldCollider,
  origin: Vector3,
  direction: Vector3,
): WorldPick | null {
  scratchRay.origin.copy(origin);
  scratchRay.direction.copy(direction).normalize();
  const hit = collider.bvh.raycastFirst(scratchRay, DoubleSide);
  if (!hit) return null;
  return { point: hit.point.clone(), distance: hit.distance };
}

/**
 * Advance `position` by `move` while keeping it inside the world.
 *
 * Containment layers, stacked:
 * 1. collision — motion stops at and slides along mesh surfaces, so terrain,
 *    trees, and walls cannot be passed through;
 * 2. the roam sphere around the start point (the origin), which caps travel
 *    through open sky and toward the world's rim, where splat capture fades
 *    out and there are no surfaces to collide with;
 * 3. a descent ratchet — over unmeshed gaps inside the world (water,
 *    chasms) the camera may cruise across but not descend, so it can never
 *    sink through a gap into the void beneath the world.
 */
export function flyWithinWorld(
  position: Vector3,
  move: Vector3,
  collider: WorldCollider,
  roamRadius: number | null = null,
): void {
  const previousY = position.y;

  slideAlongCollider(position, move, collider);
  if (roamRadius !== null && position.length() > roamRadius) {
    position.multiplyScalar(roamRadius / position.length());
  }

  if (
    position.y < previousY &&
    groundLevelBelow(position, collider) === null
  ) {
    position.setY(previousY);
  }
}

/**
 * Advance `position` by `move`, colliding against the world mesh. Movement
 * stops `clearance` short of any surface and the leftover motion slides
 * along it, so the camera can skim terrain and walls but never pass through
 * them into the void outside the splat.
 */
export function slideAlongCollider(
  position: Vector3,
  move: Vector3,
  collider: WorldCollider,
  clearance = COLLIDER_CLEARANCE,
): void {
  const remaining = move.clone();
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const distance = remaining.length();
    if (distance < 1e-6) return;

    scratchRay.origin.copy(position);
    scratchRay.direction.copy(remaining).divideScalar(distance);
    const hit = collider.bvh.raycastFirst(
      scratchRay,
      DoubleSide,
      0,
      distance + clearance,
    );
    if (!hit) {
      position.add(remaining);
      return;
    }

    const allowed = Math.max(0, hit.distance - clearance);
    position.addScaledVector(scratchRay.direction, allowed);

    const normal = hit.face?.normal;
    if (!normal) return;
    scratchNormal.copy(normal);
    if (scratchNormal.dot(scratchRay.direction) > 0) scratchNormal.negate();

    // Slide: keep the leftover motion, minus its push into the surface.
    remaining.copy(scratchRay.direction).multiplyScalar(distance - allowed);
    remaining.addScaledVector(scratchNormal, -remaining.dot(scratchNormal));
  }
}
