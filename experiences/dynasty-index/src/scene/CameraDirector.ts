import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { CardProfile } from '../types';

interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

interface CameraTransition {
  startedAt: number;
  duration: number;
  from: CameraPose;
  to: CameraPose;
}

function easeInOut(value: number): number {
  return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
}

export class CameraDirector {
  readonly controls: OrbitControls;

  private readonly camera: THREE.PerspectiveCamera;
  private readonly subject: THREE.Vector3;
  private profile: CardProfile;
  private inspection = false;
  private reducedMotion = false;
  private mobile = false;
  private transition: CameraTransition | null = null;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    subject: THREE.Vector3,
    initialProfile: CardProfile,
  ) {
    this.camera = camera;
    this.subject = subject.clone();
    this.profile = initialProfile;
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.enablePan = false;
    this.controls.screenSpacePanning = false;
    this.controls.rotateSpeed = 0.48;
    this.controls.zoomSpeed = 0.62;
    this.controls.minPolarAngle = Math.PI * 0.34;
    this.controls.maxPolarAngle = Math.PI * 0.66;
    this.controls.minAzimuthAngle = -0.52;
    this.controls.maxAzimuthAngle = 0.52;
    this.controls.target.copy(this.subject);
    this.applyLimits();
    this.applyPose(this.poseForProfile(initialProfile), true);
    this.controls.addEventListener('start', this.cancelTransition);
  }

  private readonly cancelTransition = (): void => {
    this.transition = null;
    this.controls.enabled = true;
  };

  private poseForProfile(profile: CardProfile): CameraPose {
    const distance = profile.camera.distance * (this.inspection ? 0.69 : 1);
    const yaw = profile.camera.yaw;
    const pitch = profile.camera.pitch + (this.inspection ? 0.025 : 0);
    const target = this.subject.clone();
    const position = new THREE.Vector3(
      target.x + Math.sin(yaw) * distance,
      target.y + Math.sin(pitch) * distance,
      target.z + Math.cos(yaw) * distance,
    );
    return {
      position,
      target,
      fov: (this.inspection ? Math.max(25, profile.camera.fov - 2.5) : profile.camera.fov) + (this.mobile ? 5.5 : 0),
    };
  }

  private applyLimits(): void {
    this.controls.minDistance = this.inspection ? 2.3 : 3.35;
    this.controls.maxDistance = this.inspection ? 5.2 : 7.4;
    this.controls.minAzimuthAngle = this.inspection ? -0.82 : -0.52;
    this.controls.maxAzimuthAngle = this.inspection ? 0.82 : 0.52;
    this.controls.minPolarAngle = this.inspection ? Math.PI * 0.28 : Math.PI * 0.34;
    this.controls.maxPolarAngle = this.inspection ? Math.PI * 0.72 : Math.PI * 0.66;
  }

  private applyPose(pose: CameraPose, immediate = false): void {
    if (immediate || this.reducedMotion) {
      this.camera.position.copy(pose.position);
      this.controls.target.copy(pose.target);
      this.camera.fov = pose.fov;
      this.camera.updateProjectionMatrix();
      this.controls.update();
      this.transition = null;
      this.controls.enabled = true;
      return;
    }

    this.transition = {
      startedAt: performance.now(),
      duration: this.inspection ? 780 : 620,
      from: {
        position: this.camera.position.clone(),
        target: this.controls.target.clone(),
        fov: this.camera.fov,
      },
      to: pose,
    };
    this.controls.enabled = false;
  }

  setProfile(profile: CardProfile, immediate = false): void {
    this.profile = profile;
    this.applyPose(this.poseForProfile(profile), immediate);
  }

  setInspection(active: boolean): void {
    this.inspection = active;
    this.applyLimits();
    this.applyPose(this.poseForProfile(this.profile));
  }

  setReducedMotion(active: boolean): void {
    this.reducedMotion = active;
    if (active && this.transition) this.applyPose(this.transition.to, true);
  }

  reset(): void {
    this.applyPose(this.poseForProfile(this.profile));
  }

  update(delta: number): void {
    if (this.transition) {
      const progress = THREE.MathUtils.clamp((performance.now() - this.transition.startedAt) / this.transition.duration, 0, 1);
      const eased = easeInOut(progress);
      this.camera.position.lerpVectors(this.transition.from.position, this.transition.to.position, eased);
      this.controls.target.lerpVectors(this.transition.from.target, this.transition.to.target, eased);
      this.camera.fov = THREE.MathUtils.lerp(this.transition.from.fov, this.transition.to.fov, eased);
      this.camera.updateProjectionMatrix();
      if (progress >= 1) {
        this.transition = null;
        this.controls.enabled = true;
      }
    }
    this.controls.update(delta);
  }

  resize(width: number, height: number, compact: boolean): void {
    this.mobile = compact;
    this.camera.aspect = width / Math.max(height, 1);
    if (!this.transition) {
      this.camera.fov = this.poseForProfile(this.profile).fov;
    }
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.controls.removeEventListener('start', this.cancelTransition);
    this.controls.dispose();
  }
}
