import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { CardProfile, CardSide } from '../types';
import { createCardTexture, createSlabLabelTexture } from './cardTextures';
import { createFoilMaterial, type FoilMaterialController } from './foilMaterial';

interface PreparedCard {
  card: CardProfile;
  front: THREE.CanvasTexture;
  back: THREE.CanvasTexture;
  label: THREE.CanvasTexture;
}

interface SwapTransition {
  start: number;
  duration: number;
  prepared: PreparedCard;
  swapped: boolean;
  resolve: () => void;
}

function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function damp(current: number, target: number, smoothing: number, delta: number): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-smoothing * delta));
}

export class CardRig {
  readonly root = new THREE.Group();

  private readonly presentation = new THREE.Group();
  private readonly slab = new THREE.Group();
  private readonly frontMaterial: THREE.MeshPhysicalMaterial;
  private readonly backMaterial: THREE.MeshPhysicalMaterial;
  private readonly labelMaterial: THREE.MeshBasicMaterial;
  private readonly edgeMaterial: THREE.MeshStandardMaterial;
  private readonly sealMaterial: THREE.MeshPhysicalMaterial;
  private readonly foil: FoilMaterialController;
  private readonly baseY: number;
  private transition: SwapTransition | null = null;
  private sideTarget = 0;
  private reducedMotion = false;
  private inspection = false;
  private currentCard: CardProfile | null = null;
  private readonly preparedCards = new Map<string, Promise<PreparedCard>>();
  private readonly ownedTextures = new Set<THREE.Texture>();

  constructor(position = new THREE.Vector3(0.72, 1.95, 0.08)) {
    this.root.name = 'CardRig';
    this.root.position.copy(position);
    this.baseY = position.y;
    this.root.add(this.presentation);
    this.presentation.add(this.slab);

    this.edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xd9d5ca,
      roughness: 0.58,
      metalness: 0.02,
      envMapIntensity: 0.72,
    });
    this.frontMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.28,
      metalness: 0.08,
      clearcoat: 0.75,
      clearcoatRoughness: 0.16,
      envMapIntensity: 0.95,
    });
    this.backMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.46,
      metalness: 0.02,
      clearcoat: 0.25,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.76,
    });
    this.labelMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.sealMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xff624c,
      metalness: 0.5,
      roughness: 0.28,
      clearcoat: 0.8,
      clearcoatRoughness: 0.12,
    });
    this.foil = createFoilMaterial();

    this.buildCard();
    this.buildSlab();
    this.slab.rotation.x = -0.015;
  }

  private buildCard(): void {
    const cardWidth = 1.44;
    const cardHeight = 2.02;
    const cardY = -0.17;
    const core = new THREE.Mesh(
      new RoundedBoxGeometry(cardWidth, cardHeight, 0.052, 5, 0.035),
      this.edgeMaterial,
    );
    core.name = 'CardStockCore';
    core.position.y = cardY;
    core.castShadow = true;
    core.receiveShadow = true;
    this.slab.add(core);

    const front = new THREE.Mesh(new THREE.PlaneGeometry(cardWidth - 0.015, cardHeight - 0.015), this.frontMaterial);
    front.name = 'CardFront';
    front.position.set(0, cardY, 0.0305);
    front.castShadow = true;
    this.slab.add(front);

    const back = new THREE.Mesh(new THREE.PlaneGeometry(cardWidth - 0.015, cardHeight - 0.015), this.backMaterial);
    back.name = 'CardBack';
    back.position.set(0, cardY, -0.0305);
    back.rotation.y = Math.PI;
    back.castShadow = true;
    this.slab.add(back);

    const foilPlane = new THREE.Mesh(new THREE.PlaneGeometry(cardWidth - 0.022, cardHeight - 0.022), this.foil.material);
    foilPlane.name = 'TreatmentOverlay';
    foilPlane.position.set(0, cardY, 0.0345);
    foilPlane.renderOrder = 4;
    this.slab.add(foilPlane);

    const innerShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(cardWidth + 0.08, cardHeight + 0.08),
      new THREE.MeshBasicMaterial({
        color: 0x050606,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
    );
    innerShadow.name = 'CardInnerShadow';
    innerShadow.position.set(0.025, cardY - 0.025, -0.047);
    this.slab.add(innerShadow);
  }

  private buildSlab(): void {
    const slabWidth = 1.78;
    const slabHeight = 2.68;
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xf5fbff,
      metalness: 0,
      roughness: 0.08,
      transmission: 0,
      transparent: true,
      opacity: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const glassGeometry = new RoundedBoxGeometry(slabWidth, slabHeight, 0.032, 6, 0.07);
    const frontGlass = new THREE.Mesh(glassGeometry, glassMaterial);
    frontGlass.name = 'ProtectiveSlabFront';
    frontGlass.position.z = 0.076;
    frontGlass.renderOrder = 6;
    this.slab.add(frontGlass);

    const backGlass = new THREE.Mesh(glassGeometry, glassMaterial);
    backGlass.name = 'ProtectiveSlabBack';
    backGlass.position.z = -0.076;
    backGlass.renderOrder = 2;
    this.slab.add(backGlass);

    const railMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xe9f0f3,
      metalness: 0.02,
      roughness: 0.12,
      transparent: true,
      opacity: 0.48,
      clearcoat: 1,
      envMapIntensity: 1.6,
      depthWrite: false,
    });
    const verticalRail = new RoundedBoxGeometry(0.055, slabHeight - 0.09, 0.17, 4, 0.025);
    const horizontalRail = new RoundedBoxGeometry(slabWidth - 0.09, 0.055, 0.17, 4, 0.025);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(verticalRail, railMaterial);
      rail.position.x = side * (slabWidth * 0.5 - 0.034);
      rail.renderOrder = 7;
      this.slab.add(rail);
    }
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(horizontalRail, railMaterial);
      rail.position.y = side * (slabHeight * 0.5 - 0.034);
      rail.renderOrder = 7;
      this.slab.add(rail);
    }

    const outlineMaterial = new THREE.LineBasicMaterial({
      color: 0xeaf7ff,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
    });
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(glassGeometry, 28), outlineMaterial);
    outline.name = 'SlabEdgeHighlights';
    outline.renderOrder = 8;
    this.slab.add(outline);

    const labelBacking = new THREE.Mesh(
      new RoundedBoxGeometry(1.58, 0.36, 0.045, 4, 0.025),
      new THREE.MeshStandardMaterial({ color: 0xe7e4db, roughness: 0.6, metalness: 0.02 }),
    );
    labelBacking.position.set(0, 1.08, 0.022);
    this.slab.add(labelBacking);

    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.56, 0.34), this.labelMaterial);
    label.name = 'SlabGradeLabel';
    label.position.set(0, 1.08, 0.047);
    this.slab.add(label);

    const reverseLabel = new THREE.Mesh(new THREE.PlaneGeometry(1.56, 0.34), this.labelMaterial);
    reverseLabel.name = 'SlabGradeLabelReverse';
    reverseLabel.position.set(0, 1.08, -0.047);
    reverseLabel.rotation.y = Math.PI;
    this.slab.add(reverseLabel);

    const screwGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.018, 24);
    const screwMaterial = new THREE.MeshStandardMaterial({ color: 0xb9bec0, metalness: 0.95, roughness: 0.22 });
    const screwPositions = [
      [-0.79, 1.22],
      [0.79, 1.22],
      [-0.79, -1.22],
      [0.79, -1.22],
    ];
    for (const [x, y] of screwPositions) {
      const screw = new THREE.Mesh(screwGeometry, screwMaterial);
      screw.position.set(x, y, 0.105);
      screw.rotation.x = Math.PI * 0.5;
      screw.castShadow = true;
      this.slab.add(screw);
    }

    const securitySeal = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.009, 10, 48), this.sealMaterial);
    securitySeal.name = 'SecuritySeal';
    securitySeal.position.set(0.68, -1.19, 0.11);
    this.slab.add(securitySeal);
  }

  private prepare(card: CardProfile): Promise<PreparedCard> {
    const cached = this.preparedCards.get(card.id);
    if (cached) return cached;

    const request = Promise.all([
      createCardTexture(card, 'front'),
      createCardTexture(card, 'back'),
    ]).then(([front, back]) => {
      const label = createSlabLabelTexture(card);
      this.ownedTextures.add(front).add(back).add(label);
      return { card, front, back, label };
    });
    this.preparedCards.set(card.id, request);
    return request;
  }

  private applyPrepared(prepared: PreparedCard): void {
    this.frontMaterial.map = prepared.front;
    this.frontMaterial.needsUpdate = true;
    this.backMaterial.map = prepared.back;
    this.backMaterial.needsUpdate = true;
    this.labelMaterial.map = prepared.label;
    this.labelMaterial.needsUpdate = true;
    this.edgeMaterial.color.set(prepared.card.treatment === 'archival' ? '#c6b38f' : '#d8d6ce');
    this.sealMaterial.color.set(prepared.card.accent);
    this.foil.setCard(prepared.card);
    this.currentCard = prepared.card;

    const isArchival = prepared.card.treatment === 'archival';
    this.frontMaterial.roughness = isArchival ? 0.88 : prepared.card.treatment === 'frosted' ? 0.46 : 0.28;
    this.frontMaterial.metalness = prepared.card.treatment === 'metallic' ? 0.24 : 0.06;
    this.frontMaterial.clearcoat = isArchival ? 0.04 : 0.76;
    this.frontMaterial.needsUpdate = true;
  }

  async setInitialCard(card: CardProfile): Promise<void> {
    this.applyPrepared(await this.prepare(card));
  }

  async preload(cards: CardProfile[]): Promise<void> {
    await Promise.all(cards.map((card) => this.prepare(card)));
  }

  async transitionTo(card: CardProfile): Promise<void> {
    const prepared = await this.prepare(card);
    if (this.reducedMotion) {
      this.applyPrepared(prepared);
      return;
    }

    await new Promise<void>((resolve) => {
      this.transition = {
        start: performance.now(),
        duration: 760,
        prepared,
        swapped: false,
        resolve,
      };
    });
  }

  setSide(side: CardSide): void {
    this.sideTarget = side === 'front' ? 0 : Math.PI;
    if (this.reducedMotion) this.slab.rotation.y = this.sideTarget;
  }

  setInspection(active: boolean): void {
    this.inspection = active;
    this.foil.setInspection(active);
  }

  setReducedMotion(active: boolean): void {
    this.reducedMotion = active;
    if (active) this.slab.rotation.y = this.sideTarget;
  }

  setLightPosition(position: THREE.Vector3): void {
    this.foil.setLightPosition(position);
  }

  update(delta: number, elapsed: number): void {
    this.foil.update(elapsed);
    if (!this.reducedMotion) {
      this.slab.rotation.y = damp(this.slab.rotation.y, this.sideTarget, 8.5, delta);
      this.root.position.y = this.baseY + (this.inspection ? 0 : Math.sin(elapsed * 0.68) * 0.006);
    }

    if (!this.transition) return;
    const now = performance.now();
    const progress = THREE.MathUtils.clamp((now - this.transition.start) / this.transition.duration, 0, 1);
    const eased = easeInOutCubic(progress);
    const envelope = Math.sin(progress * Math.PI);
    this.presentation.position.y = -envelope * 0.11;
    this.presentation.rotation.z = -envelope * 0.025;
    this.presentation.scale.setScalar(1 - envelope * 0.055);

    if (progress >= 0.5 && !this.transition.swapped) {
      this.applyPrepared(this.transition.prepared);
      this.transition.swapped = true;
      this.presentation.rotation.y = (1 - eased) * 0.04;
    }

    if (progress >= 1) {
      this.presentation.position.set(0, 0, 0);
      this.presentation.rotation.set(0, 0, 0);
      this.presentation.scale.setScalar(1);
      const resolve = this.transition.resolve;
      this.transition = null;
      resolve();
    }
  }

  getCurrentCard(): CardProfile | null {
    return this.currentCard;
  }

  getWorldPosition(target = new THREE.Vector3()): THREE.Vector3 {
    return this.root.getWorldPosition(target);
  }

  dispose(): void {
    this.ownedTextures.forEach((texture) => texture.dispose());
    this.ownedTextures.clear();
    this.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
  }
}
