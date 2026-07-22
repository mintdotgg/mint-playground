"use client";

import { ArrowUpRight, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/app/cart/cart-context";
import { CartItem } from "@/app/cart/cart-item";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CURRENCY, LOCALE } from "@/lib/constants";
import { formatMoney } from "@/lib/money";

export function CartSidebar() {
	const { isOpen, closeCart, clearCart, items, itemCount, subtotal } = useCart();

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
			<SheetContent className="archive-cart flex h-dvh w-full flex-col border-l border-white/15 bg-[#111411] p-0 text-[#edf0e9] sm:max-w-[460px]">
				<SheetHeader className="border-b border-white/12 px-6 pb-5 pt-8 text-left sm:px-8">
					<p className="archive-kicker">Acquisition list / {String(itemCount).padStart(2, "0")}</p>
					<SheetTitle className="font-display text-5xl font-normal uppercase leading-none text-[#edf0e9]">
						Cart
					</SheetTitle>
					<SheetDescription className="sr-only">
						Review configured sneakers, change quantities, and continue to the demonstration checkout.
					</SheetDescription>
				</SheetHeader>

				{items.length === 0 ? (
					<div className="flex flex-1 flex-col items-start justify-center gap-6 px-8">
						<div className="grid size-16 place-items-center border border-white/18 bg-white/5">
							<ShoppingBag className="size-6 text-[#c7ff1a]" />
						</div>
						<div>
							<p className="text-xl">No pairs secured.</p>
							<p className="mt-2 max-w-xs text-sm leading-relaxed text-[#a9afa7]">
								Choose a release, material, colorway, and size to start an acquisition.
							</p>
						</div>
						<Button variant="outline" onClick={closeCart} className="archive-button-secondary">
							Return to archive
						</Button>
					</div>
				) : (
					<>
						<ScrollArea className="flex-1 px-6 sm:px-8">
							<div className="divide-y divide-white/10">
								{items.map((item) => (
									<CartItem key={item.id} item={item} />
								))}
							</div>
						</ScrollArea>

						<div className="border-t border-white/12 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:px-8">
							<div className="space-y-3 border-b border-white/12 pb-5 text-sm">
								<div className="flex items-center justify-between text-[#a9afa7]">
									<span>Estimated shipping</span>
									<span>Complimentary · 2–4 days</span>
								</div>
								<div className="flex items-baseline justify-between">
									<span className="archive-kicker">Subtotal</span>
									<span className="text-2xl tabular-nums">
										{formatMoney({ amount: subtotal, currency: CURRENCY, locale: LOCALE })}
									</span>
								</div>
							</div>
							<AppLink href="/checkout" onClick={closeCart} className="archive-button-primary mt-5 w-full">
								Begin mock checkout
								<ArrowUpRight className="size-4" />
							</AppLink>
							<button
								type="button"
								onClick={clearCart}
								className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 text-xs uppercase tracking-[0.14em] text-[#a9afa7] transition-colors hover:text-[#edf0e9]"
							>
								<Trash2 className="size-3.5" />
								Clear acquisition list
							</button>
						</div>
					</>
				)}
			</SheetContent>
		</Sheet>
	);
}
