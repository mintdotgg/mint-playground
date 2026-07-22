"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "@/app/cart/cart-context";

export function CartButton() {
	const { itemCount, openCart } = useCart();

	return (
		<button
			type="button"
			onClick={openCart}
			className="relative grid size-7 place-items-center bg-background text-foreground transition duration-300 hover:-translate-y-0.5 lg:size-10"
			aria-label="Shopping cart"
		>
			<ShoppingCart className="size-5" />
			{itemCount > 0 ? (
				<span
					aria-live="polite"
					className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-foreground text-[0.65rem] font-semibold text-primary-foreground"
				>
					{itemCount}
				</span>
			) : null}
		</button>
	);
}
