// The stroke-commit slice of the putt phase machine, extracted so the
// one-stroke-one-sound rule is directly testable: exactly one committed
// stroke can come out of each charge, and a cancelled charge commits
// nothing.

export type PuttPhase = "aim" | "charging" | "rolling" | "holed";

/** Space pressed: only an aiming putt starts charging. */
export function beginCharge(phase: PuttPhase): PuttPhase {
  return phase === "aim" ? "charging" : phase;
}

/** Focus lost / cancel: an in-progress charge returns to aim, uncommitted. */
export function cancelCharge(phase: PuttPhase): PuttPhase {
  return phase === "charging" ? "aim" : phase;
}

/**
 * Space released: a stroke commits only from the charging phase. Returns
 * the committed power, or null when there is nothing to commit (already
 * rolling, already holed, cancelled, or a stray keyup).
 */
export function commitStroke(
  phase: PuttPhase,
  power: number,
): { phase: PuttPhase; committedPower: number | null } {
  if (phase !== "charging") return { phase, committedPower: null };
  return {
    phase: "rolling",
    committedPower: Math.min(1, Math.max(0, power)),
  };
}
