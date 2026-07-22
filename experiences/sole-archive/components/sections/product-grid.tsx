import { ArrowRight } from "lucide-react";
import { AppLink } from "@/components/app-link";
import { ProductCard } from "@/components/product-card";
import { type CatalogProduct, catalogProducts } from "@/lib/products";

type ProductGridProps = {
	title?: string;
	description?: string;
	products?: CatalogProduct[];
	limit?: number;
	showViewAll?: boolean;
	viewAllHref?: string;
};

export async function ProductGrid({
	title = "Featured Products",
	description = "Handpicked favorites from our collection",
	products,
	limit = 6,
	showViewAll = true,
	viewAllHref = "/products",
}: ProductGridProps) {
	const displayProducts = products ?? catalogProducts.slice(0, limit);

	return (
		<section id="products" className="store-container store-section">
			<div className="mb-12 flex items-end justify-between gap-6">
				<div>
					<h2 className="store-heading">{title}</h2>
					<p className="mt-3 max-w-xl text-foreground/65">{description}</p>
				</div>
				{showViewAll && (
					<AppLink
						prefetch={"eager"}
						href={viewAllHref}
						className="hidden items-center gap-1 text-sm font-medium text-foreground/65 transition-colors hover:text-foreground sm:inline-flex"
					>
						View all
						<ArrowRight className="h-4 w-4" />
					</AppLink>
				)}
			</div>

			<div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
				{displayProducts.map((product) => (
					<ProductCard key={product.slug} product={product} />
				))}
			</div>

			{showViewAll && (
				<div className="mt-12 text-center sm:hidden">
					<AppLink
						prefetch={"eager"}
						href={viewAllHref}
						className="inline-flex items-center gap-1 text-sm font-medium text-foreground/65 transition-colors hover:text-foreground"
					>
						View all products
						<ArrowRight className="h-4 w-4" />
					</AppLink>
				</div>
			)}
		</section>
	);
}
