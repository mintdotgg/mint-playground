"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export type ProductModelStatus = "loading" | "ready" | "unsupported" | "error";

type ProductModelCanvasProps = {
	accent: number;
	autoRotate: boolean;
	initialRotationY: number;
	modelPath: string;
	productName: string;
	resetToken: number;
	onProgress: (progress: number) => void;
	onStatusChange: (status: ProductModelStatus) => void;
};

type ProductViewerRuntime = {
	camera: THREE.PerspectiveCamera;
	controls: OrbitControls;
	homePosition: THREE.Vector3;
};

declare global {
	interface Window {
		__THREE_PRODUCT_DIAGNOSTICS__?: {
			getCameraPose: () => { position: number[]; target: number[] };
			modelPath: string;
			renderer: THREE.WebGLInfo;
		};
	}
}

const DEFAULT_CAMERA_POSITION = new THREE.Vector3(3.25, 1.9, 5.1);
const CAMERA_TARGET = new THREE.Vector3(0, 0, 0);

export function ProductModelCanvas({
	accent,
	autoRotate,
	initialRotationY,
	modelPath,
	productName,
	resetToken,
	onProgress,
	onStatusChange,
}: ProductModelCanvasProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const runtimeRef = useRef<ProductViewerRuntime | null>(null);
	const autoRotateRef = useRef(autoRotate);

	useEffect(() => {
		autoRotateRef.current = autoRotate;
		const runtime = runtimeRef.current;
		if (!runtime) return;
		const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		runtime.controls.autoRotate = autoRotate && !reducedMotion;
	}, [autoRotate]);

	useEffect(() => {
		const runtime = runtimeRef.current;
		if (!runtime || resetToken === 0) return;
		runtime.camera.position.copy(runtime.homePosition);
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

		onProgress(0);
		onStatusChange("loading");
		let renderer: THREE.WebGLRenderer;
		try {
			renderer = new THREE.WebGLRenderer({
				alpha: true,
				antialias: true,
				powerPreference: "high-performance",
			});
		} catch {
			onStatusChange("unsupported");
			return;
		}

		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
		camera.position.copy(DEFAULT_CAMERA_POSITION);
		camera.lookAt(CAMERA_TARGET);

		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.12;
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFShadowMap;
		renderer.domElement.setAttribute("aria-label", `${productName} interactive 3D model`);
		renderer.domElement.setAttribute("role", "img");
		container.appendChild(renderer.domElement);

		const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = !reducedMotionQuery.matches;
		controls.dampingFactor = 0.065;
		controls.enablePan = false;
		controls.autoRotate = autoRotateRef.current && !reducedMotionQuery.matches;
		controls.autoRotateSpeed = 0.65;
		controls.minDistance = 2.5;
		controls.maxDistance = 9;
		controls.minPolarAngle = Math.PI * 0.04;
		controls.maxPolarAngle = Math.PI * 0.96;
		controls.target.copy(CAMERA_TARGET);
		controls.update();
		runtimeRef.current = {
			camera,
			controls,
			homePosition: DEFAULT_CAMERA_POSITION.clone(),
		};

		const hemisphere = new THREE.HemisphereLight(0xfff4df, 0x2b211b, 2.3);
		scene.add(hemisphere);

		const key = new THREE.DirectionalLight(0xffdfb7, 5.4);
		key.position.set(-4.5, 6.5, 5.2);
		key.castShadow = true;
		key.shadow.mapSize.set(1024, 1024);
		key.shadow.camera.near = 0.5;
		key.shadow.camera.far = 20;
		key.shadow.camera.left = -4;
		key.shadow.camera.right = 4;
		key.shadow.camera.top = 4;
		key.shadow.camera.bottom = -4;
		scene.add(key);

		const fill = new THREE.DirectionalLight(0x9ba8b8, 2.2);
		fill.position.set(4.5, 2.5, 3.5);
		scene.add(fill);

		const rim = new THREE.PointLight(accent, 26, 12, 1.6);
		rim.position.set(3.5, 2.4, -3.5);
		scene.add(rim);

		const displayGroup = new THREE.Group();
		displayGroup.name = `detail-model-${productName.toLowerCase().replaceAll(" ", "-")}`;
		scene.add(displayGroup);

		const accentMaterial = new THREE.MeshBasicMaterial({
			color: accent,
			transparent: true,
			opacity: 0.72,
			toneMapped: false,
		});
		const orbitRing = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.012, 8, 128), accentMaterial);
		orbitRing.rotation.x = Math.PI / 2;
		orbitRing.position.y = -1.35;
		scene.add(orbitRing);

		const shadowMaterial = new THREE.MeshBasicMaterial({
			color: 0x080706,
			transparent: true,
			opacity: 0.28,
			depthWrite: false,
			side: THREE.DoubleSide,
		});
		const contactShadow = new THREE.Mesh(new THREE.CircleGeometry(1.35, 64), shadowMaterial);
		contactShadow.rotation.x = -Math.PI / 2;
		contactShadow.position.y = -1.37;
		scene.add(contactShadow);

		const manager = new THREE.LoadingManager();
		manager.onProgress = (_, loaded, total) => onProgress(total > 0 ? Math.round((loaded / total) * 100) : 0);
		manager.onLoad = () => {
			onProgress(100);
			onStatusChange("ready");
		};
		manager.onError = () => onStatusChange("error");

		const loader = new GLTFLoader(manager);
		loader.load(
			modelPath,
			(gltf) => {
				const root = gltf.scene;
				root.rotation.y = initialRotationY;
				const sourceBounds = new THREE.Box3().setFromObject(root);
				const sourceSize = sourceBounds.getSize(new THREE.Vector3());
				const largestDimension = Math.max(sourceSize.x, sourceSize.y, sourceSize.z);
				root.scale.setScalar(largestDimension > 0 ? 2.7 / largestDimension : 1);

				const normalizedBounds = new THREE.Box3().setFromObject(root);
				const normalizedCenter = normalizedBounds.getCenter(new THREE.Vector3());
				root.position.set(-normalizedCenter.x, -normalizedCenter.y, -normalizedCenter.z);
				root.traverse((object) => {
					if (!(object instanceof THREE.Mesh)) return;
					object.castShadow = true;
					object.receiveShadow = true;
				});
				displayGroup.add(root);

				const finalBounds = new THREE.Box3().setFromObject(displayGroup);
				const sphere = finalBounds.getBoundingSphere(new THREE.Sphere());
				const verticalFieldOfView = THREE.MathUtils.degToRad(camera.fov);
				const fitDistance = Math.max(3.8, (sphere.radius / Math.sin(verticalFieldOfView / 2)) * 1.12);
				const homeDirection = DEFAULT_CAMERA_POSITION.clone().normalize();
				const homePosition = homeDirection.multiplyScalar(fitDistance);
				camera.position.copy(homePosition);
				controls.minDistance = Math.max(2.4, sphere.radius * 1.45);
				controls.maxDistance = Math.max(8.5, sphere.radius * 5.5);
				controls.update();
				if (runtimeRef.current) runtimeRef.current.homePosition.copy(homePosition);

				const baseY = finalBounds.min.y - 0.08;
				orbitRing.position.y = baseY;
				contactShadow.position.y = baseY - 0.015;
			},
			undefined,
			() => onStatusChange("error"),
		);

		let isVisible = document.visibilityState === "visible";
		let reducedMotion = reducedMotionQuery.matches;
		let animationFrame = 0;

		const handleVisibilityChange = () => {
			isVisible = document.visibilityState === "visible";
		};
		const handleReducedMotionChange = (event: MediaQueryListEvent) => {
			reducedMotion = event.matches;
			controls.enableDamping = !event.matches;
			controls.autoRotate = autoRotateRef.current && !event.matches;
		};
		const handleControlStart = () => {
			renderer.domElement.style.cursor = "grabbing";
		};
		const handleControlEnd = () => {
			renderer.domElement.style.cursor = "grab";
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
		document.addEventListener("visibilitychange", handleVisibilityChange);
		reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
		controls.addEventListener("start", handleControlStart);
		controls.addEventListener("end", handleControlEnd);
		renderer.domElement.style.cursor = "grab";

		const startTime = performance.now();
		const animate = () => {
			animationFrame = window.requestAnimationFrame(animate);
			if (!isVisible) return;
			const elapsed = (performance.now() - startTime) / 1000;
			orbitRing.rotation.z = reducedMotion ? 0 : elapsed * 0.05;
			controls.update();
			renderer.render(scene, camera);
		};

		const diagnosticsEnabled =
			process.env.NODE_ENV !== "production" ||
			new URLSearchParams(window.location.search).has("threeDiagnostics");
		if (diagnosticsEnabled) {
			window.__THREE_PRODUCT_DIAGNOSTICS__ = {
				getCameraPose: () => ({
					position: camera.position.toArray(),
					target: controls.target.toArray(),
				}),
				modelPath,
				renderer: renderer.info,
			};
		}
		animate();

		return () => {
			window.cancelAnimationFrame(animationFrame);
			resizeObserver.disconnect();
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
			controls.removeEventListener("start", handleControlStart);
			controls.removeEventListener("end", handleControlEnd);
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
			if (diagnosticsEnabled) delete window.__THREE_PRODUCT_DIAGNOSTICS__;
		};
	}, [accent, initialRotationY, modelPath, onProgress, onStatusChange, productName]);

	return <div ref={containerRef} className="absolute inset-0" />;
}
