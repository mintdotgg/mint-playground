import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MintAssetRegistry } from '../assets/mint/MintAssetRegistry';
import type { CardProfile } from '../types';

function dampColor(current: THREE.Color, target: THREE.Color, delta: number, smoothing = 2.6): void {
  current.lerp(target, 1 - Math.exp(-smoothing * delta));
}

function createRadialTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable.');
  const gradient = context.createRadialGradient(256, 256, 0, 256, 256, 250);
  gradient.addColorStop(0, 'rgba(255,255,255,.9)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,.4)');
  gradient.addColorStop(0.72, 'rgba(255,255,255,.08)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class VaultScene {
  readonly root = new THREE.Group();
  readonly cardAnchor = new THREE.Vector3(0.72, 1.95, 0.08);

  private readonly atmosphereMaterial: THREE.MeshBasicMaterial;
  private readonly ringMaterial: THREE.MeshStandardMaterial;
  private readonly mintLayer = new THREE.Group();
  private readonly accentTarget = new THREE.Color();
  private readonly atmosphereTarget = new THREE.Color();
  private proceduralMemorabilia!: THREE.Group;
  private proceduralLightBlade!: THREE.Mesh;

  constructor(initialProfile: CardProfile) {
    this.root.name = 'CollectorVault';
    this.mintLayer.name = 'MintDisplayKit';
    this.root.add(this.mintLayer);

    const graphite = new THREE.MeshStandardMaterial({ color: 0x171a1c, roughness: 0.78, metalness: 0.08 });
    const graphiteSoft = new THREE.MeshStandardMaterial({ color: 0x242729, roughness: 0.9, metalness: 0.02 });
    const offWhite = new THREE.MeshPhysicalMaterial({
      color: 0xd9d5cb,
      roughness: 0.56,
      metalness: 0.02,
      clearcoat: 0.18,
      clearcoatRoughness: 0.38,
    });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x6f7475, roughness: 0.32, metalness: 0.92 });
    const polishedMetal = new THREE.MeshStandardMaterial({ color: 0xc9cdca, roughness: 0.18, metalness: 0.96 });
    const felt = new THREE.MeshStandardMaterial({ color: 0x111414, roughness: 0.97, metalness: 0 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 18), graphiteSoft);
    floor.name = 'VaultFloor';
    floor.rotation.x = -Math.PI * 0.5;
    floor.position.y = 0.02;
    floor.receiveShadow = true;
    this.root.add(floor);

    const backWall = new THREE.Mesh(new RoundedBoxGeometry(7.2, 4.85, 0.26, 8, 0.14), graphite);
    backWall.name = 'VaultRecess';
    backWall.position.set(0.52, 2.35, -1.58);
    backWall.receiveShadow = true;
    this.root.add(backWall);

    const leftWing = new THREE.Mesh(new RoundedBoxGeometry(1.72, 4.56, 0.38, 8, 0.11), offWhite);
    leftWing.name = 'LeftArchitecturalWing';
    leftWing.position.set(-2.47, 2.32, -1.28);
    leftWing.rotation.z = -0.025;
    leftWing.castShadow = true;
    leftWing.receiveShadow = true;
    this.root.add(leftWing);

    const upperBeam = new THREE.Mesh(new RoundedBoxGeometry(5.05, 0.46, 0.4, 6, 0.1), offWhite);
    upperBeam.name = 'UpperVaultBeam';
    upperBeam.position.set(1.33, 4.4, -1.28);
    upperBeam.castShadow = true;
    this.root.add(upperBeam);

    const rightColumn = new THREE.Mesh(new RoundedBoxGeometry(0.54, 3.75, 0.38, 6, 0.09), offWhite);
    rightColumn.name = 'RightVaultColumn';
    rightColumn.position.set(3.62, 2.22, -1.27);
    rightColumn.castShadow = true;
    this.root.add(rightColumn);

    const innerRail = new THREE.Mesh(new RoundedBoxGeometry(0.045, 3.22, 0.06, 4, 0.018), polishedMetal);
    innerRail.position.set(-1.48, 2.37, -1.03);
    this.root.add(innerRail);

    const lightBladeMaterial = new THREE.MeshBasicMaterial({ color: 0xd7f2ff, toneMapped: false });
    const lightBlade = new THREE.Mesh(new RoundedBoxGeometry(0.018, 2.8, 0.012, 3, 0.008), lightBladeMaterial);
    lightBlade.name = 'VaultLightBlade';
    lightBlade.position.set(-1.39, 2.42, -0.99);
    this.root.add(lightBlade);
    this.proceduralLightBlade = lightBlade;

    this.atmosphereMaterial = new THREE.MeshBasicMaterial({
      map: createRadialTexture(),
      color: initialProfile.atmosphere,
      transparent: true,
      opacity: 0.46,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 4.8), this.atmosphereMaterial);
    halo.name = 'AtmosphereHalo';
    halo.position.set(this.cardAnchor.x, 2.05, -1.38);
    this.root.add(halo);

    this.ringMaterial = new THREE.MeshStandardMaterial({
      color: initialProfile.accent,
      emissive: initialProfile.accent,
      emissiveIntensity: 0.05,
      roughness: 0.3,
      metalness: 0.74,
      transparent: true,
      opacity: 0.48,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.53, 0.018, 12, 128), this.ringMaterial);
    ring.name = 'IndexApertureRing';
    ring.position.set(this.cardAnchor.x, 2.05, -1.23);
    ring.scale.y = 1.14;
    this.root.add(ring);

    const plinthBase = new THREE.Mesh(new RoundedBoxGeometry(3.65, 0.42, 2.08, 8, 0.12), darkMetal);
    plinthBase.name = 'PlinthBase';
    plinthBase.position.set(this.cardAnchor.x, 0.29, -0.05);
    plinthBase.castShadow = true;
    plinthBase.receiveShadow = true;
    this.root.add(plinthBase);

    const plinthTop = new THREE.Mesh(new RoundedBoxGeometry(3.48, 0.32, 1.92, 8, 0.1), offWhite);
    plinthTop.name = 'ArchivalDisplaySurface';
    plinthTop.position.set(this.cardAnchor.x - 0.05, 0.52, -0.03);
    plinthTop.castShadow = true;
    plinthTop.receiveShadow = true;
    this.root.add(plinthTop);

    const channel = new THREE.Mesh(new RoundedBoxGeometry(1.96, 0.022, 0.43, 5, 0.04), felt);
    channel.name = 'GraphiteConservationChannel';
    channel.position.set(this.cardAnchor.x, 0.695, -0.08);
    this.root.add(channel);

    this.buildStand(polishedMetal);
    this.buildIndexMarkers(polishedMetal, initialProfile);
    this.buildMemorabilia(darkMetal, graphiteSoft, polishedMetal);
    this.setProfile(initialProfile, true);
  }

  private buildStand(metal: THREE.Material): void {
    const stand = new THREE.Group();
    stand.name = 'CollectorCardStand';
    stand.position.set(this.cardAnchor.x, 0.7, 0.02);

    const foot = new THREE.Mesh(new RoundedBoxGeometry(1.08, 0.11, 0.56, 5, 0.045), metal);
    foot.position.z = -0.02;
    foot.castShadow = true;
    stand.add(foot);

    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.76, 48), metal);
    hinge.rotation.z = Math.PI * 0.5;
    hinge.position.set(0, 0.15, -0.08);
    hinge.castShadow = true;
    stand.add(hinge);

    for (const side of [-1, 1]) {
      const support = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.76, 0.13, 5, 0.035), metal);
      support.position.set(side * 0.48, 0.47, -0.09);
      support.rotation.z = side * -0.095;
      support.castShadow = true;
      stand.add(support);

    }
    this.root.add(stand);
  }

  private buildIndexMarkers(metal: THREE.Material, initialProfile: CardProfile): void {
    const markers = new THREE.Group();
    markers.name = 'SixCardArchiveMarkers';
    markers.position.set(-1.82, 0.76, -0.83);
    for (let index = 0; index < 6; index += 1) {
      const marker = new THREE.Mesh(new RoundedBoxGeometry(0.055, 0.34 + index * 0.045, 0.055, 3, 0.014), metal);
      marker.position.set(index * 0.13, 0.18 + index * 0.022, 0);
      markers.add(marker);
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.038, 20, 12),
        new THREE.MeshStandardMaterial({
          color: index === 0 ? initialProfile.accent : 0x5d6262,
          roughness: 0.3,
          metalness: 0.8,
        }),
      );
      cap.position.set(index * 0.13, 0.38 + index * 0.045, 0);
      markers.add(cap);
    }
    this.root.add(markers);
  }

  private buildMemorabilia(darkMetal: THREE.Material, graphite: THREE.Material, polishedMetal: THREE.Material): void {
    const cluster = new THREE.Group();
    cluster.name = 'AbstractMemorabilia';
    cluster.position.set(2.68, 0.82, -0.66);
    cluster.rotation.y = -0.22;
    cluster.scale.setScalar(0.68);

    const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.12, 48), graphite);
    puck.rotation.x = Math.PI * 0.5;
    puck.position.set(0.42, 0.05, 0.04);
    puck.castShadow = true;
    cluster.add(puck);

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.48, -0.03, 0),
      new THREE.Vector3(-0.26, 0.34, -0.04),
      new THREE.Vector3(0.04, 0.58, 0),
      new THREE.Vector3(0.38, 0.68, 0.06),
    ]);
    const stitchedArc = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.045, 14, false), darkMetal);
    stitchedArc.castShadow = true;
    cluster.add(stitchedArc);

    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.026, 10, 48, Math.PI * 1.7), polishedMetal);
    crown.position.set(-0.34, 0.66, -0.02);
    crown.rotation.z = -0.6;
    cluster.add(crown);

    const points: THREE.Vector3[] = [];
    for (let index = 0; index <= 5; index += 1) {
      const offset = -0.32 + index * 0.128;
      points.push(new THREE.Vector3(offset, 0.04, -0.08), new THREE.Vector3(offset, 0.54, -0.08));
      points.push(new THREE.Vector3(-0.32, 0.04 + index * 0.1, -0.08), new THREE.Vector3(0.32, 0.04 + index * 0.1, -0.08));
    }
    const net = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: 0x7b8180, transparent: true, opacity: 0.34 }),
    );
    net.position.set(-0.04, 0.02, -0.1);
    cluster.add(net);
    this.root.add(cluster);
    this.proceduralMemorabilia = cluster;
  }

  async loadMintDisplayKit(): Promise<number> {
    const registry = new MintAssetRegistry();
    const tasks = [
      registry.loadNormalizedModel('Collector Card Stand GLB', 0.5).then((model) => {
        model.position.set(2.1, 0.7, -0.72);
        model.rotation.y = -0.5;
        this.mintLayer.add(model);
      }),
      registry.loadNormalizedModel('Abstract Sports Memorabilia Cluster GLB', 0.92).then((model) => {
        model.position.set(2.67, 0.7, -0.7);
        model.rotation.y = -0.28;
        this.mintLayer.add(model);
        this.proceduralMemorabilia.visible = false;
      }),
      registry.loadNormalizedModel('Vault Light Blade GLB', 2.72).then((model) => {
        model.position.set(-1.4, 1.02, -1.0);
        model.rotation.y = Math.PI;
        this.mintLayer.add(model);
        this.proceduralLightBlade.visible = false;
      }),
      registry.loadNormalizedModel('Protective Slab Detail Kit GLB', 0.56).then((model) => {
        model.position.set(-0.52, 0.71, -0.42);
        model.rotation.y = 0.32;
        this.mintLayer.add(model);
      }),
    ];

    const results = await Promise.allSettled(tasks);
    return results.filter((result) => result.status === 'fulfilled').length;
  }

  setProfile(profile: CardProfile, immediate = false): void {
    this.accentTarget.set(profile.accent);
    this.atmosphereTarget.set(profile.atmosphere);
    if (immediate) {
      this.ringMaterial.color.copy(this.accentTarget);
      this.ringMaterial.emissive.copy(this.accentTarget);
      this.atmosphereMaterial.color.copy(this.atmosphereTarget);
    }
  }

  update(delta: number): void {
    dampColor(this.ringMaterial.color, this.accentTarget, delta);
    dampColor(this.ringMaterial.emissive, this.accentTarget, delta);
    dampColor(this.atmosphereMaterial.color, this.atmosphereTarget, delta);
  }
}
