import { Ray, Vector3 } from "three";

import {
  ballCenterOn,
  type PuttingSurface,
  type SurfaceSample,
} from "./putting-surface";

// Mini-golf ball physics on the putting surface. The ball is a sphere that
// rolls along surfaces, accelerates down slopes, bounces off steep faces,
// and settles when slow. Sweeps and resting contact resolve against the same
// registered playable proxy (plus source walls), with fixed substeps so the
// ball cannot tunnel through a repaired floor gap. All units are meters and
// seconds in normalized hole space.

// Regulation golf ball scale (42.7 mm diameter).
export const BALL_RADIUS = 0.021;
// Gap kept between ball surface and ground so the rendered sphere neither
// z-fights nor numerically penetrates the surface (1–3 mm range).
export const CONTACT_SKIN = 0.002;
// Speed handed to a stroke at zero and full charge.
export const STROKE_MIN_SPEED = 1.2;
export const STROKE_MAX_SPEED = 16;
// Capture zone: the cup rim (~0.07 m) plus the ball radius, slightly
// forgiving. A ball this close to the cup center moving slower than the
// capture speed drops in; faster than that it burns the edge and deflects
// (lips out).
export const CUP_CAPTURE_RADIUS = 0.12;
export const CUP_CAPTURE_SPEED = 2.6;

const GRAVITY = 9.8;
// Rolling resistance on the green; also what makes power choice matter.
const ROLL_DECEL = 2.4;
// Faces steeper than this (normal pointing mostly sideways) bounce the ball
// instead of letting it roll up: rocks, walls, tree trunks.
const WALL_NORMAL_Y = 0.55;
const WALL_RESTITUTION = 0.45;
// Landing from the air harder than this bounces instead of sticking.
const GROUND_BOUNCE_SPEED = 1.6;
const GROUND_RESTITUTION = 0.35;
// Lip-out: a too-fast ball crossing the cup gets knocked off line and
// loses pace, once per stroke.
const LIP_DEFLECT_RADIANS = 0.21;
const LIP_DAMPING = 0.82;
// Below this speed the ball is considered at rest, provided rolling
// resistance can hold it against the slope it is standing on.
const STOP_SPEED = 0.18;
// How far under the world's lowest mesh a ball counts as lost to the void.
const LOST_MARGIN = 10;
const SUBSTEP = 1 / 120;
const MAX_STEP = 0.05;
// A ball that was rolling last substep stays glued to the surface across
// gaps up to this size (bumps, downhill crests at speed). A ball that is
// airborne is NEVER pulled down — it falls under gravity only.
const GROUND_GLUE = 0.012;

export type PuttBall = {
  position: Vector3;
  velocity: Vector3;
  grounded: boolean;
  // Seconds spent continuously below STOP_SPEED, for settling on the kind
  // of borderline slope where friction and gravity nearly balance.
  slowTime: number;
  // Whether this stroke already burned the cup's edge (at most one lip-out
  // deflection is applied per stroke).
  lipped: boolean;
};

export type PuttStepResult = "rolling" | "settled" | "holed" | "lost";

const scratchRay = new Ray();
const scratchNormal = new Vector3();
const scratchGravity = new Vector3();
const scratchMove = new Vector3();
const scratchDelta = new Vector3();

/**
 * A ball resting tangent on the putting surface at `start` (any point above
 * or near the spot works — the surface is sampled straight down from it).
 * Used for spawn, reset, and teleport so every placement path shares the
 * same contact rule. Without a surface (not loaded yet, or off the mesh)
 * the ball is left a contact gap above `start`.
 */
export function createBall(
  start: Vector3,
  surface: PuttingSurface | null = null,
): PuttBall {
  const ball: PuttBall = {
    position: start.clone(),
    velocity: new Vector3(),
    grounded: true,
    slowTime: 0,
    lipped: false,
  };
  if (!surface || !placeBallOnSurface(ball, surface, start)) {
    ball.position.y += BALL_RADIUS + CONTACT_SKIN;
  }
  return ball;
}

/**
 * Move a ball (spawn/reset/teleport) so its center sits at
 * surfacePoint + surfaceNormal * (radius + skin) for the surface sampled
 * below `at`. Returns false when no surface exists there.
 */
export function placeBallOnSurface(
  ball: PuttBall,
  surface: PuttingSurface,
  at: Vector3 = ball.position,
): boolean {
  const sample = surface.sample(at, {
    expectedRegion: "tee",
    previousSurfaceHeight: at.dot(surface.up),
    maxAbove: 2,
    maxBelow: 12,
  });
  if (!sample) return false;
  ball.position.copy(ballCenterOn(sample, BALL_RADIUS, CONTACT_SKIN));
  ball.velocity.set(0, 0, 0);
  ball.grounded = true;
  ball.slowTime = 0;
  ball.lipped = false;
  return true;
}

/** Speed for a charge level in [0, 1]. */
export function strokeSpeed(power: number): number {
  const clamped = Math.min(1, Math.max(0, power));
  return STROKE_MIN_SPEED + clamped * (STROKE_MAX_SPEED - STROKE_MIN_SPEED);
}

/** Launch the ball flat along `direction` (horizontal component only). */
export function strokeBall(
  ball: PuttBall,
  direction: Vector3,
  speed: number,
): void {
  const flat = new Vector3(direction.x, 0, direction.z);
  if (flat.lengthSq() < 1e-8) return;
  ball.velocity.copy(flat.normalize().multiplyScalar(speed));
  ball.grounded = true;
  ball.slowTime = 0;
  ball.lipped = false;
}

/**
 * Continuous collision: sweep the ball's motion for this substep against
 * the collider mesh, stopping a radius short of any surface, bouncing off
 * walls and hard landings, and sliding the leftover motion along ground.
 * Because every substep is swept, the ball cannot tunnel through the floor
 * regardless of frame rate.
 */
function moveWithCollisions(
  ball: PuttBall,
  dt: number,
  surface: PuttingSurface,
): void {
  scratchMove.copy(ball.velocity).multiplyScalar(dt);
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const distance = scratchMove.length();
    if (distance < 1e-7) return;

    scratchRay.origin.copy(ball.position);
    scratchRay.direction.copy(scratchMove).divideScalar(distance);
    const hit = surface.raycastMotion(scratchRay, distance + BALL_RADIUS);
    if (!hit || hit.distance - BALL_RADIUS > distance) {
      ball.position.add(scratchMove);
      return;
    }

    const allowed = Math.max(0, hit.distance - BALL_RADIUS);
    ball.position.addScaledVector(scratchRay.direction, allowed);

    scratchNormal.copy(hit.face?.normal ?? new Vector3(0, 1, 0));
    if (scratchNormal.dot(scratchRay.direction) > 0) scratchNormal.negate();

    if (Math.abs(scratchNormal.y) < WALL_NORMAL_Y) {
      // A wall: reflect the velocity and lose energy in the bounce.
      const into = ball.velocity.dot(scratchNormal);
      ball.velocity.addScaledVector(scratchNormal, -2 * into);
      ball.velocity.multiplyScalar(WALL_RESTITUTION);
      return;
    }

    const into = ball.velocity.dot(scratchNormal);
    if (!ball.grounded && into < -GROUND_BOUNCE_SPEED) {
      // Hard landing from the air: bounce off the ground and stay airborne.
      ball.velocity.addScaledVector(
        scratchNormal,
        -into * (1 + GROUND_RESTITUTION),
      );
      return;
    }

    // Ground-like face: slide the leftover motion along it and keep going.
    scratchMove
      .copy(scratchRay.direction)
      .multiplyScalar(distance - allowed);
    scratchMove.addScaledVector(scratchNormal, -scratchMove.dot(scratchNormal));
    if (into < 0) ball.velocity.addScaledVector(scratchNormal, -into);
  }
}

/**
 * Grounded rolling on a surface contact: slope gravity, rolling
 * resistance, cup capture/lip-out, and the settle check.
 */
function rollOnSurface(
  ball: PuttBall,
  dt: number,
  contact: SurfaceSample,
  cup: Vector3 | null,
): PuttStepResult {
  ball.grounded = true;

  // The slope component of gravity accelerates the roll; rolling
  // resistance opposes it.
  scratchGravity.set(0, -GRAVITY, 0);
  scratchGravity.addScaledVector(
    contact.normal,
    -scratchGravity.dot(contact.normal),
  );
  ball.velocity.addScaledVector(scratchGravity, dt);

  const speed = ball.velocity.length();
  const slowed = Math.max(0, speed - ROLL_DECEL * dt);
  if (speed > 1e-6) ball.velocity.multiplyScalar(slowed / speed);

  if (cup) {
    const flatDistance = Math.hypot(
      ball.position.x - cup.x,
      ball.position.z - cup.z,
    );
    const overCup =
      flatDistance <= CUP_CAPTURE_RADIUS &&
      Math.abs(ball.position.y - cup.y) < 0.6;
    if (overCup && ball.velocity.length() <= CUP_CAPTURE_SPEED) {
      ball.velocity.set(0, 0, 0);
      return "holed";
    }
    if (overCup && !ball.lipped) {
      // Burned edge: too much pace to drop. Knock the ball off line (away
      // from whichever side of the center it is passing) and take some
      // speed out of it.
      ball.lipped = true;
      const side =
        (ball.position.x - cup.x) * ball.velocity.z -
          (ball.position.z - cup.z) * ball.velocity.x >=
        0
          ? 1
          : -1;
      const angle = side * LIP_DEFLECT_RADIANS;
      const { x, z } = ball.velocity;
      ball.velocity.x = x * Math.cos(angle) - z * Math.sin(angle);
      ball.velocity.z = x * Math.sin(angle) + z * Math.cos(angle);
      ball.velocity.multiplyScalar(LIP_DAMPING);
    }
  }

  const finalSpeed = ball.velocity.length();
  ball.slowTime = finalSpeed < STOP_SPEED ? ball.slowTime + dt : 0;
  // At rest when friction can hold the slope, or when the ball has been
  // crawling for a while — the near-balance case on bumpy real meshes
  // where slope and friction cancel and speed hovers at zero forever.
  if (
    finalSpeed < STOP_SPEED &&
    (scratchGravity.length() <= ROLL_DECEL || ball.slowTime > 0.35)
  ) {
    ball.velocity.set(0, 0, 0);
    return "settled";
  }
  return "rolling";
}

function stepOnce(
  ball: PuttBall,
  dt: number,
  surface: PuttingSurface,
  cup: Vector3 | null,
): PuttStepResult {
  moveWithCollisions(ball, dt, surface);

  const contact = surface.sample(ball.position);
  if (contact) {
    // Signed height of the ball center over the surface, along its normal.
    const height = scratchDelta
      .copy(ball.position)
      .sub(contact.point)
      .dot(contact.normal);
    const restHeight = BALL_RADIUS + CONTACT_SKIN;

    if (height < restHeight) {
      // Penetrating (or inside the contact skin): project the center out
      // along the surface normal, never along world up.
      ball.position.addScaledVector(contact.normal, restHeight - height);
      const into = ball.velocity.dot(contact.normal);
      if (!ball.grounded) {
        if (into < -GROUND_BOUNCE_SPEED) {
          // Hard landing that the sweep didn't already resolve: bounce.
          ball.velocity.addScaledVector(
            contact.normal,
            -into * (1 + GROUND_RESTITUTION),
          );
          return "rolling";
        }
        if (into > STOP_SPEED) {
          // Separating fast (it just bounced off this surface): airborne.
          return "rolling";
        }
      }
      // Remove only the velocity component moving into the surface.
      if (into < 0) ball.velocity.addScaledVector(contact.normal, -into);
      return rollOnSurface(ball, dt, contact, cup);
    }

    if (ball.grounded && height <= restHeight + GROUND_GLUE) {
      // Rolling contact across small bumps: keep a grounded ball tangent
      // to the surface instead of launching it off every crest. Airborne
      // balls never take this branch, so nothing is snapped down.
      ball.position.addScaledVector(contact.normal, restHeight - height);
      const into = ball.velocity.dot(contact.normal);
      if (into < 0) ball.velocity.addScaledVector(contact.normal, -into);
      return rollOnSurface(ball, dt, contact, cup);
    }
  }

  // Airborne: gravity only.
  ball.grounded = false;
  ball.slowTime = 0;
  ball.velocity.y -= GRAVITY * dt;
  if (ball.position.y < surface.sourceCollider.bounds.min.y - LOST_MARGIN) {
    return "lost";
  }
  return "rolling";
}

/**
 * Advance the ball by `dt` seconds in fixed substeps (1/120 s). Returns the
 * first terminal event ("settled", "holed", "lost") or "rolling".
 */
export function stepBall(
  ball: PuttBall,
  dt: number,
  surface: PuttingSurface,
  cup: Vector3 | null,
): PuttStepResult {
  let remaining = Math.min(dt, MAX_STEP);
  while (remaining > 1e-6) {
    const step = Math.min(SUBSTEP, remaining);
    remaining -= step;
    const result = stepOnce(ball, step, surface, cup);
    if (result !== "rolling") return result;
  }
  return "rolling";
}
