"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AppLink } from "@/components/app-link";
import { ProductCard } from "@/components/product-card";
import { catalogProducts, type ProductSort, paginateProducts, sortProducts } from "@/lib/products";
import { ProductsPagination } from "./products-pagination";

const PRODUCTS_PER_PAGE = 12;

const sortOptions = [
	{ value: "newest", label: "Newest" },
	{ value: "price-asc", label: "Price: Low to High" },
	{ value: "price-desc", label: "Price: High to Low" },
	{ value: "name", label: "Name: A-Z" },
] as const;

function isProductSort(value: string | undefined): value is ProductSort {
	return sortOptions.some((option) => option.value === value);
}

function ProductList({ page, sort }: { page?: string; sort?: string }) {
	const sortValue = isProductSort(sort) ? sort : "newest";
	const sortedProducts = sortProducts(catalogProducts, sortValue);
	const result = paginateProducts(sortedProducts, Number(page) || 1, PRODUCTS_PER_PAGE);

	if (result.products.length === 0) {
		return (
			<div className="py-24 text-center">
				<p className="text-lg text-foreground/60">No products available yet.</p>
			</div>
		);
	}

	return (
		<>
			<div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
				{result.products.map((product) => (
					<ProductCard key={product.slug} product={product} />
				))}
			</div>

			<ProductsPagination currentPage={result.currentPage} totalPages={result.totalPages} sort={sort} />
		</>
	);
}

function SortLink({ option, currentSort }: { option: (typeof sortOptions)[number]; currentSort?: string }) {
	const isActive = option.value === (currentSort ?? "newest");
	const href = option.value === "newest" ? "/products" : `/products?sort=${option.value}`;

	return (
		<AppLink
			prefetch="eager"
			href={href}
			className={`rounded-full border px-4 py-2 text-sm transition-colors ${
				isActive
					? "border-foreground bg-foreground text-primary-foreground"
					: "border-foreground/20 text-foreground/60 hover:border-foreground hover:text-foreground"
			}`}
		>
			{option.label}
		</AppLink>
	);
}

function ProductsContent() {
	const searchParams = useSearchParams();
	const page = searchParams.get("page") ?? undefined;
	const sort = searchParams.get("sort") ?? undefined;

	return (
		<div className="store-container py-12 sm:py-16">
			<div className="mb-10">
				<h1 className="store-heading">Our Products</h1>
				<p className="mt-3 max-w-xl text-foreground/65">Browse our complete collection</p>
			</div>

			<div className="mb-8 flex flex-wrap items-center gap-3">
				<span className="text-sm font-medium text-foreground/60">Sort by:</span>
				{sortOptions.map((option) => (
					<SortLink key={option.value} option={option} currentSort={sort} />
				))}
			</div>

			<ProductList page={page} sort={sort} />
		</div>
	);
}

export default function ProductsPage() {
	return (
		<Suspense>
			<ProductsContent />
		</Suspense>
	);
}
