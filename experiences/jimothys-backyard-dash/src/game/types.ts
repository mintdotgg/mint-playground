export type GamePhase =
  | 'boot'
  | 'loading'
  | 'menu'
  | 'countdown'
  | 'racing'
  | 'paused'
  | 'finished'
  | 'failed'
  | 'restarting';

export type GameMode = 'race' | 'endless';

export type Lane = -1 | 0 | 1;
export type RacerId = 'jimothy' | 'maple' | 'tank';
export type Traversal = 'none' | 'jump' | 'scuttle';

export type ObstacleType =
  | 'block'
  | 'low'
  | 'overhead'
  | 'sprinkler'
  | 'soft-soil'
  | 'puddle'
  | 'ramp'
  | 'boost-strip';

export type PowerUpType = 'shield' | 'magnet' | 'dew-boost';

export type CourseEntity = {
  id: string;
  distance: number;
  lane: Lane;
  kind: 'obstacle' | 'token' | 'powerup';
  obstacleType?: ObstacleType;
  powerUpType?: PowerUpType;
  assetKey: string;
  shortcut?: boolean;
};

export type CourseSection = {
  index: number;
  name: string;
  shortName: string;
  start: number;
  end: number;
  ground: 'grass' | 'soil' | 'lawn-wet' | 'patio' | 'cedar';
  landmarkKey: string;
};

export type CourseDefinition = {
  seed: number;
  length: number;
  sections: CourseSection[];
  entities: CourseEntity[];
};

export type RacerState = {
  id: RacerId;
  name: string;
  lane: Lane;
  visualLane: number;
  distance: number;
  speed: number;
  baseSpeed: number;
  jumpTimer: number;
  scuttleTimer: number;
  boostTimer: number;
  stumbleTimer: number;
  finishTime: number | null;
};

export type RaceResult = {
  place: number;
  time: number;
  tokens: number;
  bestTime: number | null;
  pickupRecord: number;
  splits: number[];
};

export type RaceSnapshot = {
  mode: GameMode;
  phase: GamePhase;
  countdown: number;
  elapsed: number;
  courseLength: number;
  sectionIndex: number;
  sectionName: string;
  position: number;
  progress: number;
  lap: number;
  speedMultiplier: number;
  tokens: number;
  combo: number;
  score: number;
  mischief: number;
  badges: number;
  shield: boolean;
  magnetTime: number;
  boostTime: number;
  reducedMotion: boolean;
  racers: RacerState[];
  result: RaceResult | null;
};

export type RaceEvent =
  | { type: 'phase'; phase: GamePhase }
  | { type: 'countdown'; value: number }
  | { type: 'go' }
  | { type: 'lane'; direction: -1 | 1 }
  | { type: 'jump' }
  | { type: 'scuttle' }
  | { type: 'token'; id: string; amount: number; combo: number }
  | { type: 'powerup'; powerUp: PowerUpType }
  | { type: 'boost' }
  | { type: 'collision'; protected: boolean }
  | { type: 'soft-slow' }
  | { type: 'rival-collision'; racer: RacerId }
  | { type: 'overtake'; position: number }
  | { type: 'section'; index: number; name: string; split: number }
  | { type: 'lap'; lap: number }
  | { type: 'finish'; result: RaceResult }
  | { type: 'failed' };

export type RaceIntent = 'left' | 'right' | 'jump' | 'scuttle' | 'boost' | 'pause';
