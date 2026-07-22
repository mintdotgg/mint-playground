"use client";

import { Rotate3D } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { showroomAssets } from "@/lib/showroom-assets";
import styles from "./product-card-model.module.css";
import type { ProductCardModelStatus } from "./product-card-model-canvas";
import { getShowroomProfile } from "./showroom/showroom-data";

const ProductCardModelCanvas = dynamic(
	() => import("./product-card-model-canvas").then((module) => module.ProductCardModelCanvas),
	{ ssr: false },
);

type ProductCardModelProps = {
	productName: string;
	productSlug: string;
};

export function ProductCardModel({ productName, productSlug }: ProductCardModelProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [shouldRender, setShouldRender] = useState(false);
	const [status, setStatus] = useState<ProductCardModelStatus>("loading");
	const asset = showroomAssets.products.find((candidate) => candidate.slug === productSlug);
	const profile = getShowroomProfile(productSlug);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		if (!("IntersectionObserver" in window)) {
			const renderTimer = globalThis.setTimeout(() => setShouldRender(true), 0);
			return () => globalThis.clearTimeout(renderTimer);
		}

		const observer = new IntersectionObserver(
			(entries) => setShouldRender(entries[0]?.isIntersecting ?? false),
			{ rootMargin: "80px 0px" },
		);
		observer.observe(container);
		return () => observer.disconnect();
	}, []);

	const statusMessage = (() => {
		if (!asset) return "3D object unavailable";
		switch (status) {
			case "loading":
				return "Loading 3D object";
			case "ready":
				return "Interactive 3D object";
			case "unsupported":
				return "3D view unavailable";
			case "error":
				return "3D object could not load";
		}
	})();

	return (
		<div
			ref={containerRef}
			className={styles.model}
			data-model-status={asset && shouldRender ? status : "waiting"}
			data-product-model={productSlug}
		>
			{asset && shouldRender && (
				<div className={styles.canvasShell}>
					<ProductCardModelCanvas
						accent={profile.accent}
						initialRotationY={asset.rotationY}
						modelPath={asset.path}
						productName={productName}
						onStatusChange={setStatus}
					/>
				</div>
			)}

			<p className={styles.status} role="status" aria-live="polite">
				<span className={status === "ready" && shouldRender ? styles.readyDot : styles.statusDot} />
				{asset && !shouldRender ? "Preparing 3D object" : statusMessage}
			</p>
			<p className={styles.hint} aria-hidden="true">
				<Rotate3D />
				<span className={styles.pointerHint}>Drag to rotate</span>
				<span className={styles.touchHint}>Auto-rotating 3D</span>
			</p>
		</div>
	);
}
