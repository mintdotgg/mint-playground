import { soleArchiveAssets } from "@/lib/mint/sole-archive-assets";

export const generatedCatalogAt = "sole-archive-2026-07-21";

export type SneakerMaterial = {
	id: string;
	label: string;
	description: string;
	roughness: number;
	metalness: number;
};

export type SneakerColorway = {
	id: string;
	label: string;
	upper: string;
	accent: string;
	sole: string;
};

export type SneakerHotspot = {
	id: string;
	label: string;
	description: string;
	position: [number, number, number];
};

export type GeneratedProduct = {
	slug: string;
	csvSlug: string;
	code: string;
	name: string;
	story: string;
	descriptionHtml: string;
	descriptionText: string;
	inStock: boolean;
	amount: number;
	currency: "USD";
	images: string[];
	imageAlts: string[];
	stripeProductId: string;
	stripePriceId: string;
	modelPath: string;
	releaseDate: string;
	editionSize: number;
	remainingInventory: number;
	sizes: string[];
	inventoryBySize: Record<string, number>;
	materials: SneakerMaterial[];
	colorways: SneakerColorway[];
	defaultMaterialId: string;
	defaultColorwayId: string;
	hotspots: SneakerHotspot[];
};

const sharedMaterials = {
	mesh: {
		id: "ballistic-mesh",
		label: "Ballistic mesh",
		description: "Dense woven structure with a dry, technical finish.",
		roughness: 0.82,
		metalness: 0.02,
	},
	suede: {
		id: "brushed-suede",
		label: "Brushed suede",
		description: "Short-nap suede that softens the silhouette in close view.",
		roughness: 0.94,
		metalness: 0,
	},
	leather: {
		id: "coated-leather",
		label: "Coated leather",
		description: "Weather-sealed leather with a controlled satin reflection.",
		roughness: 0.34,
		metalness: 0.04,
	},
	knit: {
		id: "engineered-knit",
		label: "Engineered knit",
		description: "Flexible zonal knit with breathable structural bands.",
		roughness: 0.88,
		metalness: 0,
	},
	nappa: {
		id: "nappa-leather",
		label: "Nappa leather",
		description: "Supple premium leather with a low, deep sheen.",
		roughness: 0.46,
		metalness: 0.01,
	},
	ripstop: {
		id: "translucent-ripstop",
		label: "Translucent ripstop",
		description: "Light technical shell with a visible reinforcement grid.",
		roughness: 0.52,
		metalness: 0.03,
	},
} satisfies Record<string, SneakerMaterial>;

const commonHotspots: SneakerHotspot[] = [
	{
		id: "stitching",
		label: "Stitch map",
		description: "Reinforced double-needle paths follow the shoe's highest-tension zones.",
		position: [0.35, 0.62, 0.66],
	},
	{
		id: "upper",
		label: "Upper construction",
		description: "Layered panels balance ventilation, structure, and weather resistance.",
		position: [-0.28, 0.76, 0.08],
	},
	{
		id: "outsole",
		label: "Ground system",
		description: "A tuned rubber geometry separates contact, flex, and impact zones.",
		position: [0.15, 0.16, 0.5],
	},
];

export const generatedProducts: GeneratedProduct[] = [
	{
		slug: "sublevel-zero",
		csvSlug: "sublevel-zero",
		code: "SA-001",
		name: "Sublevel Zero",
		story: "A low runner modeled after a sealed transit platform beneath the city.",
		descriptionHtml:
			"<p>Ballistic mesh, brushed guards, and a translucent quarter panel expose a runner designed around service-tunnel speed.</p>",
		descriptionText:
			"Ballistic mesh, brushed guards, and a translucent quarter panel expose a runner designed around service-tunnel speed.",
		inStock: true,
		amount: 24000,
		currency: "USD",
		images: [soleArchiveAssets.sneakers["sublevel-zero"].image],
		imageAlts: ["Sublevel Zero technical runner in a raw concrete campaign set"],
		stripeProductId: "prod_replace_sa_001",
		stripePriceId: "price_replace_sa_001",
		modelPath: soleArchiveAssets.sneakers["sublevel-zero"].model,
		releaseDate: "2026-01-31",
		editionSize: 240,
		remainingInventory: 47,
		sizes: [
			"5",
			"5.5",
			"6",
			"6.5",
			"7",
			"7.5",
			"8",
			"8.5",
			"9",
			"9.5",
			"10",
			"10.5",
			"11",
			"11.5",
			"12",
			"13",
		],
		inventoryBySize: {
			"5": 1,
			"5.5": 2,
			"6": 2,
			"6.5": 3,
			"7": 4,
			"7.5": 4,
			"8": 5,
			"8.5": 5,
			"9": 5,
			"9.5": 4,
			"10": 4,
			"10.5": 3,
			"11": 2,
			"11.5": 1,
			"12": 1,
			"13": 1,
		},
		materials: [sharedMaterials.mesh, sharedMaterials.suede, sharedMaterials.ripstop],
		colorways: [
			{ id: "acid-fog", label: "Acid Fog", upper: "#777b76", accent: "#c7ff1a", sole: "#242825" },
			{ id: "tunnel-black", label: "Tunnel Black", upper: "#171a19", accent: "#d9ddd9", sole: "#0b0d0c" },
			{ id: "vapor", label: "Vapor", upper: "#d4d8d4", accent: "#9ef000", sole: "#787d79" },
		],
		defaultMaterialId: "ballistic-mesh",
		defaultColorwayId: "acid-fog",
		hotspots: commonHotspots,
	},
	{
		slug: "pressure-seal",
		csvSlug: "pressure-seal",
		code: "SA-002",
		name: "Pressure Seal",
		story: "A weatherproof high-top built around the geometry of an industrial pressure door.",
		descriptionHtml:
			"<p>A coated shell, ripstop gusset, and molded ankle frame lock the foot inside a dense beveled platform.</p>",
		descriptionText:
			"A coated shell, ripstop gusset, and molded ankle frame lock the foot inside a dense beveled platform.",
		inStock: true,
		amount: 28500,
		currency: "USD",
		images: [soleArchiveAssets.sneakers["pressure-seal"].image],
		imageAlts: ["Pressure Seal high-top beside an industrial concrete door"],
		stripeProductId: "prod_replace_sa_002",
		stripePriceId: "price_replace_sa_002",
		modelPath: soleArchiveAssets.sneakers["pressure-seal"].model,
		releaseDate: "2026-02-28",
		editionSize: 180,
		remainingInventory: 31,
		sizes: ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12", "13", "14"],
		inventoryBySize: {
			"6": 1,
			"6.5": 1,
			"7": 2,
			"7.5": 2,
			"8": 3,
			"8.5": 3,
			"9": 4,
			"9.5": 3,
			"10": 3,
			"10.5": 2,
			"11": 2,
			"11.5": 2,
			"12": 1,
			"13": 1,
			"14": 1,
		},
		materials: [sharedMaterials.leather, sharedMaterials.ripstop, sharedMaterials.suede],
		colorways: [
			{ id: "hazard-green", label: "Hazard Green", upper: "#2d332f", accent: "#c7ff1a", sole: "#111412" },
			{ id: "oxide", label: "Oxide", upper: "#69483c", accent: "#d0d5cf", sole: "#241d1a" },
			{ id: "white-noise", label: "White Noise", upper: "#d8dad4", accent: "#131615", sole: "#858b85" },
		],
		defaultMaterialId: "coated-leather",
		defaultColorwayId: "hazard-green",
		hotspots: commonHotspots,
	},
	{
		slug: "night-transit",
		csvSlug: "night-transit",
		code: "SA-003",
		name: "Night Transit",
		story: "A compact court silhouette drawn from the last train's sodium glow.",
		descriptionHtml:
			"<p>Soft nubuck and recycled mesh meet a reflective heel strip and a translucent rubber edge.</p>",
		descriptionText:
			"Soft nubuck and recycled mesh meet a reflective heel strip and a translucent rubber edge.",
		inStock: true,
		amount: 22500,
		currency: "USD",
		images: [soleArchiveAssets.sneakers["night-transit"].image],
		imageAlts: ["Night Transit low court sneaker on an illuminated shelf"],
		stripeProductId: "prod_replace_sa_003",
		stripePriceId: "price_replace_sa_003",
		modelPath: soleArchiveAssets.sneakers["night-transit"].model,
		releaseDate: "2026-03-28",
		editionSize: 300,
		remainingInventory: 72,
		sizes: [
			"5",
			"5.5",
			"6",
			"6.5",
			"7",
			"7.5",
			"8",
			"8.5",
			"9",
			"9.5",
			"10",
			"10.5",
			"11",
			"11.5",
			"12",
			"12.5",
		],
		inventoryBySize: {
			"5": 2,
			"5.5": 3,
			"6": 4,
			"6.5": 4,
			"7": 5,
			"7.5": 6,
			"8": 7,
			"8.5": 7,
			"9": 7,
			"9.5": 6,
			"10": 6,
			"10.5": 5,
			"11": 4,
			"11.5": 3,
			"12": 2,
			"12.5": 1,
		},
		materials: [sharedMaterials.suede, sharedMaterials.mesh, sharedMaterials.nappa],
		colorways: [
			{ id: "mercury", label: "Mercury", upper: "#aaaead", accent: "#e6ebea", sole: "#6e766f" },
			{ id: "carbon", label: "Carbon", upper: "#242726", accent: "#c7ff1a", sole: "#171918" },
			{ id: "sodium", label: "Sodium", upper: "#a98c62", accent: "#e5d5a4", sole: "#3e3931" },
		],
		defaultMaterialId: "brushed-suede",
		defaultColorwayId: "mercury",
		hotspots: commonHotspots,
	},
	{
		slug: "static-veil",
		csvSlug: "static-veil",
		code: "SA-004",
		name: "Static Veil",
		story: "A translucent slip-on that exposes its internal tension and support structure.",
		descriptionHtml:
			"<p>Mono-mesh floats over engineered knit while a smoked support cage traces each load path.</p>",
		descriptionText:
			"Mono-mesh floats over engineered knit while a smoked support cage traces each load path.",
		inStock: true,
		amount: 26000,
		currency: "USD",
		images: [soleArchiveAssets.sneakers["static-veil"].image],
		imageAlts: ["Static Veil translucent sneaker behind ribbed polycarbonate"],
		stripeProductId: "prod_replace_sa_004",
		stripePriceId: "price_replace_sa_004",
		modelPath: soleArchiveAssets.sneakers["static-veil"].model,
		releaseDate: "2026-04-25",
		editionSize: 210,
		remainingInventory: 26,
		sizes: ["5", "5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "12", "13"],
		inventoryBySize: {
			"5": 1,
			"5.5": 1,
			"6": 2,
			"6.5": 2,
			"7": 2,
			"7.5": 3,
			"8": 3,
			"8.5": 2,
			"9": 2,
			"9.5": 2,
			"10": 2,
			"10.5": 1,
			"11": 1,
			"12": 1,
			"13": 1,
		},
		materials: [sharedMaterials.knit, sharedMaterials.ripstop, sharedMaterials.mesh],
		colorways: [
			{ id: "frost-signal", label: "Frost Signal", upper: "#d8dcda", accent: "#bdfc16", sole: "#7e8581" },
			{ id: "black-ice", label: "Black Ice", upper: "#1f2423", accent: "#aab3af", sole: "#101312" },
			{ id: "acid-bloom", label: "Acid Bloom", upper: "#76826f", accent: "#d2ff38", sole: "#313a32" },
		],
		defaultMaterialId: "engineered-knit",
		defaultColorwayId: "frost-signal",
		hotspots: commonHotspots,
	},
	{
		slug: "vault-strike",
		csvSlug: "vault-strike",
		code: "SA-005",
		name: "Vault Strike",
		story: "A concrete trail shoe built for quarry edges and service corridors.",
		descriptionHtml:
			"<p>Waxed canvas, rough suede, and a deep-lug ground system armor a compact technical last.</p>",
		descriptionText:
			"Waxed canvas, rough suede, and a deep-lug ground system armor a compact technical last.",
		inStock: true,
		amount: 27500,
		currency: "USD",
		images: [soleArchiveAssets.sneakers["vault-strike"].image],
		imageAlts: ["Vault Strike trail sneaker staged on fractured concrete"],
		stripeProductId: "prod_replace_sa_005",
		stripePriceId: "price_replace_sa_005",
		modelPath: soleArchiveAssets.sneakers["vault-strike"].model,
		releaseDate: "2026-05-30",
		editionSize: 150,
		remainingInventory: 18,
		sizes: ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12", "13", "14"],
		inventoryBySize: {
			"6": 1,
			"6.5": 1,
			"7": 1,
			"7.5": 1,
			"8": 2,
			"8.5": 2,
			"9": 2,
			"9.5": 2,
			"10": 1,
			"10.5": 1,
			"11": 1,
			"11.5": 1,
			"12": 1,
			"13": 1,
			"14": 0,
		},
		materials: [sharedMaterials.ripstop, sharedMaterials.suede, sharedMaterials.mesh],
		colorways: [
			{ id: "quarry", label: "Quarry", upper: "#696b65", accent: "#c7ff1a", sole: "#282b27" },
			{ id: "emergency-lime", label: "Emergency Lime", upper: "#a6bb63", accent: "#e0ff43", sole: "#2f3427" },
			{ id: "ash", label: "Ash", upper: "#b0ada5", accent: "#262b28", sole: "#555851" },
		],
		defaultMaterialId: "translucent-ripstop",
		defaultColorwayId: "quarry",
		hotspots: commonHotspots,
	},
	{
		slug: "afterimage",
		csvSlug: "afterimage",
		code: "SA-006",
		name: "Afterimage",
		story: "The smallest edition: a sculpted runner suspended around a split floating heel.",
		descriptionHtml:
			"<p>Nappa leather, a patent wave, and a reflective cage orbit a translucent segmented sole.</p>",
		descriptionText:
			"Nappa leather, a patent wave, and a reflective cage orbit a translucent segmented sole.",
		inStock: true,
		amount: 32000,
		currency: "USD",
		images: [soleArchiveAssets.sneakers.afterimage.image],
		imageAlts: ["Afterimage sculptural runner in a dark concrete boutique"],
		stripeProductId: "prod_replace_sa_006",
		stripePriceId: "price_replace_sa_006",
		modelPath: soleArchiveAssets.sneakers.afterimage.model,
		releaseDate: "2026-06-27",
		editionSize: 96,
		remainingInventory: 12,
		sizes: ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12", "13", "13.5"],
		inventoryBySize: {
			"6": 0,
			"6.5": 1,
			"7": 1,
			"7.5": 1,
			"8": 1,
			"8.5": 1,
			"9": 2,
			"9.5": 1,
			"10": 1,
			"10.5": 1,
			"11": 1,
			"11.5": 1,
			"12": 0,
			"13": 0,
			"13.5": 0,
		},
		materials: [sharedMaterials.nappa, sharedMaterials.leather, sharedMaterials.ripstop],
		colorways: [
			{ id: "ghost-chrome", label: "Ghost Chrome", upper: "#babebd", accent: "#e6ffb0", sole: "#737b77" },
			{ id: "infrared", label: "Infrared", upper: "#2b2929", accent: "#ff5e3b", sole: "#151616" },
			{ id: "null", label: "Null", upper: "#121514", accent: "#c7ff1a", sole: "#080a09" },
		],
		defaultMaterialId: "nappa-leather",
		defaultColorwayId: "ghost-chrome",
		hotspots: commonHotspots,
	},
];
