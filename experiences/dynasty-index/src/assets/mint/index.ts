import runtimeManifest from './manifests/runtime-manifest.json';

export interface MintRuntimeArtifact {
  label: string;
  role: string;
  loaderHint: string;
  path: string;
}

export const mintArtifacts = runtimeManifest.artifacts as MintRuntimeArtifact[];

export function getMintArtifact(label: string): MintRuntimeArtifact {
  const artifact = mintArtifacts.find((entry) => entry.label === label);
  if (!artifact) throw new Error(`Mint artifact not found: ${label}`);
  return artifact;
}
