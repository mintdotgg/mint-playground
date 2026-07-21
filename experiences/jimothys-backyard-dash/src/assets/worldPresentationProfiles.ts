export type WorldCameraFrame = {
  height: number;
  back: number;
  targetX: number;
  targetY: number;
  lookAhead: number;
  fov: number;
};

export type WorldCameraProfile = {
  desktop: WorldCameraFrame;
  mobile: WorldCameraFrame;
};

export type WorldCompositionProfile = {
  // Semantic anchors live in the calibrated Mint root's local space. They are
  // deliberately independent of noisy collider bounds and remain attached to
  // the splat/collider transform during calibration.
  corridorAnchor: readonly [number, number, number];
  horizonAnchor: readonly [number, number, number];
  horizonRatio: { desktop: number; mobile: number };
  centerTolerance: number;
  horizonTolerance: number;
  detailScale: number;
};

export type WorldPresentationProfile = {
  name: string;
  rootOffset: readonly [number, number, number];
  rootRotation: readonly [number, number, number];
  rootScale: number;
  opacity: { desktop: number; mobileHigh: number; mobileSafe: number };
  camera: WorldCameraProfile;
  composition: WorldCompositionProfile;
  background: string;
  fog: { color: string; near: number; far: number };
};

const centeredComposition = (
  detailScale: number,
  horizonDesktop = 0.43,
  horizonMobile = 0.41,
): WorldCompositionProfile => ({
  corridorAnchor: [0, 0.68, -5.5],
  horizonAnchor: [0, 0.06, -18],
  horizonRatio: { desktop: horizonDesktop, mobile: horizonMobile },
  centerTolerance: 0.055,
  horizonTolerance: 0.13,
  detailScale,
});

// These are authored presentation anchors, not collider-bound centers. Mint
// worlds often contain distant scenery and noisy bounds, so each scene is
// registered to the fixed chase camera by eye while the shared RAD/collider
// root remains immutable after initialization. Desktop and phone frames are
// explicit rather than deriving phone composition from a generic offset.
export const WORLD_PRESENTATION_PROFILES: readonly WorldPresentationProfile[] = [
  {
    name: 'Dewy Lawn',
    rootOffset: [0, 0.015, 4.6],
    rootRotation: [Math.PI, 0, 0],
    rootScale: 2.5,
    opacity: { desktop: 1, mobileHigh: 0.98, mobileSafe: 0.96 },
    camera: {
      desktop: { height: 4.45, back: 10.4, targetX: 0, targetY: 1.05, lookAhead: 16, fov: 60 },
      mobile: { height: 4.9, back: 11.4, targetX: 0, targetY: 1.12, lookAhead: 14, fov: 60 },
    },
    composition: centeredComposition(1.08),
    background: '#78968a',
    fog: { color: '#91aa98', near: 76, far: 184 },
  },
  {
    name: 'Vegetable Garden',
    rootOffset: [0, 0.02, 6.1],
    rootRotation: [Math.PI, 0, 0],
    rootScale: 2.5,
    opacity: { desktop: 1, mobileHigh: 0.98, mobileSafe: 0.96 },
    camera: {
      desktop: { height: 4.55, back: 10.7, targetX: 0, targetY: 1.08, lookAhead: 16, fov: 59 },
      mobile: { height: 5, back: 11.7, targetX: 0, targetY: 1.15, lookAhead: 14, fov: 59 },
    },
    composition: centeredComposition(1.12, 0.42, 0.4),
    background: '#6f9380',
    fog: { color: '#84a48d', near: 72, far: 172 },
  },
  {
    name: 'Sprinkler Sprint',
    rootOffset: [-0.25, 0.015, 4.2],
    rootRotation: [Math.PI, 0, 0],
    rootScale: 2.5,
    opacity: { desktop: 1, mobileHigh: 0.98, mobileSafe: 0.96 },
    camera: {
      desktop: { height: 4.5, back: 10.5, targetX: -0.03, targetY: 1.08, lookAhead: 16.5, fov: 60 },
      mobile: { height: 4.95, back: 11.5, targetX: -0.02, targetY: 1.15, lookAhead: 14.5, fov: 60 },
    },
    composition: centeredComposition(1.08),
    background: '#789c91',
    fog: { color: '#8eaaa0', near: 76, far: 180 },
  },
  {
    name: 'Patio Panic',
    rootOffset: [0.2, 0.02, 5.2],
    rootRotation: [Math.PI, 0, 0],
    rootScale: 2.5,
    opacity: { desktop: 1, mobileHigh: 0.98, mobileSafe: 0.96 },
    camera: {
      desktop: { height: 4.6, back: 10.8, targetX: 0.03, targetY: 1.12, lookAhead: 15.5, fov: 59 },
      mobile: { height: 5.05, back: 11.8, targetX: 0.02, targetY: 1.18, lookAhead: 13.5, fov: 59 },
    },
    composition: centeredComposition(1.05, 0.42, 0.4),
    background: '#819586',
    fog: { color: '#a0aa91', near: 74, far: 174 },
  },
  {
    name: 'Fence Finale',
    rootOffset: [0, 0.015, 4.8],
    rootRotation: [Math.PI, 0, 0],
    rootScale: 2.5,
    opacity: { desktop: 1, mobileHigh: 0.98, mobileSafe: 0.96 },
    camera: {
      desktop: { height: 4.5, back: 10.5, targetX: 0, targetY: 1.08, lookAhead: 17, fov: 60 },
      mobile: { height: 4.95, back: 11.5, targetX: 0, targetY: 1.15, lookAhead: 15, fov: 60 },
    },
    composition: centeredComposition(1.14, 0.42, 0.4),
    background: '#708d78',
    fog: { color: '#899c7e', near: 78, far: 184 },
  },
] as const;

export function getWorldPresentationProfile(sequence: number): WorldPresentationProfile {
  const index = ((sequence % WORLD_PRESENTATION_PROFILES.length) + WORLD_PRESENTATION_PROFILES.length)
    % WORLD_PRESENTATION_PROFILES.length;
  return WORLD_PRESENTATION_PROFILES[index] ?? WORLD_PRESENTATION_PROFILES[0];
}
