"use client";

import {
	ArrowDownRight,
	Check,
	GitCompareArrows,
	Heart,
	Layers3,
	Maximize2,
	Rotate3D,
	ShoppingBag,
	Volume2,
	VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type CartConfiguration, useCart } from "@/app/cart/cart-context";
import {
	SoleArchiveCanvas,
	type SoleArchiveCanvasHandle,
} from "@/components/sole-archive/sole-archive-canvas";
import type { ArchiveConfiguration, ArchiveMode, SceneDiagnostics } from "@/components/sole-archive/types";
import { LOCALE } from "@/lib/constants";
import { soleArchiveAssets } from "@/lib/mint/sole-archive-assets";
import { formatMoney } from "@/lib/money";
import { catalogProducts } from "@/lib/products";

const WISHLIST_STORAGE_KEY = "sole_archive_wishlist_v1";
const audioPaths = {
	ambience: soleArchiveAssets.audio.ambience,
	material: soleArchiveAssets.audio.materialSwitch,
	cart: soleArchiveAssets.audio.cartConfirmation,
} as const;

function getInitialConfiguration(product: (typeof catalogProducts)[number]): ArchiveConfiguration {
	return {
		materialId: product.defaultMaterialId,
		colorwayId: product.defaultColorwayId,
		size: product.sizes.find((size) => (product.inventoryBySize[size] ?? 0) > 0) ?? product.sizes[0] ?? "",
	};
}

function useWishlist() {
	const [slugs, setSlugs] = useState<string[]>([]);
	const [hydrated, setHydrated] = useState(false);

	useEffect(() => {
		try {
			const raw = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
			const parsed: unknown = raw ? JSON.parse(raw) : [];
			if (Array.isArray(parsed)) setSlugs(parsed.filter((item): item is string => typeof item === "string"));
		} finally {
			setHydrated(true);
		}
	}, []);

	useEffect(() => {
		if (hydrated) window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(slugs));
	}, [hydrated, slugs]);

	const toggle = useCallback((slug: string) => {
		setSlugs((current) =>
			current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug],
		);
	}, []);

	return { slugs, toggle };
}

export function SoleArchiveExperience() {
	const [selectedSlug, setSelectedSlug] = useState(catalogProducts[0]?.slug ?? "");
	const product = catalogProducts.find((candidate) => candidate.slug === selectedSlug) ?? catalogProducts[0];
	const [configuration, setConfiguration] = useState<ArchiveConfiguration>(() =>
		getInitialConfiguration(product),
	);
	const [mode, setMode] = useState<ArchiveMode>("inspect");
	const [compareSlug, setCompareSlug] = useState(catalogProducts[1]?.slug ?? "");
	const [soundEnabled, setSoundEnabled] = useState(false);
	const [activeHotspot, setActiveHotspot] = useState(product.hotspots[0]?.id ?? "");
	const [diagnostics, setDiagnostics] = useState<SceneDiagnostics | null>(null);
	const canvasRef = useRef<SoleArchiveCanvasHandle>(null);
	const ambienceRef = useRef<HTMLAudioElement | null>(null);
	const previousConfigKey = useRef("");
	const { addItem, openCart } = useCart();
	const wishlist = useWishlist();

	const compareProduct = catalogProducts.find((candidate) => candidate.slug === compareSlug);
	const material =
		product.materials.find((candidate) => candidate.id === configuration.materialId) ?? product.materials[0];
	const colorway =
		product.colorways.find((candidate) => candidate.id === configuration.colorwayId) ?? product.colorways[0];
	const inventory = product.inventoryBySize[configuration.size] ?? 0;
	const isWishlisted = wishlist.slugs.includes(product.slug);

	const playSound = useCallback(
		(path: string, volume = 0.45) => {
			if (!soundEnabled) return;
			const audio = new Audio(path);
			audio.volume = volume;
			void audio.play().catch(() => undefined);
		},
		[soundEnabled],
	);

	useEffect(() => {
		const nextKey = `${configuration.materialId}-${configuration.colorwayId}`;
		if (previousConfigKey.current && previousConfigKey.current !== nextKey)
			playSound(audioPaths.material, 0.32);
		previousConfigKey.current = nextKey;
	}, [configuration.colorwayId, configuration.materialId, playSound]);

	useEffect(() => {
		return () => {
			ambienceRef.current?.pause();
		};
	}, []);

	const toggleSound = () => {
		setSoundEnabled((enabled) => {
			if (!enabled) {
				const ambience = ambienceRef.current ?? new Audio(audioPaths.ambience);
				ambience.loop = true;
				ambience.volume = 0.16;
				ambienceRef.current = ambience;
				void ambience.play().catch(() => undefined);
			} else {
				ambienceRef.current?.pause();
			}
			return !enabled;
		});
	};

	const selectProduct = (slug: string) => {
		const nextProduct = catalogProducts.find((candidate) => candidate.slug === slug);
		if (!nextProduct) return;
		setSelectedSlug(slug);
		setConfiguration(getInitialConfiguration(nextProduct));
		setActiveHotspot(nextProduct.hotspots[0]?.id ?? "");
		setMode("inspect");
	};

	const toggleMode = (nextMode: ArchiveMode) => {
		setMode((current) => (current === nextMode ? "inspect" : nextMode));
	};

	const addConfiguredPair = () => {
		if (!material || !colorway || inventory <= 0) return;
		const cartConfiguration: CartConfiguration = {
			size: configuration.size,
			materialId: material.id,
			materialLabel: material.label,
			colorwayId: colorway.id,
			colorwayLabel: colorway.label,
		};
		addItem(product, 1, cartConfiguration);
		playSound(audioPaths.cart, 0.5);
		openCart();
	};

	const sceneState = useMemo(
		() => ({
			product,
			configuration,
			mode,
			compareProduct: mode === "compare" ? compareProduct : undefined,
		}),
		[compareProduct, configuration, mode, product],
	);

	return (
		<main
			id="main-content"
			className="archive-experience relative min-h-[calc(100svh-5rem)] overflow-hidden bg-[#111411] text-[#edf0e9]"
		>
			<section id="archive" className="relative h-[calc(100svh-5rem)] min-h-[700px]">
				<SoleArchiveCanvas ref={canvasRef} state={sceneState} onDiagnostics={setDiagnostics} />

				<div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(10,12,10,.76)_0%,rgba(10,12,10,.08)_34%,rgba(10,12,10,.04)_66%,rgba(10,12,10,.64)_100%)]" />
				<div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-[#111411] to-transparent" />

				<div className="pointer-events-none absolute inset-0 z-10 grid grid-cols-1 lg:grid-cols-[minmax(230px,0.7fr)_minmax(420px,2fr)_minmax(300px,0.9fr)]">
					<aside className="pointer-events-auto hidden min-h-0 border-r border-white/12 px-5 pb-32 pt-7 lg:flex lg:flex-col xl:px-7">
						<div>
							<p className="archive-kicker">Release index / 2026</p>
							<h1 className="mt-3 font-display text-5xl font-normal uppercase leading-[0.88] xl:text-6xl">
								Six objects.
								<br />
								One sublevel.
							</h1>
						</div>
						<div className="mt-auto divide-y divide-white/12 border-y border-white/12">
							{catalogProducts.map((candidate, index) => {
								const selected = candidate.slug === product.slug;
								return (
									<button
										type="button"
										key={candidate.slug}
										onClick={() => selectProduct(candidate.slug)}
										className="group flex min-h-14 w-full items-center gap-3 py-3 text-left transition-colors"
										aria-current={selected ? "true" : undefined}
									>
										<span className={selected ? "text-[#c7ff1a]" : "text-[#777f78]"}>0{index + 1}</span>
										<span
											className={`flex-1 uppercase tracking-[0.08em] ${selected ? "text-[#edf0e9]" : "text-[#aeb4ad] group-hover:text-[#edf0e9]"}`}
										>
											{candidate.name}
										</span>
										{selected && <ArrowDownRight className="size-4 text-[#c7ff1a]" />}
									</button>
								);
							})}
						</div>
						{diagnostics && (
							<p className="mt-4 text-[0.62rem] uppercase tracking-[0.12em] text-[#727a73]">
								{diagnostics.usingMintModel ? "Mint artifact" : "Fallback form"} · {diagnostics.drawCalls}{" "}
								calls · {Math.round(diagnostics.triangles / 1000)}k tris
							</p>
						)}
					</aside>

					<div aria-hidden="true" />

					<aside className="pointer-events-auto absolute inset-x-3 bottom-[5.8rem] max-h-[44svh] overflow-y-auto border border-white/14 bg-[#121612]/94 p-4 backdrop-blur-md lg:static lg:m-5 lg:mb-28 lg:max-h-none lg:self-start lg:bg-[#121612]/88 lg:p-5 xl:m-7 xl:mb-28 xl:p-6">
						<div className="flex items-start justify-between gap-5 border-b border-white/12 pb-4">
							<div>
								<p className="archive-kicker">
									{product.code} / Edition {product.editionSize}
								</p>
								<h2 className="mt-2 font-display text-5xl font-normal uppercase leading-[0.88] xl:text-6xl">
									{product.name}
								</h2>
							</div>
							<button
								type="button"
								onClick={() => wishlist.toggle(product.slug)}
								className="archive-icon-button"
								aria-label={
									isWishlisted ? `Delete ${product.name} from wishlist` : `Save ${product.name} to wishlist`
								}
								aria-pressed={isWishlisted}
							>
								<Heart className={`size-4 ${isWishlisted ? "fill-[#c7ff1a] text-[#c7ff1a]" : ""}`} />
							</button>
						</div>

						<p className="mt-4 text-sm leading-relaxed text-[#b7bdb5]">{product.story}</p>

						<div className="mt-5 grid grid-cols-2 gap-px bg-white/12">
							<div className="bg-[#121612] p-3">
								<span className="archive-kicker">Price</span>
								<p className="mt-1 text-xl tabular-nums">
									{formatMoney({ amount: product.amount, currency: product.currency, locale: LOCALE })}
								</p>
							</div>
							<div className="bg-[#121612] p-3">
								<span className="archive-kicker">Archive stock</span>
								<p className="mt-1 text-xl tabular-nums">{product.remainingInventory} pairs</p>
							</div>
						</div>

						<fieldset className="mt-5">
							<legend className="archive-kicker">01 / Upper material</legend>
							<div className="mt-2 grid grid-cols-3 gap-1">
								{product.materials.map((candidate) => (
									<button
										type="button"
										key={candidate.id}
										onClick={() => setConfiguration((current) => ({ ...current, materialId: candidate.id }))}
										className="archive-option min-h-12 px-2 text-[0.66rem]"
										aria-pressed={candidate.id === configuration.materialId}
									>
										{candidate.id === configuration.materialId && <Check className="size-3" />}
										{candidate.label}
									</button>
								))}
							</div>
						</fieldset>

						<fieldset className="mt-5">
							<legend className="archive-kicker">02 / Colorway</legend>
							<div className="mt-2 flex gap-2">
								{product.colorways.map((candidate) => (
									<button
										type="button"
										key={candidate.id}
										onClick={() => setConfiguration((current) => ({ ...current, colorwayId: candidate.id }))}
										className="group flex min-h-11 flex-1 items-center gap-2 border border-white/12 px-2 text-left text-[0.65rem] uppercase tracking-[0.08em] transition-colors hover:border-white/35 aria-pressed:border-[#c7ff1a]"
										aria-pressed={candidate.id === configuration.colorwayId}
									>
										<span
											className="size-4 shrink-0 border border-white/25"
											style={{
												background: `linear-gradient(135deg, ${candidate.upper} 0 58%, ${candidate.accent} 58%)`,
											}}
										/>
										<span className="line-clamp-2">{candidate.label}</span>
									</button>
								))}
							</div>
						</fieldset>

						<fieldset className="mt-5">
							<legend className="archive-kicker">03 / US size</legend>
							<div className="mt-2 grid grid-cols-8 gap-1">
								{product.sizes.map((size) => {
									const quantity = product.inventoryBySize[size] ?? 0;
									return (
										<button
											type="button"
											key={size}
											onClick={() => setConfiguration((current) => ({ ...current, size }))}
											disabled={quantity === 0}
											className="archive-size"
											aria-pressed={size === configuration.size}
										>
											{size}
										</button>
									);
								})}
							</div>
							<p className="mt-2 text-xs text-[#8e968f]">
								{inventory > 0
									? `${inventory} available in US ${configuration.size}`
									: "Select an available size"}
							</p>
						</fieldset>

						{mode === "compare" && (
							<label className="mt-5 block">
								<span className="archive-kicker">Comparison release</span>
								<select
									value={compareSlug}
									onChange={(event) => setCompareSlug(event.target.value)}
									className="archive-select mt-2"
								>
									{catalogProducts
										.filter((candidate) => candidate.slug !== product.slug)
										.map((candidate) => (
											<option key={candidate.slug} value={candidate.slug}>
												{candidate.code} — {candidate.name}
											</option>
										))}
								</select>
							</label>
						)}

						<button
							type="button"
							onClick={addConfiguredPair}
							disabled={inventory <= 0}
							className="archive-button-primary mt-5 w-full"
						>
							<ShoppingBag className="size-4" />
							Secure configured pair
						</button>
					</aside>
				</div>

				<div className="pointer-events-auto absolute inset-x-3 bottom-3 z-20 flex items-center gap-1 overflow-x-auto border border-white/14 bg-[#111411]/95 p-1.5 backdrop-blur-md lg:left-1/2 lg:right-auto lg:w-auto lg:-translate-x-1/2">
					<button type="button" className="archive-tool" onClick={() => canvasRef.current?.resetView()}>
						<Rotate3D className="size-4" /> Reset
					</button>
					<button
						type="button"
						className="archive-tool"
						aria-pressed={mode === "lifted"}
						onClick={() => toggleMode("lifted")}
					>
						<Maximize2 className="size-4" /> Lift
					</button>
					<button
						type="button"
						className="archive-tool"
						aria-pressed={mode === "exploded"}
						onClick={() => toggleMode("exploded")}
					>
						<Layers3 className="size-4" /> Explode
					</button>
					<button
						id="compare"
						type="button"
						className="archive-tool"
						aria-pressed={mode === "compare"}
						onClick={() => toggleMode("compare")}
					>
						<GitCompareArrows className="size-4" /> Compare
					</button>
					<button type="button" className="archive-tool" aria-pressed={soundEnabled} onClick={toggleSound}>
						{soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />} Sound
					</button>
				</div>

				{mode === "exploded" && (
					<div className="pointer-events-none absolute left-1/2 top-28 z-20 hidden -translate-x-1/2 items-center gap-4 border border-[#c7ff1a]/45 bg-[#111411]/88 px-4 py-2 text-[0.62rem] uppercase tracking-[0.14em] text-[#c7ff1a] backdrop-blur-sm lg:flex">
						{["01 / Material shell", "02 / Topology mesh", "03 / Ground form"].map((label) => (
							<span key={label}>{label}</span>
						))}
					</div>
				)}

				<div className="absolute left-3 top-3 z-20 flex gap-1 overflow-x-auto lg:hidden">
					{catalogProducts.map((candidate, index) => (
						<button
							type="button"
							key={candidate.slug}
							onClick={() => selectProduct(candidate.slug)}
							className="archive-mobile-index"
							aria-current={candidate.slug === product.slug ? "true" : undefined}
						>
							0{index + 1}
						</button>
					))}
				</div>

				{mode !== "exploded" && (
					<div className="absolute left-[28%] top-[28%] z-20 hidden lg:block">
						<div className="flex flex-col gap-2">
							{product.hotspots.map((hotspot, index) => (
								<button
									type="button"
									key={hotspot.id}
									onClick={() => {
										setActiveHotspot(hotspot.id);
										canvasRef.current?.focusHotspot(hotspot.position);
									}}
									className="group flex items-center gap-2 text-left"
									aria-pressed={activeHotspot === hotspot.id}
								>
									<span className="grid size-7 place-items-center border border-[#c7ff1a] bg-[#111411]/85 text-[0.62rem] text-[#c7ff1a]">
										0{index + 1}
									</span>
									<span className="max-w-0 overflow-hidden whitespace-nowrap bg-[#111411]/88 text-[0.65rem] uppercase tracking-[0.12em] text-[#edf0e9] opacity-0 transition-all duration-300 group-hover:max-w-52 group-hover:px-3 group-hover:py-2 group-hover:opacity-100 group-aria-pressed:max-w-52 group-aria-pressed:px-3 group-aria-pressed:py-2 group-aria-pressed:opacity-100">
										{hotspot.label}
									</span>
								</button>
							))}
						</div>
					</div>
				)}
			</section>

			<section
				className="relative z-30 border-t border-white/12 bg-[#171b18] px-5 py-20 sm:px-8 lg:px-12"
				aria-labelledby="archive-notes-title"
			>
				<div className="mx-auto grid max-w-[1500px] gap-12 lg:grid-cols-[0.8fr_1.2fr]">
					<div>
						<p className="archive-kicker">Construction notes / {product.code}</p>
						<h2
							id="archive-notes-title"
							className="mt-4 max-w-lg font-display text-7xl font-normal uppercase leading-[0.84] sm:text-8xl"
						>
							Built to be taken apart.
						</h2>
					</div>
					<div className="grid content-end gap-px bg-white/12 sm:grid-cols-3">
						{product.hotspots.map((hotspot, index) => (
							<article key={hotspot.id} className="bg-[#171b18] p-6 sm:min-h-56">
								<span className="archive-kicker">Detail 0{index + 1}</span>
								<h3 className="mt-8 text-xl">{hotspot.label}</h3>
								<p className="mt-3 text-sm leading-relaxed text-[#aeb5ad]">{hotspot.description}</p>
							</article>
						))}
					</div>
				</div>
			</section>
		</main>
	);
}
