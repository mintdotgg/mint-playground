import { CURRENCY, LOCALE } from "@/lib/constants";
import { ProductMedia } from "@/lib/media";
import { formatMoney } from "@/lib/money";
import type { CatalogProduct } from "@/lib/products";
import { isVideoUrl } from "@/lib/utils";
import { AppLink } from "./app-link";
import { ProductAddToCartButton } from "./product-add-to-cart-button";

export function ProductCard({ product }: { product: CatalogProduct }) {
	const priceDisplay = formatMoney({ amount: product.amount, currency: CURRENCY, locale: LOCALE });
	const allImages = product.images;
	const primaryImage = allImages[0];
	const secondaryImage = allImages[1];

	return (
		<article className="group flex flex-col gap-4">
			<AppLink prefetch={"eager"} href={`/product/${product.slug}`} className="space-y-4">
				<div className="flex min-h-12 items-start justify-between gap-4">
					<h3 className="max-w-[14rem] text-xl font-medium leading-none text-foreground">{product.name}</h3>
					<p className="shrink-0 rounded-full border border-foreground px-4 py-2 text-sm leading-none text-foreground">
						{priceDisplay}
					</p>
				</div>
				<div className="relative aspect-[3/4] overflow-hidden bg-secondary">
					{primaryImage &&
						(isVideoUrl(primaryImage) ? (
							<video
								className={`absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] ${secondaryImage ? "group-hover:opacity-0" : ""}`}
								src={primaryImage}
								muted
								loop
								autoPlay
								playsInline
							/>
						) : (
							<ProductMedia
								src={primaryImage}
								alt={product.name}
								fill
								sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 30vw"
								className={`object-cover transition duration-500 group-hover:scale-[1.03] ${secondaryImage ? "group-hover:opacity-0" : ""}`}
							/>
						))}
					{secondaryImage &&
						(isVideoUrl(secondaryImage) ? (
							<video
								className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
								src={secondaryImage}
								muted
								loop
								autoPlay
								playsInline
							/>
						) : (
							<ProductMedia
								src={secondaryImage}
								alt={`${product.name} - alternate view`}
								fill
								sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 30vw"
								className="object-cover opacity-0 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
							/>
						))}
				</div>
			</AppLink>
			<ProductAddToCartButton product={product} />
		</article>
	);
}
