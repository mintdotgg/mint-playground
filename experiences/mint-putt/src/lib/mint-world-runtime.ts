import { GENERATED_MINT_WORLD_RUNTIMES } from "./mint-world-runtime.generated";

export type MintWorldRuntime = {
  holeNumber: number;
  runtimeUrl: string;
  byteSize: number;
  colliderUrl: string;
};

export const MINT_WORLD_RUNTIMES = GENERATED_MINT_WORLD_RUNTIMES;

export const ALL_COURSE_HOLES = Array.from(
  { length: 18 },
  (_, index) => index + 1,
);
export const EXACT_MINT_WORLD_HOLES = ALL_COURSE_HOLES.filter(
  (holeNumber) => Boolean(MINT_WORLD_RUNTIMES[holeNumber]),
);
export const MISSING_MINT_WORLD_HOLES = ALL_COURSE_HOLES.filter(
  (holeNumber) => !MINT_WORLD_RUNTIMES[holeNumber],
);

export function hasCompleteMintWorldRuntimeSet() {
  return MISSING_MINT_WORLD_HOLES.length === 0;
}

export function getExactMintWorldRuntime(holeNumber: number) {
  if (!Number.isInteger(holeNumber) || holeNumber < 1 || holeNumber > 18) {
    return undefined;
  }

  return MINT_WORLD_RUNTIMES[holeNumber];
}

export function getMintWorldRuntime(holeNumber: number) {
  const runtime = getExactMintWorldRuntime(holeNumber);

  if (!runtime) {
    throw new Error(`The exact Mint splat for hole ${holeNumber} is missing.`);
  }

  return {
    runtime,
    exact: true as const,
  };
}
