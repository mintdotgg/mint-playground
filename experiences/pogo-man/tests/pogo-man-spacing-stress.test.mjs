import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTO_HOP_VELOCITY,
  EXTRA_OPEN_ROAD_METERS,
  HERO_COLLISION_WIDTH,
  MAX_JUMPS_PER_LANDING,
  MAX_CHARGED_HOP_VELOCITY,
  MINIMUM_RECOVERY_SECONDS,
  POGO_GRAVITY,
  TRAFFIC_GAME_SPECS,
  bounceVelocityForCharge,
  canUseJump,
  jumpsAfterAttempt,
  immediateJumpVelocity,
  minimumSpawnInterval,
  nextSpawnInterval,
  trafficKindAt,
  trafficSpeedAt,
} from "../app/pogoManGameMath.ts";

const makeRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

test("200,000 escalating traffic spawns preserve geometric and recovery gaps", () => {
  const random = makeRandom(0x504f474f);
  let distance = 0;
  let previous = "taxi";
  let narrowestRecoveryWindow = Number.POSITIVE_INFINITY;
  let narrowestRoadGap = Number.POSITIVE_INFINITY;

  for (let index = 0; index < 200_000; index += 1) {
    const next = trafficKindAt(distance, random());
    const speed = trafficSpeedAt(distance);
    const interval = nextSpawnInterval(distance, previous, next, random());
    const centerGap = speed * interval;
    const requiredRoadGap =
      TRAFFIC_GAME_SPECS[previous].width * 0.5 +
      TRAFFIC_GAME_SPECS[next].width * 0.5 +
      HERO_COLLISION_WIDTH +
      EXTRA_OPEN_ROAD_METERS;

    narrowestRecoveryWindow = Math.min(narrowestRecoveryWindow, interval);
    narrowestRoadGap = Math.min(narrowestRoadGap, centerGap - requiredRoadGap);

    assert.ok(
      interval >= minimumSpawnInterval(distance, previous, next),
      `unsafe recovery interval at spawn ${index}`,
    );
    assert.ok(
      centerGap >= requiredRoadGap,
      `overlapping safe corridors at spawn ${index}`,
    );

    distance += speed * interval;
    previous = next;
  }

  assert.ok(narrowestRecoveryWindow >= MINIMUM_RECOVERY_SECONDS);
  assert.ok(narrowestRoadGap >= -Number.EPSILON);
  assert.ok(distance > 2_000_000);
});

test("automatic hops stay fast and low while charged jumps remain distinct", () => {
  const automaticAirtime = (AUTO_HOP_VELOCITY * 2) / POGO_GRAVITY;
  const automaticHeight =
    (AUTO_HOP_VELOCITY * AUTO_HOP_VELOCITY) / (2 * POGO_GRAVITY);
  const fullChargeAirtime = (MAX_CHARGED_HOP_VELOCITY * 2) / POGO_GRAVITY;

  assert.ok(automaticAirtime < 0.36);
  assert.ok(automaticHeight < 0.3);
  assert.ok(fullChargeAirtime > automaticAirtime * 2);
  assert.equal(bounceVelocityForCharge(1), MAX_CHARGED_HOP_VELOCITY);
  assert.ok(immediateJumpVelocity(-12, 0) >= 7.2);
  assert.ok(immediateJumpVelocity(8.5, 0) >= 8.5);
});

test("exactly two jump attempts are available before the landing reset", () => {
  let jumpsRemaining = MAX_JUMPS_PER_LANDING;

  assert.equal(canUseJump(jumpsRemaining), true);
  jumpsRemaining = jumpsAfterAttempt(jumpsRemaining);
  assert.equal(jumpsRemaining, 1);

  assert.equal(canUseJump(jumpsRemaining), true);
  jumpsRemaining = jumpsAfterAttempt(jumpsRemaining);
  assert.equal(jumpsRemaining, 0);

  assert.equal(canUseJump(jumpsRemaining), false);
  assert.equal(jumpsAfterAttempt(jumpsRemaining), 0);

  jumpsRemaining = MAX_JUMPS_PER_LANDING;
  assert.equal(jumpsRemaining, 2);
});
