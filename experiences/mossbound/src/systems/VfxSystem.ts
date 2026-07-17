import * as THREE from 'three';

const MAX_PARTICLES = 144;
const SHOCKWAVE_COUNT = 12;
const EXPLOSION_RING_HEIGHT = .28;

type Particle = {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  spin: THREE.Vector3;
  life: number;
  duration: number;
  size: number;
};

type Shockwave = {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  active: boolean;
  delay: number;
  life: number;
  duration: number;
  startScale: number;
  maxScale: number;
  peakOpacity: number;
};

export class VfxSystem {
  private readonly particleGeometry = new THREE.TetrahedronGeometry(.075, 0);
  private readonly particleMaterial = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: .92,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  private readonly particleMesh = new THREE.InstancedMesh(this.particleGeometry, this.particleMaterial, MAX_PARTICLES);
  private readonly particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    active: false,
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    rotation: new THREE.Euler(),
    spin: new THREE.Vector3(),
    life: 0,
    duration: .55,
    size: 1,
  }));
  private readonly dummy = new THREE.Object3D();
  private readonly hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  private readonly ambientMotes = this.createAmbientMotes();
  private readonly shockwaveGeometry = new THREE.RingGeometry(.72, 1, 48);
  private readonly shockwaves: Shockwave[] = [];
  private readonly explosionDomeGeometry = new THREE.SphereGeometry(1, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  private readonly explosionDomeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uOpacity: { value: 0 },
      uGold: { value: new THREE.Color('#ffc94f') },
      uCyan: { value: new THREE.Color('#4cecff') },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying float vHeight;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vHeight = position.y;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uProgress;
      uniform float uOpacity;
      uniform vec3 uGold;
      uniform vec3 uCyan;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying float vHeight;
      void main() {
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - abs(dot(normalize(vWorldNormal), viewDirection)), 2.2);
        float ripple = 0.5 + 0.5 * sin(vHeight * 20.0 - uProgress * 18.0 + uTime * 1.5);
        float rippleLine = smoothstep(0.86, 1.0, ripple) * 0.16;
        float crown = smoothstep(0.0, 0.72, vHeight);
        vec3 color = mix(uGold, uCyan, crown * 0.72 + fresnel * 0.18);
        float alpha = (0.025 + fresnel * 0.72 + rippleLine) * uOpacity;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    depthTest: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  private readonly explosionDome = new THREE.Mesh(this.explosionDomeGeometry, this.explosionDomeMaterial);
  private particleCursor = 0;
  private shockwaveCursor = 0;
  private explosionDomeLife = 0;
  private explosionDomeDuration = .7;
  private explosionDomeRadius = 1;
  private explosionDomePeakOpacity = .38;

  constructor(private readonly scene: THREE.Scene) {
    this.particleMesh.name = 'PooledCombatShards';
    this.particleMesh.frustumCulled = false;
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let index = 0; index < MAX_PARTICLES; index += 1) {
      this.particleMesh.setMatrixAt(index, this.hiddenMatrix);
      this.particleMesh.setColorAt(index, new THREE.Color('#ffffff'));
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    this.particleMesh.instanceColor?.setUsage(THREE.DynamicDrawUsage);
    this.explosionDome.name = 'GroveBlastEnergyDome';
    this.explosionDome.visible = false;
    this.explosionDome.renderOrder = 4;
    this.scene.add(this.particleMesh, this.ambientMotes, this.explosionDome);

    for (let index = 0; index < SHOCKWAVE_COUNT; index += 1) {
      const mesh = new THREE.Mesh(
        this.shockwaveGeometry,
        new THREE.MeshBasicMaterial({
          color: '#4cecff',
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      mesh.renderOrder = 5;
      this.scene.add(mesh);
      this.shockwaves.push({ mesh, active: false, delay: 0, life: 0, duration: .38, startScale: .14, maxScale: 2, peakOpacity: .72 });
    }
  }

  burst(position: THREE.Vector3, color: THREE.ColorRepresentation, count: number, strength = 3): void {
    const tint = new THREE.Color(color);
    let emitted = 0;
    let attempts = 0;
    while (emitted < count && attempts < MAX_PARTICLES) {
      const index = this.particleCursor;
      this.particleCursor = (this.particleCursor + 1) % MAX_PARTICLES;
      attempts += 1;
      const particle = this.particles[index];
      if (particle.active) continue;

      const angle = (emitted + index * .37) * 2.399963;
      const band = emitted % 4;
      particle.active = true;
      particle.position.copy(position);
      particle.velocity.set(
        Math.sin(angle) * strength * (.45 + (emitted % 3) * .18),
        strength * (.52 + band * .18),
        Math.cos(angle) * strength * (.45 + ((emitted + 1) % 3) * .18),
      );
      particle.rotation.set(angle, angle * .7, 0);
      particle.spin.set(7 + band, 5 + (emitted % 5), 4 + (index % 4));
      particle.duration = .46 + band * .045;
      particle.life = particle.duration;
      particle.size = 1 + (emitted % 3) * .28;
      this.particleMesh.setColorAt(index, tint);
      emitted += 1;
    }
    if (emitted > 0 && this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
  }

  shockwave(position: THREE.Vector3, color: THREE.ColorRepresentation, scale = 2.4): void {
    this.startShockwave(position, color, scale, .38, 0, .72, .14);
  }

  radiantExplosion(position: THREE.Vector3, radius: number, reducedMotion = false): void {
    const ground = position.clone().setY(EXPLOSION_RING_HEIGHT);
    const center = position.clone().setY(.58);
    this.explosionDome.position.copy(position).setY(EXPLOSION_RING_HEIGHT - .03);
    this.explosionDome.scale.setScalar(.2);
    this.explosionDomeLife = reducedMotion ? .22 : .7;
    this.explosionDomeDuration = this.explosionDomeLife;
    this.explosionDomeRadius = radius * 1.03;
    this.explosionDomePeakOpacity = reducedMotion ? .18 : .38;
    this.explosionDomeMaterial.uniforms.uProgress.value = 0;
    this.explosionDomeMaterial.uniforms.uOpacity.value = this.explosionDomePeakOpacity;
    this.explosionDome.visible = true;
    if (reducedMotion) {
      this.startShockwave(ground, '#ffc94f', radius, .2, 0, .72, .18);
      this.burst(center, '#fff4c9', 10, 4.6);
      return;
    }

    const rings: ReadonlyArray<readonly [number, number, number, number, number, THREE.ColorRepresentation]> = [
      [.5, .42, 0, .98, .24, '#fff8d8'],
      [.61, .46, .035, .94, .2, '#ffc94f'],
      [.71, .5, .07, .88, .18, '#4cecff'],
      [.81, .55, .105, .8, .15, '#fff4c9'],
      [.9, .6, .14, .7, .13, '#ffc94f'],
      [.98, .65, .175, .62, .11, '#4cecff'],
      [1.05, .7, .21, .54, .09, '#fff4c9'],
      [1.12, .76, .25, .44, .07, '#ffc94f'],
    ];
    rings.forEach(([radiusScale, duration, delay, opacity, startScale, color], index) => {
      const ringPosition = ground.clone().setY(EXPLOSION_RING_HEIGHT + index * .014);
      this.startShockwave(ringPosition, color, radius * radiusScale, duration, delay, opacity, startScale);
    });
    this.burst(center, '#ffc94f', 36, 7.2);
    this.burst(center, '#efffff', 18, 5.4);
  }

  deathBurst(position: THREE.Vector3, color: THREE.ColorRepresentation): void {
    this.burst(position, color, 24, 4.8);
    this.burst(position, '#f8f1d7', 8, 3.5);
    const ground = position.clone().setY(.055);
    this.shockwave(ground, color, 3.1);
  }

  update(delta: number, elapsed: number): void {
    const ambientMaterial = this.ambientMotes.material as THREE.ShaderMaterial;
    ambientMaterial.uniforms.uTime.value = elapsed;

    if (this.explosionDomeLife > 0) {
      this.explosionDomeLife -= delta;
      const progress = THREE.MathUtils.clamp(1 - this.explosionDomeLife / this.explosionDomeDuration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.explosionDome.scale.setScalar(THREE.MathUtils.lerp(.2, this.explosionDomeRadius, eased));
      this.explosionDomeMaterial.uniforms.uTime.value = elapsed;
      this.explosionDomeMaterial.uniforms.uProgress.value = progress;
      this.explosionDomeMaterial.uniforms.uOpacity.value = (1 - progress) * this.explosionDomePeakOpacity;
      if (this.explosionDomeLife <= 0) this.explosionDome.visible = false;
    }

    let matricesChanged = false;
    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index];
      if (!particle.active) continue;
      particle.life -= delta;
      if (particle.life <= 0) {
        particle.active = false;
        this.particleMesh.setMatrixAt(index, this.hiddenMatrix);
        matricesChanged = true;
        continue;
      }

      particle.velocity.y -= 8.8 * delta;
      particle.velocity.multiplyScalar(Math.exp(-delta * .55));
      particle.position.addScaledVector(particle.velocity, delta);
      particle.rotation.x += particle.spin.x * delta;
      particle.rotation.y += particle.spin.y * delta;
      particle.rotation.z += particle.spin.z * delta;
      const progress = 1 - particle.life / particle.duration;
      const scale = particle.size * Math.sin(Math.min(1, progress * 1.18) * Math.PI);
      this.dummy.position.copy(particle.position);
      this.dummy.rotation.copy(particle.rotation);
      this.dummy.scale.setScalar(Math.max(.01, scale));
      this.dummy.updateMatrix();
      this.particleMesh.setMatrixAt(index, this.dummy.matrix);
      matricesChanged = true;
    }
    if (matricesChanged) this.particleMesh.instanceMatrix.needsUpdate = true;

    for (const wave of this.shockwaves) {
      if (!wave.active) continue;
      if (wave.delay > 0) {
        wave.delay -= delta;
        if (wave.delay > 0) continue;
        wave.mesh.material.opacity = wave.peakOpacity;
      }
      wave.life -= delta;
      if (wave.life <= 0) {
        wave.active = false;
        wave.mesh.visible = false;
        continue;
      }
      const progress = 1 - wave.life / wave.duration;
      const scale = THREE.MathUtils.lerp(wave.startScale, wave.maxScale, 1 - Math.pow(1 - progress, 3));
      wave.mesh.scale.setScalar(scale);
      wave.mesh.material.opacity = (1 - progress) * wave.peakOpacity;
    }
  }

  clearTransient(): void {
    for (let index = 0; index < this.particles.length; index += 1) {
      this.particles[index].active = false;
      this.particleMesh.setMatrixAt(index, this.hiddenMatrix);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    for (const wave of this.shockwaves) {
      wave.active = false;
      wave.mesh.visible = false;
    }
    this.explosionDomeLife = 0;
    this.explosionDome.visible = false;
  }

  dispose(): void {
    this.clearTransient();
    this.scene.remove(this.particleMesh, this.ambientMotes, this.explosionDome);
    for (const wave of this.shockwaves) {
      this.scene.remove(wave.mesh);
      wave.mesh.material.dispose();
    }
    this.particleGeometry.dispose();
    this.particleMaterial.dispose();
    this.shockwaveGeometry.dispose();
    this.explosionDomeGeometry.dispose();
    this.explosionDomeMaterial.dispose();
    this.ambientMotes.geometry.dispose();
    (this.ambientMotes.material as THREE.Material).dispose();
  }

  private startShockwave(
    position: THREE.Vector3,
    color: THREE.ColorRepresentation,
    maxScale: number,
    duration: number,
    delay: number,
    peakOpacity: number,
    startScale: number,
  ): void {
    let wave = this.shockwaves.find((candidate) => !candidate.active);
    if (!wave) {
      wave = this.shockwaves[this.shockwaveCursor];
      this.shockwaveCursor = (this.shockwaveCursor + 1) % this.shockwaves.length;
    }
    wave.active = true;
    wave.delay = delay;
    wave.duration = duration;
    wave.life = duration;
    wave.startScale = startScale;
    wave.maxScale = maxScale;
    wave.peakOpacity = peakOpacity;
    wave.mesh.position.copy(position);
    wave.mesh.position.y = Math.max(.045, position.y);
    wave.mesh.scale.setScalar(startScale);
    wave.mesh.material.color.set(color);
    wave.mesh.material.opacity = delay > 0 ? 0 : peakOpacity;
    wave.mesh.visible = true;
  }

  private createAmbientMotes(): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
    const count = 84;
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      const angle = index * 2.399963;
      const radius = 5 + (index % 22) * 1.05;
      positions[index * 3] = Math.sin(angle) * radius;
      positions[index * 3 + 1] = .65 + ((index * 17) % 37) * .13;
      positions[index * 3 + 2] = Math.cos(angle) * radius;
      phases[index] = (index * .618033) % 6.28318;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aPhase;
        uniform float uTime;
        varying float vPulse;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * .55 + aPhase) * .22;
          p.y += sin(uTime * .9 + aPhase * 1.7) * .16;
          p.z += cos(uTime * .48 + aPhase) * .2;
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          vPulse = .5 + .5 * sin(uTime * 2.1 + aPhase * 2.0);
          gl_PointSize = clamp((1.6 + vPulse * 1.4) * (12.0 / max(2.0, -mvPosition.z)), 1.0, 4.4);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vPulse;
        void main() {
          float distanceToCenter = length(gl_PointCoord - vec2(.5));
          float alpha = (1.0 - smoothstep(.08, .5, distanceToCenter)) * (.34 + vPulse * .48);
          vec3 color = mix(vec3(.28, .95, 1.0), vec3(.78, 1.0, .42), vPulse);
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });
    const points = new THREE.Points(geometry, material);
    points.name = 'GroveAmbientMotes';
    points.frustumCulled = false;
    return points;
  }
}
