import * as THREE from 'three';
import type { AssetLibrary } from '../assets/AssetLibrary';
import type { ModelKey } from '../assets/assetCatalog';

export type PickupKind = 'coin' | 'xp' | 'heal' | 'stamina';

const MODEL_BY_KIND: Record<PickupKind, ModelKey> = {
  coin: 'goldenSapCoin',
  xp: 'spiritMoteCrystal',
  heal: 'healingBloom',
  stamina: 'staminaLeafCharm',
};

export const PICKUP_COLORS: Record<PickupKind, THREE.ColorRepresentation> = {
  coin: '#ffc94f',
  xp: '#4cecff',
  heal: '#ff725b',
  stamina: '#b7d83e',
};

const HEIGHT_BY_KIND: Record<PickupKind, number> = { coin: .48, xp: .62, heal: .58, stamina: .56 };
const REWARD_REVEAL_SECONDS = .6;

type SharedRewardVisuals = {
  haloGeometry: THREE.TorusGeometry;
  flareTexture: THREE.CanvasTexture;
};

let sharedRewardVisuals: SharedRewardVisuals | null = null;

function rewardVisuals(): SharedRewardVisuals {
  if (sharedRewardVisuals) return sharedRewardVisuals;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create reward flare texture');
  const glow = context.createRadialGradient(32, 32, 1, 32, 32, 31);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(.16, 'rgba(255,255,255,.86)');
  glow.addColorStop(.5, 'rgba(255,255,255,.18)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 64, 64);
  context.translate(32, 32);
  context.fillStyle = 'rgba(255,255,255,.94)';
  context.beginPath();
  context.moveTo(0, -31);
  context.lineTo(3, -5);
  context.lineTo(31, 0);
  context.lineTo(3, 5);
  context.lineTo(0, 31);
  context.lineTo(-3, 5);
  context.lineTo(-31, 0);
  context.lineTo(-3, -5);
  context.closePath();
  context.fill();

  const flareTexture = new THREE.CanvasTexture(canvas);
  flareTexture.name = 'RewardStarFlare';
  flareTexture.colorSpace = THREE.SRGBColorSpace;
  flareTexture.generateMipmaps = false;
  flareTexture.minFilter = THREE.LinearFilter;
  sharedRewardVisuals = {
    haloGeometry: new THREE.TorusGeometry(.48, .024, 6, 32, Math.PI * 1.46),
    flareTexture,
  };
  return sharedRewardVisuals;
}

export function disposePickupVisualResources(): void {
  sharedRewardVisuals?.haloGeometry.dispose();
  sharedRewardVisuals?.flareTexture.dispose();
  sharedRewardVisuals = null;
}

function polishRewardMaterials(root: THREE.Object3D, color: THREE.ColorRepresentation): void {
  const tint = new THREE.Color(color);
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial) || material.userData.mossboundRewardPolish) continue;
      material.userData.mossboundRewardPolish = true;
      material.emissive.lerp(tint, .72);
      material.emissiveIntensity = Math.max(material.emissiveIntensity, .48);
      material.envMapIntensity = Math.max(material.envMapIntensity, 1.35);
      material.roughness = Math.max(.2, material.roughness * .82);
    }
  });
}

export class Pickup {
  readonly group = new THREE.Group();
  active = true;
  private readonly visual: THREE.Group;
  private readonly halo: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private readonly flare: THREE.Sprite;
  private readonly baseY: number;
  private readonly flareBaseScale: number;
  private age = 0;
  private collectTime = 0;

  constructor(readonly kind: PickupKind, assets: AssetLibrary, position: THREE.Vector3, readonly value: number, readonly index: number) {
    const height = HEIGHT_BY_KIND[kind];
    const color = PICKUP_COLORS[kind];
    const shared = rewardVisuals();

    this.visual = assets.create(MODEL_BY_KIND[kind], height);
    polishRewardMaterials(this.visual, color);
    this.group.add(this.visual);

    this.halo = new THREE.Mesh(
      shared.haloGeometry,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: .34,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    this.halo.position.y = height * .48;
    this.halo.rotation.x = Math.PI / 2;
    this.halo.renderOrder = 2;
    this.group.add(this.halo);

    const flareMaterial = new THREE.SpriteMaterial({
      map: shared.flareTexture,
      color,
      transparent: true,
      opacity: .46,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.flare = new THREE.Sprite(flareMaterial);
    this.flare.position.set(0, height * .58, -.06);
    this.flareBaseScale = height * 1.5;
    this.flare.scale.setScalar(this.flareBaseScale);
    this.flare.renderOrder = 1;
    this.group.add(this.flare);

    this.group.position.copy(position);
    this.baseY = position.y;
  }

  update(delta: number, elapsed: number, playerPosition: THREE.Vector3): boolean {
    this.age += delta;
    if (!this.active) {
      this.collectTime += delta;
      this.group.position.y += delta * 1.6;
      this.group.scale.setScalar(Math.max(0, 1 - this.collectTime / .24));
      return false;
    }

    const phase = elapsed * 4.4 + this.index * 1.73;
    const pulse = .5 + .5 * Math.sin(phase);
    this.visual.rotation.y += delta * (this.kind === 'coin' ? 2.8 : 1.8);
    this.visual.rotation.z = Math.sin(phase * .42) * .035;
    this.halo.rotation.z += delta * (this.kind === 'xp' ? 1.7 : 1.15);
    this.halo.scale.setScalar(.88 + pulse * .2);
    this.halo.material.opacity = .2 + pulse * .3;
    this.flare.material.rotation = phase * .18;
    this.flare.material.opacity = .3 + pulse * .34;
    this.flare.scale.setScalar(this.flareBaseScale * (.88 + pulse * .18));
    this.group.position.y = this.baseY + Math.sin(elapsed * 3.2 + this.index) * .1;

    if (this.age < REWARD_REVEAL_SECONDS) return false;

    const distanceSq = this.group.position.distanceToSquared(playerPosition);
    if (distanceSq < 3.2 * 3.2) {
      const attraction = Math.max(0, 1 - Math.sqrt(distanceSq) / 3.2);
      this.group.position.lerp(playerPosition, delta * (2 + attraction * 8));
    }
    if (distanceSq < .72 * .72) {
      this.active = false;
      return true;
    }
    return false;
  }

  canRemove(): boolean { return !this.active && this.collectTime > .26; }

  dispose(): void {
    this.halo.material.dispose();
    this.flare.material.dispose();
  }
}
