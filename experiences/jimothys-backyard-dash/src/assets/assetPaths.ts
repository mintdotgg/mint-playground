import { runtimeAssetUrl } from './runtimeAssets';

const MODEL_ASSET_GROUPS: Record<string, string> = {
  'hero-jimothy': 'hero-jimothy',
  'rival-maple': 'rival-roster',
  'rival-tank': 'rival-roster',
  'coiled-hose': 'backyard-obstacles',
  'watering-can': 'backyard-obstacles',
  'raised-planter': 'backyard-obstacles',
  'tomato-cage': 'backyard-obstacles',
  'patio-chair': 'backyard-obstacles',
  'wheelbarrow': 'backyard-obstacles',
  'pool-toy': 'backyard-obstacles',
  'folded-umbrella': 'backyard-obstacles',
  'recycle-bin': 'backyard-obstacles',
  'garden-gate': 'backyard-obstacles',
  'sprinkler-head': 'backyard-obstacles',
  'laundry-basket': 'backyard-obstacles',
  'garden-shed': 'backyard-obstacles',
  'finish-line': 'backyard-obstacles',
  'moon-token': 'backyard-rewards',
  'cardboard-shield': 'backyard-rewards',
  'garden-glove-magnet': 'backyard-rewards',
  'dew-drop-boost': 'backyard-rewards',
};

const AUDIO_KEYS = [
  'finish-sound',
  'boost-sound',
  'backyard-ambience',
  'powerup-sound',
  'backyard-music',
  'paw-step-sound',
  'pickup-sound',
  'collision-sound',
  'start-sound',
  'results-sound',
  'final-section-sound',
  'countdown-sound',
] as const;

function modelPaths(tier: 'desktop' | 'mobile'): Record<string, string> {
  return Object.fromEntries(
    Object.entries(MODEL_ASSET_GROUPS).map(([modelKey, assetKey]) => [
      modelKey,
      runtimeAssetUrl(assetKey, `${modelKey}-${tier}`),
    ]),
  );
}

export const MODEL_PATHS = modelPaths('desktop');
export const MOBILE_MODEL_PATHS = modelPaths('mobile');
export const AUDIO_PATHS: Record<string, string> = Object.fromEntries(
  AUDIO_KEYS.map((key) => [key, runtimeAssetUrl(key, 'audio')]),
);
