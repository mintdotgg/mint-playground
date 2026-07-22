"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { CatalogProduct } from "@/lib/products";
import { showroomAssets } from "@/lib/showroom-assets";
import { getShowroomProfile } from "./showroom-data";

type ShowroomStatus = "loading" | "ready" | "unsupported" | "error";

type ShowroomCanvasProps = {
	products: CatalogProduct[];
	selectedSlug: string;
	resetToken: number;
	onSelect: (slug: string) => void;
	onStatusChange: (status: ShowroomStatus) => void;
};

type ShowroomRuntime = {
	camera: THREE.PerspectiveCamera;
	controls: OrbitControls;
};

declare global {
	interface Window {
		__THREE_STORE_DIAGNOSTICS__?: {
			getCameraPose: () => { position: number[]; target: number[] };
			getSelectedSlug: () => string;
			renderer: THREE.WebGLInfo;
		};
	}
}

const CAMERA_POSITION = new THREE.Vector3(0, 2.65, 8.4);
const CAMERA_TARGET = new THREE.Vector3(0, 1.05, 0);

function getWrappedOffset(index: number, selectedIndex: number, length: number) {
	const rawOffset = index - selectedIndex;
	if (rawOffset > length / 2) return rawOffset - length;
	if (rawOffset < -length / 2) return rawOffset + length;
	return rawOffset;
}

function createArchitecture(scene: THREE.Scene) {
	const stone = new THREE.MeshStandardMaterial({ color: 0xc9c1b3, roughness: 0.92, metalness: 0.02 });
	const darkStone = new THREE.MeshStandardMaterial({ color: 0x25221f, roughness: 0.82, metalness: 0.08 });
	const bronze = new THREE.MeshStandardMaterial({ color: 0x624535, roughness: 0.48, metalness: 0.72 });
	const warmLight = new THREE.MeshBasicMaterial({ color: 0xf0ad67, toneMapped: false });

	const floor = new THREE.Mesh(new THREE.CircleGeometry(10.5, 72), stone);
	floor.rotation.x = -Math.PI / 2;
	floor.position.y = -0.52;
	floor.receiveShadow = true;
	scene.add(floor);

	const floorInset = new THREE.Mesh(new THREE.RingGeometry(4.7, 4.76, 96), bronze);
	floorInset.rotation.x = -Math.PI / 2;
	floorInset.position.y = -0.505;
	scene.add(floorInset);

	const backWall = new THREE.Mesh(new THREE.BoxGeometry(13.5, 5.8, 0.3), darkStone);
	backWall.position.set(0, 2.1, -4.15);
	backWall.receiveShadow = true;
	scene.add(backWall);

	const finGeometry = new THREE.BoxGeometry(0.13, 4.7, 0.45);
	const fins = Array.from({ length: 19 }).map((_, index) => {
		const fin = new THREE.Mesh(finGeometry, index % 5 === 0 ? bronze : darkStone);
		fin.position.set(-5.4 + index * 0.6, 1.65, -3.92);
		fin.castShadow = index % 3 === 0;
		return fin;
	});
	fins.map((fin) => scene.add(fin));

	const portal = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.045, 8, 96, Math.PI), bronze);
	portal.position.set(0, -0.25, -3.64);
	portal.rotation.z = Math.PI / 2;
	scene.add(portal);

	const lightGeometry = new THREE.BoxGeometry(0.035, 2.7, 0.035);
	[-4.15, 4.15].map((x) => {
		const blade = new THREE.Mesh(lightGeometry, warmLight);
		blade.position.set(x, 1.55, -3.6);
		scene.add(blade);
		return blade;
	});

	const pedestalGeometry = new THREE.CylinderGeometry(0.88, 1.04, 0.35, 48);
	[-3.9, 3.9].map((x) => {
		const pedestal = new THREE.Mesh(pedestalGeometry, darkStone);
		pedestal.position.set(x, -0.34, -1.15);
		pedestal.receiveShadow = true;
		pedestal.castShadow = true;
		scene.add(pedestal);
		return pedestal;
	});
}

async function loadImportedProps(scene: THREE.Scene, manager: THREE.LoadingManager) {
	const loader = new GLTFLoader(manager);
	return Promise.all(
		showroomAssets.fixtures.map(async (asset) => {
			const gltf = await loader.loadAsync(asset.path);
			const root = gltf.scene;
			const sourceBounds = new THREE.Box3().setFromObject(root);
			const sourceSize = sourceBounds.getSize(new THREE.Vector3());
			const scale = sourceSize.y > 0 ? asset.targetHeight / sourceSize.y : 1;
			root.scale.setScalar(scale);

			const normalizedBounds = new THREE.Box3().setFromObject(root);
			const normalizedCenter = normalizedBounds.getCenter(new THREE.Vector3());
			root.position.set(-normalizedCenter.x, -normalizedBounds.min.y, -normalizedCenter.z);
			root.traverse((object) => {
				if (!(object instanceof THREE.Mesh)) return;
				object.castShadow = true;
				object.receiveShadow = true;
			});

			const wrapper = new THREE.Group();
			wrapper.name = `mint-${asset.label.toLowerCase().replaceAll(" ", "-")}`;
			wrapper.position.set(asset.position[0], asset.position[1], asset.position[2]);
			wrapper.rotation.y = asset.rotationY;
			wrapper.add(root);
			scene.add(wrapper);
			return wrapper;
		}),
	);
}

function createProductDisplay(product: CatalogProduct, index: number) {
	const group = new THREE.Group();
	group.name = `display-${product.slug}`;

	const profile = getShowroomProfile(product.slug);
	const accentMaterial = new THREE.MeshStandardMaterial({
		color: profile.accent,
		roughness: 0.45,
		metalness: 0.35,
		emissive: profile.accent,
		emissiveIntensity: 0.12,
	});
	const accent = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.035, 32), accentMaterial);
	accent.position.set(0, 0.12, 0);
	group.add(accent);

	const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x292522, roughness: 0.7, metalness: 0.25 });
	const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 0.75, 18), stemMaterial);
	stem.position.y = -0.23;
	stem.castShadow = true;
	group.add(stem);

	const base = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 0.16, 36), stemMaterial);
	base.position.y = -0.6;
	base.receiveShadow = true;
	base.castShadow = true;
	group.add(base);

	const modelPivot = new THREE.Group();
	modelPivot.name = `mint-product-${product.slug}`;
	modelPivot.position.y = 0.15;
	group.add(modelPivot);

	const loadingMaterial = new THREE.MeshBasicMaterial({
		color: profile.accent,
		wireframe: true,
		transparent: true,
		opacity: 0.36,
	});
	const loadingMarker = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), loadingMaterial);
	loadingMarker.position.y = 0.54;
	modelPivot.add(loadingMarker);

	return {
		accentMaterial,
		group,
		slug: product.slug,
		index,
		loadingMarker,
		modelPivot,
		modelRotationY: 0,
	};
}

async function loadProductModels(
	displays: ReturnType<typeof createProductDisplay>[],
	manager: THREE.LoadingManager,
	pickTargets: THREE.Object3D[],
) {
	const loader = new GLTFLoader(manager);
	return Promise.all(
		displays.map(async (display) => {
			const asset = showroomAssets.products.find((candidate) => candidate.slug === display.slug);
			if (!asset) throw new Error(`Missing 3D product asset configuration for ${display.slug}`);

			const gltf = await loader.loadAsync(asset.path);
			const root = gltf.scene;
			const sourceBounds = new THREE.Box3().setFromObject(root);
			const sourceSize = sourceBounds.getSize(new THREE.Vector3());
			const largestDimension = Math.max(sourceSize.x, sourceSize.y, sourceSize.z);
			root.scale.setScalar(largestDimension > 0 ? asset.targetSize / largestDimension : 1);

			const normalizedBounds = new THREE.Box3().setFromObject(root);
			const normalizedCenter = normalizedBounds.getCenter(new THREE.Vector3());
			root.position.set(-normalizedCenter.x, -normalizedBounds.min.y, -normalizedCenter.z);
			const interactiveMeshes: THREE.Mesh[] = [];
			root.traverse((object) => {
				if (!(object instanceof THREE.Mesh)) return;
				object.castShadow = true;
				object.receiveShadow = true;
				object.userData.slug = display.slug;
				interactiveMeshes.push(object);
			});

			display.modelRotationY = asset.rotationY;
			display.modelPivot.rotation.y = asset.rotationY;
			display.loadingMarker.visible = false;
			display.modelPivot.add(root);
			pickTargets.push(...interactiveMeshes);
			return root;
		}),
	);
}

export function ShowroomCanvas({
	products,
	selectedSlug,
	resetToken,
	onSelect,
	onStatusChange,
}: ShowroomCanvasProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const selectedSlugRef = useRef(selectedSlug);
	const hoveredSlugRef = useRef<string | null>(null);
	const runtimeRef = useRef<ShowroomRuntime | null>(null);
	const onSelectRef = useRef(onSelect);

	useEffect(() => {
		selectedSlugRef.current = selectedSlug;
	}, [selectedSlug]);

	useEffect(() => {
		onSelectRef.current = onSelect;
	}, [onSelect]);

	useEffect(() => {
		const runtime = runtimeRef.current;
		if (!runtime || resetToken === 0) return;
		runtime.camera.position.copy(CAMERA_POSITION);
		runtime.controls.target.copy(CAMERA_TARGET);
		runtime.controls.update();
	}, [resetToken]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		if (!window.WebGLRenderingContext) {
			onStatusChange("unsupported");
			return;
		}

		onStatusChange("loading");
		let renderer: THREE.WebGLRenderer;
		try {
			renderer = new THREE.WebGLRenderer({
				antialias: true,
				alpha: false,
				powerPreference: "high-performance",
			});
		} catch {
			onStatusChange("unsupported");
			return;
		}

		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x171513);
		scene.fog = new THREE.FogExp2(0x171513, 0.044);

		const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 35);
		camera.position.copy(CAMERA_POSITION);
		camera.lookAt(CAMERA_TARGET);

		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.08;
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFShadowMap;
		container.appendChild(renderer.domElement);
		renderer.domElement.setAttribute("aria-label", "Interactive 3D product showroom");
		renderer.domElement.setAttribute("role", "img");

		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.dampingFactor = 0.065;
		controls.enablePan = true;
		controls.screenSpacePanning = true;
		controls.minDistance = 4.8;
		controls.maxDistance = 13.5;
		controls.minPolarAngle = Math.PI * 0.14;
		controls.maxPolarAngle = Math.PI * 0.72;
		controls.minAzimuthAngle = -Math.PI * 0.6;
		controls.maxAzimuthAngle = Math.PI * 0.6;
		controls.target.copy(CAMERA_TARGET);
		controls.update();
		runtimeRef.current = { camera, controls };

		const hemisphere = new THREE.HemisphereLight(0xf8eee0, 0x2c2520, 1.5);
		scene.add(hemisphere);

		const key = new THREE.DirectionalLight(0xffd9a5, 5.2);
		key.position.set(-3.8, 7, 5.8);
		key.castShadow = true;
		key.shadow.mapSize.set(1024, 1024);
		key.shadow.camera.near = 0.5;
		key.shadow.camera.far = 20;
		key.shadow.camera.left = -7;
		key.shadow.camera.right = 7;
		key.shadow.camera.top = 7;
		key.shadow.camera.bottom = -4;
		scene.add(key);

		const rim = new THREE.PointLight(0xc2583f, 28, 12, 1.8);
		rim.position.set(4.8, 2.4, -0.8);
		scene.add(rim);

		createArchitecture(scene);
		const manager = new THREE.LoadingManager();
		let loadHadError = false;
		const displays = products.map((product, index) => createProductDisplay(product, index));
		displays.map((display) => scene.add(display.group));
		const pickTargets: THREE.Object3D[] = [];
		void loadProductModels(displays, manager, pickTargets).catch(() => {
			loadHadError = true;
			onStatusChange("error");
		});
		void loadImportedProps(scene, manager).catch(() => {
			loadHadError = true;
			onStatusChange("error");
		});

		const raycaster = new THREE.Raycaster();
		const pointer = new THREE.Vector2();
		let pointerStart = { x: 0, y: 0 };
		let animationFrame = 0;
		let isVisible = document.visibilityState === "visible";
		let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

		const updatePointer = (event: PointerEvent) => {
			const bounds = renderer.domElement.getBoundingClientRect();
			pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
			pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
		};

		const getPickedSlug = () => {
			raycaster.setFromCamera(pointer, camera);
			const hit = raycaster.intersectObjects(pickTargets, false)[0];
			return typeof hit?.object.userData.slug === "string" ? hit.object.userData.slug : null;
		};

		const handlePointerDown = (event: PointerEvent) => {
			pointerStart = { x: event.clientX, y: event.clientY };
		};

		const handlePointerMove = (event: PointerEvent) => {
			updatePointer(event);
			hoveredSlugRef.current = getPickedSlug();
			renderer.domElement.style.cursor = hoveredSlugRef.current ? "pointer" : "grab";
		};

		const handlePointerUp = (event: PointerEvent) => {
			const distance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
			if (distance > 8) return;
			updatePointer(event);
			const slug = getPickedSlug();
			if (slug) onSelectRef.current(slug);
		};

		const handlePointerLeave = () => {
			hoveredSlugRef.current = null;
			renderer.domElement.style.cursor = "grab";
		};

		const handleVisibilityChange = () => {
			isVisible = document.visibilityState === "visible";
		};

		const handleReducedMotionChange = (event: MediaQueryListEvent) => {
			reducedMotion = event.matches;
			controls.enableDamping = !event.matches;
		};

		const resize = () => {
			const { width, height } = container.getBoundingClientRect();
			if (width === 0 || height === 0) return;
			const dprCap = width < 720 ? 1.45 : 1.8;
			renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
			renderer.setSize(width, height, false);
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
		};

		const resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(container);
		resize();

		renderer.domElement.addEventListener("pointerdown", handlePointerDown);
		renderer.domElement.addEventListener("pointermove", handlePointerMove, { passive: true });
		renderer.domElement.addEventListener("pointerup", handlePointerUp);
		renderer.domElement.addEventListener("pointercancel", handlePointerLeave);
		renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
		document.addEventListener("visibilitychange", handleVisibilityChange);
		reducedMotionQuery.addEventListener("change", handleReducedMotionChange);

		manager.onLoad = () => onStatusChange(loadHadError ? "error" : "ready");
		manager.onError = () => {
			loadHadError = true;
			onStatusChange("error");
		};

		const startTime = performance.now();
		const animate = () => {
			animationFrame = window.requestAnimationFrame(animate);
			if (!isVisible) return;

			const elapsed = (performance.now() - startTime) / 1000;
			const selectedIndex = Math.max(
				0,
				products.findIndex((product) => product.slug === selectedSlugRef.current),
			);

			displays.map((display) => {
				const offset = getWrappedOffset(display.index, selectedIndex, displays.length);
				const angle = offset * 0.56;
				const targetX = Math.sin(angle) * 4.2;
				const targetZ = 0.75 - Math.abs(offset) * 0.92;
				const targetY = 0.05 - Math.abs(offset) * 0.08;
				const isSelected = display.slug === selectedSlugRef.current;
				const isHovered = display.slug === hoveredSlugRef.current;
				const targetScale = isSelected ? 1 : isHovered ? 0.82 : 0.76;
				const interpolation = reducedMotion ? 1 : 0.085;

				display.group.position.x = THREE.MathUtils.lerp(display.group.position.x, targetX, interpolation);
				display.group.position.y = THREE.MathUtils.lerp(
					display.group.position.y,
					targetY + (reducedMotion ? 0 : Math.sin(elapsed * 0.72 + display.index) * 0.018),
					interpolation,
				);
				display.group.position.z = THREE.MathUtils.lerp(display.group.position.z, targetZ, interpolation);
				display.group.rotation.y = THREE.MathUtils.lerp(
					display.group.rotation.y,
					-angle * 0.32,
					interpolation,
				);
				const displayScale = THREE.MathUtils.lerp(display.group.scale.x, targetScale, interpolation);
				display.group.scale.setScalar(displayScale);
				display.accentMaterial.emissiveIntensity = THREE.MathUtils.lerp(
					display.accentMaterial.emissiveIntensity,
					isSelected ? 0.68 : isHovered ? 0.42 : 0.12,
					0.12,
				);
				display.modelPivot.rotation.y =
					display.modelRotationY +
					(reducedMotion ? 0 : Math.sin(elapsed * 0.46 + display.index * 0.7) * (isSelected ? 0.16 : 0.06));
				display.loadingMarker.rotation.x = elapsed * 0.45;
				display.loadingMarker.rotation.y = elapsed * 0.7;
				return display;
			});

			controls.target.x = THREE.MathUtils.clamp(controls.target.x, -2.75, 2.75);
			controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0.4, 2.1);
			controls.target.z = THREE.MathUtils.clamp(controls.target.z, -1.2, 1.5);
			controls.update();
			renderer.render(scene, camera);
		};

		const diagnosticsEnabled =
			process.env.NODE_ENV !== "production" ||
			new URLSearchParams(window.location.search).has("threeDiagnostics");
		if (diagnosticsEnabled) {
			window.__THREE_STORE_DIAGNOSTICS__ = {
				getCameraPose: () => ({
					position: camera.position.toArray(),
					target: controls.target.toArray(),
				}),
				getSelectedSlug: () => selectedSlugRef.current,
				renderer: renderer.info,
			};
		}
		animate();

		return () => {
			window.cancelAnimationFrame(animationFrame);
			resizeObserver.disconnect();
			renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
			renderer.domElement.removeEventListener("pointermove", handlePointerMove);
			renderer.domElement.removeEventListener("pointerup", handlePointerUp);
			renderer.domElement.removeEventListener("pointercancel", handlePointerLeave);
			renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
			controls.dispose();
			const disposedGeometries = new Set<THREE.BufferGeometry>();
			const disposedMaterials = new Set<THREE.Material>();
			const disposedTextures = new Set<THREE.Texture>();
			scene.traverse((object) => {
				if (!(object instanceof THREE.Mesh)) return;
				if (!disposedGeometries.has(object.geometry)) {
					object.geometry.dispose();
					disposedGeometries.add(object.geometry);
				}
				const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
				objectMaterials.map((material) => {
					if (disposedMaterials.has(material)) return material;
					Object.values(material).map((value) => {
						if (!(value instanceof THREE.Texture) || disposedTextures.has(value)) return value;
						value.dispose();
						disposedTextures.add(value);
						return value;
					});
					material.dispose();
					disposedMaterials.add(material);
					return material;
				});
			});
			renderer.dispose();
			renderer.forceContextLoss();
			renderer.domElement.remove();
			runtimeRef.current = null;
			if (diagnosticsEnabled) delete window.__THREE_STORE_DIAGNOSTICS__;
		};
	}, [products, onStatusChange]);

	return <div ref={containerRef} className="absolute inset-0" />;
}
