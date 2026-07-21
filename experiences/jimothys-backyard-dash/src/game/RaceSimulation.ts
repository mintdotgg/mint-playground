import { buildCourse } from '../course/CourseBuilder';
import type {
  CourseDefinition,
  CourseEntity,
  GameMode,
  GamePhase,
  Lane,
  RaceEvent,
  RaceIntent,
  RaceResult,
  RaceSnapshot,
  RacerId,
  RacerState,
} from './types';

const FIXED_DT = 1 / 60;
const JUMP_DURATION = 0.82;
const SCUTTLE_DURATION = 0.68;
const LANE_RESPONSE = 18;
const PACE_INCREASE_PER_SECOND = 0.01;
const STORAGE_BEST = 'jimothys-backyard-dash-best-time';
const STORAGE_PICKUPS = 'jimothys-backyard-dash-pickup-record';

type RivalProfile = {
  id: Exclude<RacerId, 'jimothy'>;
  name: string;
  baseSpeed: number;
  lane: Lane;
  skill: number;
  risk: number;
};

const RIVAL_PROFILES: RivalProfile[] = [
  { id: 'maple', name: 'Maple', baseSpeed: 10.28, lane: -1, skill: 0.9, risk: 0.88 },
  { id: 'tank', name: 'Tank', baseSpeed: 9.94, lane: 1, skill: 0.84, risk: 0.35 },
];

type PlayerExtras = {
  tokens: number;
  score: number;
  combo: number;
  mischief: number;
  badges: number;
  shield: boolean;
  magnetTimer: number;
  softSlowTimer: number;
  invulnerableTimer: number;
};

function laneClamp(value: number): Lane {
  return Math.max(-1, Math.min(1, value)) as Lane;
}

function readNumber(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeNumber(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Private browsing and embedded contexts may reject storage.
  }
}

export class RaceSimulation {
  readonly fixedDt = FIXED_DT;
  readonly paceIncreasePerSecond = PACE_INCREASE_PER_SECOND;
  course: CourseDefinition;

  private mode: GameMode = 'race';
  private phase: GamePhase = 'menu';
  private previousPhase: GamePhase = 'menu';
  private countdown = 3.05;
  private elapsed = 0;
  private accumulator = 0;
  private sectionIndex = 0;
  private sectionSequence = 0;
  private lastCountdownWhole = 4;
  private lastPosition = 3;
  private result: RaceResult | null = null;
  private reducedMotion = false;
  private readonly events: RaceEvent[] = [];
  private readonly bufferedIntents = new Map<RaceIntent, number>();
  private readonly handledPlayer = new Set<string>();
  private readonly collected = new Set<string>();
  private readonly rivalHandled = new Map<RacerId, Set<string>>();
  private readonly splits: number[] = [];

  private player: RacerState;
  private rivals: RacerState[];
  private playerExtras: PlayerExtras;

  constructor(seed = 731) {
    this.course = buildCourse(seed);
    this.player = this.createPlayer();
    this.rivals = this.createRivals();
    this.playerExtras = this.createPlayerExtras();
    for (const rival of this.rivals) this.rivalHandled.set(rival.id, new Set());
  }

  get snapshot(): RaceSnapshot {
    const position = this.calculatePosition();
    const courseProgress = this.mode === 'endless'
      ? (this.player.distance % this.course.length) / this.course.length
      : Math.min(1, this.player.distance / this.course.length);
    return {
      mode: this.mode,
      phase: this.phase,
      countdown: Math.max(0, Math.ceil(this.countdown)),
      elapsed: this.elapsed,
      courseLength: this.course.length,
      sectionIndex: this.sectionIndex,
      sectionName: this.course.sections[this.sectionIndex]?.name ?? this.course.sections.at(-1)?.name ?? '',
      position,
      progress: courseProgress,
      lap: Math.floor(this.player.distance / this.course.length) + 1,
      speedMultiplier: this.currentSpeedMultiplier(),
      tokens: this.playerExtras.tokens,
      combo: this.playerExtras.combo,
      score: this.playerExtras.score,
      mischief: this.playerExtras.mischief,
      badges: this.playerExtras.badges,
      shield: this.playerExtras.shield,
      magnetTime: this.playerExtras.magnetTimer,
      boostTime: this.player.boostTimer,
      reducedMotion: this.reducedMotion,
      racers: [this.player, ...this.rivals].map((racer) => ({ ...racer })),
      result: this.result ? { ...this.result, splits: [...this.result.splits] } : null,
    };
  }

  startRace(mode: GameMode = 'race'): void {
    this.mode = mode;
    this.resetInternal(this.course.seed);
    this.setPhase('countdown');
    this.events.push({ type: 'countdown', value: 3 });
  }

  restart(): void {
    this.setPhase('restarting');
    this.resetInternal(this.course.seed);
    this.setPhase('countdown');
  }

  goToMenu(): void {
    this.resetInternal(this.course.seed);
    this.setPhase('menu');
  }

  togglePause(): void {
    if (this.phase === 'racing' || this.phase === 'countdown') {
      this.previousPhase = this.phase;
      this.setPhase('paused');
    } else if (this.phase === 'paused') {
      this.setPhase(this.previousPhase === 'countdown' ? 'countdown' : 'racing');
    }
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
  }

  seed(value: number): void {
    this.course = buildCourse(value);
    this.resetInternal(value);
  }

  debugSetState(name: string): void {
    this.resetInternal(this.course.seed);
    if (name === 'active-play') {
      this.player.distance = 84;
      this.elapsed = 6.5;
      this.setPhase('racing');
      return;
    }
    if (name === 'late-play') {
      this.player.distance = this.course.length * 0.8;
      this.rivals.forEach((rival, index) => { rival.distance = this.player.distance - 2.4 + index * 1.6; });
      this.elapsed = 68;
      this.setPhase('racing');
      return;
    }
    if (name === 'section-transition') {
      const boundary = this.course.sections[1]?.start ?? this.course.length / this.course.sections.length;
      this.player.distance = boundary - 9;
      this.rivals.forEach((rival, index) => { rival.distance = this.player.distance - 2.4 + index * 1.6; });
      this.elapsed = 18;
      this.playerExtras.invulnerableTimer = 8;
      this.setPhase('racing');
      return;
    }
    if (name === 'garden-play') {
      const boundary = this.course.sections[1]?.start ?? this.course.length / this.course.sections.length;
      this.player.distance = boundary + 12;
      this.rivals.forEach((rival, index) => { rival.distance = this.player.distance - 2.4 + index * 1.6; });
      this.elapsed = 20;
      this.playerExtras.invulnerableTimer = 8;
      this.setPhase('racing');
      return;
    }
    if (name === 'endless-lap') {
      this.mode = 'endless';
      this.player.distance = this.course.length - 3;
      this.rivals.forEach((rival, index) => { rival.distance = this.player.distance - 2.4 + index * 1.6; });
      this.elapsed = 24;
      this.setPhase('racing');
      return;
    }
    if (name === 'complete') {
      this.elapsed = 101.4;
      this.player.distance = this.course.length;
      this.setPhase('racing');
      this.finishRace();
      return;
    }
    if (name === 'failed') {
      this.elapsed = 68;
      this.playerExtras.badges = 0;
      this.setPhase('failed');
      return;
    }
    this.setPhase('menu');
  }

  debugSetDistance(distance: number): void {
    this.mode = 'race';
    this.resetInternal(this.course.seed);
    const maximum = this.mode === 'race' ? this.course.length - 0.01 : Number.POSITIVE_INFINITY;
    this.player.distance = Math.max(0, Math.min(maximum, distance));
    this.rivals.forEach((rival, index) => {
      rival.distance = this.player.distance - 2.4 + index * 1.6;
    });
    const sectionLength = this.course.length / this.course.sections.length;
    this.sectionSequence = Math.max(0, Math.floor(this.player.distance / sectionLength));
    this.sectionIndex = this.sectionSequence % this.course.sections.length;
    this.elapsed = this.player.distance / Math.max(1, this.player.baseSpeed);
    this.playerExtras.invulnerableTimer = 60;
    this.setPhase('racing');
  }

  queueIntent(intent: RaceIntent): void {
    if (intent === 'pause') {
      this.togglePause();
      return;
    }
    this.bufferedIntents.set(intent, 0.14);
  }

  update(realDelta: number): void {
    if (this.phase === 'paused' || this.phase === 'menu' || this.phase === 'loading' || this.phase === 'boot' || this.phase === 'finished' || this.phase === 'failed') return;
    this.accumulator += Math.min(realDelta, 0.1);
    while (this.accumulator >= FIXED_DT) {
      this.step(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }
  }

  drainEvents(): RaceEvent[] {
    return this.events.splice(0, this.events.length);
  }

  getActiveEntities(back = 18, ahead = 145): CourseEntity[] {
    const min = this.player.distance - back;
    const max = this.player.distance + ahead;
    return this.getCourseEntitiesBetween(min, max).filter((entity) => !this.collected.has(entity.id));
  }

  private step(dt: number): void {
    this.ageInputBuffers(dt);
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      const whole = Math.ceil(this.countdown);
      if (whole > 0 && whole < this.lastCountdownWhole) {
        this.lastCountdownWhole = whole;
        this.events.push({ type: 'countdown', value: whole });
      }
      if (this.countdown <= 0) {
        this.setPhase('racing');
        this.events.push({ type: 'go' });
      }
      return;
    }
    if (this.phase !== 'racing') return;

    const closeFinish = this.mode === 'race' && this.player.distance > this.course.length - 14 && this.rivals.some((rival) => Math.abs(rival.distance - this.player.distance) < 3.2);
    if (closeFinish && !this.reducedMotion) dt *= 0.55;

    this.elapsed += dt;
    this.consumePlayerIntents();
    this.updateTimers(this.player, dt);
    this.playerExtras.magnetTimer = Math.max(0, this.playerExtras.magnetTimer - dt);
    this.playerExtras.softSlowTimer = Math.max(0, this.playerExtras.softSlowTimer - dt);
    this.playerExtras.invulnerableTimer = Math.max(0, this.playerExtras.invulnerableTimer - dt);

    const boostMultiplier = this.player.boostTimer > 0 ? 1.52 : 1;
    const slowMultiplier = this.playerExtras.softSlowTimer > 0 ? 0.76 : 1;
    const targetSpeed = this.player.baseSpeed * this.currentSpeedMultiplier() * boostMultiplier * slowMultiplier;
    const recovery = 1 - Math.exp(-dt * 2.8);
    this.player.speed += (targetSpeed - this.player.speed) * recovery;
    this.player.distance += this.player.speed * dt;
    this.updateVisualLane(this.player, dt);
    this.handlePlayerEntities();

    for (const rival of this.rivals) this.updateRival(rival, dt);
    this.updateSection();
    this.updatePosition();

    if (this.mode === 'race' && this.player.distance >= this.course.length) this.finishRace();
  }

  private consumePlayerIntents(): void {
    if (this.takeIntent('left')) {
      const before = this.player.lane;
      this.player.lane = laneClamp(this.player.lane - 1);
      if (before !== this.player.lane) this.events.push({ type: 'lane', direction: -1 });
    }
    if (this.takeIntent('right')) {
      const before = this.player.lane;
      this.player.lane = laneClamp(this.player.lane + 1);
      if (before !== this.player.lane) this.events.push({ type: 'lane', direction: 1 });
    }
    if (this.takeIntent('jump') && this.player.jumpTimer <= 0.08) {
      this.player.jumpTimer = JUMP_DURATION;
      this.player.scuttleTimer = 0;
      this.events.push({ type: 'jump' });
    }
    if (this.takeIntent('scuttle') && this.player.jumpTimer <= 0.08) {
      this.player.scuttleTimer = SCUTTLE_DURATION;
      this.events.push({ type: 'scuttle' });
    }
    if (this.takeIntent('boost') && this.playerExtras.mischief >= 100) {
      this.playerExtras.mischief = 0;
      this.player.boostTimer = Math.max(this.player.boostTimer, 3.6);
      this.events.push({ type: 'boost' });
    }
  }

  private handlePlayerEntities(): void {
    for (const entity of this.getCourseEntitiesBetween(this.player.distance - 8, this.player.distance + 8)) {
      const delta = entity.distance - this.player.distance;
      if (delta < -2.2 || delta > 2.2) continue;

      if (entity.kind === 'token') {
        const magnetic = this.playerExtras.magnetTimer > 0 && Math.abs(entity.lane - this.player.lane) <= 1 && Math.abs(delta) < 8;
        if (!this.collected.has(entity.id) && (entity.lane === this.player.lane || magnetic)) this.collectToken(entity);
        continue;
      }
      if (entity.kind === 'powerup') {
        if (!this.collected.has(entity.id) && entity.lane === this.player.lane) this.collectPowerUp(entity);
        continue;
      }
      if (this.handledPlayer.has(entity.id) || entity.lane !== this.player.lane) continue;
      this.handledPlayer.add(entity.id);
      this.resolvePlayerObstacle(entity);
    }
  }

  private resolvePlayerObstacle(entity: CourseEntity): void {
    const type = entity.obstacleType;
    if (!type) return;
    if (type === 'soft-soil' || type === 'puddle') {
      this.playerExtras.softSlowTimer = Math.max(this.playerExtras.softSlowTimer, type === 'puddle' ? 1.2 : 1.8);
      this.events.push({ type: 'soft-slow' });
      return;
    }
    if (type === 'ramp') {
      this.player.jumpTimer = Math.max(this.player.jumpTimer, JUMP_DURATION);
      this.playerExtras.combo += 1;
      this.playerExtras.score += 80 * Math.max(1, this.playerExtras.combo);
      this.events.push({ type: 'jump' });
      return;
    }
    if (type === 'boost-strip') {
      this.player.boostTimer = Math.max(this.player.boostTimer, 2.8);
      this.events.push({ type: 'boost' });
      return;
    }

    const jumpProgress = this.player.jumpTimer / JUMP_DURATION;
    const jumpHeight = Math.sin(Math.PI * (1 - jumpProgress)) * 1.8;
    const cleared =
      (type === 'low' && jumpHeight > 0.62) ||
      (type === 'overhead' && this.player.scuttleTimer > 0.08) ||
      (type === 'sprinkler' && (jumpHeight > 0.5 || Math.sin(this.elapsed * 2.3 + entity.distance * 0.07) < -0.18));

    if (cleared) {
      this.playerExtras.combo += entity.shortcut ? 2 : 1;
      this.playerExtras.score += (entity.shortcut ? 160 : 70) * Math.max(1, this.playerExtras.combo);
      this.playerExtras.mischief = Math.min(100, this.playerExtras.mischief + (entity.shortcut ? 12 : 5));
      return;
    }
    this.collidePlayer();
  }

  private collidePlayer(): void {
    if (this.playerExtras.invulnerableTimer > 0) return;
    this.playerExtras.invulnerableTimer = 0.9;
    this.player.stumbleTimer = 0.55;
    this.player.speed = Math.max(4.8, this.player.speed * 0.52);
    this.playerExtras.combo = 0;
    const protectedHit = this.playerExtras.shield;
    if (protectedHit) this.playerExtras.shield = false;
    else this.playerExtras.badges -= 1;
    this.events.push({ type: 'collision', protected: protectedHit });
    if (this.playerExtras.badges <= 0) {
      this.setPhase('failed');
      this.events.push({ type: 'failed' });
    }
  }

  private collectToken(entity: CourseEntity): void {
    this.collected.add(entity.id);
    this.playerExtras.tokens += 1;
    this.playerExtras.combo += 1;
    this.playerExtras.score += 100 * Math.min(8, this.playerExtras.combo);
    this.playerExtras.mischief = Math.min(100, this.playerExtras.mischief + (entity.shortcut ? 9 : 6));
    this.events.push({ type: 'token', id: entity.id, amount: 1, combo: this.playerExtras.combo });
  }

  private collectPowerUp(entity: CourseEntity): void {
    this.collected.add(entity.id);
    const powerUp = entity.powerUpType;
    if (!powerUp) return;
    if (powerUp === 'shield') this.playerExtras.shield = true;
    if (powerUp === 'magnet') this.playerExtras.magnetTimer = 7;
    if (powerUp === 'dew-boost') this.player.boostTimer = Math.max(this.player.boostTimer, 4.6);
    this.playerExtras.score += 350;
    this.events.push({ type: 'powerup', powerUp });
  }

  private updateRival(rival: RacerState, dt: number): void {
    if (rival.finishTime !== null) return;
    this.updateTimers(rival, dt);
    const profile = RIVAL_PROFILES.find((item) => item.id === rival.id);
    if (!profile) return;
    const lookAhead = this.getCourseEntitiesBetween(rival.distance, rival.distance + 17)
      .filter((entity) => entity.distance > rival.distance);
    const nearestObstacle = lookAhead.find((entity) => entity.kind === 'obstacle' && entity.lane === rival.lane);
    if (nearestObstacle) this.planRivalAvoidance(rival, profile, nearestObstacle);
    else {
      const reward = lookAhead.find((entity) => entity.kind === 'token' && (entity.shortcut ? profile.risk > 0.45 : true));
      if (reward && rival.jumpTimer <= 0 && rival.scuttleTimer <= 0) rival.lane = reward.lane;
    }

    const gap = this.player.distance - rival.distance;
    const catchup = gap > 32 ? 1.03 : gap < -32 ? 0.98 : 1;
    const stumbleScale = rival.stumbleTimer > 0 ? 0.62 : 1;
    const target = rival.baseSpeed * this.currentSpeedMultiplier() * catchup * (rival.boostTimer > 0 ? 1.18 : 1) * stumbleScale;
    rival.speed += (target - rival.speed) * (1 - Math.exp(-dt * 2.2));
    rival.distance += rival.speed * dt;
    this.updateVisualLane(rival, dt);
    this.resolveRivalEntities(rival, profile);
    if (this.mode === 'race' && rival.distance >= this.course.length) rival.finishTime = this.elapsed;
  }

  private planRivalAvoidance(rival: RacerState, profile: RivalProfile, entity: CourseEntity): void {
    const distance = entity.distance - rival.distance;
    const failRoll = this.stableRoll(`${rival.id}-${entity.id}`);
    if (failRoll > profile.skill && distance < 5.2) return;
    if (entity.obstacleType === 'low' && distance < 6.2) rival.jumpTimer = JUMP_DURATION;
    else if (entity.obstacleType === 'overhead' && distance < 5.7) rival.scuttleTimer = SCUTTLE_DURATION;
    else if (entity.obstacleType === 'sprinkler' && distance < 6.4) rival.jumpTimer = JUMP_DURATION;
    else if (entity.obstacleType === 'block' && distance < 10) {
      const blocked = this.getCourseEntitiesBetween(entity.distance - 0.25, entity.distance + 0.25)
        .filter((candidate) => candidate.kind === 'obstacle' && candidate.obstacleType === 'block')
        .map((candidate) => candidate.lane);
      const choices = ([-1, 0, 1] as Lane[]).filter((lane) => !blocked.includes(lane));
      if (choices.length > 0) rival.lane = choices[Math.floor(this.stableRoll(`${entity.id}-${rival.id}-lane`) * choices.length)] ?? choices[0];
    }
  }

  private resolveRivalEntities(rival: RacerState, profile: RivalProfile): void {
    const handled = this.rivalHandled.get(rival.id);
    if (!handled) return;
    for (const entity of this.getCourseEntitiesBetween(rival.distance - 1.8, rival.distance + 1.8)) {
      if (entity.kind !== 'obstacle' || entity.lane !== rival.lane || handled.has(entity.id)) continue;
      if (Math.abs(entity.distance - rival.distance) > 1.8) continue;
      handled.add(entity.id);
      const jumpHeight = Math.sin(Math.PI * (1 - rival.jumpTimer / JUMP_DURATION)) * 1.8;
      const safe =
        entity.obstacleType === 'soft-soil' ||
        entity.obstacleType === 'puddle' ||
        entity.obstacleType === 'ramp' ||
        entity.obstacleType === 'boost-strip' ||
        (entity.obstacleType === 'low' && jumpHeight > 0.58) ||
        (entity.obstacleType === 'overhead' && rival.scuttleTimer > 0.06) ||
        (entity.obstacleType === 'sprinkler' && (jumpHeight > 0.45 || this.stableRoll(`${entity.id}-water`) < profile.skill));
      if (!safe) {
        rival.stumbleTimer = profile.id === 'tank' ? 0.38 : 0.58;
        rival.speed *= profile.id === 'tank' ? 0.74 : 0.62;
        this.events.push({ type: 'rival-collision', racer: rival.id });
      }
      if (entity.obstacleType === 'boost-strip') rival.boostTimer = 2.1;
    }
  }

  private updateSection(): void {
    const sectionLength = this.course.length / this.course.sections.length;
    const rawSequence = Math.floor(this.player.distance / sectionLength);
    const nextSequence = this.mode === 'race'
      ? Math.min(this.course.sections.length - 1, rawSequence)
      : rawSequence;
    if (nextSequence <= this.sectionSequence) return;

    for (let sequence = this.sectionSequence + 1; sequence <= nextSequence; sequence += 1) {
      const next = sequence % this.course.sections.length;
      this.sectionIndex = next;
      if (this.mode === 'race') this.splits.push(this.elapsed);
      const section = this.course.sections[next];
      this.events.push({ type: 'section', index: next, name: section.name, split: this.elapsed });
      if (this.mode === 'endless' && next === 0) {
        const lap = Math.floor(sequence / this.course.sections.length) + 1;
        this.events.push({ type: 'lap', lap });
        this.pruneEntityHistory(lap - 2);
      }
    }
    this.sectionSequence = nextSequence;
  }

  private updatePosition(): void {
    const position = this.calculatePosition();
    if (position < this.lastPosition) this.events.push({ type: 'overtake', position });
    this.lastPosition = position;
  }

  private calculatePosition(): number {
    return 1 + this.rivals.filter((rival) => rival.distance > this.player.distance || (rival.finishTime !== null && this.player.finishTime === null)).length;
  }

  private finishRace(): void {
    this.player.distance = this.course.length;
    this.player.finishTime = this.elapsed;
    const place = 1 + this.rivals.filter((rival) => rival.finishTime !== null && rival.finishTime <= this.elapsed).length;
    const previousBest = readNumber(STORAGE_BEST);
    const previousPickups = readNumber(STORAGE_PICKUPS) ?? 0;
    const bestTime = previousBest === null || this.elapsed < previousBest ? this.elapsed : previousBest;
    const pickupRecord = Math.max(previousPickups, this.playerExtras.tokens);
    writeNumber(STORAGE_BEST, bestTime);
    writeNumber(STORAGE_PICKUPS, pickupRecord);
    this.result = { place, time: this.elapsed, tokens: this.playerExtras.tokens, bestTime, pickupRecord, splits: [...this.splits, this.elapsed] };
    this.setPhase('finished');
    this.events.push({ type: 'finish', result: this.result });
  }

  private updateTimers(racer: RacerState, dt: number): void {
    racer.jumpTimer = Math.max(0, racer.jumpTimer - dt);
    racer.scuttleTimer = Math.max(0, racer.scuttleTimer - dt);
    racer.boostTimer = Math.max(0, racer.boostTimer - dt);
    racer.stumbleTimer = Math.max(0, racer.stumbleTimer - dt);
  }

  private currentSpeedMultiplier(): number {
    return 1 + this.elapsed * PACE_INCREASE_PER_SECOND;
  }

  private getCourseEntitiesBetween(min: number, max: number): CourseEntity[] {
    if (this.mode === 'race') {
      return this.course.entities.filter((entity) => entity.distance >= min && entity.distance <= max);
    }

    const firstLap = Math.max(0, Math.floor(min / this.course.length));
    const lastLap = Math.max(firstLap, Math.floor(max / this.course.length));
    const entities: CourseEntity[] = [];
    for (let lap = firstLap; lap <= lastLap; lap += 1) {
      const offset = lap * this.course.length;
      for (const entity of this.course.entities) {
        const distance = entity.distance + offset;
        if (distance < min || distance > max) continue;
        entities.push({ ...entity, id: `lap-${lap}:${entity.id}`, distance });
      }
    }
    return entities;
  }

  private pruneEntityHistory(minimumLap: number): void {
    const isStale = (id: string): boolean => {
      const match = /^lap-(\d+):/.exec(id);
      return match !== null && Number(match[1]) < minimumLap;
    };
    for (const id of this.handledPlayer) if (isStale(id)) this.handledPlayer.delete(id);
    for (const id of this.collected) if (isStale(id)) this.collected.delete(id);
    for (const handled of this.rivalHandled.values()) {
      for (const id of handled) if (isStale(id)) handled.delete(id);
    }
  }

  private updateVisualLane(racer: RacerState, dt: number): void {
    racer.visualLane += (racer.lane - racer.visualLane) * (1 - Math.exp(-LANE_RESPONSE * dt));
  }

  private ageInputBuffers(dt: number): void {
    for (const [intent, remaining] of this.bufferedIntents) {
      const next = remaining - dt;
      if (next <= 0) this.bufferedIntents.delete(intent);
      else this.bufferedIntents.set(intent, next);
    }
  }

  private takeIntent(intent: RaceIntent): boolean {
    if (!this.bufferedIntents.has(intent)) return false;
    this.bufferedIntents.delete(intent);
    return true;
  }

  private stableRoll(value: string): number {
    let hash = this.course.seed ^ 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967296;
  }

  private setPhase(phase: GamePhase): void {
    this.phase = phase;
    this.events.push({ type: 'phase', phase });
  }

  private resetInternal(seed: number): void {
    this.course = buildCourse(seed);
    this.player = this.createPlayer();
    this.rivals = this.createRivals();
    this.playerExtras = this.createPlayerExtras();
    this.countdown = 3.05;
    this.lastCountdownWhole = 3;
    this.elapsed = 0;
    this.accumulator = 0;
    this.sectionIndex = 0;
    this.sectionSequence = 0;
    this.lastPosition = 3;
    this.result = null;
    this.splits.length = 0;
    this.handledPlayer.clear();
    this.collected.clear();
    this.rivalHandled.clear();
    this.bufferedIntents.clear();
    for (const rival of this.rivals) this.rivalHandled.set(rival.id, new Set());
  }

  private createPlayer(): RacerState {
    return { id: 'jimothy', name: 'Jimothy', lane: 0, visualLane: 0, distance: 0, speed: 10.15, baseSpeed: 10.15, jumpTimer: 0, scuttleTimer: 0, boostTimer: 0, stumbleTimer: 0, finishTime: null };
  }

  private createRivals(): RacerState[] {
    return RIVAL_PROFILES.map((profile, index) => ({
      id: profile.id,
      name: profile.name,
      lane: profile.lane,
      visualLane: profile.lane,
      distance: -0.9 - index * 0.42,
      speed: profile.baseSpeed,
      baseSpeed: profile.baseSpeed,
      jumpTimer: 0,
      scuttleTimer: 0,
      boostTimer: 0,
      stumbleTimer: 0,
      finishTime: null,
    }));
  }

  private createPlayerExtras(): PlayerExtras {
    return { tokens: 0, score: 0, combo: 0, mischief: 0, badges: 3, shield: false, magnetTimer: 0, softSlowTimer: 0, invulnerableTimer: 0 };
  }
}
