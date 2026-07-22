import { ArrowUpRight } from "lucide-react";
import { AppLink } from "@/components/app-link";
import { ProductAddToCartButton } from "@/components/product-add-to-cart-button";
import { ProductCardModel } from "@/components/product-card-model";
import { CURRENCY, LOCALE } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import type { CatalogProduct } from "@/lib/products";
import { catalogProducts } from "@/lib/products";

function ProductShowcaseCard({ product }: { product: CatalogProduct }) {
	const priceDisplay = formatMoney({ amount: product.amount, currency: CURRENCY, locale: LOCALE });

	return (
		<article className="group flex min-w-[280px] flex-col gap-4 sm:min-w-0">
			<div className="flex min-h-12 items-start justify-between gap-4">
				<AppLink prefetch="eager" href={`/product/${product.slug}`}>
					<h2 className="max-w-[13rem] text-xl font-medium leading-none text-foreground">{product.name}</h2>
				</AppLink>
				<span className="rounded-full border border-foreground px-4 py-2 text-sm leading-none">
					{priceDisplay}
				</span>
			</div>

			<div className="relative aspect-[3/4] overflow-hidden bg-secondary">
				<ProductCardModel productName={product.name} productSlug={product.slug} />
				<AppLink
					prefetch="eager"
					href={`/product/${product.slug}`}
					className="absolute bottom-4 right-4 z-10 inline-flex items-center gap-1.5 bg-foreground/88 px-3 py-2 text-xs font-semibold text-primary-foreground backdrop-blur-sm transition hover:bg-foreground"
				>
					View in 360° <ArrowUpRight className="size-3.5" aria-hidden="true" />
				</AppLink>
			</div>

			<ProductAddToCartButton product={product} />
		</article>
	);
}

export async function ProductShowcase() {
	return (
		<div className="grid gap-8 overflow-x-auto pb-4 sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3">
			{catalogProducts.map((product) => (
				<ProductShowcaseCard key={product.slug} product={product} />
			))}
		</div>
	);
}
