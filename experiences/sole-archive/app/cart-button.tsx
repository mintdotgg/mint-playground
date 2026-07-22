"use client";

import { ShoppingBag } from "lucide-react";
import { useCart } from "@/app/cart/cart-context";

export function CartButton() {
	const { itemCount, openCart } = useCart();

	return (
		<button
			type="button"
			onClick={openCart}
			className="relative grid min-h-11 min-w-11 place-items-center border border-white/18 text-[#edf0e9] transition-colors hover:border-[#c7ff1a] hover:text-[#c7ff1a]"
			aria-label={`Shopping cart, ${itemCount} items`}
		>
			<ShoppingBag className="size-4" />
			{itemCount > 0 && (
				<span
					aria-live="polite"
					className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center bg-[#c7ff1a] text-[0.6rem] font-semibold text-[#101310]"
				>
					{itemCount}
				</span>
			)}
		</button>
	);
}
