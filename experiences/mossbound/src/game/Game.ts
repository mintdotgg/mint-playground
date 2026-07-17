import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AssetLibrary } from '../assets/AssetLibrary';
import { AUDIO_KEYS, MODEL_KEYS } from '../assets/assetCatalog';
import { InputController } from '../core/InputController';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { Enemy, type EnemyType } from '../entities/Enemy';
import { disposePickupVisualResources, PICKUP_COLORS, Pickup, type PickupKind } from '../entities/Pickup';
import { Player, type PlayerTuning } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { AudioSystem } from '../systems/AudioSystem';
import { CollisionSystem, type CircleObstacle, type WorldBounds } from '../systems/CollisionSystem';
import { CombatTextSystem } from '../systems/CombatTextSystem';
import { Hud, type HudSnapshot, type UpgradeOption } from '../systems/Hud';
import { RenderPipeline } from '../systems/RenderPipeline';
import { VfxSystem } from '../systems/VfxSystem';
import { WeaponView } from '../systems/WeaponView';
import { WorldBuilder } from '../systems/WorldBuilder';
import { createSeededRandom } from '../utils/random';

type GameState = 'loading' | 'intro' | 'playing' | 'paused' | 'ended' | 'error';

const BASE_CAMERA_FOV = 72;
const TOTAL_MINT_ASSETS = MODEL_KEYS.length + AUDIO_KEYS.length;
const EXPLOSIVE_COST = 12;
const EXPLOSIVE_RADIUS = 7.5;
const EXPLOSIVE_MIN_DAMAGE = 32;
const EXPLOSIVE_MAX_DAMAGE = 84;

const WAVE_DEFINITIONS: readonly (readonly EnemyType[])[] = [
  ['sproutling', 'sproutling', 'sproutling', 'rootlurker'],
  ['sproutling', 'sporecap', 'sporecap', 'moonhare', 'moonhare', 'pollenWisp'],
  ['brambleback', 'brambleback', 'rootlurker', 'rootlurker', 'barkKnight', 'sporecap'],
  ['rotToad', 'rotToad', 'stonehorn', 'stonehorn', 'moonhare', 'moonhare', 'pollenWisp', 'barkKnight'],
  ['thornheart'],
];

const UPGRADES: readonly UpgradeOption[] = [
  { id: 'iron-edge', icon: '╱', label: 'IRON EDGE', description: '+7 sword damage. Clean hits end encounters faster.' },
  { id: 'sap-heart', icon: '♥', label: 'SAP HEART', description: '+25 maximum health and heal 25 immediately.' },
  { id: 'wind-step', icon: '➤', label: 'WIND STEP', description: '+12% movement speed for safer spacing.' },
  { id: 'green-breath', icon: '⌁', label: 'GREEN BREATH', description: '+20 maximum stamina and +20% regeneration.' },
  { id: 'guardian-bark', icon: '⬡', label: 'GUARDIAN BARK', description: 'Guard blocks an additional 10% of incoming damage.' },
  { id: 'crescent-reach', icon: '☾', label: 'CRESCENT REACH', description: '+0.45 meters sword reach and a wider punish window.' },
];

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly renderPipeline: RenderPipeline;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(BASE_CAMERA_FOV, 1, .08, 120);
  private readonly assets = new AssetLibrary();
  private readonly audio = new AudioSystem();
  private readonly collision = new CollisionSystem();
  private readonly input: InputController;
  private readonly hud: Hud;
  private readonly player = new Player(this.camera);
  private readonly vfx: VfxSystem;
  private readonly combatText: CombatTextSystem;
  private readonly loop: Loop;
  private readonly enemies: Enemy[] = [];
  private readonly projectiles: Projectile[] = [];
  private readonly pickups: Pickup[] = [];
  private readonly tuning: PlayerTuning = {
    walkSpeed: 5.6,
    sprintSpeed: 8.3,
    acceleration: 13,
    lookSensitivity: .0022,
    attackDuration: .46,
    attackCost: 11,
    attackDamage: 20,
  };

  private state: GameState = 'loading';
  private weaponView: WeaponView | null = null;
  private obstacles: CircleObstacle[] = [];
  private bounds: WorldBounds = { halfWidth: 24, halfDepth: 28 };
  private rng = createSeededRandom(1337);
  private wave = 1;
  private waveTransition = -1;
  private elapsed = 0;
  private frame = 0;
  private spawnSerial = 0;
  private pickupSerial = 0;
  private explosiveAttackSerial = 1_000_000;
  private attackRange = 3.05;
  private attackDot = .55;
  private hitstop = 0;
  private trauma = 0;
  private fovPunch = 0;
  private pausedForScreenshot = false;
  private reducedMotion = false;
  private assetsReady = false;
  private environmentTexture: THREE.Texture | null = null;
  private pauseTransitionAt = -Infinity;
  private boonPending = false;
  private queuedBoons = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    this.renderPipeline = new RenderPipeline(this.renderer, this.scene, this.camera);
    this.scene.add(this.camera);
    this.createEnvironment();

    this.input = new InputController(
      canvas,
      this.getElement('#touch-stick'),
      this.getElement('#touch-knob'),
      this.getButton('#slash-button'),
      this.getButton('#guard-button'),
      this.getButton('#sprint-button'),
      this.getButton('#blast-button'),
      () => this.togglePause(),
    );
    this.hud = new Hud({
      start: () => { void this.startRun(); },
      resume: () => { void this.resume(); },
      restart: () => { void this.restartRun(); },
      mute: () => this.audio.toggleMute(),
    });
    this.combatText = new CombatTextSystem(this.getElement('#combat-floaters'));
    this.vfx = new VfxSystem(this.scene);
    this.loop = new Loop((delta, loopElapsed) => this.update(delta, loopElapsed), () => this.render());
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    resizeRenderer(this.renderer, this.camera, this.renderPipeline.dprCap);
    this.renderPipeline.resize();
    this.installTestHooks();
    this.publishDiagnostics();
  }

  start(): void {
    this.loop.start();
    void this.initialize();
  }

  dispose(): void {
    this.loop.stop();
    this.input.dispose();
    this.audio.dispose();
    this.clearEntities();
    this.weaponView?.dispose();
    this.combatText.dispose();
    this.hud.hideUpgrade();
    this.vfx.dispose();
    disposePickupVisualResources();
    this.assets.dispose();
    this.environmentTexture?.dispose();
    this.renderPipeline.dispose();
    this.renderer.dispose();
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    window.__THREE_GAME_DIAGNOSTICS__ = undefined;
    window.__THREE_GAME_TEST_HOOKS__ = undefined;
  }

  private async initialize(): Promise<void> {
    let modelLoaded = 0;
    let audioLoaded = 0;
    let loadFailed = false;
    const updateProgress = (label: string) => {
      if (loadFailed) return;
      const loaded = modelLoaded + audioLoaded;
      this.hud.setLoading(loaded / TOTAL_MINT_ASSETS, 'Growing the Mossbound grove…', `${loaded}/${TOTAL_MINT_ASSETS} Mint assets ready · ${label}`);
    };
    try {
      await Promise.all([
        this.assets.loadAll(({ loaded, key }) => { modelLoaded = loaded; updateProgress(key); }),
        this.audio.prepare((loaded, _total, key) => { audioLoaded = loaded; updateProgress(key); }),
      ]);
      const world = new WorldBuilder(this.assets).build();
      this.scene.add(world.root);
      this.obstacles = world.obstacles;
      this.bounds = world.bounds;
      this.weaponView = new WeaponView(this.camera, this.assets);
      this.assetsReady = true;
      this.state = 'intro';
      this.hud.setLoading(1, 'The grove is ready', `${TOTAL_MINT_ASSETS}/${TOTAL_MINT_ASSETS} Mint assets ready`);
      window.setTimeout(() => this.hud.showIntro(), 320);
    } catch (error) {
      loadFailed = true;
      this.state = 'error';
      const message = error instanceof Error ? error.message : String(error);
      this.hud.showLoadError(message);
      console.error(error);
    }
  }

  private async startRun(): Promise<void> {
    if (!this.assetsReady) return;
    await this.audio.unlock();
    this.hud.hideIntro();
    await this.restartRun();
  }

  private async restartRun(): Promise<void> {
    if (!this.assetsReady) return;
    await this.audio.unlock();
    this.clearEntities();
    this.rng = createSeededRandom(1337);
    this.player.reset();
    this.wave = 1;
    this.waveTransition = -1;
    this.elapsed = 0;
    this.spawnSerial = 0;
    this.pickupSerial = 0;
    this.explosiveAttackSerial = 1_000_000;
    this.attackRange = 3.05;
    this.attackDot = .55;
    this.hitstop = 0;
    this.trauma = 0;
    this.fovPunch = 0;
    this.hud.hidePause();
    this.hud.hideEnd();
    this.hud.hideIntro();
    this.hud.hideUpgrade();
    this.boonPending = false;
    this.queuedBoons = 0;
    this.spawnWave(1);
    this.audio.playMusic('forestLoop');
    this.state = 'playing';
    this.input.requestPointerLock();
    this.updateHud();
  }

  private async resume(): Promise<void> {
    if (this.state !== 'paused') return;
    await this.audio.unlock();
    this.state = 'playing';
    this.audio.setDuck(1);
    this.hud.hidePause();
    this.input.requestPointerLock();
  }

  private pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.pauseTransitionAt = performance.now();
    this.audio.setDuck(.42);
    if (this.input.isPointerLocked) document.exitPointerLock();
    this.hud.showPause();
  }

  private togglePause(): void {
    if (this.state === 'playing') {
      this.pause();
      return;
    }
    if (this.state === 'paused' && performance.now() - this.pauseTransitionAt > 180) void this.resume();
  }

  private update(delta: number, loopElapsed: number): void {
    this.frame += 1;
    if (resizeRenderer(this.renderer, this.camera, this.renderPipeline.dprCap)) this.renderPipeline.resize();
    if (this.pausedForScreenshot || this.state !== 'playing') {
      this.publishDiagnostics();
      return;
    }

    this.elapsed += delta;
    this.hitstop = Math.max(0, this.hitstop - delta);
    this.audio.setDuck(this.hitstop > 0 ? .66 : 1);
    const gameDelta = delta * (this.hitstop > 0 ? .05 : 1);
    const playerUpdate = this.player.update(gameDelta, this.input, this.tuning, this.collision, this.bounds, this.obstacles);
    if (this.input.consumeExplosive()) this.tryExplosive();

    if (playerUpdate.attackStarted) {
      const heavy = this.player.combo >= 4;
      this.audio.play(heavy ? 'swordSlashHeavy' : 'swordSlashLight', this.rng, heavy ? .9 : .72);
      this.fovPunch = Math.max(this.fovPunch, heavy ? 3.3 : 1.8);
    }
    if (playerUpdate.attackActive) this.resolveSwordHits();
    this.weaponView?.update(delta, this.player.attackProgress(this.tuning.attackDuration), this.player.guarding, this.player.velocity.length());
    this.hud.setSprinting(playerUpdate.sprinting);

    this.updateEnemies(gameDelta, this.reducedMotion ? 0 : loopElapsed);
    this.updateProjectiles(gameDelta);
    this.updatePickups(gameDelta, this.reducedMotion ? 0 : loopElapsed);
    this.updateWaveFlow(gameDelta);
    this.vfx.update(delta, this.elapsed);
    this.combatText.update(delta, this.camera, this.canvas);
    this.updateCameraEffects(delta, loopElapsed, playerUpdate.sprinting);
    this.updateHud();
    this.publishDiagnostics();
  }

  private updateEnemies(delta: number, elapsed: number): void {
    for (const enemy of this.enemies) {
      const events = enemy.update(delta, elapsed, this.player.position);
      if (enemy.alive) {
        enemy.group.position.x = THREE.MathUtils.clamp(enemy.group.position.x, -this.bounds.halfWidth + enemy.radius, this.bounds.halfWidth - enemy.radius);
        enemy.group.position.z = THREE.MathUtils.clamp(enemy.group.position.z, -this.bounds.halfDepth + enemy.radius, this.bounds.halfDepth - enemy.radius);
      }
      for (const event of events) {
        if (event.type === 'alert') {
          this.audio.play('enemyAlert', this.rng, .42, .1);
        } else if (event.type === 'melee') {
          this.damagePlayer(event.damage, event.enemy.group.position);
        } else {
          const projectile = new Projectile(this.assets, event.origin, event.direction, event.speed, event.damage);
          this.projectiles.push(projectile);
          this.scene.add(projectile.group);
        }
      }
    }

    for (let left = 0; left < this.enemies.length; left += 1) {
      for (let right = left + 1; right < this.enemies.length; right += 1) this.enemies[right].separateFrom(this.enemies[left]);
    }

    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index];
      if (!enemy.canRemove()) continue;
      this.scene.remove(enemy.group);
      enemy.dispose();
      this.enemies.splice(index, 1);
    }
  }

  private updateProjectiles(delta: number): void {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      const status = projectile.update(delta, this.player.position);
      if (status === 'hit') this.damagePlayer(projectile.damage, projectile.group.position);
      if (status === 'active') continue;
      if (status === 'hit') this.vfx.burst(projectile.group.position, '#b388ff', 7, 2.2);
      this.scene.remove(projectile.group);
      this.projectiles.splice(index, 1);
    }
  }

  private updatePickups(delta: number, elapsed: number): void {
    for (let index = this.pickups.length - 1; index >= 0; index -= 1) {
      const pickup = this.pickups[index];
      const collected = pickup.update(delta, elapsed, this.player.position);
      if (collected) this.collectPickup(pickup);
      if (!pickup.canRemove()) continue;
      this.scene.remove(pickup.group);
      pickup.dispose();
      this.pickups.splice(index, 1);
    }
  }

  private resolveSwordHits(): void {
    const horizontalForward = this.player.forward.clone().setY(0).normalize();
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const toEnemy = enemy.group.position.clone().sub(this.player.position);
      toEnemy.y = 0;
      const distance = toEnemy.length();
      if (distance > this.attackRange + enemy.radius || distance < .001) continue;
      toEnemy.multiplyScalar(1 / distance);
      if (horizontalForward.dot(toEnemy) < this.attackDot) continue;
      const comboBonus = 1 + Math.min(10, this.player.combo) * .025;
      const damage = this.player.stats.attackDamage * comboBonus;
      const result = enemy.hit(damage, this.player.attackId, toEnemy);
      if (!result.applied) continue;
      this.player.registerHit();
      this.hitstop = result.killed ? .085 : .055;
      this.trauma = Math.min(1, this.trauma + (result.killed ? .34 : .22));
      this.fovPunch = Math.max(this.fovPunch, result.killed ? 4 : 2.2);
      this.audio.play('creatureImpact', this.rng, result.killed ? .9 : .7, .08);
      this.audio.play('enemyHurt', this.rng, .38, .12);
      this.hud.flashHit();
      const impact = enemy.group.position.clone().add(new THREE.Vector3(0, enemy.config.height * .55, 0));
      this.combatText.show(impact, `-${Math.round(damage)}`, result.killed ? 'kill' : 'damage');
      if (result.killed) {
        this.hud.flashKill();
        this.vfx.deathBurst(impact, '#ffc94f');
        this.dropRewards(enemy);
      } else {
        this.vfx.burst(impact, '#4cecff', 10, 3);
        this.vfx.shockwave(enemy.group.position, '#4cecff', 1.15);
      }
    }
  }

  private tryExplosive(): void {
    if (this.player.coins < EXPLOSIVE_COST) {
      this.hud.banner(`NEED ${EXPLOSIVE_COST} COINS FOR GROVE BLAST`, 950);
      return;
    }

    const targets = this.enemies.filter((enemy) => {
      if (!enemy.alive) return false;
      const offset = enemy.group.position.clone().sub(this.player.position).setY(0);
      return offset.length() <= EXPLOSIVE_RADIUS + enemy.radius;
    });
    if (targets.length === 0) {
      this.hud.banner('NO CREATURES IN BLAST RANGE', 850);
      return;
    }

    this.player.coins -= EXPLOSIVE_COST;
    const attackId = this.explosiveAttackSerial++;
    let hitCount = 0;
    let killCount = 0;

    for (const enemy of targets) {
      const direction = enemy.group.position.clone().sub(this.player.position).setY(0);
      const distance = direction.length();
      if (distance > .001) direction.multiplyScalar(1 / distance);
      else direction.copy(this.player.forward).setY(0).normalize();
      const proximity = THREE.MathUtils.clamp(1 - distance / EXPLOSIVE_RADIUS, 0, 1);
      const damage = THREE.MathUtils.lerp(EXPLOSIVE_MIN_DAMAGE, EXPLOSIVE_MAX_DAMAGE, proximity);
      const result = enemy.hit(damage, attackId, direction);
      if (!result.applied) continue;

      hitCount += 1;
      const impact = enemy.group.position.clone().add(new THREE.Vector3(0, enemy.config.height * .5, 0));
      this.combatText.show(impact, `-${Math.round(damage)}`, result.killed ? 'kill' : 'damage');
      if (result.killed) {
        killCount += 1;
        this.vfx.deathBurst(impact, '#ffc94f');
        this.dropRewards(enemy);
      } else {
        this.vfx.burst(impact, '#fff4c9', 8, 3.8);
      }
    }

    this.vfx.radiantExplosion(this.player.position, EXPLOSIVE_RADIUS, this.reducedMotion);
    this.audio.play('stoneImpact', this.rng, 1, .04);
    this.audio.play('creatureImpact', this.rng, .82, .12);
    this.hitstop = Math.max(this.hitstop, .1);
    this.trauma = Math.min(1, this.trauma + .72);
    if (!this.reducedMotion) this.fovPunch = Math.max(this.fovPunch, 8);
    this.hud.flashExplosion();
    this.hud.pulseCoins();
    this.hud.banner(
      killCount > 0
        ? `GROVE BLAST · ${hitCount} HIT · ${killCount} FELLED`
        : `GROVE BLAST · ${hitCount} WEAKENED`,
      1250,
    );
  }

  private damagePlayer(amount: number, source: THREE.Vector3): void {
    const result = this.player.takeDamage(amount);
    if (result.applied <= 0) return;
    this.audio.play(result.blocked ? 'stoneImpact' : 'playerDamage', this.rng, result.blocked ? .7 : .88, .06);
    this.hud.flashDamage(result.blocked);
    this.trauma = Math.min(1, this.trauma + (result.blocked ? .2 : .46));
    this.fovPunch = Math.max(this.fovPunch, result.blocked ? 2 : 5.5);
    this.vfx.burst(this.player.position.clone().lerp(source, .35), result.blocked ? '#4cecff' : '#ff563f', result.blocked ? 6 : 11, 2.4);
    if (result.dead) this.finishRun(false);
  }

  private dropRewards(enemy: Enemy): void {
    const towardEnemy = enemy.group.position.clone().sub(this.player.position).setY(0);
    if (towardEnemy.lengthSq() < .001) towardEnemy.copy(this.player.forward).setY(0);
    towardEnemy.normalize();
    const screenRight = new THREE.Vector3(-towardEnemy.z, 0, towardEnemy.x);
    const origin = enemy.group.position.clone().addScaledVector(towardEnemy, .95);
    origin.x = THREE.MathUtils.clamp(origin.x, -this.bounds.halfWidth + 1, this.bounds.halfWidth - 1);
    origin.z = THREE.MathUtils.clamp(origin.z, -this.bounds.halfDepth + 1, this.bounds.halfDepth - 1);

    this.spawnPickup('coin', origin.clone().addScaledVector(screenRight, -.42).setY(.9), enemy.rewardCoins);
    this.spawnPickup('xp', origin.clone().addScaledVector(screenRight, .42).addScaledVector(towardEnemy, .12).setY(.94), enemy.rewardXp);
    const roll = this.rng();
    if (roll < .12) this.spawnPickup('heal', origin.clone().addScaledVector(towardEnemy, .22).setY(.88), 24);
    else if (roll < .25) this.spawnPickup('stamina', origin.clone().addScaledVector(towardEnemy, .22).setY(.88), 32);
  }

  private collectPickup(pickup: Pickup): void {
    const position = pickup.group.position.clone();
    this.vfx.shockwave(position.clone().setY(.06), PICKUP_COLORS[pickup.kind], 1.05);
    if (pickup.kind === 'coin') {
      this.player.coins += pickup.value;
      this.audio.play('coinPickup', this.rng, .66, .09);
      this.hud.pulseCoins();
      this.combatText.show(position, `+${pickup.value} COIN`, 'coin');
      this.vfx.burst(position, '#ffc94f', 9, 2.4);
    } else if (pickup.kind === 'xp') {
      const leveled = this.player.addXp(pickup.value);
      this.audio.play('xpPickup', this.rng, .58, .07);
      this.vfx.burst(position, '#4cecff', 8, 2.1);
      this.combatText.show(position, `+${pickup.value} XP`, 'xp');
      if (leveled && this.state === 'playing') this.showUpgrade();
    } else if (pickup.kind === 'heal') {
      this.player.heal(pickup.value);
      this.audio.play('levelUp', this.rng, .42, .02);
      this.vfx.burst(position, '#ff725b', 12, 2.2);
      this.combatText.show(position, `+${pickup.value} HP`, 'heal');
      this.hud.banner(`HEALED +${pickup.value}`, 800);
    } else {
      this.player.stats.stamina = Math.min(this.player.stats.maxStamina, this.player.stats.stamina + pickup.value);
      this.audio.play('xpPickup', this.rng, .45, .08);
      this.vfx.burst(position, '#b7d83e', 10, 2.2);
      this.combatText.show(position, `+${pickup.value} STAMINA`, 'xp');
      this.hud.banner(`STAMINA +${pickup.value}`, 800);
    }
  }

  private updateWaveFlow(delta: number): void {
    if (this.enemies.length > 0 || this.waveTransition >= 0) {
      if (this.waveTransition >= 0) {
        this.waveTransition -= delta;
        if (this.waveTransition <= 0) {
          this.waveTransition = -1;
          this.wave += 1;
          this.spawnWave(this.wave);
        }
      }
      return;
    }
    if (this.wave >= WAVE_DEFINITIONS.length) {
      this.finishRun(true);
      return;
    }
    this.waveTransition = 2.25;
    this.hud.banner('WAVE CLEARED', 1200);
  }

  private spawnWave(wave: number): void {
    const definition = WAVE_DEFINITIONS[wave - 1];
    const spawnPoints = [
      new THREE.Vector3(-9, 0, -9), new THREE.Vector3(9, 0, -10), new THREE.Vector3(-15, 0, 0),
      new THREE.Vector3(15, 0, -1), new THREE.Vector3(-8, 0, 15), new THREE.Vector3(8, 0, 16),
      new THREE.Vector3(-17, 0, -18), new THREE.Vector3(17, 0, -19),
    ];
    definition.forEach((type, index) => {
      const point = spawnPoints[index % spawnPoints.length].clone();
      point.x += (this.rng() - .5) * 1.5;
      point.z += (this.rng() - .5) * 1.5;
      const enemy = new Enemy(type, this.assets, point, this.spawnSerial++);
      this.enemies.push(enemy);
      this.scene.add(enemy.group);
      this.vfx.shockwave(point, wave === WAVE_DEFINITIONS.length ? '#ffc94f' : '#b7d83e', wave === WAVE_DEFINITIONS.length ? 3 : 1.35);
      this.vfx.burst(point.clone().setY(.25), wave === WAVE_DEFINITIONS.length ? '#ffc94f' : '#7ff9bf', wave === WAVE_DEFINITIONS.length ? 18 : 6, 1.8);
    });
    if (wave === WAVE_DEFINITIONS.length) {
      this.audio.playMusic('bossLoop');
      this.hud.banner('THORNHEART AWAKENS', 1800);
      this.trauma = .55;
    } else {
      this.hud.banner(`WAVE ${wave}`, 900);
    }
  }

  private spawnPickup(kind: PickupKind, position: THREE.Vector3, value: number): void {
    const pickup = new Pickup(kind, this.assets, position, value, this.pickupSerial++);
    this.pickups.push(pickup);
    this.scene.add(pickup.group);
    this.vfx.burst(position.clone().add(new THREE.Vector3(0, .16, 0)), PICKUP_COLORS[kind], 4, 1.2);
    this.vfx.shockwave(position.clone().setY(.06), PICKUP_COLORS[kind], .72);
  }

  private showUpgrade(): void {
    if (this.boonPending) {
      this.queuedBoons += 1;
      return;
    }
    this.boonPending = true;
    this.audio.play('levelUp', this.rng, .82, .02);
    const offset = (this.player.level * 2) % UPGRADES.length;
    const options = [UPGRADES[offset], UPGRADES[(offset + 2) % UPGRADES.length], UPGRADES[(offset + 4) % UPGRADES.length]];
    this.hud.showUpgrade(options, (id) => {
      if (!this.boonPending) return;
      this.boonPending = false;
      this.applyUpgrade(id);
      if (this.queuedBoons > 0 && this.state === 'playing') {
        this.queuedBoons -= 1;
        this.showUpgrade();
      }
    });
  }

  private applyUpgrade(id: string): void {
    if (id === 'iron-edge') this.player.stats.attackDamage += 7;
    else if (id === 'sap-heart') {
      this.player.stats.maxHealth += 25;
      this.player.stats.health = Math.min(this.player.stats.maxHealth, this.player.stats.health + 25);
    } else if (id === 'wind-step') this.player.stats.moveSpeedMultiplier *= 1.12;
    else if (id === 'green-breath') {
      this.player.stats.maxStamina += 20;
      this.player.stats.stamina = this.player.stats.maxStamina;
      this.player.stats.staminaRegenMultiplier *= 1.2;
    } else if (id === 'guardian-bark') this.player.stats.guardReduction = Math.min(.92, this.player.stats.guardReduction + .1);
    else if (id === 'crescent-reach') {
      this.attackRange += .45;
      this.attackDot = Math.max(.42, this.attackDot - .04);
    }
    const boonPosition = this.player.position.clone().add(new THREE.Vector3(0, 1, 0));
    this.vfx.burst(boonPosition, '#ffc94f', 18, 3.1);
    this.vfx.shockwave(this.player.position.clone().setY(.06), '#4cecff', 2.1);
    this.hud.banner(UPGRADES.find((upgrade) => upgrade.id === id)?.label ?? 'BOON CLAIMED', 1000);
  }

  private finishRun(victory: boolean): void {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.hud.hideUpgrade();
    this.boonPending = false;
    this.queuedBoons = 0;
    if (document.pointerLockElement) document.exitPointerLock();
    this.hud.setSprinting(false);
    const clearedWaves = victory ? WAVE_DEFINITIONS.length : Math.max(0, this.wave - 1);
    const score = this.player.coins * 125 + clearedWaves * 1500 + (victory ? 5000 : 0);
    this.hud.showEnd({ victory, score, coins: this.player.coins, wave: this.wave, elapsed: this.elapsed });
  }

  private updateCameraEffects(delta: number, elapsed: number, sprinting: boolean): void {
    this.trauma = Math.max(0, this.trauma - delta * 1.45);
    this.fovPunch *= Math.exp(-delta / .18);
    const shake = this.reducedMotion ? 0 : this.trauma * this.trauma;
    this.camera.position.x += Math.sin(elapsed * 49.1) * shake * .12;
    this.camera.position.y += Math.sin(elapsed * 63.7 + 1.7) * shake * .08;
    this.camera.rotation.z += Math.sin(elapsed * 42.3 + 2.9) * shake * .028;
    const targetFov = BASE_CAMERA_FOV + this.fovPunch + (sprinting ? 4 : 0);
    const nextFov = THREE.MathUtils.damp(this.camera.fov, targetFov, 9, delta);
    if (Math.abs(nextFov - this.camera.fov) > .001) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }
  }

  private updateHud(): void {
    const boss = this.enemies.find((enemy) => enemy.type === 'thornheart' && enemy.alive);
    const snapshot: HudSnapshot = {
      health: this.player.stats.health,
      maxHealth: this.player.stats.maxHealth,
      stamina: this.player.stats.stamina,
      maxStamina: this.player.stats.maxStamina,
      xp: this.player.xp,
      xpTarget: this.player.xpTarget,
      level: this.player.level,
      coins: this.player.coins,
      explosiveCost: EXPLOSIVE_COST,
      explosiveReady: this.player.coins >= EXPLOSIVE_COST,
      wave: this.wave,
      maxWaves: WAVE_DEFINITIONS.length,
      enemiesRemaining: this.enemies.filter((enemy) => enemy.alive).length,
      combo: this.player.combo,
      minimap: {
        player: { x: this.player.position.x, z: this.player.position.z, yaw: this.player.yaw },
        enemies: this.enemies
          .filter((enemy) => enemy.alive)
          .map((enemy) => ({
            x: enemy.group.position.x,
            z: enemy.group.position.z,
            boss: enemy.type === 'thornheart',
          })),
        bounds: this.bounds,
      },
      boss: boss ? { name: boss.label, health: boss.health, maxHealth: boss.config.health } : undefined,
    };
    this.hud.update(snapshot);
  }

  private createEnvironment(): void {
    this.scene.background = new THREE.Color('#78bfc2');
    this.scene.fog = new THREE.FogExp2('#789d83', .0135);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environmentTexture = pmrem.fromScene(new RoomEnvironment(), .04).texture;
    this.scene.environment = this.environmentTexture;
    this.scene.environmentIntensity = .68;
    pmrem.dispose();

    const hemisphere = new THREE.HemisphereLight('#dff8ff', '#1b2e16', 1.25);
    this.scene.add(hemisphere);
    const sun = new THREE.DirectionalLight('#fff0b0', 3.75);
    sun.position.set(-12, 22, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 70;
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32;
    sun.shadow.camera.bottom = -32;
    sun.shadow.bias = -.00035;
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight('#69f1d2', 1.2);
    rim.position.set(14, 10, -18);
    this.scene.add(rim);
    const runeLight = new THREE.PointLight('#4cecff', 6, 18, 2);
    runeLight.position.set(0, 3.5, -20);
    this.scene.add(runeLight);

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(90, 24, 12),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          topColor: { value: new THREE.Color('#4d9fd2') },
          bottomColor: { value: new THREE.Color('#d8e8ad') },
          sunColor: { value: new THREE.Color('#fff3bf') },
          sunDirection: { value: new THREE.Vector3(-.46, .38, -.8).normalize() },
        },
        vertexShader: 'varying vec3 vDirection; void main(){ vDirection = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 topColor; uniform vec3 bottomColor; uniform vec3 sunColor; uniform vec3 sunDirection; varying vec3 vDirection; void main(){ float h = clamp(vDirection.y * .5 + .5, 0.0, 1.0); vec3 color = mix(bottomColor, topColor, pow(h, .72)); float d = max(dot(normalize(vDirection), sunDirection), 0.0); color += sunColor * (pow(d, 320.0) + pow(d, 7.0) * .16); gl_FragColor = vec4(color,1.0); }',
      }),
    );
    this.scene.add(sky);
  }

  private clearEntities(): void {
    for (const enemy of this.enemies) { this.scene.remove(enemy.group); enemy.dispose(); }
    for (const projectile of this.projectiles) this.scene.remove(projectile.group);
    for (const pickup of this.pickups) {
      this.scene.remove(pickup.group);
      pickup.dispose();
    }
    this.enemies.length = 0;
    this.projectiles.length = 0;
    this.pickups.length = 0;
    this.combatText.clear();
    this.vfx.clearTransient();
  }

  private installTestHooks(): void {
    window.__THREE_GAME_TEST_HOOKS__ = {
      seed: (value: number) => { this.rng = createSeededRandom(value); },
      setState: (name: string) => {
        if (name === 'active-play') void this.restartRun();
        else if (name === 'boss' && this.assetsReady) {
          this.clearEntities();
          this.wave = 5;
          this.spawnWave(5);
          this.state = 'playing';
        } else if (name === 'complete') this.finishRun(true);
        else console.warn(`Unknown test state: ${name}`);
      },
      setPausedForScreenshot: (paused: boolean) => { this.pausedForScreenshot = paused; },
      setReducedMotion: (enabled: boolean) => {
        this.reducedMotion = enabled;
        this.renderPipeline.setReducedMotion(enabled);
      },
      hideDebugUi: () => undefined,
    };
  }

  private publishDiagnostics(): void {
    const info = this.renderer.info;
    window.__THREE_GAME_DIAGNOSTICS__ = {
      frame: this.frame,
      elapsed: this.elapsed,
      state: this.state,
      wave: this.wave,
      score: this.player.coins,
      targetScore: 42,
      complete: this.state === 'ended',
      player: {
        position: { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z },
        speed: this.player.velocity.length(),
        health: this.player.stats.health,
        stamina: this.player.stats.stamina,
      },
      entities: { enemies: this.enemies.length, projectiles: this.projectiles.length, pickups: this.pickups.length },
      renderer: { calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures },
      post: { enabled: this.renderPipeline.enabled, passes: this.renderPipeline.postPasses },
      canvas: {
        clientWidth: this.canvas.clientWidth,
        clientHeight: this.canvas.clientHeight,
        width: this.canvas.width,
        height: this.canvas.height,
        dpr: Math.min(window.devicePixelRatio || 1, this.renderPipeline.dprCap),
      },
    };
  }

  private render(): void { this.renderPipeline.render(this.elapsed); }

  private readonly onPointerLockChange = () => {
    if (matchMedia('(pointer: coarse)').matches) return;
    if (this.state === 'playing' && !this.input.isPointerLocked) this.pause();
  };

  private getElement(selector: string): HTMLElement {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing element: ${selector}`);
    return element;
  }

  private getButton(selector: string): HTMLButtonElement {
    const button = document.querySelector<HTMLButtonElement>(selector);
    if (!button) throw new Error(`Missing button: ${selector}`);
    return button;
  }
}
