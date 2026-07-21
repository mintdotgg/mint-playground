import * as THREE from 'three';
import type { WorldCameraFrame, WorldCameraProfile } from '../assets/worldPresentationProfiles';

export type WorldCameraCalibration = {
  cameraHeight: number;
  cameraBack: number;
  cameraTargetX: number;
  cameraTargetY: number;
  cameraLookAhead: number;
  cameraFov: number;
};

export class CameraRig {
  private readonly desired = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private trauma = 0;
  private time = 0;
  private profile: WorldCameraProfile = {
    desktop: { height: 4.45, back: 10.4, targetX: 0, targetY: 1.05, lookAhead: 16, fov: 60 },
    mobile: { height: 4.9, back: 11.4, targetX: 0, targetY: 1.12, lookAhead: 14, fov: 60 },
  };

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  snap(laneX: number): void {
    const frame = this.activeFrame;
    this.camera.position.set(frame.targetX + laneX * 0.18, frame.height, -frame.back);
    this.target.set(frame.targetX + laneX * 0.08, frame.targetY, frame.lookAhead);
    this.camera.lookAt(this.target);
    this.camera.fov = frame.fov;
    this.camera.updateProjectionMatrix();
  }

  setProfile(profile: WorldCameraProfile, snap = false): void {
    this.profile = {
      desktop: { ...profile.desktop },
      mobile: { ...profile.mobile },
    };
    if (snap) this.snap(0);
  }

  get calibration(): WorldCameraCalibration {
    const frame = this.activeFrame;
    return {
      cameraHeight: frame.height,
      cameraBack: frame.back,
      cameraTargetX: frame.targetX,
      cameraTargetY: frame.targetY,
      cameraLookAhead: frame.lookAhead,
      cameraFov: frame.fov,
    };
  }

  calibrate(values: Partial<WorldCameraCalibration>): WorldCameraCalibration {
    const frame = this.activeFrame;
    frame.height = values.cameraHeight ?? frame.height;
    frame.back = values.cameraBack ?? frame.back;
    frame.targetX = values.cameraTargetX ?? frame.targetX;
    frame.targetY = values.cameraTargetY ?? frame.targetY;
    frame.lookAhead = values.cameraLookAhead ?? frame.lookAhead;
    frame.fov = values.cameraFov ?? frame.fov;
    this.snap(0);
    return this.calibration;
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(delta: number, laneX: number, boost: boolean, reducedMotion: boolean): void {
    this.time += delta;
    const frame = this.activeFrame;
    this.desired.set(frame.targetX + laneX * 0.22, frame.height, -frame.back);
    const follow = 1 - Math.exp(-delta / 0.12);
    this.camera.position.lerp(this.desired, follow);
    this.target.set(frame.targetX + laneX * 0.12, frame.targetY, frame.lookAhead);
    this.camera.lookAt(this.target);

    const desiredFov = frame.fov + (boost && !reducedMotion ? 6 : 0);
    this.camera.fov += (desiredFov - this.camera.fov) * (1 - Math.exp(-delta / 0.2));
    this.camera.updateProjectionMatrix();

    this.trauma = Math.max(0, this.trauma - delta * 1.5);
    if (!reducedMotion && this.trauma > 0) {
      const strength = this.trauma * this.trauma;
      this.camera.position.x += Math.sin(this.time * 43.1) * strength * 0.16;
      this.camera.position.y += Math.sin(this.time * 38.7 + 1.7) * strength * 0.1;
      this.camera.rotation.z += Math.sin(this.time * 34.3 + 0.4) * strength * 0.012;
    }
  }

  private get activeFrame(): WorldCameraFrame {
    return window.innerWidth < 720 ? this.profile.mobile : this.profile.desktop;
  }
}
