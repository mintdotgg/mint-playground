import Image from "next/image";
import { AppLink } from "@/components/app-link";
import { ProductAddToCartButton } from "@/components/product-add-to-cart-button";
import { CURRENCY, LOCALE } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import type { CatalogProduct } from "@/lib/products";
import { catalogProducts } from "@/lib/products";

function ProductShowcaseCard({ product }: { product: CatalogProduct }) {
	const priceDisplay = formatMoney({ amount: product.amount, currency: CURRENCY, locale: LOCALE });
	const image = (
		<div className="relative aspect-[3/4] overflow-hidden bg-secondary">
			<Image
				src={product.images[0] ?? "https://cdn.mint.gg/images/xn74f5svq5bed0ks8p9ewygcrx8aynff/sa-001-sublevel-zero-campaign-5f6461-6744ce2570d613ad.png"}
				alt={product.imageAlts[0] ?? product.name}
				fill
				sizes="(max-width: 640px) 82vw, (max-width: 1024px) 42vw, 284px"
				className="object-cover transition duration-500 group-hover:scale-[1.03]"
			/>
		</div>
	);

	return (
		<article className="group flex min-w-[280px] flex-col gap-4 sm:min-w-0">
			<AppLink prefetch="eager" href={`/product/${product.slug}`} className="space-y-4">
				<div className="flex min-h-12 items-start justify-between gap-4">
					<h2 className="max-w-[13rem] text-xl font-medium leading-none text-foreground">{product.name}</h2>
					<span className="rounded-full border border-foreground px-4 py-2 text-sm leading-none">
						{priceDisplay}
					</span>
				</div>
				{image}
			</AppLink>

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
