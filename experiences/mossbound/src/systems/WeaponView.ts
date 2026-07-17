import * as THREE from 'three';
import type { AssetLibrary } from '../assets/AssetLibrary';

const degrees = THREE.MathUtils.degToRad;

export class WeaponView {
  private readonly root = new THREE.Group();
  private readonly idlePosition = new THREE.Vector3(.5, -.68, -1.2);
  private readonly sword: THREE.Group;
  private readonly swordHand: THREE.Group;
  private readonly buckler: THREE.Group;
  private readonly arc: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private readonly arcCore: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private idleTime = 0;

  constructor(camera: THREE.PerspectiveCamera, assets: AssetLibrary) {
    this.sword = assets.create('runeIronSword', 1.18);
    this.sword.position.set(-0.14, 0.15, .29);
    // Rotation order: X, Y, Z — edit these values in degrees.
    this.sword.rotation.set(degrees(-20), degrees(180), degrees(1));
    this.root.add(this.sword);

    this.swordHand = assets.create('firstPersonSwordHand', .44);
    this.swordHand.position.set(.2, -.08, .07);
    // Rotation order: X, Y, Z — edit these values in degrees.
    this.swordHand.rotation.set(degrees(-2.29), degrees(-6.88), degrees(-21.77));
    this.root.add(this.swordHand);

    this.buckler = assets.create('thornwoodBuckler', .72);
    this.buckler.position.set(-.62, -.04, -.04);
    this.buckler.rotation.set(.25, .65, -.2);
    this.buckler.visible = false;
    this.root.add(this.buckler);

    this.arc = new THREE.Mesh(
      new THREE.TorusGeometry(.68, .052, 6, 48, Math.PI * 1.22),
      new THREE.MeshBasicMaterial({ color: '#32e9ff', transparent: true, opacity: .62, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.arc.position.set(-.03, .1, -.18);
    this.arc.rotation.set(.16, .28, -.82);
    this.arc.visible = false;
    this.root.add(this.arc);

    this.arcCore = new THREE.Mesh(
      new THREE.TorusGeometry(.68, .014, 5, 48, Math.PI * 1.22),
      new THREE.MeshBasicMaterial({ color: '#ecffff', transparent: true, opacity: .96, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.arcCore.position.copy(this.arc.position);
    this.arcCore.rotation.copy(this.arc.rotation);
    this.arcCore.visible = false;
    this.root.add(this.arcCore);
    camera.add(this.root);
    this.root.position.copy(this.idlePosition);
  }

  update(delta: number, attackProgress: number, guarding: boolean, speed: number): void {
    this.idleTime += delta;
    const bob = Math.sin(this.idleTime * 8) * Math.min(speed * .0025, .018);
    if (attackProgress < 1) {
      const swing = Math.sin(attackProgress * Math.PI);
      this.root.position.set(
        this.idlePosition.x - swing * .38,
        this.idlePosition.y + swing * .2,
        this.idlePosition.z + swing * .1,
      );
      this.root.rotation.set(-swing * .3, -swing * .34, swing * 1.25);
      this.arc.visible = attackProgress > .24 && attackProgress < .68;
      this.arcCore.visible = this.arc.visible;
      const sweepScale = .86 + swing * .22;
      this.arc.scale.setScalar(sweepScale);
      this.arcCore.scale.setScalar(sweepScale);
      this.arc.material.opacity = THREE.MathUtils.lerp(this.arc.material.opacity, this.arc.visible ? .72 : 0, 1 - Math.exp(-24 * delta));
      this.arcCore.material.opacity = THREE.MathUtils.lerp(this.arcCore.material.opacity, this.arcCore.visible ? .96 : 0, 1 - Math.exp(-28 * delta));
    } else {
      this.root.position.x = THREE.MathUtils.damp(this.root.position.x, this.idlePosition.x, 14, delta);
      this.root.position.y = THREE.MathUtils.damp(this.root.position.y, this.idlePosition.y + bob, 14, delta);
      this.root.position.z = THREE.MathUtils.damp(this.root.position.z, this.idlePosition.z, 14, delta);
      this.root.rotation.x = THREE.MathUtils.damp(this.root.rotation.x, 0, 14, delta);
      this.root.rotation.y = THREE.MathUtils.damp(this.root.rotation.y, 0, 14, delta);
      this.root.rotation.z = THREE.MathUtils.damp(this.root.rotation.z, 0, 14, delta);
      this.arc.visible = false;
      this.arcCore.visible = false;
    }
    this.buckler.visible = guarding;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.arc.geometry.dispose();
    this.arc.material.dispose();
    this.arcCore.geometry.dispose();
    this.arcCore.material.dispose();
  }
}
