import * as THREE from 'three';
import type { RuntimeAssetRegistry } from '../assets/RuntimeAssetRegistry';
import type { MaterialLibrary } from '../assets/MaterialLibrary';
import { LANE_WIDTH, laneToWorldX } from '../game/spatial';
import type { CourseDefinition, CourseEntity } from '../game/types';
import { createSeededRandom } from '../utils/random';

const ROUTE_WIDTH = 7.55;
const ROUTE_RENDER_ORDER = -20;

export type WorldPathDiagnostics = {
  routeSurfaceCount: number;
  routeVisible: boolean;
  routeWidth: number;
  routeRenderOrder: number;
  nearestFinishZ: number;
  generatedBackdropActive: boolean;
  fallbackDressingVisible: boolean;
};

const TARGET_SIZE: Record<string, number> = {
  'coiled-hose': 1.5,
  'watering-can': 1.05,
  'raised-planter': 2.25,
  'tomato-cage': 1.65,
  'patio-chair': 1.6,
  wheelbarrow: 1.9,
  'pool-toy': 1.45,
  'folded-umbrella': 2.7,
  'recycle-bin': 1.85,
  'garden-gate': 3.25,
  'sprinkler-head': 1.05,
  'laundry-basket': 1.25,
  'garden-shed': 6.2,
  'finish-line': 7.3,
  'moon-token': 0.62,
  'cardboard-shield': 0.86,
  'garden-glove-magnet': 0.82,
  'dew-drop-boost': 0.78,
};

export class WorldBuilder {
  readonly root = new THREE.Group();
  readonly endless: boolean;
  private readonly dynamicRoot = new THREE.Group();
  private readonly environmentRoots: THREE.Group[] = [];
  private readonly dressingRoots: THREE.Group[] = [];
  private readonly groundSurfaces: THREE.Mesh[] = [];
  private readonly routeSurfaces: THREE.Mesh[] = [];
  private readonly routeTexture: THREE.CanvasTexture;
  private readonly routeMaterial: THREE.MeshBasicMaterial;
  private readonly active = new Map<string, THREE.Group>();
  private readonly pool = new Map<string, THREE.Group[]>();
  private readonly waterArcs: THREE.Mesh[] = [];
  private generatedBackdropActive = false;
  private time = 0;

  constructor(
    private readonly course: CourseDefinition,
    private readonly registry: RuntimeAssetRegistry,
    private readonly materials: MaterialLibrary,
    endless = false,
  ) {
    this.endless = endless;
    this.routeTexture = this.createRouteTexture();
    this.routeMaterial = new THREE.MeshBasicMaterial({
      map: this.routeTexture,
      color: '#ffffff',
      depthTest: false,
      depthWrite: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.root.name = 'backyard-dash-world';
    this.dynamicRoot.name = 'active-course-entities';
    this.root.add(this.dynamicRoot);
    const environmentCount = endless ? 3 : 1;
    for (let index = 0; index < environmentCount; index += 1) {
      const environment = new THREE.Group();
      const dressing = new THREE.Group();
      environment.name = `course-tile-${index}`;
      dressing.name = `lightweight-course-dressing-${index}`;
      this.environmentRoots.push(environment);
      this.dressingRoots.push(dressing);
      this.root.add(environment);
      this.createGround(environment);
      environment.add(dressing);
      this.createFences(dressing);
      this.createFoliage(dressing);
      this.createLandmarks(dressing);
      this.createFinishDetails(environment);
    }
    this.positionEnvironmentRoots(0);
  }

  get diagnostics(): WorldPathDiagnostics {
    const nearestFinishZ = this.environmentRoots.reduce((nearest, root) => Math.min(
      nearest,
      root.position.z + this.root.position.z + this.course.length - 8,
    ), Number.POSITIVE_INFINITY);
    return {
      routeSurfaceCount: this.routeSurfaces.length,
      routeVisible: this.routeSurfaces.length > 0 && this.routeSurfaces.every((surface) => surface.visible),
      routeWidth: ROUTE_WIDTH,
      routeRenderOrder: ROUTE_RENDER_ORDER,
      nearestFinishZ,
      generatedBackdropActive: this.generatedBackdropActive,
      fallbackDressingVisible: this.dressingRoots.some((dressing) => dressing.visible),
    };
  }

  setGeneratedBackdropActive(active: boolean): void {
    this.generatedBackdropActive = active;
    // The fences, foliage, and landmarks are a complete lightweight fallback,
    // not a second background. Once Mint is ready they would cover the splat
    // with low-poly scenery, so leave only the authored route and gameplay
    // entities in front of the generated world.
    for (const dressing of this.dressingRoots) dressing.visible = !active;
    for (const surface of this.groundSurfaces) surface.scale.x = active ? 0.78 : 1;
  }

  syncEntities(entities: CourseEntity[]): void {
    const wanted = new Set(entities.map((entity) => entity.id));
    for (const [id, group] of this.active) {
      if (wanted.has(id)) continue;
      this.active.delete(id);
      group.visible = false;
      const key = group.userData.poolKey as string;
      const list = this.pool.get(key) ?? [];
      list.push(group);
      this.pool.set(key, list);
    }

    for (const entity of entities) {
      let group = this.active.get(entity.id);
      if (!group) {
        group = this.acquire(entity);
        group.userData.entity = entity;
        this.active.set(entity.id, group);
      }
      group.visible = true;
      group.position.set(laneToWorldX(entity.lane), 0, entity.distance);
      if (entity.obstacleType === 'ramp') group.rotation.x = -0.24;
    }
  }

  update(delta: number, reducedMotion: boolean, playerDistance = 0): void {
    this.time += delta;
    this.positionEnvironmentRoots(playerDistance);
    // The chase camera and Mint backdrop now live at a fixed presentation
    // origin. Scroll the lightweight gameplay course instead of translating
    // the generated environment every frame.
    this.root.position.z = -playerDistance;
    for (const [id, group] of this.active) {
      const entity = group.userData.entity as CourseEntity;
      if (entity.kind === 'token') {
        group.rotation.y = reducedMotion ? 0.35 : this.time * 2.4 + id.length;
        group.position.y = 0.72 + (reducedMotion ? 0 : Math.sin(this.time * 3.4 + id.length) * 0.09);
      } else if (entity.kind === 'powerup') {
        group.rotation.y = reducedMotion ? 0.2 : this.time * 1.4;
        group.position.y = 0.72 + (reducedMotion ? 0 : Math.sin(this.time * 2.6 + id.length) * 0.12);
      } else if (entity.obstacleType === 'sprinkler') {
        group.rotation.y = reducedMotion ? 0.25 : this.time * 2.1;
      }
    }
    this.waterArcs.forEach((arc, index) => {
      arc.visible = this.active.has(arc.userData.entityId as string);
      if (!reducedMotion) arc.rotation.y = Math.sin(this.time * 1.7 + index) * 0.8;
    });
  }

  dispose(): void {
    this.root.traverse((object) => {
      if (object instanceof THREE.InstancedMesh || (object instanceof THREE.Mesh && object.userData.ownedGeometry)) object.geometry.dispose();
      if (object instanceof THREE.Mesh && object.userData.ownedMaterial) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.dispose();
      }
    });
    this.routeMaterial.dispose();
    this.routeTexture.dispose();
  }

  private acquire(entity: CourseEntity): THREE.Group {
    const poolKey = this.poolKey(entity);
    const pooled = this.pool.get(poolKey)?.pop();
    if (pooled) {
      pooled.userData.entity = entity;
      pooled.traverse((object) => {
        if (typeof object.userData.entityId === 'string') object.userData.entityId = entity.id;
      });
      return pooled;
    }
    const group = this.createEntityVisual(entity);
    group.userData.poolKey = poolKey;
    this.dynamicRoot.add(group);
    return group;
  }

  private poolKey(entity: CourseEntity): string {
    if (entity.obstacleType === 'soft-soil' || entity.obstacleType === 'puddle' || entity.obstacleType === 'boost-strip') return entity.obstacleType;
    return entity.assetKey;
  }

  private createEntityVisual(entity: CourseEntity): THREE.Group {
    if (entity.obstacleType === 'soft-soil') return this.createGroundPatch('#5b432f', 2.05, 3.5);
    if (entity.obstacleType === 'puddle') return this.createGroundPatch('#477b79', 2.1, 3.1, true);
    if (entity.obstacleType === 'boost-strip') return this.createBoostStrip();
    const model = this.registry.createModel(entity.assetKey, TARGET_SIZE[entity.assetKey] ?? 1.35);
    if (entity.kind === 'token' || entity.kind === 'powerup') {
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.5, 24),
        new THREE.MeshBasicMaterial({ color: entity.kind === 'token' ? '#ffd86b' : '#87dfd4', transparent: true, opacity: 0.46, side: THREE.DoubleSide, depthWrite: false }),
      );
      halo.rotation.x = -Math.PI / 2;
      halo.userData.ownedGeometry = true;
      halo.userData.ownedMaterial = true;
      model.add(halo);
    }
    if (entity.obstacleType === 'sprinkler') this.attachWaterArc(model, entity.id);
    return model;
  }

  private createGroundPatch(color: string, width: number, depth: number, transparent = false): THREE.Group {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color, roughness: transparent ? 0.22 : 0.98, metalness: 0, transparent, opacity: transparent ? 0.74 : 1 });
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(width / 2, 18), material);
    mesh.scale.z = depth / width;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.018;
    mesh.userData.ownedGeometry = true;
    mesh.userData.ownedMaterial = true;
    group.add(mesh);
    return group;
  }

  private createBoostStrip(): THREE.Group {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 5.2), this.materials.shieldBoost);
    base.rotation.x = -Math.PI / 2;
    base.position.y = 0.025;
    base.userData.ownedGeometry = true;
    group.add(base);
    const chevronMaterial = new THREE.MeshBasicMaterial({ color: '#d9fff7', transparent: true, opacity: 0.82, side: THREE.DoubleSide });
    for (let index = 0; index < 3; index += 1) {
      const shape = new THREE.Shape();
      shape.moveTo(-0.55, -0.24);
      shape.lineTo(0, 0.28);
      shape.lineTo(0.55, -0.24);
      shape.lineTo(0.38, -0.42);
      shape.lineTo(0, -0.04);
      shape.lineTo(-0.38, -0.42);
      const chevron = new THREE.Mesh(new THREE.ShapeGeometry(shape), chevronMaterial);
      chevron.rotation.x = -Math.PI / 2;
      chevron.position.set(0, 0.032, -1.45 + index * 1.45);
      chevron.userData.ownedGeometry = true;
      group.add(chevron);
    }
    return group;
  }

  private attachWaterArc(parent: THREE.Group, entityId: string): void {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-1.65, 0.25, 0), new THREE.Vector3(0, 2.4, 0), new THREE.Vector3(1.65, 0.25, 0));
    const geometry = new THREE.TubeGeometry(curve, 18, 0.025, 5, false);
    const material = new THREE.MeshBasicMaterial({ color: '#b8edf0', transparent: true, opacity: 0.55 });
    const arc = new THREE.Mesh(geometry, material);
    arc.userData.entityId = entityId;
    arc.userData.ownedGeometry = true;
    arc.userData.ownedMaterial = true;
    parent.add(arc);
    this.waterArcs.push(arc);
  }

  private createGround(parent: THREE.Group): void {
    for (const section of this.course.sections) {
      const material =
        section.ground === 'soil' ? this.materials.soil :
          section.ground === 'lawn-wet' ? this.materials.wetGrass :
            section.ground === 'patio' ? this.materials.patio :
              section.ground === 'cedar' ? this.materials.grass : this.materials.grass;
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(9.8, section.end - section.start), material);
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(0, 0, (section.start + section.end) / 2);
      ground.receiveShadow = true;
      ground.userData.ownedGeometry = true;
      this.groundSurfaces.push(ground);
      parent.add(ground);

      // This unlit authored ribbon is deliberately separate from Mint's
      // generated world. The splat corridor is masked in MintWorldStream, so
      // this surface stays readable even when a source scene contains a tree,
      // wall, or dense foliage on the gameplay line.
      const route = new THREE.Mesh(
        new THREE.PlaneGeometry(ROUTE_WIDTH, section.end - section.start),
        this.routeMaterial,
      );
      route.name = `always-visible-route-${section.index}`;
      route.rotation.x = -Math.PI / 2;
      route.position.set(0, 0.042, (section.start + section.end) / 2);
      route.renderOrder = ROUTE_RENDER_ORDER;
      route.receiveShadow = false;
      route.userData.ownedGeometry = true;
      route.userData.gameplayRoute = true;
      this.routeSurfaces.push(route);
      parent.add(route);

      const laneGeometry = new THREE.PlaneGeometry(0.045, section.end - section.start - 2);
      for (const x of [-LANE_WIDTH / 2, LANE_WIDTH / 2]) {
        const line = new THREE.Mesh(laneGeometry, this.materials.decalLight);
        line.rotation.x = -Math.PI / 2;
        line.position.set(x, 0.012, (section.start + section.end) / 2);
        line.userData.ownedGeometry = true;
        parent.add(line);
      }

      const entry = this.createSectionMarker(section.shortName);
      entry.position.set(-4.35, 0.04, section.start + 6);
      entry.rotation.x = -Math.PI / 2;
      parent.add(entry);
    }
  }

  private createFences(parent: THREE.Group): void {
    const segmentLength = 7.5;
    const countPerSide = Math.ceil(this.course.length / segmentLength);
    const geometry = new THREE.BoxGeometry(0.28, 1.95, segmentLength - 0.08);
    const fences = new THREE.InstancedMesh(geometry, this.materials.cedar, countPerSide * 2);
    fences.castShadow = true;
    fences.receiveShadow = true;
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < countPerSide; index += 1) {
      const z = index * segmentLength + segmentLength / 2;
      matrix.makeTranslation(-5.1, 0.98, z);
      fences.setMatrixAt(index * 2, matrix);
      matrix.makeTranslation(5.1, 0.98, z);
      fences.setMatrixAt(index * 2 + 1, matrix);
    }
    fences.instanceMatrix.needsUpdate = true;
    parent.add(fences);
  }

  private createFoliage(parent: THREE.Group): void {
    const rng = createSeededRandom(this.course.seed + 99);
    const count = 260;
    const geometry = new THREE.ConeGeometry(0.24, 0.72, 5);
    const plants = new THREE.InstancedMesh(geometry, this.materials.foliage, count);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    for (let index = 0; index < count; index += 1) {
      const side = rng() < 0.5 ? -1 : 1;
      const x = side * (5.35 + rng() * 2.4);
      const z = rng() * this.course.length;
      const size = 0.7 + rng() * 1.35;
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI);
      scale.set(size, size, size);
      matrix.compose(new THREE.Vector3(x, 0.36 * size, z), quaternion, scale);
      plants.setMatrixAt(index, matrix);
    }
    plants.instanceMatrix.needsUpdate = true;
    parent.add(plants);
  }

  private createLandmarks(parent: THREE.Group): void {
    const landmarkMap: Record<string, { key: string; size: number }> = {
      'garden-shed': { key: 'garden-shed', size: 6.2 },
      'raised-planter': { key: 'raised-planter', size: 2.6 },
      'sprinkler-head': { key: 'sprinkler-head', size: 1.3 },
      'folded-umbrella': { key: 'folded-umbrella', size: 3.1 },
      'finish-line': { key: 'finish-line', size: 7.3 },
    };
    for (const section of this.course.sections) {
      const config = landmarkMap[section.landmarkKey];
      if (!config) continue;
      const model = this.registry.createModel(config.key, config.size);
      model.position.set(section.index % 2 === 0 ? -6.4 : 6.4, 0, section.start + 24);
      model.rotation.y = section.index % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
      parent.add(model);
    }
  }

  private createFinishDetails(parent: THREE.Group): void {
    const finish = this.registry.createModel('finish-line', 7.3);
    finish.position.set(0, 0, this.course.length - 8);
    finish.rotation.y = Math.PI;
    parent.add(finish);

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = '#f3dfb1';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = '#8d5d3b';
      context.lineWidth = 18;
      context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
      context.fillStyle = '#2f493d';
      context.font = '900 94px system-ui';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(this.endless ? 'KEEP GOING!' : 'JIMOTHY’S DASH', canvas.width / 2, canvas.height / 2 + 5);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 1.48), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
    banner.position.set(0, 3.55, this.course.length - 8.1);
    banner.userData.ownedGeometry = true;
    banner.userData.ownedMaterial = true;
    parent.add(banner);

    const finishStripe = new THREE.Mesh(new THREE.PlaneGeometry(8.7, 1.25), this.materials.decalLight);
    finishStripe.rotation.x = -Math.PI / 2;
    finishStripe.position.set(0, 0.025, this.course.length);
    finishStripe.userData.ownedGeometry = true;
    parent.add(finishStripe);
  }

  private positionEnvironmentRoots(playerDistance: number): void {
    if (!this.endless) {
      this.environmentRoots[0]?.position.set(0, 0, 0);
      return;
    }
    const currentLap = Math.max(0, Math.floor(playerDistance / this.course.length));
    this.environmentRoots.forEach((root, index) => {
      // Keep only the current and upcoming tiles. A previous tile places its
      // finish banner just behind the chase camera at lap start, where the
      // double-sided banner fills the viewport backwards.
      root.position.set(0, 0, (currentLap + index) * this.course.length);
    });
  }

  private createRouteTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const context = canvas.getContext('2d');
    if (context) {
      const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#355f48');
      gradient.addColorStop(0.08, '#4f7953');
      gradient.addColorStop(0.5, '#62885b');
      gradient.addColorStop(0.92, '#4f7953');
      gradient.addColorStop(1, '#355f48');
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);

      // Alternating lane tint makes direction readable without looking like a
      // flat road pasted over the backyard.
      context.fillStyle = 'rgba(231, 218, 166, 0.055)';
      context.fillRect(canvas.width / 3, 0, canvas.width / 3, canvas.height);
      context.fillStyle = 'rgba(20, 50, 35, 0.08)';
      context.fillRect(0, 0, canvas.width / 3, canvas.height);
      context.fillRect(canvas.width * 2 / 3, 0, canvas.width / 3, canvas.height);

      context.strokeStyle = 'rgba(247, 226, 164, 0.78)';
      context.lineWidth = 7;
      context.setLineDash([42, 34]);
      for (const x of [canvas.width / 3, canvas.width * 2 / 3]) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, canvas.height);
        context.stroke();
      }
      context.setLineDash([]);
      context.lineWidth = 13;
      context.strokeStyle = '#e6c35f';
      context.strokeRect(7, 0, canvas.width - 14, canvas.height);

      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = 'rgba(244, 228, 189, 0.52)';
      context.lineWidth = 8;
      for (let y = 92; y < canvas.height; y += 184) {
        for (let lane = 0; lane < 3; lane += 1) {
          const centerX = (lane + 0.5) * canvas.width / 3;
          context.beginPath();
          context.moveTo(centerX - 21, y + 24);
          context.lineTo(centerX, y);
          context.lineTo(centerX + 21, y + 24);
          context.stroke();
        }
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  private createSectionMarker(text: string): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = '#e8d59d';
      context.fillRect(0, 0, 512, 128);
      context.fillStyle = '#2b4438';
      context.font = '900 62px system-ui';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, 256, 66);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.62), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }));
    mesh.userData.ownedGeometry = true;
    mesh.userData.ownedMaterial = true;
    return mesh;
  }
}
