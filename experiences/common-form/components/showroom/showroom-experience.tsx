"use client";

import { ArrowLeft, ArrowRight, Maximize2, Rotate3D, ShoppingBag, Volume2, VolumeX } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/app/cart/cart-context";
import { AppLink } from "@/components/app-link";
import { CURRENCY, LOCALE } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { catalogProducts } from "@/lib/products";
import { showroomAssets } from "@/lib/showroom-assets";
import styles from "./showroom.module.css";
import { getShowroomProfile } from "./showroom-data";

const ShowroomCanvas = dynamic(() => import("./showroom-canvas").then((module) => module.ShowroomCanvas), {
	ssr: false,
	loading: () => <div className={styles.canvasLoading}>Preparing the showroom</div>,
});

type ShowroomStatus = "loading" | "ready" | "unsupported" | "error";

const products = catalogProducts.slice(0, 6);

export function ShowroomExperience() {
	const { addItem, openCart } = useCart();
	const [selectedSlug, setSelectedSlug] = useState(products[0]?.slug ?? "");
	const [status, setStatus] = useState<ShowroomStatus>("loading");
	const [resetToken, setResetToken] = useState(0);
	const [soundEnabled, setSoundEnabled] = useState(false);
	const ambienceRef = useRef<HTMLAudioElement | null>(null);
	const selectionAudioRef = useRef<HTMLAudioElement | null>(null);

	const selectedIndex = Math.max(
		0,
		products.findIndex((product) => product.slug === selectedSlug),
	);
	const selectedProduct = products[selectedIndex] ?? products[0];
	const profile = getShowroomProfile(selectedProduct?.slug ?? "");
	const price = selectedProduct
		? formatMoney({ amount: selectedProduct.amount, currency: CURRENCY, locale: LOCALE })
		: "";

	const selectProduct = useCallback(
		(slug: string) => {
			if (soundEnabled && selectedSlug !== slug) {
				const selectionAudio = selectionAudioRef.current ?? new Audio(showroomAssets.audio.selection);
				selectionAudio.volume = 0.22;
				selectionAudio.currentTime = 0;
				selectionAudioRef.current = selectionAudio;
				void selectionAudio.play().catch(() => setSoundEnabled(false));
			}
			setSelectedSlug(slug);
		},
		[selectedSlug, soundEnabled],
	);

	const selectAt = useCallback(
		(index: number) => {
			if (!products.length) return;
			const wrappedIndex = (index + products.length) % products.length;
			const product = products[wrappedIndex];
			if (product) selectProduct(product.slug);
		},
		[selectProduct],
	);

	const toggleSound = useCallback(async () => {
		if (soundEnabled) {
			ambienceRef.current?.pause();
			setSoundEnabled(false);
			return;
		}

		const ambience = ambienceRef.current ?? new Audio(showroomAssets.audio.ambience);
		ambience.loop = true;
		ambience.volume = 0.12;
		ambienceRef.current = ambience;
		try {
			await ambience.play();
			setSoundEnabled(true);
		} catch {
			setSoundEnabled(false);
		}
	}, [soundEnabled]);

	useEffect(() => {
		const handleVisibilityChange = () => {
			const ambience = ambienceRef.current;
			if (!ambience || !soundEnabled) return;
			if (document.visibilityState === "hidden") {
				ambience.pause();
				return;
			}
			void ambience.play().catch(() => setSoundEnabled(false));
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [soundEnabled]);

	useEffect(
		() => () => {
			ambienceRef.current?.pause();
			selectionAudioRef.current?.pause();
		},
		[],
	);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLElement>) => {
			if (event.key === "ArrowLeft") {
				event.preventDefault();
				selectAt(selectedIndex - 1);
			}
			if (event.key === "ArrowRight") {
				event.preventDefault();
				selectAt(selectedIndex + 1);
			}
			if (event.key.toLowerCase() === "r") {
				event.preventDefault();
				setResetToken((current) => current + 1);
			}
		},
		[selectAt, selectedIndex],
	);

	const statusMessage = useMemo(() => {
		switch (status) {
			case "loading":
				return "Loading product gallery";
			case "unsupported":
				return "3D view unavailable. Use the product list below.";
			case "error":
				return "Some showroom media could not load. Product controls remain available.";
			case "ready":
				return "3D showroom ready";
		}
	}, [status]);

	if (!selectedProduct) return null;

	return (
		<section
			id="showroom"
			className={styles.showroom}
			aria-labelledby="showroom-title"
			onKeyDown={handleKeyDown}
		>
			<div className={styles.canvasShell} aria-hidden={status === "unsupported"}>
				<ShowroomCanvas
					products={products}
					selectedSlug={selectedSlug}
					resetToken={resetToken}
					onSelect={selectProduct}
					onStatusChange={setStatus}
				/>
			</div>

			<div className={styles.scrim} aria-hidden="true" />
			<div className={styles.grain} aria-hidden="true" />

			<div className={styles.content}>
				<div className={styles.kickerRow}>
					<p>Interactive collection / 2026</p>
					<p className={styles.status} role="status" aria-live="polite">
						<span className={status === "ready" ? styles.statusReady : styles.statusDot} />
						{statusMessage}
					</p>
				</div>

				<div className={styles.productCopy}>
					<p className={styles.collection}>{profile.collection}</p>
					<h1 id="showroom-title">{selectedProduct.name}</h1>
					<p className={styles.description}>{profile.note}</p>

					<dl className={styles.productMeta}>
						<div>
							<dt>Price</dt>
							<dd>{price}</dd>
						</div>
						<div>
							<dt>Material</dt>
							<dd>{profile.material}</dd>
						</div>
					</dl>

					<div className={styles.actions}>
						<button
							type="button"
							className={styles.primaryAction}
							disabled={!selectedProduct.inStock}
							onClick={() => {
								addItem(selectedProduct, 1);
								openCart();
							}}
						>
							<ShoppingBag aria-hidden="true" />
							{selectedProduct.inStock ? "Add to cart" : "Out of stock"}
						</button>
						<AppLink href={`/product/${selectedProduct.slug}`} prefetch="eager" className={styles.textAction}>
							View details
							<ArrowRight aria-hidden="true" />
						</AppLink>
					</div>
				</div>

				<div className={styles.navigator}>
					<div className={styles.arrowControls}>
						<button type="button" onClick={() => selectAt(selectedIndex - 1)} aria-label="Previous product">
							<ArrowLeft aria-hidden="true" />
						</button>
						<p>
							<span>{String(selectedIndex + 1).padStart(2, "0")}</span> /{" "}
							{String(products.length).padStart(2, "0")}
						</p>
						<button type="button" onClick={() => selectAt(selectedIndex + 1)} aria-label="Next product">
							<ArrowRight aria-hidden="true" />
						</button>
					</div>

					<div className={styles.productRail} role="group" aria-label="Choose a product">
						{products.map((product, index) => (
							<button
								type="button"
								key={product.slug}
								className={product.slug === selectedSlug ? styles.railItemActive : styles.railItem}
								onClick={() => selectProduct(product.slug)}
								aria-pressed={product.slug === selectedSlug}
							>
								<span className={styles.railImage}>
									<Image
										src={product.images[0] ?? "https://cdn.mint.gg/images/models/everyday-tote-e7e38680279b2df1.webp"}
										alt=""
										fill
										sizes="72px"
									/>
								</span>
								<span className={styles.railLabel}>
									<small>{String(index + 1).padStart(2, "0")}</small>
									{product.name}
								</span>
							</button>
						))}
					</div>
				</div>

				<div className={styles.viewerControls} role="toolbar" aria-label="3D viewer controls">
					<span>
						<Rotate3D aria-hidden="true" /> Drag to look around
					</span>
					<span>
						<Maximize2 aria-hidden="true" /> Right-drag to pan · scroll to zoom
					</span>
					<button type="button" onClick={toggleSound} aria-pressed={soundEnabled}>
						{soundEnabled ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
						{soundEnabled ? "Sound on" : "Sound off"}
					</button>
					<button type="button" onClick={() => setResetToken((current) => current + 1)}>
						R&nbsp; Reset view
					</button>
				</div>
			</div>
		</section>
	);
}
