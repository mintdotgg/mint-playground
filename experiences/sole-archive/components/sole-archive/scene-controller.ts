import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { ArchiveSceneState, SceneDiagnostics, SceneStatus } from "@/components/sole-archive/types";
import { getMintMaterialAssets, getMintMaterialId } from "@/lib/mint/sole-archive-assets";
import type { CatalogProduct } from "@/lib/products";

type SceneControllerOptions = {
	canvas: HTMLCanvasElement;
	onStatus: (status: SceneStatus) => void;
	onDiagnostics: (diagnostics: SceneDiagnostics) => void;
};

type ModelSlot = {
	wrapper: THREE.Group;
	model: THREE.Group;
	productSlug: string;
	usingMintModel: boolean;
};

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const MODEL_FORWARD = new THREE.Vector3(0, 0, 1);
const ACID = new THREE.Color("#c7ff1a");
const COLD_WHITE = new THREE.Color("#e8eee8");
const CONCRETE = new THREE.Color("#252a27");

function makeExtrudedShape(points: Array<[number, number]>, depth: number, bevelSize: number) {
	const shape = new THREE.Shape();
	points.map(([x, y], index) => (index === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
	shape.closePath();
	const geometry = new THREE.ExtrudeGeometry(shape, {
		depth,
		bevelEnabled: true,
		bevelSegments: 3,
		bevelSize,
		bevelThickness: bevelSize,
		curveSegments: 6,
	});
	geometry.translate(0, 0, -depth / 2);
	geometry.computeVertexNormals();
	return geometry;
}

function markExplodable(object: THREE.Object3D, offset: THREE.Vector3) {
	object.userData.basePosition = object.position.clone();
	object.userData.explodeOffset = offset;
}

function buildProceduralShoe(product: CatalogProduct) {
	const group = new THREE.Group();
	group.name = `fallback-${product.slug}`;

	const colorway =
		product.colorways.find((candidate) => candidate.id === product.defaultColorwayId) ?? product.colorways[0];
	const upperMaterial = new THREE.MeshStandardMaterial({
		name: "upper-material",
		color: colorway?.upper ?? "#777b76",
		roughness: 0.72,
		metalness: 0.02,
	});
	const overlayMaterial = new THREE.MeshPhysicalMaterial({
		name: "overlay-material",
		color: colorway?.upper ?? "#777b76",
		roughness: 0.38,
		metalness: 0.05,
		clearcoat: 0.18,
	});
	const accentMaterial = new THREE.MeshStandardMaterial({
		name: "accent-material",
		color: colorway?.accent ?? "#c7ff1a",
		emissive: colorway?.accent ?? "#c7ff1a",
		emissiveIntensity: 0.12,
		roughness: 0.48,
	});
	const soleMaterial = new THREE.MeshStandardMaterial({
		name: "sole-material",
		color: colorway?.sole ?? "#232724",
		roughness: 0.86,
		metalness: 0,
	});

	const outsole = new THREE.Mesh(
		makeExtrudedShape(
			[
				[-1.75, 0],
				[-1.52, -0.1],
				[1.35, -0.1],
				[1.72, 0.08],
				[1.55, 0.34],
				[-1.48, 0.3],
			],
			1.02,
			0.08,
		),
		soleMaterial,
	);
	outsole.name = "outsole";
	outsole.position.y = 0.18;
	outsole.castShadow = true;
	markExplodable(outsole, new THREE.Vector3(0, -0.7, 0));
	group.add(outsole);

	const midsole = new THREE.Mesh(
		makeExtrudedShape(
			[
				[-1.62, 0],
				[-1.35, -0.03],
				[1.32, 0],
				[1.58, 0.16],
				[1.42, 0.43],
				[-1.38, 0.4],
			],
			0.94,
			0.07,
		),
		new THREE.MeshStandardMaterial({ color: "#a8ada7", roughness: 0.58 }),
	);
	midsole.name = "midsole";
	midsole.position.y = 0.42;
	midsole.castShadow = true;
	markExplodable(midsole, new THREE.Vector3(0, -0.2, 0));
	group.add(midsole);

	const upper = new THREE.Mesh(
		makeExtrudedShape(
			[
				[-1.38, 0],
				[-1.08, 0.18],
				[-0.42, 0.38],
				[0.12, 1.18],
				[0.72, 1.44],
				[1.18, 1.15],
				[1.36, 0.12],
			],
			0.78,
			0.07,
		),
		upperMaterial,
	);
	upper.name = "upper";
	upper.position.y = 0.66;
	upper.castShadow = true;
	markExplodable(upper, new THREE.Vector3(-0.28, 0.45, 0));
	group.add(upper);

	const quarter = new THREE.Mesh(
		makeExtrudedShape(
			[
				[-0.35, 0.12],
				[0.06, 0.92],
				[0.68, 1.14],
				[0.92, 0.35],
				[0.45, 0.03],
			],
			0.04,
			0.025,
		),
		overlayMaterial,
	);
	quarter.name = "overlay-quarter";
	quarter.position.set(0, 0.78, 0.43);
	markExplodable(quarter, new THREE.Vector3(0, 0.2, 0.72));
	group.add(quarter);

	const toeOverlay = new THREE.Mesh(
		makeExtrudedShape(
			[
				[-1.4, 0.08],
				[-0.94, 0.42],
				[-0.28, 0.3],
				[-0.5, 0.05],
			],
			0.05,
			0.025,
		),
		overlayMaterial,
	);
	toeOverlay.name = "overlay-toe";
	toeOverlay.position.set(0, 0.72, 0.43);
	markExplodable(toeOverlay, new THREE.Vector3(-0.45, 0.1, 0.62));
	group.add(toeOverlay);

	const heelCage = new THREE.Mesh(
		new THREE.TorusGeometry(0.53, 0.055, 8, 30, Math.PI * 1.35),
		accentMaterial,
	);
	heelCage.name = "heel-cage-accent";
	heelCage.rotation.set(Math.PI / 2, 0.25, -0.15);
	heelCage.position.set(0.9, 1.3, 0.08);
	markExplodable(heelCage, new THREE.Vector3(0.72, 0.38, 0));
	group.add(heelCage);

	const laceGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.82, 8);
	Array.from({ length: 6 }).map((_, index) => {
		const lace = new THREE.Mesh(laceGeometry, accentMaterial);
		lace.name = `lace-${index}`;
		lace.rotation.set(Math.PI / 2, 0, Math.PI / 2 + (index % 2 === 0 ? 0.25 : -0.25));
		lace.position.set(-0.2 + index * 0.16, 1.37 + index * 0.045, 0.46);
		markExplodable(lace, new THREE.Vector3(0, 0.9 + index * 0.05, 0.4));
		group.add(lace);
		return lace;
	});

	const stitchCurve = new THREE.CatmullRomCurve3([
		new THREE.Vector3(-1.15, 0.96, 0.49),
		new THREE.Vector3(-0.55, 1.05, 0.5),
		new THREE.Vector3(0.05, 1.14, 0.5),
		new THREE.Vector3(0.62, 1.13, 0.5),
	]);
	const stitching = new THREE.Mesh(new THREE.TubeGeometry(stitchCurve, 36, 0.014, 5, false), accentMaterial);
	stitching.name = "stitching-accent";
	markExplodable(stitching, new THREE.Vector3(0, 0.46, 0.78));
	group.add(stitching);

	group.rotation.y = -0.2;
	group.scale.setScalar(1.05);
	return group;
}

function disposeObject(object: THREE.Object3D) {
	object.traverse((child) => {
		if (!(child instanceof THREE.Mesh)) return;
		child.geometry.dispose();
		const materials = Array.isArray(child.material) ? child.material : [child.material];
		materials.map((material) => material.dispose());
	});
}

function normalizeImportedModel(scene: THREE.Group) {
	const sourceBounds = new THREE.Box3().setFromObject(scene);
	const sourceSize = sourceBounds.getSize(new THREE.Vector3());
	const sourceCenter = sourceBounds.getCenter(new THREE.Vector3());
	if (sourceSize.z > sourceSize.x) scene.rotation.y = Math.PI / 2;
	scene.updateMatrixWorld(true);
	const bounds = new THREE.Box3().setFromObject(scene);
	const size = bounds.getSize(new THREE.Vector3());
	const largest = Math.max(size.x, size.y, size.z, 0.001);
	const scale = 3.6 / largest;
	scene.scale.setScalar(scale);
	const normalizedBounds = new THREE.Box3().setFromObject(scene);
	const normalizedCenter = normalizedBounds.getCenter(new THREE.Vector3());
	scene.position.sub(normalizedCenter);
	const grounded = new THREE.Box3().setFromObject(scene);
	scene.position.y -= grounded.min.y;
	scene.userData.canonicalBasis = {
		worldUp: WORLD_UP.toArray(),
		modelForward: MODEL_FORWARD.toArray(),
		originalCenter: sourceCenter.toArray(),
	};

	const meshes: THREE.Mesh[] = [];
	scene.traverse((child) => {
		if (child instanceof THREE.Mesh) meshes.push(child);
	});
	meshes.map((mesh) => {
		mesh.castShadow = true;
		mesh.receiveShadow = false;
		return mesh;
	});
	return scene;
}

export class SoleArchiveScene {
	private readonly renderer: THREE.WebGLRenderer;
	private readonly scene = new THREE.Scene();
	private readonly camera: THREE.PerspectiveCamera;
	private readonly controls: OrbitControls;
	private readonly loader = new GLTFLoader();
	private readonly textureLoader = new THREE.TextureLoader();
	private readonly materialTextures = new Map<string, THREE.Texture>();
	private readonly timer = new THREE.Timer();
	private readonly root = new THREE.Group();
	private readonly productStage = new THREE.Group();
	private readonly secondaryStage = new THREE.Group();
	private readonly explodedStudy = new THREE.Group();
	private readonly primaryPlinth = new THREE.Group();
	private readonly secondaryPlinth = new THREE.Group();
	private primarySlot?: ModelSlot;
	private secondarySlot?: ModelSlot;
	private frame = 0;
	private state?: ArchiveSceneState;
	private disposed = false;
	private targetCamera = new THREE.Vector3(4.8, 2.7, 5.4);
	private targetLookAt = new THREE.Vector3(0, 0.9, 0);
	private explodeProgress = 0;
	private liftProgress = 0;
	private readonly onStatus: SceneControllerOptions["onStatus"];
	private readonly onDiagnostics: SceneControllerOptions["onDiagnostics"];
	private lastDiagnosticTime = 0;

	constructor({ canvas, onStatus, onDiagnostics }: SceneControllerOptions) {
		this.onStatus = onStatus;
		this.onDiagnostics = onDiagnostics;
		this.onStatus("initializing");

		this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.03;
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFShadowMap;

		this.camera = new THREE.PerspectiveCamera(34, 1, 0.08, 80);
		this.camera.position.copy(this.targetCamera);
		this.camera.lookAt(this.targetLookAt);
		this.controls = new OrbitControls(this.camera, canvas);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.07;
		this.controls.enablePan = false;
		this.controls.minDistance = 3.3;
		this.controls.maxDistance = 9.5;
		this.controls.minPolarAngle = Math.PI * 0.18;
		this.controls.maxPolarAngle = Math.PI * 0.49;
		this.controls.target.copy(this.targetLookAt);

		this.scene.background = new THREE.Color("#111411");
		this.scene.fog = new THREE.FogExp2("#111411", 0.038);
		this.scene.add(this.root);
		this.root.add(this.productStage, this.secondaryStage, this.primaryPlinth, this.secondaryPlinth);
		this.secondaryStage.visible = false;
		this.secondaryPlinth.visible = false;
		this.explodedStudy.visible = false;
		this.productStage.add(this.explodedStudy);

		this.buildEnvironment();
		this.resize();
		window.addEventListener("resize", this.resize);
		this.frame = window.requestAnimationFrame(this.render);
		this.onStatus("ready");
	}

	private buildEnvironment() {
		const floorMaterial = new THREE.MeshStandardMaterial({
			color: CONCRETE,
			map: this.getMaterialTexture("board-formed-concrete"),
			roughness: 0.96,
			metalness: 0.01,
		});
		const wallMaterial = new THREE.MeshStandardMaterial({ color: "#1a1e1b", roughness: 0.88 });
		const metalMaterial = new THREE.MeshStandardMaterial({
			color: "#0d100f",
			roughness: 0.34,
			metalness: 0.72,
		});
		const polyMaterial = new THREE.MeshPhysicalMaterial({
			color: "#7d8983",
			roughness: 0.3,
			metalness: 0.04,
			transmission: 0.32,
			transparent: true,
			opacity: 0.44,
			thickness: 0.25,
		});

		const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 24), floorMaterial);
		floor.rotation.x = -Math.PI / 2;
		floor.position.y = -0.8;
		floor.receiveShadow = true;
		this.root.add(floor);

		const backWall = new THREE.Mesh(new THREE.PlaneGeometry(24, 9), wallMaterial);
		backWall.position.set(0, 4.5, -5.2);
		backWall.receiveShadow = true;
		this.root.add(backWall);

		const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(13, 9), wallMaterial);
		sideWall.rotation.y = Math.PI / 2;
		sideWall.position.set(-7.5, 4.5, 0);
		this.root.add(sideWall);

		const mirror = new THREE.Mesh(
			new THREE.PlaneGeometry(4.3, 5.7),
			new THREE.MeshPhysicalMaterial({ color: "#303833", roughness: 0.16, metalness: 0.82, clearcoat: 0.32 }),
		);
		mirror.position.set(4.2, 3.1, -5.12);
		this.root.add(mirror);

		const divider = new THREE.Mesh(new THREE.BoxGeometry(0.08, 4.8, 2.3), polyMaterial);
		divider.position.set(-4.3, 2.4, -1.1);
		this.root.add(divider);

		const shelfGeometry = new THREE.BoxGeometry(2.2, 0.07, 0.72);
		Array.from({ length: 5 }).map((_, index) => {
			const shelf = new THREE.Mesh(shelfGeometry, metalMaterial);
			shelf.position.set(-4.7 + index * 2.3, 3.3 + (index % 2) * 1.25, -4.75);
			this.root.add(shelf);
			const light = new THREE.Mesh(
				new THREE.BoxGeometry(1.85, 0.018, 0.07),
				new THREE.MeshBasicMaterial({ color: index === 4 ? ACID : COLD_WHITE, toneMapped: false }),
			);
			light.position.copy(shelf.position).add(new THREE.Vector3(0, -0.07, 0.3));
			this.root.add(light);
			return shelf;
		});

		const ambient = new THREE.HemisphereLight("#dfe8e1", "#111411", 1.35);
		this.scene.add(ambient);
		const key = new THREE.DirectionalLight("#f2f7f3", 3.6);
		key.position.set(-3.5, 7, 4.5);
		key.castShadow = true;
		key.shadow.mapSize.set(1536, 1536);
		key.shadow.camera.left = -6;
		key.shadow.camera.right = 6;
		key.shadow.camera.top = 6;
		key.shadow.camera.bottom = -3;
		key.shadow.bias = -0.0002;
		key.shadow.normalBias = 0.04;
		key.shadow.radius = 2;
		this.scene.add(key);
		const rim = new THREE.DirectionalLight("#c7ff1a", 1.45);
		rim.position.set(4, 3.5, -3);
		this.scene.add(rim);

		this.buildPlinth(this.primaryPlinth);
		this.buildPlinth(this.secondaryPlinth);
	}

	private getMaterialTexture(materialId: string) {
		const resolvedId = getMintMaterialId(materialId);
		const cached = this.materialTextures.get(resolvedId);
		if (cached) return cached;
		const texture = this.textureLoader.load(getMintMaterialAssets(resolvedId).baseColor);
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		const repeat = resolvedId === "board-formed-concrete" ? 5 : 2.5;
		texture.repeat.set(repeat, repeat);
		texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
		this.materialTextures.set(resolvedId, texture);
		return texture;
	}

	private buildPlinth(target: THREE.Group) {
		const base = new THREE.Mesh(
			new THREE.BoxGeometry(4.2, 0.78, 2.4),
			new THREE.MeshStandardMaterial({ color: "#353a36", roughness: 0.96, metalness: 0.01 }),
		);
		base.position.y = -0.39;
		base.receiveShadow = true;
		target.add(base);
		const line = new THREE.Mesh(
			new THREE.BoxGeometry(3.6, 0.025, 0.04),
			new THREE.MeshBasicMaterial({ color: ACID, toneMapped: false }),
		);
		line.position.set(0, 0.02, 1.15);
		target.add(line);
	}

	update(nextState: ArchiveSceneState) {
		const productChanged = this.state?.product.slug !== nextState.product.slug;
		const compareChanged = this.state?.compareProduct?.slug !== nextState.compareProduct?.slug;
		const modeChanged = this.state?.mode !== nextState.mode;
		this.state = nextState;

		if (productChanged) this.loadProduct(nextState.product, "primary");
		if (nextState.mode === "compare" && nextState.compareProduct && compareChanged) {
			this.loadProduct(nextState.compareProduct, "secondary");
		}
		this.applyMaterials(
			this.primarySlot,
			nextState.product,
			nextState.configuration.materialId,
			nextState.configuration.colorwayId,
		);
		this.updateComposition();
		if (modeChanged) this.resetView();
	}

	private loadProduct(product: CatalogProduct, slot: "primary" | "secondary") {
		const stage = slot === "primary" ? this.productStage : this.secondaryStage;
		const existing = slot === "primary" ? this.primarySlot : this.secondarySlot;
		if (existing?.productSlug === product.slug) return;
		if (existing) {
			stage.remove(existing.wrapper);
			disposeObject(existing.wrapper);
		}

		const wrapper = new THREE.Group();
		wrapper.name = `${slot}-${product.slug}-presentation`;
		const fallback = buildProceduralShoe(product);
		wrapper.add(fallback);
		stage.add(wrapper);
		const nextSlot = { wrapper, model: fallback, productSlug: product.slug, usingMintModel: false };
		if (slot === "primary") this.primarySlot = nextSlot;
		else this.secondarySlot = nextSlot;
		this.onStatus("loading-model");

		this.loader.load(
			product.modelPath,
			(gltf) => {
				if (this.disposed) return;
				const currentSlot = slot === "primary" ? this.primarySlot : this.secondarySlot;
				if (!currentSlot || currentSlot.productSlug !== product.slug) return;
				const imported = normalizeImportedModel(gltf.scene);
				currentSlot.wrapper.remove(currentSlot.model);
				disposeObject(currentSlot.model);
				currentSlot.model = imported;
				currentSlot.usingMintModel = true;
				currentSlot.wrapper.add(imported);
				this.applyMaterials(
					currentSlot,
					product,
					this.state?.configuration.materialId,
					this.state?.configuration.colorwayId,
				);
				this.onStatus("ready");
			},
			undefined,
			() => {
				if (slot === "primary") this.onStatus("fallback");
			},
		);
	}

	private applyMaterials(
		slot: ModelSlot | undefined,
		product: CatalogProduct,
		materialId?: string,
		colorwayId?: string,
	) {
		if (!slot) return;
		const material =
			product.materials.find((candidate) => candidate.id === materialId) ?? product.materials[0];
		const colorway =
			product.colorways.find((candidate) => candidate.id === colorwayId) ?? product.colorways[0];
		if (!material || !colorway) return;
		const materialTexture = this.getMaterialTexture(material.id);

		slot.model.traverse((child) => {
			if (!(child instanceof THREE.Mesh)) return;
			const name = child.name.toLowerCase();
			const source = Array.isArray(child.material) ? child.material[0] : child.material;
			const nextMaterial =
				source instanceof THREE.MeshStandardMaterial ? source.clone() : new THREE.MeshStandardMaterial();
			if (name.includes("sole") || name.includes("bottom")) {
				nextMaterial.color.set(colorway.sole);
				nextMaterial.roughness = 0.86;
				nextMaterial.metalness = 0;
			} else if (
				name.includes("lace") ||
				name.includes("stitch") ||
				name.includes("accent") ||
				name.includes("tab")
			) {
				nextMaterial.color.set(colorway.accent);
				nextMaterial.emissive.set(colorway.accent);
				nextMaterial.emissiveIntensity = 0.08;
			} else {
				nextMaterial.color.set(colorway.upper);
				nextMaterial.map = materialTexture;
				nextMaterial.roughness = material.roughness;
				nextMaterial.metalness = material.metalness;
			}
			if (child.material !== nextMaterial) {
				const previous = Array.isArray(child.material) ? child.material : [child.material];
				previous.map((entry) => entry.dispose());
				child.material = nextMaterial;
			}
		});
		if (slot === this.primarySlot && slot.usingMintModel) {
			this.buildExplodedStudy(slot, colorway.upper, colorway.sole, materialTexture);
		}
		this.syncExplodedVisibility();
	}

	private buildExplodedStudy(
		slot: ModelSlot,
		upperColor: string,
		soleColor: string,
		materialTexture: THREE.Texture,
	) {
		this.explodedStudy.children.map((child) => {
			child.traverse((descendant) => {
				if (!(descendant instanceof THREE.Mesh)) return;
				const materials = Array.isArray(descendant.material) ? descendant.material : [descendant.material];
				materials.map((entry) => entry.dispose());
			});
			this.explodedStudy.remove(child);
			return child;
		});

		const bounds = new THREE.Box3().setFromObject(slot.model);
		const height = Math.max(bounds.max.y - bounds.min.y, 0.001);
		const presentationScale = 0.64;
		const verticalStep = height * presentationScale + 0.22;
		const baseOffset = 0.5;
		const layers = [
			{ kind: "surface", offsetY: baseOffset + verticalStep * 2 },
			{ kind: "mesh", offsetY: baseOffset + verticalStep },
			{ kind: "ground", offsetY: baseOffset },
		] as const;

		layers.map((layer) => {
			const clone = slot.model.clone(true);
			clone.traverse((child) => {
				if (!(child instanceof THREE.Mesh)) return;
				child.castShadow = false;
				child.receiveShadow = false;
				child.material =
					layer.kind === "mesh"
						? new THREE.MeshBasicMaterial({
								color: ACID,
								wireframe: true,
								transparent: true,
								opacity: 0.88,
								depthWrite: false,
								toneMapped: false,
							})
						: new THREE.MeshStandardMaterial({
								color: layer.kind === "surface" ? upperColor : soleColor,
								map: layer.kind === "surface" ? materialTexture : null,
								roughness: layer.kind === "surface" ? 0.58 : 0.9,
								metalness: 0.02,
								emissive: layer.kind === "surface" ? "#ffffff" : "#7a827a",
								emissiveIntensity: layer.kind === "surface" ? 0.055 : 0.045,
							});
			});
			const layerGroup = new THREE.Group();
			layerGroup.scale.setScalar(presentationScale);
			layerGroup.position.y = layer.offsetY;
			layerGroup.add(clone);
			this.explodedStudy.add(layerGroup);
			return layerGroup;
		});
	}

	private syncExplodedVisibility() {
		const showStudy = this.state?.mode === "exploded" && (this.primarySlot?.usingMintModel ?? false);
		this.explodedStudy.visible = showStudy;
		if (this.primarySlot) this.primarySlot.wrapper.visible = !showStudy;
	}

	private updateComposition() {
		const compare = this.state?.mode === "compare";
		this.secondaryStage.visible = compare;
		this.secondaryPlinth.visible = compare;
		this.primaryPlinth.position.x = compare ? -2.15 : 0;
		this.productStage.position.x = compare ? -2.15 : 0;
		this.secondaryStage.position.x = 2.15;
		this.secondaryPlinth.position.x = 2.15;
		this.syncExplodedVisibility();

		const exploded = this.state?.mode === "exploded";
		this.targetCamera.set(
			compare ? 7.4 : exploded ? 7.6 : 4.8,
			compare ? 3.2 : exploded ? 4.8 : 2.7,
			compare ? 7.8 : exploded ? 10.8 : 5.4,
		);
		this.targetLookAt.set(0, compare ? 0.8 : exploded ? 2.35 : 0.9, 0);
		this.controls.minDistance = compare ? 6.2 : exploded ? 7.4 : 3.3;
		this.controls.maxDistance = compare ? 12 : exploded ? 14 : 9.5;
	}

	resetView() {
		this.camera.position.copy(this.targetCamera);
		this.controls.target.copy(this.targetLookAt);
		this.controls.update();
	}

	focusHotspot(position: [number, number, number]) {
		this.targetLookAt.set(...position);
		this.targetCamera.set(position[0] + 2.25, position[1] + 1.35, position[2] + 2.8);
		this.camera.position.lerp(this.targetCamera, 0.42);
	}

	private updateAnimatedState(delta: number) {
		const speed = Math.min(1, delta * 5.5);
		this.explodeProgress = THREE.MathUtils.lerp(
			this.explodeProgress,
			this.state?.mode === "exploded" ? 1 : 0,
			speed,
		);
		this.liftProgress = THREE.MathUtils.lerp(this.liftProgress, this.state?.mode === "lifted" ? 1 : 0, speed);
		this.productStage.position.y = THREE.MathUtils.lerp(
			this.productStage.position.y,
			this.liftProgress * 1.25,
			speed,
		);
		const rotationSpeed = this.state?.mode === "lifted" ? 0.22 : this.state?.mode === "inspect" ? 0.035 : 0;
		this.productStage.rotation.y += delta * rotationSpeed;

		const applyExplode = (slot?: ModelSlot) => {
			slot?.model.traverse((child) => {
				const base = child.userData.basePosition as THREE.Vector3 | undefined;
				const offset = child.userData.explodeOffset as THREE.Vector3 | undefined;
				if (!base || !offset) return;
				child.position.copy(base).addScaledVector(offset, this.explodeProgress);
			});
		};
		if (!this.primarySlot?.usingMintModel) applyExplode(this.primarySlot);
		this.explodedStudy.rotation.y = 0;
	}

	private resize = () => {
		const canvas = this.renderer.domElement;
		const width = Math.max(1, canvas.clientWidth);
		const height = Math.max(1, canvas.clientHeight);
		const mobile = width < 700;
		const dpr = Math.min(window.devicePixelRatio, mobile ? 1.5 : 2);
		this.renderer.setPixelRatio(dpr);
		this.renderer.setSize(width, height, false);
		this.camera.aspect = width / height;
		this.camera.fov = mobile ? 42 : 34;
		this.camera.updateProjectionMatrix();
	};

	private render = () => {
		if (this.disposed) return;
		this.timer.update();
		const delta = Math.min(this.timer.getDelta(), 0.05);
		this.updateAnimatedState(delta);
		this.controls.target.lerp(this.targetLookAt, Math.min(1, delta * 3.2));
		this.controls.update();
		this.renderer.render(this.scene, this.camera);
		const now = performance.now();
		if (now - this.lastDiagnosticTime > 1200) {
			this.lastDiagnosticTime = now;
			this.onDiagnostics({
				drawCalls: this.renderer.info.render.calls,
				triangles: this.renderer.info.render.triangles,
				geometries: this.renderer.info.memory.geometries,
				textures: this.renderer.info.memory.textures,
				dpr: this.renderer.getPixelRatio(),
				usingMintModel: this.primarySlot?.usingMintModel ?? false,
			});
		}
		this.frame = window.requestAnimationFrame(this.render);
	};

	dispose() {
		this.disposed = true;
		window.cancelAnimationFrame(this.frame);
		window.removeEventListener("resize", this.resize);
		this.controls.dispose();
		disposeObject(this.root);
		this.materialTextures.forEach((texture) => texture.dispose());
		this.materialTextures.clear();
		this.timer.dispose();
		this.renderer.dispose();
	}
}
