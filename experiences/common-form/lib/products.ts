import { generatedProducts } from "@/lib/generated/catalog";

export type CatalogProduct = (typeof generatedProducts)[number];
export type ProductSort = "newest" | "price-asc" | "price-desc" | "name";

export const catalogProducts = [...generatedProducts];

export function getProductBySlug(slug: string) {
	return catalogProducts.find((product) => product.slug === slug);
}

export function getProductByPriceId(priceId: string) {
	return catalogProducts.find((product) => product.stripePriceId === priceId);
}

export function getRelatedProducts(product: CatalogProduct, limit = 3) {
	return catalogProducts.filter((item) => item.slug !== product.slug).slice(0, limit);
}

export function sortProducts(products: CatalogProduct[], sort: ProductSort = "newest") {
	const indexedProducts = products.map((product, index) => ({ product, index }));
	return indexedProducts
		.toSorted((a, b) => {
			switch (sort) {
				case "price-asc":
					return a.product.amount - b.product.amount;
				case "price-desc":
					return b.product.amount - a.product.amount;
				case "name":
					return a.product.name.localeCompare(b.product.name);
				case "newest":
					return a.index - b.index;
			}
		})
		.map(({ product }) => product);
}

export function searchProducts(query: string) {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) {
		return [];
	}

	return catalogProducts.filter((product) =>
		[product.name, product.descriptionText, product.slug].some((value) =>
			value.toLowerCase().includes(normalizedQuery),
		),
	);
}

export function paginateProducts(products: CatalogProduct[], page: number, perPage: number) {
	const currentPage = Math.max(1, page);
	const offset = (currentPage - 1) * perPage;
	return {
		currentPage,
		totalPages: Math.ceil(products.length / perPage),
		products: products.slice(offset, offset + perPage),
		total: products.length,
	};
}
