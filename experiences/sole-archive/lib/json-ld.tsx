import { CURRENCY } from "@/lib/constants";
import type { CatalogProduct } from "@/lib/products";
import { STORE_DESCRIPTION, STORE_NAME } from "@/lib/store";

function getDecimalPrice(minorAmount: string | number): string {
	return (Number(minorAmount) / 100).toFixed(2);
}

function getBaseUrl(): string {
	return process.env.NEXT_PUBLIC_URL ?? "";
}

export function JsonLdScript({ data }: { data: Record<string, unknown> }) {
	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
		/>
	);
}

export function buildProductJsonLd(product: CatalogProduct): Record<string, unknown> {
	const baseUrl = getBaseUrl();

	return {
		"@context": "https://schema.org",
		"@type": "Product",
		name: product.name,
		description: product.descriptionText,
		image: product.images,
		sku: product.stripeProductId,
		brand: { "@type": "Brand", name: STORE_NAME },
		offers: {
			"@type": "Offer",
			url: `${baseUrl}/product/${product.slug}`,
			priceCurrency: CURRENCY,
			price: getDecimalPrice(product.amount),
			availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
		},
	};
}

export function buildProductBreadcrumbJsonLd(product: CatalogProduct): Record<string, unknown> {
	const baseUrl = getBaseUrl();

	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: [
			{ "@type": "ListItem", position: 1, name: "Home", item: baseUrl || undefined },
			{ "@type": "ListItem", position: 2, name: product.name },
		],
	};
}

export async function StoreJsonLd() {
	return (
		<JsonLdScript
			data={{
				"@context": "https://schema.org",
				"@type": "Store",
				name: STORE_NAME,
				description: STORE_DESCRIPTION,
				url: getBaseUrl(),
			}}
		/>
	);
}
