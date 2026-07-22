"use client";

import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ProductCard } from "@/components/product-card";
import { paginateProducts, searchProducts } from "@/lib/products";
import { SearchPagination } from "./search-pagination";

const PRODUCTS_PER_PAGE = 12;

function SearchForm({ defaultValue = "" }: { defaultValue?: string }) {
	return (
		<form method="get" className="mx-auto mt-8 flex max-w-xl gap-3">
			<input
				type="search"
				name="q"
				defaultValue={defaultValue}
				placeholder="Search products"
				className="min-w-0 flex-1 rounded-lg border border-foreground bg-background px-5 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
			/>
			<button type="submit" className="store-pill">
				Search
			</button>
		</form>
	);
}

function SearchResults({ q, page }: { q?: string; page?: string }) {
	const query = q?.trim() ?? "";
	const result = paginateProducts(searchProducts(query), Number(page) || 1, PRODUCTS_PER_PAGE);

	if (!query) {
		return (
			<section className="store-container store-section">
				<div className="text-center">
					<Search className="mx-auto size-12 text-foreground/45" />
					<h1 className="mt-4 text-3xl font-bold uppercase text-foreground">Search our store</h1>
					<p className="mt-2 text-foreground/60">Enter a search term to find products.</p>
					<SearchForm />
				</div>
			</section>
		);
	}

	if (result.products.length === 0) {
		return (
			<section className="store-container store-section">
				<div className="text-center">
					<Search className="mx-auto size-12 text-foreground/45" />
					<h1 className="mt-4 text-3xl font-bold uppercase text-foreground">No results found</h1>
					<p className="mt-2 text-foreground/60">
						No products matched &ldquo;{query}&rdquo;. Try a different search term.
					</p>
					<SearchForm defaultValue={query} />
				</div>
			</section>
		);
	}

	return (
		<section className="store-container store-section">
			<div className="mb-12">
				<h1 className="store-heading">Results</h1>
				<p className="mt-3 text-foreground/60">
					For &ldquo;{query}&rdquo; / {result.total} {result.total === 1 ? "product" : "products"} found
				</p>
				<SearchForm defaultValue={query} />
			</div>

			<div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
				{result.products.map((product) => (
					<ProductCard key={product.slug} product={product} />
				))}
			</div>

			<SearchPagination currentPage={result.currentPage} totalPages={result.totalPages} query={query} />
		</section>
	);
}

function SearchContent() {
	const searchParams = useSearchParams();
	const q = searchParams.get("q") ?? undefined;
	const page = searchParams.get("page") ?? undefined;
	return <SearchResults q={q} page={page} />;
}

export default function SearchPage() {
	return (
		<Suspense>
			<SearchContent />
		</Suspense>
	);
}
