import { BALL, GAME_SECONDS } from './config.js';

export function createBallState() {
  return {
    x: BALL.startX,
    y: BALL.startY,
    previousX: BALL.startX,
    previousY: BALL.startY,
    vx: 0,
    vy: 0,
    rotation: 0,
    radius: BALL.radius,
    mode: 'ready',
    shotAge: 0,
    restTime: 0,
    rimContactAge: null,
    floorContactAge: null,
    resetTime: 0,
    scoredThisShot: false,
    missRecorded: false,
    collisionCooldown: 0,
  };
}

export function createGameState() {
  return {
    phase: 'ready',
    score: 0,
    shotsTaken: 0,
    madeShots: 0,
    streak: 0,
    bestStreak: 0,
    timeRemaining: GAME_SECONDS,
    threePointMode: false,
    ball: createBallState(),
    retiredBalls: [], // Airborne balls replaced by a ready ball remain visible until floor contact.
    drag: {
      active: false,
      pointerId: null,
      x: BALL.startX,
      y: BALL.startY,
      dx: 0,
      dy: 0,
      distance: 0,
    },
    effects: {
      particles: [],
      swishTime: 0,
      rimFlash: 0,
      scorePulse: 0,
      trail: [],
    },
    frame: 0,
    elapsed: 0,
    fps: 60,
  };
}

export function resetBall(ball) {
  Object.assign(ball, createBallState());
}
