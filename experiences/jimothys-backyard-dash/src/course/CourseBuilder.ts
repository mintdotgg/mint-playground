import { createSeededRandom } from '../utils/random';
import type { CourseDefinition, CourseEntity, CourseSection, Lane, ObstacleType } from '../game/types';

export const COURSE_LENGTH = 1050;
export const SECTION_LENGTH = COURSE_LENGTH / 5;

const LANES: readonly Lane[] = [-1, 0, 1];

const SECTION_DATA: Omit<CourseSection, 'index' | 'start' | 'end'>[] = [
  { name: 'Dewy Lawn', shortName: 'LAWN', ground: 'grass', landmarkKey: 'garden-shed' },
  { name: 'Vegetable Garden', shortName: 'GARDEN', ground: 'soil', landmarkKey: 'raised-planter' },
  { name: 'Sprinkler Sprint', shortName: 'SPRINT', ground: 'lawn-wet', landmarkKey: 'sprinkler-head' },
  { name: 'Patio Panic', shortName: 'PATIO', ground: 'patio', landmarkKey: 'folded-umbrella' },
  { name: 'Fence Finale', shortName: 'FINALE', ground: 'cedar', landmarkKey: 'finish-line' },
];

type PatternObstacle = {
  lane: Lane;
  type: ObstacleType;
  assetKey: string;
  offset?: number;
  shortcut?: boolean;
};

const PATTERNS: PatternObstacle[][] = [
  [
    { lane: -1, type: 'block', assetKey: 'watering-can' },
    { lane: 1, type: 'low', assetKey: 'coiled-hose' },
  ],
  [
    { lane: -1, type: 'low', assetKey: 'laundry-basket' },
    { lane: 0, type: 'block', assetKey: 'tomato-cage' },
    { lane: 1, type: 'overhead', assetKey: 'garden-gate', shortcut: true },
  ],
  [
    { lane: -1, type: 'block', assetKey: 'recycle-bin' },
    { lane: 0, type: 'block', assetKey: 'patio-chair', offset: 7 },
  ],
  [
    { lane: 0, type: 'low', assetKey: 'pool-toy' },
    { lane: 1, type: 'block', assetKey: 'wheelbarrow', offset: 7 },
  ],
  [
    { lane: -1, type: 'overhead', assetKey: 'garden-gate', shortcut: true },
    { lane: 0, type: 'low', assetKey: 'coiled-hose' },
    { lane: 1, type: 'block', assetKey: 'watering-can' },
  ],
];

function addTokenLine(entities: CourseEntity[], id: string, start: number, lane: Lane, count = 5, shortcut = false): void {
  for (let index = 0; index < count; index += 1) {
    entities.push({
      id: `${id}-token-${index}`,
      distance: start + index * 4.2,
      lane,
      kind: 'token',
      assetKey: 'moon-token',
      shortcut,
    });
  }
}

function obstacle(id: string, distance: number, lane: Lane, obstacleType: ObstacleType, assetKey: string, shortcut = false): CourseEntity {
  return { id, distance, lane, kind: 'obstacle', obstacleType, assetKey, shortcut };
}

function addSectionSpecific(section: number, start: number, entities: CourseEntity[]): void {
  if (section === 0) {
    addTokenLine(entities, 'tutorial', start + 18, 0, 4);
    entities.push(obstacle('tutorial-hose', start + 46, 0, 'low', 'coiled-hose'));
    addTokenLine(entities, 'tutorial-jump-reward', start + 50, 0, 4);
    entities.push(obstacle('lawn-gate', start + 151, -1, 'overhead', 'garden-gate', true));
    addTokenLine(entities, 'lawn-shortcut', start + 153, -1, 7, true);
  } else if (section === 1) {
    entities.push(obstacle('garden-soft-left', start + 30, -1, 'soft-soil', 'raised-planter'));
    entities.push(obstacle('garden-hedge-tunnel', start + 88, 1, 'overhead', 'garden-gate', true));
    addTokenLine(entities, 'garden-center-rich', start + 109, 0, 8, true);
    entities.push({ id: 'garden-shield', distance: start + 178, lane: -1, kind: 'powerup', powerUpType: 'shield', assetKey: 'cardboard-shield' });
  } else if (section === 2) {
    entities.push(obstacle('sprinkler-a', start + 45, 0, 'sprinkler', 'sprinkler-head'));
    entities.push(obstacle('sprinkler-puddle', start + 82, -1, 'puddle', 'sprinkler-head'));
    entities.push(obstacle('sprinkler-b', start + 118, 1, 'sprinkler', 'sprinkler-head'));
    entities.push({ id: 'sprinkler-magnet', distance: start + 154, lane: 0, kind: 'powerup', powerUpType: 'magnet', assetKey: 'garden-glove-magnet' });
  } else if (section === 3) {
    entities.push(obstacle('patio-ramp', start + 64, 1, 'ramp', 'raised-planter', true));
    addTokenLine(entities, 'patio-ramp-reward', start + 68, 1, 8, true);
    entities.push(obstacle('patio-laundry-line', start + 142, 0, 'overhead', 'garden-gate'));
    entities.push({ id: 'patio-dew', distance: start + 184, lane: -1, kind: 'powerup', powerUpType: 'dew-boost', assetKey: 'dew-drop-boost' });
  } else {
    entities.push(obstacle('finale-bin-left', start + 43, -1, 'block', 'recycle-bin'));
    entities.push(obstacle('finale-bin-right', start + 65, 1, 'block', 'recycle-bin'));
    entities.push(obstacle('finale-low', start + 96, 0, 'low', 'coiled-hose'));
    entities.push(obstacle('finale-overhead', start + 127, -1, 'overhead', 'garden-gate'));
    entities.push(obstacle('finale-boost', start + 158, 0, 'boost-strip', 'dew-drop-boost', true));
    addTokenLine(entities, 'finale-reward', start + 161, 0, 7, true);
  }
}

export function buildCourse(seed = 731): CourseDefinition {
  const rng = createSeededRandom(seed);
  const sections = SECTION_DATA.map((data, index): CourseSection => ({
    ...data,
    index,
    start: index * SECTION_LENGTH,
    end: (index + 1) * SECTION_LENGTH,
  }));
  const entities: CourseEntity[] = [];

  sections.forEach((section) => {
    addSectionSpecific(section.index, section.start, entities);
    const patternSlots = [70, 104, 136, 174];
    patternSlots.forEach((localDistance, slot) => {
      const patternIndex = Math.floor(rng() * PATTERNS.length);
      const pattern = PATTERNS[(patternIndex + section.index + slot) % PATTERNS.length];
      pattern.forEach((item, itemIndex) => {
        const distance = section.start + localDistance + (item.offset ?? 0);
        entities.push(obstacle(`s${section.index}-p${slot}-${itemIndex}`, distance, item.lane, item.type, item.assetKey, item.shortcut));
      });

      const openLane = LANES.find((lane) => !pattern.some((item) => item.lane === lane && item.type === 'block')) ?? 0;
      addTokenLine(entities, `s${section.index}-reward-${slot}`, section.start + localDistance + 9, openLane, 4, pattern.some((item) => item.shortcut));
    });
  });

  return {
    seed,
    length: COURSE_LENGTH,
    sections,
    entities: entities
      .filter((entity) => entity.distance > 0 && entity.distance < COURSE_LENGTH - 12)
      .sort((a, b) => a.distance - b.distance || a.lane - b.lane),
  };
}

export function hasValidSolutionAtDistance(entities: CourseEntity[], distance: number): boolean {
  const group = entities.filter((entity) => entity.kind === 'obstacle' && Math.abs(entity.distance - distance) < 0.2);
  return LANES.some((lane) => {
    const item = group.find((entity) => entity.lane === lane);
    return !item || item.obstacleType === 'low' || item.obstacleType === 'overhead' || item.obstacleType === 'sprinkler' || item.obstacleType === 'soft-soil' || item.obstacleType === 'puddle' || item.obstacleType === 'ramp' || item.obstacleType === 'boost-strip';
  });
}
