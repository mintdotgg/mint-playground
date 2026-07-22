"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export type ProductCardModelStatus = "loading" | "ready" | "unsupported" | "error";

type ProductCardModelCanvasProps = {
	accent: number;
	initialRotationY: number;
	modelPath: string;
	productName: string;
	onStatusChange: (status: ProductCardModelStatus) => void;
};

const CAMERA_POSITION = new THREE.Vector3(3.1, 1.55, 5.25);
const CAMERA_TARGET = new THREE.Vector3(0, 0, 0);

export function ProductCardModelCanvas({
	accent,
	initialRotationY,
	modelPath,
	productName,
	onStatusChange,
}: ProductCardModelCanvasProps) {
	const containerRef = useRef<HTMLDivElement>(null);

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
				alpha: true,
				antialias: true,
				powerPreference: "high-performance",
			});
		} catch {
			onStatusChange("unsupported");
			return;
		}

		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 30);
		camera.position.copy(CAMERA_POSITION);
		camera.lookAt(CAMERA_TARGET);
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.1;
		renderer.domElement.setAttribute("aria-label", `${productName} interactive 3D object`);
		renderer.domElement.setAttribute("role", "img");
		container.appendChild(renderer.domElement);

		const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = !reducedMotionQuery.matches;
		controls.dampingFactor = 0.075;
		controls.enablePan = false;
		controls.enableZoom = false;
		controls.autoRotate = !reducedMotionQuery.matches;
		controls.autoRotateSpeed = 0.48;
		controls.minPolarAngle = Math.PI * 0.25;
		controls.maxPolarAngle = Math.PI * 0.72;
		controls.enabled = !coarsePointerQuery.matches;
		controls.target.copy(CAMERA_TARGET);
		controls.update();
		renderer.domElement.style.cursor = coarsePointerQuery.matches ? "default" : "grab";
		renderer.domElement.style.touchAction = "pan-y";

		const hemisphere = new THREE.HemisphereLight(0xfff7e8, 0x3a302a, 2.5);
		scene.add(hemisphere);

		const key = new THREE.DirectionalLight(0xffddb2, 4.8);
		key.position.set(-4.2, 6, 5.2);
		scene.add(key);

		const fill = new THREE.DirectionalLight(0xaab7c7, 2.1);
		fill.position.set(4.5, 2.4, 3.2);
		scene.add(fill);

		const rim = new THREE.PointLight(accent, 18, 9, 1.7);
		rim.position.set(3.2, 2.1, -3.2);
		scene.add(rim);

		const platformMaterial = new THREE.MeshStandardMaterial({
			color: 0xcac4ba,
			metalness: 0.08,
			roughness: 0.82,
		});
		const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.5, 0.09, 64), platformMaterial);
		platform.position.y = -1.36;
		scene.add(platform);

		const ringMaterial = new THREE.MeshBasicMaterial({
			color: accent,
			transparent: true,
			opacity: 0.78,
			toneMapped: false,
		});
		const platformRing = new THREE.Mesh(new THREE.TorusGeometry(1.47, 0.018, 8, 96), ringMaterial);
		platformRing.rotation.x = Math.PI / 2;
		platformRing.position.y = -1.305;
		scene.add(platformRing);

		const manager = new THREE.LoadingManager();
		manager.onLoad = () => onStatusChange("ready");
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
				root.scale.setScalar(largestDimension > 0 ? 2.52 / largestDimension : 1);

				const normalizedBounds = new THREE.Box3().setFromObject(root);
				const normalizedCenter = normalizedBounds.getCenter(new THREE.Vector3());
				root.position.set(-normalizedCenter.x, -normalizedCenter.y, -normalizedCenter.z);
				scene.add(root);

				const finalBounds = new THREE.Box3().setFromObject(root);
				const sphere = finalBounds.getBoundingSphere(new THREE.Sphere());
				const fieldOfView = THREE.MathUtils.degToRad(camera.fov);
				const fitDistance = Math.max(3.7, (sphere.radius / Math.sin(fieldOfView / 2)) * 1.22);
				camera.position.copy(CAMERA_POSITION.clone().normalize().multiplyScalar(fitDistance));
				controls.update();

				const platformY = finalBounds.min.y - 0.08;
				platform.position.y = platformY - 0.045;
				platformRing.position.y = platformY + 0.002;
			},
			undefined,
			() => onStatusChange("error"),
		);

		let isVisible = document.visibilityState === "visible";
		let animationFrame = 0;
		const handleVisibilityChange = () => {
			isVisible = document.visibilityState === "visible";
		};
		const handleReducedMotionChange = (event: MediaQueryListEvent) => {
			controls.enableDamping = !event.matches;
			controls.autoRotate = !event.matches;
		};
		const handlePointerChange = (event: MediaQueryListEvent) => {
			controls.enabled = !event.matches;
			renderer.domElement.style.cursor = event.matches ? "default" : "grab";
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
			renderer.setPixelRatio(Math.min(window.devicePixelRatio, width < 480 ? 1.2 : 1.35));
			renderer.setSize(width, height, false);
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
		};

		const resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(container);
		resize();
		document.addEventListener("visibilitychange", handleVisibilityChange);
		reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
		coarsePointerQuery.addEventListener("change", handlePointerChange);
		controls.addEventListener("start", handleControlStart);
		controls.addEventListener("end", handleControlEnd);

		const animate = () => {
			animationFrame = window.requestAnimationFrame(animate);
			if (!isVisible) return;
			controls.update();
			renderer.render(scene, camera);
		};
		animate();

		return () => {
			window.cancelAnimationFrame(animationFrame);
			resizeObserver.disconnect();
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
			coarsePointerQuery.removeEventListener("change", handlePointerChange);
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
		};
	}, [accent, initialRotationY, modelPath, onStatusChange, productName]);

	return <div ref={containerRef} className="absolute inset-0" />;
}
