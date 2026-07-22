"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/app/cart/cart-context";
import { TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CatalogProduct } from "@/lib/products";

type QuickAddButtonProps = {
	product: CatalogProduct;
};

export function QuickAddButton({ product }: QuickAddButtonProps) {
	const { openCart, addItem } = useCart();

	const handleClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		if (!product.inStock) return;

		openCart();
		addItem(product, 1);
	};

	return (
		<TooltipPrimitive.Provider delayDuration={1000}>
			<TooltipPrimitive.Root>
				<TooltipTrigger asChild>
					<button
						type="button"
						onClick={handleClick}
						disabled={!product.inStock}
						className="absolute bottom-3 left-3 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-background/80 backdrop-blur-sm transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-background hover:scale-110 active:scale-95 disabled:opacity-50"
						aria-label={`Add ${product.name} to cart`}
					>
						<ShoppingBag className="h-3.5 w-3.5" />
					</button>
				</TooltipTrigger>
				<TooltipContent side="top" className="text-xs">
					Add to cart
				</TooltipContent>
			</TooltipPrimitive.Root>
		</TooltipPrimitive.Provider>
	);
}
