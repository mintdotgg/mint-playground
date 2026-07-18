import type { PuttIntensity } from "./audio-manifest";

// Maps the game's normalized stroke charge (0..1, from holding Space up to
// CHARGE_FULL_MS) onto the three putt-impact sound intensities.
//
// The thresholds are derived from the actual stroke model in putt-physics:
// speed = 1.2 + power * 14.8 m/s and rolling deceleration 2.4 m/s², so a
// stroke rolls speed²/(2·2.4) meters on flat green. Authored holes measure
// roughly 9–14 m tee-to-cup:
//   power < 0.25  → under ~5 m of roll: taps and short saves     → soft
//   power < 0.60  → ~5–21 m: standard putts at hole scale        → medium
//   power ≥ 0.60  → beyond ~21 m: full sends and bank attempts   → hard
export const PUTT_SOFT_MAX_POWER = 0.25;
export const PUTT_MEDIUM_MAX_POWER = 0.6;

export function puttIntensityForPower(power: number): PuttIntensity {
  const clamped = Math.min(1, Math.max(0, Number.isNaN(power) ? 0 : power));
  if (clamped < PUTT_SOFT_MAX_POWER) return "soft";
  if (clamped < PUTT_MEDIUM_MAX_POWER) return "medium";
  return "hard";
}

/**
 * Picks a variation index in [0, count), avoiding an immediate repeat of
 * `lastIndex` whenever more than one variation exists.
 */
export function pickVariation(
  count: number,
  lastIndex: number | null,
  random: () => number = Math.random,
): number {
  if (count <= 0) return -1;
  if (count === 1) return 0;
  if (lastIndex === null || lastIndex < 0 || lastIndex >= count) {
    return Math.min(count - 1, Math.floor(random() * count));
  }
  const offset = Math.min(count - 2, Math.floor(random() * (count - 1)));
  return offset >= lastIndex ? offset + 1 : offset;
}

// Subtle humanization so repeated putts never sound stamped from one file.
// Pitch stays within ±2.5% (imperceptible as detuning) and gain within
// about ±0.8 dB.
export const PITCH_JITTER_RANGE = 0.025;
export const GAIN_JITTER_RANGE = 0.09;

export function pitchJitter(random: () => number = Math.random): number {
  return 1 + (random() * 2 - 1) * PITCH_JITTER_RANGE;
}

export function gainJitter(random: () => number = Math.random): number {
  return 1 + (random() * 2 - 1) * GAIN_JITTER_RANGE;
}
