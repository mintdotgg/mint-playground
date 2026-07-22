"use client";

import { ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/app/cart/cart-context";
import { CartItem } from "@/app/cart/cart-item";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { CURRENCY, LOCALE } from "@/lib/constants";
import { formatMoney } from "@/lib/money";

export function CartSidebar() {
	const { isOpen, closeCart, clearCart, items, itemCount, subtotal } = useCart();
	const handleEmptyCart = () => {
		clearCart();
	};

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
			<SheetContent className="m-3 flex h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] max-w-[390px] flex-col rounded-[22px] border border-foreground bg-background p-0 shadow-2xl sm:max-w-[390px]">
				<SheetHeader className="border-b border-foreground/15 p-6">
					<SheetTitle className="flex items-center gap-2 text-xl font-medium">
						Shopping Cart
						{itemCount > 0 && (
							<span className="text-sm font-normal text-foreground/55">({itemCount} items)</span>
						)}
					</SheetTitle>
					<SheetDescription className="sr-only">
						Review your persistent demonstration cart and update quantities.
					</SheetDescription>
				</SheetHeader>

				{items.length === 0 ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-12">
						<div className="flex size-20 items-center justify-center rounded-full border border-foreground/20 bg-secondary">
							<ShoppingBag className="size-10 text-foreground/55" />
						</div>
						<div className="text-center">
							<p className="text-lg font-medium">Your cart is empty</p>
							<p className="mt-1 text-sm text-foreground/55">Add some products to get started</p>
						</div>
						<Button variant="outline" onClick={closeCart} className="rounded-lg border-foreground">
							Continue Shopping
						</Button>
					</div>
				) : (
					<>
						<ScrollArea className="flex-1 px-4">
							<div className="divide-y divide-foreground/10">
								{items.map((item) => (
									<CartItem key={item.product.slug} item={item} />
								))}
							</div>
						</ScrollArea>

						<SheetFooter className="mt-auto border-t border-foreground/15 p-5">
							<div className="w-full space-y-4">
								<div className="flex items-center justify-between text-sm">
									<span className="font-medium">Shipping</span>
									<span className="text-xs uppercase text-foreground/55">Calculated at Checkout</span>
								</div>
								<div className="flex items-center justify-between text-xl">
									<span className="font-medium uppercase">TOTAL</span>
									<span className="font-semibold">
										{formatMoney({ amount: subtotal, currency: CURRENCY, locale: LOCALE })}
									</span>
								</div>
								<button
									type="button"
									onClick={handleEmptyCart}
									className="flex w-full items-center justify-center gap-2 rounded-lg border border-foreground bg-background px-4 py-3 text-base text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
								>
									<Trash2 className="size-5" />
									Empty Cart
								</button>
								<div className="rounded-lg bg-foreground px-4 py-4 text-center text-sm text-primary-foreground">
									Demo cart only · checkout is intentionally disabled
								</div>
							</div>
						</SheetFooter>
					</>
				)}
			</SheetContent>
		</Sheet>
	);
}
