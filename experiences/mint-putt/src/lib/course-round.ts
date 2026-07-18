import { HOLES } from "./course-data";
import { scoreHole, type HoleScore } from "./hole-score";

export type CourseHoleScore = HoleScore & {
  holeNumber: number;
  holeName: string;
};

export type CourseScorecard = Array<CourseHoleScore | null>;

export function createCourseScorecard(): CourseScorecard {
  return HOLES.map(() => null);
}

export function recordCourseHole(
  scorecard: CourseScorecard,
  holeNumber: number,
  strokes: number,
): CourseScorecard {
  const hole = HOLES.find((candidate) => candidate.number === holeNumber);
  if (!hole) throw new RangeError(`Unknown hole ${holeNumber}`);

  const next = scorecard.slice();
  next[holeNumber - 1] = {
    holeNumber,
    holeName: hole.name,
    ...scoreHole(strokes, hole.par),
  };
  return next;
}

export function courseScoreTotals(scorecard: CourseScorecard) {
  return scorecard.reduce(
    (totals, score) => {
      if (!score) return totals;
      totals.strokes += score.strokes;
      totals.par += score.par;
      totals.diff += score.diff;
      totals.completed += 1;
      return totals;
    },
    { strokes: 0, par: 0, diff: 0, completed: 0 },
  );
}

export function formatCourseDiff(diff: number) {
  if (diff === 0) return "E";
  return diff > 0 ? `+${diff}` : String(diff);
}

export function describeCourseDiff(diff: number) {
  if (diff === 0) return "Even par";
  return `${formatCourseDiff(diff)} ${diff > 0 ? "over par" : "under par"}`;
}
