"use client";

import { Expand, Pause, Play, Rotate3D, RotateCcw, ZoomIn } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getShowroomProfile } from "@/components/showroom/showroom-data";
import { showroomAssets } from "@/lib/showroom-assets";
import type { ProductModelStatus } from "./product-model-canvas";
import styles from "./product-model-viewer.module.css";

const ProductModelCanvas = dynamic(
	() => import("./product-model-canvas").then((module) => module.ProductModelCanvas),
	{
		ssr: false,
		loading: () => <div className={styles.canvasLoading}>Preparing interactive model</div>,
	},
);

type ProductModelViewerProps = {
	productName: string;
	productSlug: string;
};

export function ProductModelViewer({ productName, productSlug }: ProductModelViewerProps) {
	const viewerRef = useRef<HTMLDivElement>(null);
	const [status, setStatus] = useState<ProductModelStatus>("loading");
	const [progress, setProgress] = useState(0);
	const [autoRotate, setAutoRotate] = useState(true);
	const [resetToken, setResetToken] = useState(0);
	const [fullscreenAvailable, setFullscreenAvailable] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const asset = showroomAssets.products.find((candidate) => candidate.slug === productSlug);
	const profile = getShowroomProfile(productSlug);

	useEffect(() => {
		const availabilityTimer = window.setTimeout(
			() => setFullscreenAvailable(Boolean(document.fullscreenEnabled)),
			0,
		);
		const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement === viewerRef.current);
		document.addEventListener("fullscreenchange", handleFullscreenChange);
		return () => {
			window.clearTimeout(availabilityTimer);
			document.removeEventListener("fullscreenchange", handleFullscreenChange);
		};
	}, []);

	const toggleFullscreen = useCallback(async () => {
		const viewer = viewerRef.current;
		if (!viewer || !document.fullscreenEnabled) return;
		try {
			if (document.fullscreenElement === viewer) {
				await document.exitFullscreen();
				return;
			}
			await viewer.requestFullscreen();
		} catch {
			setFullscreenAvailable(false);
		}
	}, []);

	const statusMessage = useMemo(() => {
		switch (status) {
			case "loading":
				return `Loading 3D object${progress > 0 ? ` · ${progress}%` : ""}`;
			case "ready":
				return "Interactive 3D object ready";
			case "unsupported":
				return "3D viewing is not supported in this browser";
			case "error":
				return "The 3D object could not be loaded";
		}
	}, [progress, status]);

	if (!asset) {
		return (
			<div className={styles.viewerUnavailable} role="status">
				<p>Interactive model unavailable for this product.</p>
			</div>
		);
	}

	return (
		<div ref={viewerRef} className={styles.viewer} data-fullscreen={isFullscreen || undefined}>
			<div className={styles.canvasShell} aria-hidden={status === "unsupported"}>
				<ProductModelCanvas
					accent={profile.accent}
					autoRotate={autoRotate}
					initialRotationY={asset.rotationY}
					modelPath={asset.path}
					productName={productName}
					resetToken={resetToken}
					onProgress={setProgress}
					onStatusChange={setStatus}
				/>
			</div>

			<div className={styles.viewerHeader}>
				<p>Object / 360° inspection</p>
				<p className={styles.status} role="status" aria-live="polite">
					<span className={status === "ready" ? styles.statusReady : styles.statusDot} />
					{statusMessage}
				</p>
			</div>

			<div className={styles.viewerHint} aria-hidden="true">
				<span>
					<Rotate3D /> Drag to see every side
				</span>
				<span>
					<ZoomIn /> Scroll or pinch to zoom
				</span>
			</div>

			<div className={styles.controls} role="toolbar" aria-label={`${productName} 3D viewer controls`}>
				<button type="button" onClick={() => setAutoRotate((current) => !current)} aria-pressed={autoRotate}>
					{autoRotate ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
					{autoRotate ? "Pause rotation" : "Auto rotate"}
				</button>
				<button type="button" onClick={() => setResetToken((current) => current + 1)}>
					<RotateCcw aria-hidden="true" /> Reset view
				</button>
				<button type="button" onClick={toggleFullscreen} disabled={!fullscreenAvailable}>
					<Expand aria-hidden="true" /> {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
				</button>
			</div>
		</div>
	);
}
