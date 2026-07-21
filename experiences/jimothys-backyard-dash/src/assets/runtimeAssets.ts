import registryJson from '../../mint-assets.json';

type RegistryArtifact = {
  runtimeUrl?: string;
};

type Registry = {
  assets: Record<string, { artifacts: Record<string, RegistryArtifact> }>;
};

const registry = registryJson as Registry;

export function runtimeAssetUrl(assetKey: string, artifactKey: string): string {
  const runtimeUrl = registry.assets[assetKey]?.artifacts[artifactKey]?.runtimeUrl;
  if (!runtimeUrl) {
    throw new Error(`Missing Mint runtime artifact: ${assetKey}.${artifactKey}`);
  }
  return runtimeUrl;
}
