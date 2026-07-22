"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { type CartLineItem, getLineItemUnitPrice, useCart } from "@/app/cart/cart-context";
import { AppLink } from "@/components/app-link";
import { CURRENCY, LOCALE } from "@/lib/constants";
import { ProductMedia } from "@/lib/media";
import { formatMoney } from "@/lib/money";
import { cn, getProductThumbnail } from "@/lib/utils";

type CartItemProps = {
	item: CartLineItem;
};

export function CartItem({ item }: CartItemProps) {
	const { closeCart, removeItem, setItemQuantity } = useCart();

	const { product, quantity } = item;
	const image = getProductThumbnail(product.images);
	const price = getLineItemUnitPrice(item);
	const lineTotal = price * BigInt(quantity);

	const handleRemove = () => {
		removeItem(product.slug);
	};

	const handleIncrement = () => {
		setItemQuantity(product.slug, quantity + 1);
	};

	const handleDecrement = () => {
		if (quantity <= 1) {
			handleRemove();
			return;
		}
		setItemQuantity(product.slug, quantity - 1);
	};

	return (
		<div className="flex gap-3 py-4">
			{/* Product Image */}
			<AppLink
				prefetch={"eager"}
				href={`/product/${product.slug}`}
				onClick={closeCart}
				className="relative h-24 w-20 shrink-0 overflow-hidden bg-secondary"
			>
				{image && <ProductMedia src={image} alt={product.name} fill className="object-cover" sizes="96px" />}
			</AppLink>

			{/* Product Details */}
			<div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
				<div className="flex items-start justify-between gap-2">
					<AppLink
						prefetch={"eager"}
						href={`/product/${product.slug}`}
						onClick={closeCart}
						className="line-clamp-2 text-sm font-medium leading-tight text-foreground hover:underline"
					>
						{product.name}
					</AppLink>
					<button
						type="button"
						onClick={handleRemove}
						className="shrink-0 p-1 text-foreground/45 transition-colors hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
						aria-label="Remove item"
					>
						<Trash2 className="size-4" />
					</button>
				</div>

				<div className="flex items-center justify-between">
					{/* Quantity Controls */}
					<div
						className={cn("inline-flex items-center rounded-full border border-border transition-opacity")}
					>
						<button
							type="button"
							onClick={handleDecrement}
							className="flex h-7 w-7 shrink-0 items-center justify-center rounded-l-full transition-colors hover:bg-secondary disabled:pointer-events-none"
							aria-label="Decrease quantity"
						>
							<Minus className="size-3" />
						</button>
						<span className="flex h-7 w-8 items-center justify-center text-sm tabular-nums">{quantity}</span>
						<button
							type="button"
							onClick={handleIncrement}
							className="flex h-7 w-7 shrink-0 items-center justify-center rounded-r-full transition-colors hover:bg-secondary disabled:pointer-events-none"
							aria-label="Increase quantity"
						>
							<Plus className="size-3" />
						</button>
					</div>

					{/* Price */}
					<span className="text-sm font-semibold">
						{formatMoney({ amount: lineTotal, currency: CURRENCY, locale: LOCALE })}
					</span>
				</div>
			</div>
		</div>
	);
}
