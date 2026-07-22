"use client";

import { CirclePlus } from "lucide-react";
import { useCart } from "@/app/cart/cart-context";
import type { CatalogProduct } from "@/lib/products";

type ProductAddToCartButtonProps = {
	product: CatalogProduct;
	quantity?: number;
};

export function ProductAddToCartButton({ product, quantity = 1 }: ProductAddToCartButtonProps) {
	const { openCart, addItem } = useCart();

	const handleClick = () => {
		if (!product.inStock) return;
		openCart();
		addItem(product, quantity);
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={!product.inStock}
			className="store-pill w-full gap-2"
		>
			<CirclePlus className="size-5" />
			{product.inStock ? "Add to Cart" : "Out of Stock"}
		</button>
	);
}
