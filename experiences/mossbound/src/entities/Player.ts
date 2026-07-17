import * as THREE from 'three';
import type { InputController } from '../core/InputController';
import type { CircleObstacle, CollisionSystem, WorldBounds } from '../systems/CollisionSystem';

export type PlayerTuning = {
  walkSpeed: number;
  sprintSpeed: number;
  acceleration: number;
  lookSensitivity: number;
  attackDuration: number;
  attackCost: number;
  attackDamage: number;
};

export type PlayerUpdateResult = {
  attackStarted: boolean;
  attackActive: boolean;
  guardStarted: boolean;
  sprinting: boolean;
};

const FIRST_PERSON_EYE_HEIGHT = 1.18;

export class Player {
  readonly position = new THREE.Vector3(0, FIRST_PERSON_EYE_HEIGHT, 12);
  readonly velocity = new THREE.Vector3();
  readonly forward = new THREE.Vector3(0, 0, -1);
  readonly stats = {
    maxHealth: 100,
    health: 100,
    maxStamina: 100,
    stamina: 100,
    attackDamage: 20,
    moveSpeedMultiplier: 1,
    staminaRegenMultiplier: 1,
    guardReduction: 0.72,
  };

  yaw = 0;
  pitch = 0;
  xp = 0;
  xpTarget = 40;
  level = 1;
  coins = 0;
  combo = 0;
  comboTimer = 0;

  private readonly movement = new THREE.Vector2();
  private readonly look = new THREE.Vector2();
  private readonly desiredVelocity = new THREE.Vector3();
  private attackTime = 99;
  private attackSerial = 0;
  private guardWasHeld = false;
  private bobTime = 0;
  private damageCooldown = 0;

  constructor(private readonly camera: THREE.PerspectiveCamera) {
    this.camera.rotation.order = 'YXZ';
    this.snapCamera();
  }

  get attackId(): number { return this.attackSerial; }
  get attacking(): boolean { return this.attackTime < 0.48; }
  get guarding(): boolean { return this.guardWasHeld && this.stats.stamina > 0; }

  attackProgress(duration: number): number {
    return THREE.MathUtils.clamp(this.attackTime / duration, 0, 1);
  }

  update(
    delta: number,
    input: InputController,
    tuning: PlayerTuning,
    collision: CollisionSystem,
    bounds: WorldBounds,
    obstacles: readonly CircleObstacle[],
  ): PlayerUpdateResult {
    this.damageCooldown = Math.max(0, this.damageCooldown - delta);
    this.comboTimer = Math.max(0, this.comboTimer - delta);
    if (this.comboTimer === 0) this.combo = 0;

    input.consumeLook(this.look);
    this.yaw -= this.look.x * tuning.lookSensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - this.look.y * tuning.lookSensitivity, -1.28, 1.18);

    input.readMovement(this.movement);
    const guardHeld = input.isGuardHeld() && this.stats.stamina > 0;
    const canSprint = input.isSprintHeld() && this.movement.y > 0.1 && this.stats.stamina > 3 && !guardHeld;
    const speed = (canSprint ? tuning.sprintSpeed : tuning.walkSpeed) * this.stats.moveSpeedMultiplier;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    this.desiredVelocity.set(
      (this.movement.x * cos - this.movement.y * sin) * speed,
      0,
      (-this.movement.x * sin - this.movement.y * cos) * speed,
    );
    const smoothing = 1 - Math.exp(-tuning.acceleration * delta);
    this.velocity.lerp(this.desiredVelocity, smoothing);
    this.position.addScaledVector(this.velocity, delta);
    collision.resolvePlayer(this.position, 0.48, bounds, obstacles);

    if (canSprint) this.stats.stamina = Math.max(0, this.stats.stamina - delta * 22);
    else if (guardHeld) this.stats.stamina = Math.max(0, this.stats.stamina - delta * 7);
    else this.stats.stamina = Math.min(this.stats.maxStamina, this.stats.stamina + delta * 19 * this.stats.staminaRegenMultiplier);

    let attackStarted = false;
    if (input.consumeAttack() && this.attackTime >= tuning.attackDuration && this.stats.stamina >= tuning.attackCost && !guardHeld) {
      this.attackTime = 0;
      this.attackSerial += 1;
      this.stats.stamina -= tuning.attackCost;
      attackStarted = true;
    } else {
      this.attackTime += delta;
    }

    const attackActive = this.attackTime >= tuning.attackDuration * 0.25 && this.attackTime <= tuning.attackDuration * 0.64;
    const moving = this.velocity.lengthSq() > 0.12;
    if (moving) this.bobTime += delta * (canSprint ? 12 : 8);
    const bob = moving ? Math.sin(this.bobTime) * (canSprint ? 0.038 : 0.024) : 0;

    this.camera.position.set(this.position.x, this.position.y + bob, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, moving ? Math.sin(this.bobTime * 0.5) * 0.004 : 0);
    this.forward.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)).normalize();

    const guardStarted = guardHeld && !this.guardWasHeld;
    this.guardWasHeld = guardHeld;
    return { attackStarted, attackActive, guardStarted, sprinting: canSprint };
  }

  takeDamage(amount: number): { applied: number; blocked: boolean; dead: boolean } {
    if (this.damageCooldown > 0) return { applied: 0, blocked: false, dead: false };
    const blocked = this.guarding && this.stats.stamina >= 8;
    const applied = blocked ? amount * (1 - this.stats.guardReduction) : amount;
    if (blocked) this.stats.stamina = Math.max(0, this.stats.stamina - amount * 0.55);
    this.stats.health = Math.max(0, this.stats.health - applied);
    this.damageCooldown = blocked ? 0.22 : 0.54;
    this.combo = 0;
    this.comboTimer = 0;
    return { applied, blocked, dead: this.stats.health <= 0 };
  }

  heal(amount: number): void {
    this.stats.health = Math.min(this.stats.maxHealth, this.stats.health + amount);
  }

  addXp(amount: number): boolean {
    this.xp += amount;
    if (this.xp < this.xpTarget) return false;
    this.xp -= this.xpTarget;
    this.level += 1;
    this.xpTarget = Math.round(this.xpTarget * 1.28);
    return true;
  }

  registerHit(): void {
    this.combo += 1;
    this.comboTimer = 2.4;
  }

  reset(): void {
    this.position.set(0, FIRST_PERSON_EYE_HEIGHT, 12);
    this.velocity.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.stats.health = this.stats.maxHealth = 100;
    this.stats.stamina = this.stats.maxStamina = 100;
    this.stats.attackDamage = 20;
    this.stats.moveSpeedMultiplier = 1;
    this.stats.staminaRegenMultiplier = 1;
    this.stats.guardReduction = 0.72;
    this.xp = 0;
    this.xpTarget = 40;
    this.level = 1;
    this.coins = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.attackTime = 99;
    this.attackSerial = 0;
    this.guardWasHeld = false;
    this.snapCamera();
  }

  private snapCamera(): void {
    this.camera.position.copy(this.position);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
