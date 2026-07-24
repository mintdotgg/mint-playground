export type TrafficKind = "taxi" | "sedan" | "bus";

export const TRAFFIC_GAME_SPECS = {
  taxi: { width: 2.05, points: 100 },
  sedan: { width: 2.25, points: 130 },
  bus: { width: 2.9, points: 220 },
} as const satisfies Record<TrafficKind, { width: number; points: number }>;

export const HERO_COLLISION_WIDTH = 0.64;
export const MAX_JUMPS_PER_LANDING = 2;
export const MINIMUM_RECOVERY_SECONDS = 1.7;
export const EXTRA_OPEN_ROAD_METERS = 3.1;
export const POGO_GRAVITY = 11.5;
export const AUTO_HOP_VELOCITY = 1.8;
export const MIN_CHARGED_HOP_VELOCITY = 9.6;
export const MAX_CHARGED_HOP_VELOCITY = 11.4;

export const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));

export const trafficSpeedAt = (distance: number) =>
  clamp(4.65 + distance * 0.0065, 4.65, 8.25);

export const bounceVelocityForCharge = (charge: number) =>
  MIN_CHARGED_HOP_VELOCITY +
  clamp(charge, 0, 1) *
    (MAX_CHARGED_HOP_VELOCITY - MIN_CHARGED_HOP_VELOCITY);

export const immediateJumpVelocity = (
  currentVelocity: number,
  charge: number,
) => Math.max(currentVelocity, bounceVelocityForCharge(Math.max(charge, 0.34)));

export const airborneJumpVelocity = (charge: number) =>
  bounceVelocityForCharge(Math.max(charge, 0.34));

export const canUseJump = (jumpsRemaining: number) => jumpsRemaining > 0;

export const jumpsAfterAttempt = (jumpsRemaining: number) =>
  Math.max(0, jumpsRemaining - 1);

export const trafficKindAt = (distance: number, roll: number): TrafficKind => {
  if (distance > 115 && roll > 0.73) return "bus";
  if (distance > 35 && roll > 0.43) return "sedan";
  return "taxi";
};

export const minimumSpawnInterval = (
  distance: number,
  previous: TrafficKind,
  next: TrafficKind,
) => {
  const previousHalfWidth = TRAFFIC_GAME_SPECS[previous].width * 0.5;
  const nextHalfWidth = TRAFFIC_GAME_SPECS[next].width * 0.5;
  const geometricGap =
    (previousHalfWidth +
      nextHalfWidth +
      HERO_COLLISION_WIDTH +
      EXTRA_OPEN_ROAD_METERS) /
    trafficSpeedAt(distance);

  return Math.max(MINIMUM_RECOVERY_SECONDS, geometricGap);
};

export const nextSpawnInterval = (
  distance: number,
  previous: TrafficKind,
  next: TrafficKind,
  randomUnit: number,
) => {
  const difficultyInterval = clamp(2.4 - distance * 0.0018, 1.7, 2.4);
  const safeMinimum = minimumSpawnInterval(distance, previous, next);
  return Math.max(difficultyInterval, safeMinimum) + clamp(randomUnit, 0, 1) * 0.52;
};
