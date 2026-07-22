"use client";

import { useMemo, useState } from "react";
import { useCart } from "@/app/cart/cart-context";
import { QuantitySelector } from "@/app/product/[slug]/quantity-selector";
import { TrustBadges } from "@/app/product/[slug]/trust-badges";
import { CURRENCY, LOCALE } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import type { CatalogProduct } from "@/lib/products";

type AddToCartButtonProps = {
	product: CatalogProduct;
};

export function AddToCartButton({ product }: AddToCartButtonProps) {
	const [quantity, setQuantity] = useState(1);
	const { openCart, addItem } = useCart();
	const totalPrice = BigInt(product.amount) * BigInt(quantity);

	const buttonText = useMemo(() => {
		if (!product.inStock) return "Out of Stock";
		return `Add to Cart - ${formatMoney({ amount: totalPrice, currency: CURRENCY, locale: LOCALE })}`;
	}, [product.inStock, totalPrice]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (!product.inStock) return;

		openCart();
		addItem(product, quantity);
		setQuantity(1);
	};

	return (
		<div className="space-y-8">
			<QuantitySelector quantity={quantity} onQuantityChange={setQuantity} disabled={!product.inStock} />

			<form onSubmit={handleSubmit}>
				<button
					type="submit"
					disabled={!product.inStock}
					className="h-14 w-full rounded-lg bg-foreground px-8 py-4 text-base font-medium text-primary-foreground transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{buttonText}
				</button>
			</form>

			<TrustBadges />
		</div>
	);
}
