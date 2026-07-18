// Scoring for a completed hole. Every hole plays as a par 3 to start (no
// per-hole pars have been authored for gameplay yet), so par lives here as
// one constant that the HUD, the score card, and the tests all share.

export const HOLE_PAR = 3;

export type ScoreTone = "under" | "even" | "over";

export type HoleScore = {
  strokes: number;
  par: number;
  /** Strokes relative to par: negative is under, positive is over. */
  diff: number;
  /** Golf name for the result: "Hole-in-one", "Birdie", "Bogey", … */
  label: string;
  /** Plain reading of the diff: "1 under par", "Even with par". */
  relative: string;
  /** For styling the card: under, even, or over par. */
  tone: ScoreTone;
};

const NAMED_DIFFS = new Map<number, string>([
  [-3, "Albatross"],
  [-2, "Eagle"],
  [-1, "Birdie"],
  [0, "Par"],
  [1, "Bogey"],
  [2, "Double bogey"],
  [3, "Triple bogey"],
]);

export function scoreHole(strokes: number, par: number = HOLE_PAR): HoleScore {
  const diff = strokes - par;
  const label =
    strokes === 1
      ? "Hole-in-one"
      : (NAMED_DIFFS.get(diff) ?? (diff > 0 ? `+${diff}` : `${diff}`));
  const relative =
    diff === 0
      ? "Even with par"
      : diff < 0
        ? `${-diff} under par`
        : `${diff} over par`;
  const tone: ScoreTone = diff === 0 ? "even" : diff < 0 ? "under" : "over";
  return { strokes, par, diff, label, relative, tone };
}
