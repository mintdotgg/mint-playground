import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import type { CardProfile } from '../types';

function damp(current: number, target: number, smoothing: number, delta: number): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-smoothing * delta));
}

export class LightingRig {
  readonly root = new THREE.Group();

  private readonly key: THREE.RectAreaLight;
  private readonly fill: THREE.PointLight;
  private readonly rim: THREE.SpotLight;
  private readonly rimTarget = new THREE.Object3D();
  private readonly inspectionLight: THREE.RectAreaLight;
  private readonly inspectionPosition = new THREE.Vector3(2.4, 3.9, 3.2);
  private readonly inspectionTargetPosition = new THREE.Vector3(2.4, 3.9, 3.2);
  private readonly subject: THREE.Vector3;
  private readonly targetKeyColor = new THREE.Color();
  private readonly targetFillColor = new THREE.Color();
  private readonly targetRimColor = new THREE.Color();
  private targetKeyIntensity = 6;
  private inspectionActive = false;
  private reducedMotion = false;

  constructor(subject: THREE.Vector3, initialProfile: CardProfile) {
    RectAreaLightUniformsLib.init();
    this.root.name = 'LightingRig';
    this.subject = subject.clone();

    const hemisphere = new THREE.HemisphereLight(0xdce9ee, 0x15181a, 1.45);
    this.root.add(hemisphere);

    this.key = new THREE.RectAreaLight(initialProfile.lighting.key, initialProfile.lighting.keyIntensity, 2.1, 3.4);
    this.key.position.set(-2.4, 4.5, 3.0);
    this.key.lookAt(this.subject);
    this.root.add(this.key);

    this.fill = new THREE.PointLight(initialProfile.lighting.fill, 18, 9, 2);
    this.fill.position.set(3.2, 2.2, 2.2);
    this.root.add(this.fill);

    this.rim = new THREE.SpotLight(initialProfile.lighting.rim, 42, 10, Math.PI * 0.18, 0.55, 1.4);
    this.rim.position.set(2.7, 4.6, -2.1);
    this.rim.castShadow = false;
    this.rim.target = this.rimTarget;
    this.rimTarget.position.copy(this.subject);
    this.root.add(this.rim, this.rimTarget);

    this.inspectionLight = new THREE.RectAreaLight(0xffffff, 0.5, 0.38, 3.1);
    this.inspectionLight.position.copy(this.inspectionPosition);
    this.inspectionLight.lookAt(this.subject);
    this.root.add(this.inspectionLight);

    this.setProfile(initialProfile, true);
  }

  setProfile(profile: CardProfile, immediate = false): void {
    this.targetKeyColor.set(profile.lighting.key);
    this.targetFillColor.set(profile.lighting.fill);
    this.targetRimColor.set(profile.lighting.rim);
    this.targetKeyIntensity = profile.lighting.keyIntensity;

    if (immediate) {
      this.key.color.copy(this.targetKeyColor);
      this.fill.color.copy(this.targetFillColor);
      this.rim.color.copy(this.targetRimColor);
      this.key.intensity = this.targetKeyIntensity;
    }
  }

  setPointer(x: number, y: number): void {
    this.inspectionTargetPosition.set(
      this.subject.x + x * 3.3,
      this.subject.y + 1.25 - y * 2.1,
      3.15,
    );
  }

  setInspection(active: boolean): void {
    this.inspectionActive = active;
    if (this.reducedMotion) this.inspectionLight.intensity = active ? 5.2 : 0.48;
  }

  setReducedMotion(active: boolean): void {
    this.reducedMotion = active;
  }

  update(delta: number, elapsed: number): void {
    const colorAlpha = 1 - Math.exp(-3.2 * delta);
    this.key.color.lerp(this.targetKeyColor, colorAlpha);
    this.fill.color.lerp(this.targetFillColor, colorAlpha);
    this.rim.color.lerp(this.targetRimColor, colorAlpha);
    this.key.intensity = damp(this.key.intensity, this.targetKeyIntensity, 3.4, delta);
    this.inspectionLight.intensity = damp(this.inspectionLight.intensity, this.inspectionActive ? 5.2 : 0.48, 4.5, delta);

    if (!this.reducedMotion) {
      this.inspectionPosition.lerp(this.inspectionTargetPosition, 1 - Math.exp(-4.4 * delta));
      if (!this.inspectionActive) this.inspectionPosition.x += Math.sin(elapsed * 0.42) * 0.0015;
    } else {
      this.inspectionPosition.copy(this.inspectionTargetPosition);
    }
    this.inspectionLight.position.copy(this.inspectionPosition);
    this.inspectionLight.lookAt(this.subject);
  }

  getInspectionLightPosition(target = new THREE.Vector3()): THREE.Vector3 {
    return target.copy(this.inspectionLight.position);
  }
}
