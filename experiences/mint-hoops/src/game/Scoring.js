import { THREE_POINT_MODE } from './config.js';

export function isThreePointMode(timeRemaining) {
  const seconds = Number(timeRemaining);
  return Number.isFinite(seconds)
    && seconds > 0
    && seconds <= THREE_POINT_MODE.durationSeconds;
}

export function getBasketValue(timeRemaining, multiplier = 1) {
  const baseValue = isThreePointMode(timeRemaining)
    ? THREE_POINT_MODE.basketValue
    : THREE_POINT_MODE.normalBasketValue;
  const safeMultiplier = Number.isFinite(Number(multiplier))
    ? Math.max(1, Math.floor(Number(multiplier)))
    : 1;
  return baseValue * safeMultiplier;
}

/**
 * Return the exact downward rim-plane crossing for a made basket.
 *
 * Scoring is deliberately derived from the previous and current fixed-step
 * states instead of the rendered frame. Interpolating X at the moment Y
 * reaches the rim plane prevents fast diagonal shots from being judged by an
 * endpoint that is already past the hoop. The full ball must also fit between
 * the two circular rim proxies, so a grazing rim contact cannot award a point.
 */
export function getBasketCrossing(ball, hoop) {
  if (
    ball.scoredThisShot ||
    ball.previousY > hoop.rimY ||
    ball.y <= hoop.rimY ||
    ball.vy <= 0
  ) {
    return null;
  }

  const verticalTravel = ball.y - ball.previousY;
  if (verticalTravel <= 0) return null;

  const crossingT = (hoop.rimY - ball.previousY) / verticalTravel;
  const previousX = Number.isFinite(ball.previousX) ? ball.previousX : ball.x;
  const crossingX = previousX + (ball.x - previousX) * crossingT;
  const clearance = Math.max(
    Number(hoop.scoreInset) || 0,
    (Number(ball.radius) || 0) + (Number(hoop.rimRadius) || 0),
  );
  const openingLeft = hoop.rimLeft + clearance;
  const openingRight = hoop.rimRight - clearance;

  if (crossingX <= openingLeft || crossingX >= openingRight) return null;

  return {
    x: crossingX,
    y: hoop.rimY,
    t: crossingT,
    clearance,
    openingLeft,
    openingRight,
    downwardVelocity: ball.vy,
    previousX,
    previousY: ball.previousY,
    currentX: ball.x,
    currentY: ball.y,
  };
}

export function didScoreBasket(ball, hoop) {
  return getBasketCrossing(ball, hoop) !== null;
}
