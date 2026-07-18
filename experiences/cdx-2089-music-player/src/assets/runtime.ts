import registryJson from '../../mint-assets.json'

type RegistryArtifact = {
  runtimeUrl?: string
}

type Registry = {
  assets: Record<string, {
    artifacts: Record<string, RegistryArtifact>
  }>
}

const registry = registryJson as unknown as Registry

export function mintRuntimeUrl(assetKey: string, artifactId: string): string {
  const runtimeUrl = registry.assets[assetKey]?.artifacts[artifactId]?.runtimeUrl
  if (!runtimeUrl) {
    throw new Error(`Missing Mint runtime URL for ${assetKey}/${artifactId}`)
  }
  return runtimeUrl
}

export const MINT_ASSET_URLS = {
  tracks: {
    orbitalDecay: mintRuntimeUrl('track-orbital-decay', 'audio_file'),
    zeroGBreaker: mintRuntimeUrl('track-zero-g-breaker', 'audio_file'),
    plasmaWake: mintRuntimeUrl('track-plasma-wake', 'audio_file'),
    hullBreach: mintRuntimeUrl('track-hull-breach', 'audio_file'),
    eventHorizon: mintRuntimeUrl('track-event-horizon', 'audio_file'),
  },
  covers: {
    orbitalDecay: mintRuntimeUrl('cover-orbital-decay', 'image_file'),
    chromeCasket: mintRuntimeUrl('cover-chrome-casket', 'image_file'),
    spliceRunner: mintRuntimeUrl('cover-splice-runner', 'image_file'),
    adrenalCircuit: mintRuntimeUrl('cover-adrenal-circuit', 'image_file'),
    neonBodega: mintRuntimeUrl('cover-neon-bodega', 'image_file'),
  },
  holoFoil: mintRuntimeUrl('texture-holo-foil', 'image_file'),
  models: {
    chassisAcrylic: mintRuntimeUrl('chassis-acrylic', 'original_glb'),
    chassisMonolith: mintRuntimeUrl('chassis-monolith', 'original_glb'),
    chassisOrbital: mintRuntimeUrl('chassis-orbital', 'original_glb'),
    rotaryKnob: mintRuntimeUrl('rotary-knob', 'original_glb'),
    gripRail: mintRuntimeUrl('grip-rail', 'original_glb'),
  },
  dancers: {
    chromePulse: mintRuntimeUrl(
      'dancer-chrome-pulse',
      'clip:w976v2dyzt6y4h2j9fneacjtw18ajskp:animation_glb',
    ),
    coralCircuit: mintRuntimeUrl(
      'dancer-coral-circuit',
      'clip:w974h57wa2x8e9c4d3sf8r94bx8ajv92:animation_glb',
    ),
    neonNight: mintRuntimeUrl(
      'dancer-neon-night',
      'clip:w97e6mes877q7ppcge54ate07n8aj5ra:animation_glb',
    ),
    signalRunner: mintRuntimeUrl(
      'dancer-signal-runner',
      'clip:w976yf8rr3ss97m483jeddr2s58akrgm:animation_glb',
    ),
  },
  dracoDecoderPath: mintRuntimeUrl('draco-runtime', 'decoder_path'),
} as const
