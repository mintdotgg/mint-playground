import { Suspense } from "react";
import { ProductGrid } from "@/components/sections/product-grid";
import { type CatalogProduct, getRelatedProducts } from "@/lib/products";

export function RelatedProducts(props: { product: CatalogProduct }) {
	return (
		<Suspense>
			<RelatedProductsContent {...props} />
		</Suspense>
	);
}

async function RelatedProductsContent({ product }: { product: CatalogProduct }) {
	const related = getRelatedProducts(product, 6);

	if (related.length === 0) return null;

	return (
		<ProductGrid
			title="You might also like"
			description="More products to explore"
			products={related}
			showViewAll={false}
		/>
	);
}
