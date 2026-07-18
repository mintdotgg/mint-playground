import { Matrix4, Quaternion, Vector3 } from "three";

/**
 * Mint world assets are authored Y-down. Importers apply this conversion once
 * at the source boundary; every gameplay system uses the resulting Y-up hole
 * coordinates and must not apply another axis conversion.
 */
export const MINT_SOURCE_TO_HOLE = new Matrix4().makeRotationX(Math.PI);

export type HoleRootRegistration = Readonly<{
  position: readonly [number, number, number];
  quaternion: readonly [number, number, number, number];
  scale: readonly [number, number, number];
}>;

const IDENTITY_REGISTRATION: HoleRootRegistration = {
  position: [0, 0, 0],
  quaternion: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

/**
 * One documented registration transform per hole, shared by the splat root,
 * collider bake (`mintSourceToWorldMatrix`), playable proxy, ball, tee, cup,
 * flag, and gameplay triggers.
 *
 * Finalized RAD/GLB pairs already share source registration, so every current
 * hole is identity. Do not add per-hole Y offsets here for splat-vs-collider
 * contact drift — that vertical bias is measured once and baked into the
 * playable-surface proxy. Change this table only when a rigid transform is
 * proven to apply to the entire hole together.
 */
export function getHoleRootRegistration(
  holeNumber: number,
): HoleRootRegistration {
  if (!Number.isInteger(holeNumber) || holeNumber < 1 || holeNumber > 18) {
    throw new RangeError(`Invalid hole number: ${holeNumber}`);
  }
  return IDENTITY_REGISTRATION;
}

export function holeRootMatrix(holeNumber: number): Matrix4 {
  const registration = getHoleRootRegistration(holeNumber);
  return new Matrix4().compose(
    new Vector3().fromArray(registration.position),
    new Quaternion().fromArray(registration.quaternion),
    new Vector3().fromArray(registration.scale),
  );
}

/** Source-file coordinates to the registered hole's world coordinates. */
export function mintSourceToWorldMatrix(holeNumber: number): Matrix4 {
  return holeRootMatrix(holeNumber).multiply(MINT_SOURCE_TO_HOLE);
}
