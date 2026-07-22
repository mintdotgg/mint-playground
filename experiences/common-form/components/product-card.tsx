import { ArrowUpRight } from "lucide-react";
import { CURRENCY, LOCALE } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import type { CatalogProduct } from "@/lib/products";
import { AppLink } from "./app-link";
import { ProductAddToCartButton } from "./product-add-to-cart-button";
import { ProductCardModel } from "./product-card-model";

export function ProductCard({ product }: { product: CatalogProduct }) {
	const priceDisplay = formatMoney({ amount: product.amount, currency: CURRENCY, locale: LOCALE });

	return (
		<article className="group flex flex-col gap-4">
			<div className="flex min-h-12 items-start justify-between gap-4">
				<AppLink prefetch="eager" href={`/product/${product.slug}`}>
					<h3 className="max-w-[14rem] text-xl font-medium leading-none text-foreground">{product.name}</h3>
				</AppLink>
				<p className="shrink-0 rounded-full border border-foreground px-4 py-2 text-sm leading-none text-foreground">
					{priceDisplay}
				</p>
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
