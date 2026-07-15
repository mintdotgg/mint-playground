import { BALL, COURT, VIEWPORT } from './config.js';

export function getLaunchVelocity(dx, dy) {
  const distance = Math.hypot(dx, dy);
  if (distance < BALL.minDragDistance) return null;

  const clampedDistance = Math.min(distance, BALL.maxDragDistance);
  const nx = dx / distance;
  const ny = dy / distance;
  // Preserve fine control around medium power while reserving the top of the
  // drag range for deliberate overshoots. Unlike the old linear cap, a longer
  // pull now continues to add meaningful speed all the way to maximum power.
  const normalizedPower = clampedDistance / BALL.maxDragDistance;
  const speed = BALL.maxLaunchSpeed * normalizedPower ** BALL.launchPowerExponent;
  return { vx: nx * speed, vy: ny * speed, speed };
}

function resolveCircleCollision(ball, collider, restitution) {
  const dx = ball.x - collider.x;
  const dy = ball.y - collider.y;
  const minDistance = ball.radius + collider.radius;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared >= minDistance * minDistance) return null;

  const distance = Math.sqrt(distanceSquared) || 0.0001;
  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = minDistance - distance;
  ball.x += nx * overlap;
  ball.y += ny * overlap;

  const velocityAlongNormal = ball.vx * nx + ball.vy * ny;
  if (velocityAlongNormal < 0) {
    const impulse = -(1 + restitution) * velocityAlongNormal;
    ball.vx += impulse * nx;
    ball.vy += impulse * ny;
  }
  return Math.abs(velocityAlongNormal);
}

function resolveRectCollision(ball, rect, restitution) {
  const closestX = Math.max(rect.x, Math.min(ball.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(ball.y, rect.y + rect.height));
  let dx = ball.x - closestX;
  let dy = ball.y - closestY;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared >= ball.radius * ball.radius) return null;

  let distance = Math.sqrt(distanceSquared);
  let nx;
  let ny;
  if (distance < 0.0001) {
    // The center is inside the board: choose the nearest escape face.
    const distances = [
      { d: Math.abs(ball.x - rect.x), nx: -1, ny: 0 },
      { d: Math.abs(rect.x + rect.width - ball.x), nx: 1, ny: 0 },
      { d: Math.abs(ball.y - rect.y), nx: 0, ny: -1 },
      { d: Math.abs(rect.y + rect.height - ball.y), nx: 0, ny: 1 },
    ].sort((a, b) => a.d - b.d);
    ({ nx, ny } = distances[0]);
    distance = 0;
  } else {
    nx = dx / distance;
    ny = dy / distance;
  }

  const overlap = ball.radius - distance;
  ball.x += nx * overlap;
  ball.y += ny * overlap;
  const velocityAlongNormal = ball.vx * nx + ball.vy * ny;
  if (velocityAlongNormal < 0) {
    const impulse = -(1 + restitution) * velocityAlongNormal;
    ball.vx += impulse * nx;
    ball.vy += impulse * ny;
  }
  return Math.abs(velocityAlongNormal);
}

/**
 * Fixed-step, arcade-style ball simulation. The visual asset never owns
 * collision: two rim circles, one backboard rectangle, and the floor are the
 * authoritative proxies, making tuning deterministic and forgiving. The rear
 * rim centerline meets the board face, so no hidden connector is necessary.
 */
export function stepBall(ball, deltaSeconds, onCollision = () => {}) {
  ball.previousX = ball.x;
  ball.previousY = ball.y;
  ball.collisionCooldown = Math.max(0, ball.collisionCooldown - deltaSeconds);

  const airDamping = Math.exp(-BALL.airDampingPerSecond * deltaSeconds);
  ball.vx *= airDamping;
  ball.vy = ball.vy * airDamping + BALL.gravity * deltaSeconds;
  ball.x += ball.vx * deltaSeconds;
  ball.y += ball.vy * deltaSeconds;
  ball.rotation += (ball.vx / Math.max(ball.radius, 1)) * deltaSeconds;

  const hoop = COURT.hoop;
  const rimColliders = [
    { x: hoop.rimLeft, y: hoop.rimY, radius: hoop.rimRadius },
    { x: hoop.rimRight, y: hoop.rimY, radius: hoop.rimRadius },
  ];

  for (const rim of rimColliders) {
    const impact = resolveCircleCollision(ball, rim, BALL.rimRestitution);
    if (impact !== null) {
      if (ball.rimContactAge === null) ball.rimContactAge = 0;
      if (impact > 28 && ball.collisionCooldown === 0) {
        onCollision('rim', impact);
        ball.collisionCooldown = 0.045;
      }
    }
  }

  const boardImpact = resolveRectCollision(ball, hoop.backboard, BALL.backboardRestitution);
  if (boardImpact !== null && boardImpact > 28 && ball.collisionCooldown === 0) {
    onCollision('backboard', boardImpact);
    ball.collisionCooldown = 0.045;
  }

  if (ball.y + ball.radius >= COURT.floorY && ball.vy > 0) {
    const impact = Math.abs(ball.vy);
    ball.y = COURT.floorY - ball.radius;
    ball.vy = -ball.vy * BALL.floorRestitution;
    ball.vx *= BALL.horizontalDamping;
    if (ball.floorContactAge === null) ball.floorContactAge = 0;
    if (Math.abs(ball.vy) < 42) ball.vy = 0;
    if (impact > 56 && ball.collisionCooldown === 0) {
      onCollision('floor', impact);
      ball.collisionCooldown = 0.045;
    }
  }

  return ball;
}

export function isBallOutOfBounds(ball) {
  const margin = 70;
  return (
    ball.x < -margin ||
    ball.x > VIEWPORT.width + margin ||
    ball.y < -220 ||
    ball.y > VIEWPORT.height + margin
  );
}

export function isBallResting(ball) {
  const onFloor = Math.abs(ball.y + ball.radius - COURT.floorY) < 1;
  return onFloor && Math.hypot(ball.vx, ball.vy) < 58;
}
