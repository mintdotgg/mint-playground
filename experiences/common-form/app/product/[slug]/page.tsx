import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/app/product/[slug]/add-to-cart-button";
import { ProductFeatures } from "@/app/product/[slug]/product-features";
import { ProductModelViewer } from "@/app/product/[slug]/product-model-viewer";
import { RelatedProducts } from "@/app/product/[slug]/related-products";
import { getShowroomProfile } from "@/components/showroom/showroom-data";
import { CURRENCY, LOCALE } from "@/lib/constants";
import { buildProductBreadcrumbJsonLd, buildProductJsonLd, JsonLdScript } from "@/lib/json-ld";
import { formatMoney } from "@/lib/money";
import { catalogProducts, getProductBySlug } from "@/lib/products";
import { STORE_NAME } from "@/lib/store";

export function generateStaticParams() {
	return catalogProducts.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
	const { slug } = await params;
	const product = getProductBySlug(slug);

	if (!product) {
		return { title: `Product Not Found - ${STORE_NAME}` };
	}

	return {
		title: `${product.name} - ${STORE_NAME}`,
		description: product.descriptionText,
		openGraph: {
			title: product.name,
			description: product.descriptionText,
			images: product.images[0] ? [product.images[0]] : undefined,
		},
	};
}

export default async function ProductPage(props: { params: Promise<{ slug: string }> }) {
	return <ProductDetails params={props.params} />;
}

const ProductDetails = async ({ params }: { params: Promise<{ slug: string }> }) => {
	const { slug } = await params;
	const product = getProductBySlug(slug);

	if (!product) {
		notFound();
	}

	const priceDisplay = formatMoney({ amount: product.amount, currency: CURRENCY, locale: LOCALE });
	const profile = getShowroomProfile(product.slug);

	return (
		<div className="mx-auto w-full max-w-[1440px] px-5 py-6 sm:px-10 sm:py-10 xl:px-12">
			<JsonLdScript data={buildProductJsonLd(product)} />
			<JsonLdScript data={buildProductBreadcrumbJsonLd(product)} />
			<div className="lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.65fr)] lg:items-start lg:gap-12 xl:gap-16">
				<ProductModelViewer productName={product.name} productSlug={product.slug} />

				<div className="mt-8 space-y-8 lg:sticky lg:top-24 lg:mt-0 lg:py-6">
					<div className="space-y-4">
						<p className="store-kicker mb-0">{profile.collection} / Interactive object</p>
						<h1 className="max-w-[9ch] text-balance font-display text-[3.4rem] font-medium leading-[0.86] tracking-[-0.06em] text-foreground lg:text-[4.8rem]">
							{product.name}
						</h1>
						<p className="inline-flex border-b border-foreground py-2 text-xl font-semibold">
							{priceDisplay}
						</p>
						<p className="text-lg leading-relaxed text-foreground/65">{product.descriptionText}</p>
						<dl className="grid grid-cols-2 gap-4 border-t border-foreground/20 pt-4 text-sm">
							<div>
								<dt className="text-xs uppercase tracking-[0.14em] text-foreground/50">Material</dt>
								<dd className="mt-1">{profile.material}</dd>
							</div>
							<div>
								<dt className="text-xs uppercase tracking-[0.14em] text-foreground/50">View</dt>
								<dd className="mt-1">Full 360° orbit</dd>
							</div>
						</dl>
					</div>

					<AddToCartButton product={product} />
				</div>
			</div>

			<div className="mx-auto max-w-[1180px]">
				<ProductFeatures />

				<RelatedProducts product={product} />
			</div>
		</div>
	);
};
