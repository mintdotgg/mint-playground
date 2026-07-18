import { Vector3 } from "three";

import { groundLevelBelow, type WorldCollider } from "./world-collider";

export type LayoutPoint = { x: number; y: number; z: number };
export type DefaultHoleLayout = { tee: LayoutPoint; cup: LayoutPoint };

// Distances (m) ahead of the start camera to try for each marker. The cup
// prefers a real putt length and walks closer only when the terrain ahead
// is unusable; the tee sits just in front of the player.
const TEE_DISTANCES = [2.2, 1.6, 1.0, 0.5];
const CUP_DISTANCES = [9, 7.5, 6, 5, 4, 3];
// If the straight line ahead has no usable ground, fan left/right.
const CUP_FAN_RADIANS = [0, -0.5, 0.5, -1, 1];
// Probe for ground from this high above the camera eye, and accept ground
// only within this vertical window of the eye, so markers don't land on
// canopies above or at the bottom of chasms.
const PROBE_RISE = 2.5;
const MAX_DROP = 8;
const MAX_RISE = 2;
// The cup must be a real putt away from the tee.
const MIN_HOLE_LENGTH = 2.5;

function groundAt(
  collider: WorldCollider,
  eye: Vector3,
  spot: Vector3,
): LayoutPoint | null {
  const probe = new Vector3(spot.x, eye.y + PROBE_RISE, spot.z);
  const ground = groundLevelBelow(probe, collider);
  if (ground === null) return null;
  if (ground < eye.y - MAX_DROP || ground > eye.y + MAX_RISE) return null;
  return { x: spot.x, y: ground, z: spot.z };
}

/**
 * A playable tee and cup for a hole with no authored layout: the tee on the
 * ground just ahead of the start camera, the cup further down the same line
 * (fanning sideways when the line ahead runs off the mesh). Returns null
 * only when the start area has no usable ground at all.
 */
export function defaultHoleLayout(
  collider: WorldCollider,
  eye: Vector3,
  forward: Vector3,
): DefaultHoleLayout | null {
  const line = new Vector3(forward.x, 0, forward.z);
  if (line.lengthSq() < 1e-6) line.set(0, 0, -1);
  line.normalize();

  let tee: LayoutPoint | null = null;
  for (const distance of TEE_DISTANCES) {
    tee = groundAt(collider, eye, eye.clone().addScaledVector(line, distance));
    if (tee) break;
  }
  if (!tee) return null;

  for (const angle of CUP_FAN_RADIANS) {
    const direction = line.clone().applyAxisAngle(new Vector3(0, 1, 0), angle);
    for (const distance of CUP_DISTANCES) {
      const cup = groundAt(
        collider,
        eye,
        eye.clone().addScaledVector(direction, distance),
      );
      if (!cup) continue;
      if (Math.hypot(cup.x - tee.x, cup.z - tee.z) < MIN_HOLE_LENGTH) continue;
      return { tee, cup };
    }
  }
  return null;
}
