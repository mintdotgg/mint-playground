export const LANE_WIDTH = 2.25;

/**
 * The chase camera faces world +Z. In Three.js that makes screen-right point
 * toward world -X, so lane intent is converted at this single presentation
 * boundary. Simulation lane values stay semantic: -1 is left and +1 is right.
 */
export function laneToWorldX(lane: number): number {
  return -lane * LANE_WIDTH;
}
