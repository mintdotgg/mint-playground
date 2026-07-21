import { runtimeAssetUrl } from './runtimeAssets';

export type MintWorldRuntime = {
  name: string;
  runtimeUrl: string;
  colliderUrl: string;
};

function mintWorld(name: string, assetKey: string): MintWorldRuntime {
  return {
    name,
    runtimeUrl: runtimeAssetUrl(assetKey, 'runtime'),
    colliderUrl: runtimeAssetUrl(assetKey, 'collider'),
  };
}

// The browser resolves only published Mint CDN artifacts from mint-assets.json.
// Generation handles and chat provenance never enter the runtime bundle.
export const MINT_WORLDS: readonly MintWorldRuntime[] = [
  mintWorld('Dewy Lawn', 'dewy-lawn-world'),
  mintWorld('Vegetable Garden', 'vegetable-garden-world'),
  mintWorld('Sprinkler Sprint', 'sprinkler-sprint-world'),
  mintWorld('Patio Panic', 'patio-panic-world'),
  mintWorld('Fence Finale', 'fence-finale-world'),
] as const;
