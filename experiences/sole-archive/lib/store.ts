export const STORE_NAME = "Sole Archive";

export const STORE_DESCRIPTION =
	"An underground archive for inspecting, configuring, and acquiring six fictional limited-edition sneakers.";

export const storeNavItems = [
	{ label: "Archive", href: "/#archive" },
	{ label: "Compare", href: "/#compare" },
	{ label: "Release Index", href: "/products" },
] as const;

export const storeAssets = {
	favicon: "https://cdn.mint.gg/images/xn74f5svq5bed0ks8p9ewygcrx8aynff/sa-001-sublevel-zero-campaign-5f6461-6744ce2570d613ad.png",
	hero: "https://cdn.mint.gg/images/xn74f5svq5bed0ks8p9ewygcrx8aynff/sa-001-sublevel-zero-campaign-5f6461-6744ce2570d613ad.png",
	logoMark: "https://cdn.mint.gg/images/xn74f5svq5bed0ks8p9ewygcrx8aynff/sa-001-sublevel-zero-campaign-5f6461-6744ce2570d613ad.png",
	openGraph: "https://cdn.mint.gg/images/xn74f5svq5bed0ks8p9ewygcrx8aynff/sa-001-sublevel-zero-campaign-5f6461-6744ce2570d613ad.png",
	featureCatalog: "https://cdn.mint.gg/images/xn7e11z4az05pqwm30c151j7xs8azsry/sa-004-static-veil-campaign-528569-fa34d23806a3e4c3.png",
	featureFulfillment: "https://cdn.mint.gg/images/xn7e1qbrd0qpb7jnwt9ezytcm98azbkb/sa-006-afterimage-campaign-07ac09-203110f6e43daf4b.png",
} as const;
