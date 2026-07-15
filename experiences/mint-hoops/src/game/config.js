export const VIEWPORT = Object.freeze({ width: 1280, height: 720 });

export const COLORS = Object.freeze({
  mint: '#7FE0C3',
  mintLight: '#C8F5E6',
  mintDeep: '#4FC6A5',
  dark: '#173F35',
  cream: '#FFF9EC',
  creamDeep: '#F4E8CF',
  orange: '#F28C28',
  orangeDeep: '#C75F16',
  coral: '#F06D4F',
  white: '#FFFFFF',
});

export const COURT = Object.freeze({
  floorY: 646,
  hoop: {
    rimY: 294,
    rimLeft: 979,
    rimRight: 1109,
    rimRadius: 9,
    scoreInset: 14,
    // The rear rim centerline meets the front face of the rotated Mint board,
    // matching a conventional flush-mounted basket without an invisible gap.
    backboard: { x: 1109, y: 142, width: 18, height: 212 },
  },
});

export const BALL = Object.freeze({
  radius: 28,
  startX: 205,
  startY: 594,
  gravity: 1020,
  maxLaunchSpeed: 1480,
  maxDragDistance: 270,
  launchPowerExponent: 1.1,
  minDragDistance: 18,
  floorRestitution: 0.46,
  rimRestitution: 0.72,
  backboardRestitution: 0.66,
  horizontalDamping: 0.985,
  airDampingPerSecond: 0.09,
  maxShotSeconds: 5.5,
  rimResetDelay: 0.1,
  floorResetDelay: 0.04,
  resetSeconds: 0.06,
});

export const AIM_ARROW = Object.freeze({
  minLength: 74,
  maxLength: 176,
  maxHeadLength: 26,
  maxHeadWidth: 18,
  midColorPower: 0.65,
});

export const GAME_SECONDS = 60;
export const THREE_POINT_MODE = Object.freeze({
  durationSeconds: 15,
  basketValue: 3,
  normalBasketValue: 1,
});
export const FIXED_TIMESTEP = 1 / 120;
