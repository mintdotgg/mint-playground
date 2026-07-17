import * as THREE from 'three';
import type { AssetLibrary } from '../assets/AssetLibrary';
import type { ModelKey } from '../assets/assetCatalog';

export type EnemyType = Extract<ModelKey,
  | 'sproutling' | 'sporecap' | 'brambleback' | 'moonhare' | 'rootlurker'
  | 'pollenWisp' | 'barkKnight' | 'rotToad' | 'stonehorn' | 'thornheart'
>;

type EnemyBehavior = 'melee' | 'ranged' | 'leap' | 'tank' | 'boss';
type DeathStyle = 'launch' | 'bounce' | 'tumble' | 'spiral' | 'boss';

type EnemyConfig = {
  label: string;
  height: number;
  radius: number;
  health: number;
  speed: number;
  damage: number;
  range: number;
  windup: number;
  cooldown: number;
  xp: number;
  coins: number;
  behavior: EnemyBehavior;
};

export type EnemyEvent =
  | { type: 'alert'; enemy: Enemy }
  | { type: 'melee'; enemy: Enemy; damage: number }
  | { type: 'projectile'; enemy: Enemy; damage: number; origin: THREE.Vector3; direction: THREE.Vector3; speed: number };

const CONFIGS: Record<EnemyType, EnemyConfig> = {
  sproutling: { label: 'Sproutling', height: 1.15, radius: .55, health: 34, speed: 2.35, damage: 10, range: 1.25, windup: .62, cooldown: 1.15, xp: 10, coins: 2, behavior: 'melee' },
  sporecap: { label: 'Sporecap', height: 1.45, radius: .65, health: 42, speed: 1.25, damage: 12, range: 8, windup: .95, cooldown: 1.9, xp: 14, coins: 3, behavior: 'ranged' },
  brambleback: { label: 'Brambleback', height: 1.65, radius: .9, health: 92, speed: 1.25, damage: 18, range: 1.65, windup: .95, cooldown: 1.75, xp: 22, coins: 5, behavior: 'tank' },
  moonhare: { label: 'Moonhare', height: 1.55, radius: .58, health: 48, speed: 2.75, damage: 14, range: 2.8, windup: .72, cooldown: 1.45, xp: 16, coins: 4, behavior: 'leap' },
  rootlurker: { label: 'Rootlurker', height: 1.05, radius: .72, health: 55, speed: 1.8, damage: 13, range: 1.45, windup: .58, cooldown: 1.25, xp: 15, coins: 3, behavior: 'melee' },
  pollenWisp: { label: 'Pollen Wisp', height: 1.3, radius: .52, health: 38, speed: 1.65, damage: 9, range: 9, windup: .78, cooldown: 1.5, xp: 15, coins: 3, behavior: 'ranged' },
  barkKnight: { label: 'Bark Knight', height: 2.2, radius: .68, health: 115, speed: 1.45, damage: 19, range: 1.7, windup: .72, cooldown: 1.35, xp: 26, coins: 6, behavior: 'tank' },
  rotToad: { label: 'Rot Toad', height: 1.45, radius: .9, health: 80, speed: 1.1, damage: 16, range: 7.5, windup: 1.1, cooldown: 2.2, xp: 22, coins: 5, behavior: 'ranged' },
  stonehorn: { label: 'Stonehorn', height: 1.65, radius: .9, health: 105, speed: 2.05, damage: 22, range: 3.2, windup: 1.0, cooldown: 2.1, xp: 28, coins: 7, behavior: 'leap' },
  thornheart: { label: 'Thornheart', height: 4.8, radius: 1.75, health: 560, speed: 1.45, damage: 24, range: 2.7, windup: 1.05, cooldown: 1.55, xp: 160, coins: 42, behavior: 'boss' },
};

let alertTexture: THREE.CanvasTexture | null = null;

function getAlertTexture(): THREE.CanvasTexture {
  if (alertTexture) return alertTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create enemy alert marker');
  context.font = '900 78px ui-monospace, monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = 10;
  context.strokeStyle = '#25120c';
  context.strokeText('!', 32, 48);
  context.fillStyle = '#ff563f';
  context.fillText('!', 32, 48);
  alertTexture = new THREE.CanvasTexture(canvas);
  alertTexture.colorSpace = THREE.SRGBColorSpace;
  alertTexture.minFilter = THREE.NearestFilter;
  alertTexture.magFilter = THREE.NearestFilter;
  alertTexture.generateMipmaps = false;
  return alertTexture;
}

export class Enemy {
  readonly group = new THREE.Group();
  readonly config: EnemyConfig;
  health: number;
  alive = true;

  private readonly visual: THREE.Group;
  private readonly telegraph: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly alert: THREE.Sprite;
  private readonly direction = new THREE.Vector3();
  private readonly materialStates: Array<{
    material: THREE.MeshStandardMaterial;
    emissive: THREE.Color;
    intensity: number;
  }> = [];
  private readonly deathVelocity = new THREE.Vector3();
  private readonly deathSpin = new THREE.Vector3();
  private readonly flashColor = new THREE.Color('#efffff');
  private deathStyle: DeathStyle = 'launch';
  private deathDuration = 1;
  private deathBounces = 0;
  private cooldown = .5;
  private windup = 0;
  private flash = 0;
  private deathTime = 0;
  private lastAttackId = -1;
  private attackCount = 0;

  constructor(readonly type: EnemyType, assets: AssetLibrary, position: THREE.Vector3, readonly spawnIndex: number) {
    this.config = CONFIGS[type];
    this.health = this.config.health;
    this.visual = assets.create(type, this.config.height, true);
    this.group.add(this.visual);
    this.group.position.copy(position);
    this.group.name = `${this.config.label}-${spawnIndex}`;
    this.visual.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const source = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of source) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        this.materialStates.push({
          material,
          emissive: material.emissive.clone(),
          intensity: material.emissiveIntensity,
        });
      }
    });

    this.telegraph = new THREE.Mesh(
      new THREE.RingGeometry(this.config.radius * 1.15, this.config.radius * 1.32, 28),
      new THREE.MeshBasicMaterial({ color: '#ff563f', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.telegraph.rotation.x = -Math.PI / 2;
    this.telegraph.position.y = .025;
    this.group.add(this.telegraph);

    this.alert = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getAlertTexture(),
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }));
    this.alert.position.y = this.config.height + .52;
    this.alert.scale.set(.42, .64, 1);
    this.alert.visible = false;
    this.alert.renderOrder = 20;
    this.group.add(this.alert);
  }

  get radius(): number { return this.config.radius; }
  get rewardXp(): number { return this.config.xp; }
  get rewardCoins(): number { return this.config.coins; }
  get label(): string { return this.config.label; }
  get healthRatio(): number { return this.health / this.config.health; }

  update(delta: number, elapsed: number, playerPosition: THREE.Vector3): EnemyEvent[] {
    const events: EnemyEvent[] = [];
    if (!this.alive) {
      this.updateDeath(delta);
      return events;
    }

    this.flash = Math.max(0, this.flash - delta);
    const flashStrength = Math.min(1, this.flash / .12);
    for (const state of this.materialStates) {
      state.material.emissive.copy(state.emissive).lerp(this.flashColor, flashStrength * .86);
      state.material.emissiveIntensity = state.intensity + flashStrength * 1.7;
    }

    this.cooldown = Math.max(0, this.cooldown - delta);
    this.direction.subVectors(playerPosition, this.group.position);
    this.direction.y = 0;
    const distance = this.direction.length();
    if (distance > .001) this.direction.multiplyScalar(1 / distance);
    this.group.rotation.y = Math.atan2(this.direction.x, this.direction.z);

    if (this.windup > 0) {
      this.windup -= delta;
      const pulse = 1 + Math.sin(elapsed * 24) * .08;
      this.telegraph.scale.setScalar(pulse);
      this.telegraph.material.opacity = .48 + Math.sin(elapsed * 18) * .2;
      this.alert.visible = true;
      this.alert.position.y = this.config.height + .52 + Math.sin(elapsed * 18) * .08;
      const alertScale = .42 * (.94 + Math.sin(elapsed * 22) * .06);
      this.alert.scale.set(alertScale, alertScale * 1.5, 1);
      this.alert.material.opacity = .78 + Math.sin(elapsed * 20) * .2;
      this.visual.position.y = Math.sin(elapsed * 30) * .035;
      if (this.windup <= 0) {
        this.telegraph.material.opacity = 0;
        this.alert.visible = false;
        this.visual.position.y = 0;
        this.attackCount += 1;
        this.cooldown = this.config.cooldown;
        if (this.config.behavior === 'ranged') {
          events.push({ type: 'projectile', enemy: this, damage: this.config.damage, origin: this.group.position.clone().add(new THREE.Vector3(0, this.config.height * .55, 0)), direction: this.direction.clone(), speed: this.type === 'pollenWisp' ? 7.2 : 5.4 });
        } else if (this.config.behavior === 'boss' && this.attackCount % 3 === 0) {
          for (let index = 0; index < 5; index += 1) {
            const angle = (index - 2) * .18;
            const direction = this.direction.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
            events.push({ type: 'projectile', enemy: this, damage: 16, origin: this.group.position.clone().add(new THREE.Vector3(0, 2.3, 0)), direction, speed: 6.2 });
          }
        } else if (distance <= this.config.range + 1) {
          events.push({ type: 'melee', enemy: this, damage: this.config.damage });
        }
      }
      return events;
    }

    if (this.cooldown <= 0 && distance <= this.config.range) {
      this.windup = this.config.windup * (this.config.behavior === 'boss' && this.healthRatio < .45 ? .72 : 1);
      this.telegraph.material.opacity = .55;
      this.alert.visible = true;
      events.push({ type: 'alert', enemy: this });
      return events;
    }

    let move = 0;
    if (this.config.behavior === 'ranged') {
      if (distance > this.config.range * .78) move = 1;
      else if (distance < this.config.range * .52) move = -1;
    } else if (distance > this.config.range * .8) {
      move = 1;
    }
    if (move !== 0) {
      const phaseBoost = this.config.behavior === 'boss' && this.healthRatio < .45 ? 1.42 : 1;
      this.group.position.addScaledVector(this.direction, delta * this.config.speed * move * phaseBoost);
      const bounce = Math.sin(elapsed * (this.config.behavior === 'tank' ? 6 : 9) + this.spawnIndex) * .035;
      this.visual.position.y = Math.max(0, bounce);
    }
    return events;
  }

  hit(damage: number, attackId: number, knockbackDirection: THREE.Vector3): { applied: boolean; killed: boolean } {
    if (!this.alive || this.lastAttackId === attackId) return { applied: false, killed: false };
    this.lastAttackId = attackId;
    this.health = Math.max(0, this.health - damage);
    this.flash = .12;
    if (this.health === 0) {
      this.alive = false;
      this.telegraph.visible = false;
      this.alert.visible = false;
      this.beginDeath(knockbackDirection);
    }
    return { applied: true, killed: !this.alive };
  }

  separateFrom(other: Enemy): void {
    if (!this.alive || !other.alive) return;
    this.direction.subVectors(this.group.position, other.group.position);
    this.direction.y = 0;
    const minDistance = (this.radius + other.radius) * .72;
    const distanceSq = this.direction.lengthSq();
    if (distanceSq < .0001 || distanceSq >= minDistance * minDistance) return;
    const distance = Math.sqrt(distanceSq);
    this.direction.multiplyScalar((minDistance - distance) / distance * .5);
    this.group.position.add(this.direction);
  }

  canRemove(): boolean {
    return !this.alive && this.deathTime >= this.deathDuration;
  }

  dispose(): void {
    this.telegraph.geometry.dispose();
    this.telegraph.material.dispose();
    this.alert.material.dispose();
    for (const state of this.materialStates) state.material.dispose();
  }

  private beginDeath(knockbackDirection: THREE.Vector3): void {
    this.deathTime = 0;
    this.deathBounces = 0;
    this.deathStyle = this.type === 'thornheart'
      ? 'boss'
      : (['launch', 'bounce', 'tumble', 'spiral'] as const)[(this.spawnIndex + this.type.length) % 4];

    this.direction.copy(knockbackDirection).setY(0);
    if (this.direction.lengthSq() < .001) this.direction.set(0, 0, -1);
    this.direction.normalize();
    const side = this.spawnIndex % 2 === 0 ? 1 : -1;

    if (this.deathStyle === 'launch') {
      this.deathVelocity.copy(this.direction).multiplyScalar(12).setY(6.2);
      this.deathSpin.set(8 * side, 5, 10 * side);
      this.deathDuration = 1.05;
    } else if (this.deathStyle === 'bounce') {
      this.deathVelocity.copy(this.direction).multiplyScalar(8.5).setY(4.4);
      this.deathSpin.set(12, 4 * side, 8 * side);
      this.deathDuration = 1.18;
    } else if (this.deathStyle === 'tumble') {
      this.deathVelocity.copy(this.direction).multiplyScalar(10.5).setY(2.8);
      this.deathSpin.set(15 * side, 7, 5);
      this.deathDuration = 1;
    } else if (this.deathStyle === 'spiral') {
      this.deathVelocity.copy(this.direction).applyAxisAngle(new THREE.Vector3(0, 1, 0), side * .48).multiplyScalar(10).setY(7.2);
      this.deathSpin.set(5, 16 * side, 12);
      this.deathDuration = 1.22;
    } else {
      this.deathVelocity.copy(this.direction).multiplyScalar(4.2).setY(3.5);
      this.deathSpin.set(2.4 * side, 3, 1.2 * side);
      this.deathDuration = 1.48;
    }
  }

  private updateDeath(delta: number): void {
    this.deathTime += delta;
    this.group.position.addScaledVector(this.deathVelocity, delta);
    this.deathVelocity.y -= (this.deathStyle === 'boss' ? 10 : 13.5) * delta;
    this.group.rotation.x += this.deathSpin.x * delta;
    this.group.rotation.y += this.deathSpin.y * delta;
    this.group.rotation.z += this.deathSpin.z * delta;

    const bounceLimit = this.deathStyle === 'bounce' ? 2 : 1;
    if (this.group.position.y <= 0 && this.deathVelocity.y < 0 && this.deathBounces < bounceLimit && this.deathTime < this.deathDuration * .76) {
      this.group.position.y = 0;
      this.deathVelocity.y *= -.42;
      this.deathVelocity.x *= .7;
      this.deathVelocity.z *= .7;
      this.deathSpin.multiplyScalar(.82);
      this.deathBounces += 1;
    }

    const progress = Math.min(1, this.deathTime / this.deathDuration);
    const vanish = progress < .62 ? 1 : 1 - Math.pow((progress - .62) / .38, 2);
    const pop = this.deathStyle === 'boss'
      ? 1 + Math.sin(progress * Math.PI) * .09
      : 1 + Math.sin(Math.min(1, progress * 3.4) * Math.PI) * .18;
    this.group.scale.setScalar(Math.max(.001, vanish * pop));
  }
}
