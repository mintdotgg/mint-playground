export const STORE_NAME = "Common Form";

export const STORE_DESCRIPTION =
	"Considered objects for the everyday, explored through an interactive three-dimensional showroom.";

export const storeNavItems = [
	{ label: "Showroom", href: "/#showroom" },
	{ label: "Collection", href: "/#collection" },
	{ label: "Studio", href: "/#studio" },
	{ label: "FAQ", href: "/faq" },
] as const;

export const storeAssets = {
	favicon: "https://cdn.mint.gg/images/models/ceramic-mug-ae7622d92575f546.webp",
	hero: "https://cdn.mint.gg/images/models/everyday-tote-e7e38680279b2df1.webp",
	openGraph: "https://cdn.mint.gg/images/models/everyday-tote-e7e38680279b2df1.webp",
	featureCatalog: "https://cdn.mint.gg/images/models/woven-throw-05cd2851ac8e2b9c.webp",
	featureFulfillment: "https://cdn.mint.gg/images/models/desk-lamp-6a1e6ae47dc1bb9d.webp",
} as const;
