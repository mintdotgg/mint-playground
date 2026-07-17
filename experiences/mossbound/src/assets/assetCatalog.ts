import registryJson from '../../mint-assets.json';

export const MODEL_KEYS = [
  'sproutling', 'sporecap', 'brambleback', 'moonhare', 'rootlurker', 'pollenWisp', 'barkKnight', 'rotToad', 'stonehorn', 'thornheart',
  'tallRuneMonolith', 'brokenRuneMonolith', 'mossyStoneArchway', 'collapsedArchHalf', 'intactSquarePillar', 'brokenPillarStump', 'lowRuinedWall', 'cornerRuinedWall', 'stoneStairFlight', 'smallStoneFootbridge', 'moonwellShrineBasin', 'ancientRewardChest', 'runeBrazier', 'carvedStonePlinth', 'weatheredWaystone', 'thornheartArenaAltar',
  'ancientBroadOak', 'twistedRootTree', 'youngBirchCluster', 'fallenMossyLog', 'hollowStump', 'redBerryBush', 'blueFlowerBush', 'fernClump', 'tallGrassClump', 'whiteDaisyPatch', 'orangeWildflowerPatch', 'purpleMushroomCluster', 'redMushroomCluster', 'hangingVineCurtain', 'mossyBoulderCluster', 'crystalFlowerCluster',
  'runeIronSword', 'firstPersonSwordHand', 'thornwoodBuckler', 'goldenSapCoin', 'spiritMoteCrystal', 'healingBloom', 'staminaLeafCharm', 'upgradeShrineObelisk', 'sporeProjectilePod', 'rootSpikeTrap',
] as const;

export type ModelKey = (typeof MODEL_KEYS)[number];

export const AUDIO_KEYS = [
  'swordSlashLight', 'swordSlashHeavy', 'creatureImpact', 'stoneImpact', 'enemyAlert', 'enemyHurt', 'playerDamage', 'coinPickup', 'xpPickup', 'levelUp', 'forestLoop', 'bossLoop',
] as const;

export type AudioKey = (typeof AUDIO_KEYS)[number];

type RegistryArtifact = {
  role: string;
  filename: string;
  runtimeUrl: string;
};

type Registry = {
  assets: Record<string, { artifacts: Record<string, RegistryArtifact> }>;
};

const registry = registryJson as unknown as Registry;

function artifactUrl(artifact: RegistryArtifact | undefined): string {
  return artifact?.runtimeUrl ?? '';
}

function modelUrl(packKey: string, filenameSlug: string): string {
  const artifacts = Object.values(registry.assets[packKey]?.artifacts ?? {});
  const artifact = artifacts.find((candidate) => candidate.role === 'canonical_model' && candidate.filename.toLowerCase().startsWith(`${filenameSlug}-`));
  return artifactUrl(artifact);
}

function audioUrl(key: string): string {
  const artifacts = Object.values(registry.assets[key]?.artifacts ?? {});
  const artifact = artifacts.find((candidate) => candidate.role === 'audio');
  return artifactUrl(artifact);
}

export const MINT_MODEL_URLS: Record<ModelKey, string> = {
  sproutling: modelUrl('pack-creatures', 'sproutling'),
  sporecap: modelUrl('pack-creatures', 'sporecap'),
  brambleback: modelUrl('pack-creatures', 'brambleback'),
  moonhare: modelUrl('pack-creatures', 'moonhare'),
  rootlurker: modelUrl('pack-creatures', 'rootlurker'),
  pollenWisp: modelUrl('pack-creatures', 'pollen-wisp'),
  barkKnight: modelUrl('pack-creatures', 'bark-knight'),
  rotToad: modelUrl('pack-creatures', 'rot-toad'),
  stonehorn: modelUrl('pack-creatures', 'stonehorn'),
  thornheart: modelUrl('pack-creatures', 'thornheart'),
  tallRuneMonolith: modelUrl('pack-ruins', 'tall-rune-monolith'),
  brokenRuneMonolith: modelUrl('pack-ruins', 'broken-rune-monolith'),
  mossyStoneArchway: modelUrl('pack-ruins', 'mossy-stone-archway'),
  collapsedArchHalf: modelUrl('pack-ruins', 'collapsed-arch-half'),
  intactSquarePillar: modelUrl('pack-ruins', 'intact-square-pillar'),
  brokenPillarStump: modelUrl('pack-ruins', 'broken-pillar-stump'),
  lowRuinedWall: modelUrl('pack-ruins', 'low-ruined-wall'),
  cornerRuinedWall: modelUrl('pack-ruins', 'corner-ruined-wall'),
  stoneStairFlight: modelUrl('pack-ruins', 'stone-stair-flight'),
  smallStoneFootbridge: modelUrl('pack-ruins', 'small-stone-footbridge'),
  moonwellShrineBasin: modelUrl('pack-ruins', 'moonwell-shrine-basin'),
  ancientRewardChest: modelUrl('pack-ruins', 'ancient-reward-chest'),
  runeBrazier: modelUrl('pack-ruins', 'rune-brazier'),
  carvedStonePlinth: modelUrl('pack-ruins', 'carved-stone-plinth'),
  weatheredWaystone: modelUrl('pack-ruins', 'weathered-waystone'),
  thornheartArenaAltar: modelUrl('pack-ruins', 'thornheart-arena-altar'),
  ancientBroadOak: modelUrl('pack-vegetation', 'ancient-broad-oak'),
  twistedRootTree: modelUrl('pack-vegetation', 'twisted-root-tree'),
  youngBirchCluster: modelUrl('pack-vegetation', 'young-birch-cluster'),
  fallenMossyLog: modelUrl('pack-vegetation', 'fallen-mossy-log'),
  hollowStump: modelUrl('pack-vegetation', 'hollow-stump'),
  redBerryBush: modelUrl('pack-vegetation', 'red-berry-bush'),
  blueFlowerBush: modelUrl('pack-vegetation', 'blue-flower-bush'),
  fernClump: modelUrl('pack-vegetation', 'fern-clump'),
  tallGrassClump: modelUrl('pack-vegetation', 'tall-grass-clump'),
  whiteDaisyPatch: modelUrl('pack-vegetation', 'white-daisy-patch'),
  orangeWildflowerPatch: modelUrl('pack-vegetation', 'orange-wildflower-patch'),
  purpleMushroomCluster: modelUrl('pack-vegetation', 'purple-mushroom-cluster'),
  redMushroomCluster: modelUrl('pack-vegetation', 'red-mushroom-cluster'),
  hangingVineCurtain: modelUrl('pack-vegetation', 'hanging-vine-curtain'),
  mossyBoulderCluster: modelUrl('pack-vegetation', 'mossy-boulder-cluster'),
  crystalFlowerCluster: modelUrl('pack-vegetation', 'crystal-flower-cluster'),
  runeIronSword: modelUrl('pack-gameplay', 'rune-iron-sword'),
  firstPersonSwordHand: modelUrl('first-person-sword-hand', 'blue-cuff-gauntlet-grip'),
  thornwoodBuckler: modelUrl('pack-gameplay', 'thornwood-buckler'),
  goldenSapCoin: modelUrl('pack-gameplay', 'golden-sap-coin'),
  spiritMoteCrystal: modelUrl('pack-gameplay', 'spirit-mote-crystal'),
  healingBloom: modelUrl('pack-gameplay', 'healing-bloom'),
  staminaLeafCharm: modelUrl('pack-gameplay', 'stamina-leaf-charm'),
  upgradeShrineObelisk: modelUrl('pack-gameplay', 'upgrade-shrine-obelisk'),
  sporeProjectilePod: modelUrl('pack-gameplay', 'spore-projectile-pod'),
  rootSpikeTrap: modelUrl('pack-gameplay', 'root-spike-trap'),
};

export const MINT_AUDIO_URLS: Record<AudioKey, string> = {
  swordSlashLight: audioUrl('audio-sword-slash-light'),
  swordSlashHeavy: audioUrl('audio-sword-slash-heavy'),
  creatureImpact: audioUrl('audio-creature-impact'),
  stoneImpact: audioUrl('audio-stone-impact'),
  enemyAlert: audioUrl('audio-enemy-alert'),
  enemyHurt: audioUrl('audio-enemy-hurt'),
  playerDamage: audioUrl('audio-player-damage'),
  coinPickup: audioUrl('audio-coin-pickup'),
  xpPickup: audioUrl('audio-xp-pickup'),
  levelUp: audioUrl('audio-level-up'),
  forestLoop: audioUrl('audio-forest-loop'),
  bossLoop: audioUrl('audio-boss-loop'),
};
