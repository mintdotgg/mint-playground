import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/app/product/[slug]/add-to-cart-button";
import { MediaGallery } from "@/app/product/[slug]/media-gallery";
import { ProductFeatures } from "@/app/product/[slug]/product-features";
import { RelatedProducts } from "@/app/product/[slug]/related-products";
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

	return (
		<div className="store-container py-10 sm:py-14">
			<JsonLdScript data={buildProductJsonLd(product)} />
			<JsonLdScript data={buildProductBreadcrumbJsonLd(product)} />
			<div className="lg:grid lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
				<MediaGallery images={product.images} productName={product.name} />

				<div className="mt-8 space-y-8 lg:mt-0">
					<div className="space-y-4">
						<h1 className="text-balance text-[2.4rem] font-bold uppercase leading-[1.05] text-foreground lg:text-[4.4rem]">
							{product.name}
						</h1>
						<p className="inline-flex rounded-full border border-foreground px-5 py-2 text-xl font-semibold">
							{priceDisplay}
						</p>
						<p className="text-lg leading-relaxed text-foreground/65">{product.descriptionText}</p>
						{product.descriptionHtml && (
							<div
								className="prose prose-sm max-w-none text-foreground/65"
								dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
							/>
						)}
					</div>

					<AddToCartButton product={product} />
				</div>
			</div>

			<ProductFeatures />

			<RelatedProducts product={product} />
		</div>
	);
};
