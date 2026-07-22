"use client";

import { ArrowLeft, Check, LockKeyhole } from "lucide-react";
import { useMemo, useState } from "react";
import { useCart } from "@/app/cart/cart-context";
import { AppLink } from "@/components/app-link";
import { CURRENCY, LOCALE } from "@/lib/constants";
import { formatMoney } from "@/lib/money";

type CheckoutDetails = {
	email: string;
	name: string;
	address: string;
	city: string;
	postalCode: string;
};

const emptyDetails: CheckoutDetails = {
	email: "",
	name: "",
	address: "",
	city: "",
	postalCode: "",
};

export default function CheckoutPage() {
	const { items, subtotal, clearCart } = useCart();
	const [step, setStep] = useState<"shipping" | "review" | "complete">("shipping");
	const [details, setDetails] = useState(emptyDetails);
	const [orderNumber, setOrderNumber] = useState("");
	const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

	const updateField = (field: keyof CheckoutDetails, value: string) => {
		setDetails((current) => ({ ...current, [field]: value }));
	};

	const continueToReview = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setStep("review");
	};

	const placeMockOrder = () => {
		const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
		setOrderNumber(`SA-${suffix}`);
		clearCart();
		setStep("complete");
	};

	if (step === "complete") {
		return (
			<main
				id="main-content"
				className="grid min-h-[70svh] place-items-center bg-[#111411] px-5 py-20 text-[#edf0e9]"
			>
				<div className="max-w-xl border border-white/14 p-8 sm:p-12">
					<div className="grid size-14 place-items-center bg-[#c7ff1a] text-[#111411]">
						<Check className="size-5" />
					</div>
					<p className="archive-kicker mt-8">Mock order / {orderNumber}</p>
					<h1 className="mt-3 font-display text-7xl font-normal uppercase leading-[0.86]">Pair secured.</h1>
					<p className="mt-6 leading-relaxed text-[#aeb5ad]">
						This demonstration order was not charged or transmitted. In a production store, confirmation would
						be sent to {details.email}.
					</p>
					<AppLink href="/" className="archive-button-primary mt-8">
						Return to the archive
					</AppLink>
				</div>
			</main>
		);
	}

	return (
		<main
			id="main-content"
			className="min-h-[80svh] bg-[#111411] px-5 py-12 text-[#edf0e9] sm:px-8 lg:px-12 lg:py-20"
		>
			<div className="mx-auto max-w-[1200px]">
				<AppLink
					href="/"
					className="inline-flex min-h-11 items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#aeb5ad] hover:text-[#c7ff1a]"
				>
					<ArrowLeft className="size-4" /> Return to archive
				</AppLink>
				<div className="mt-10 grid gap-12 lg:grid-cols-[1fr_0.72fr] lg:gap-24">
					<section>
						<p className="archive-kicker">Demonstration acquisition</p>
						<h1 className="mt-3 font-display text-7xl font-normal uppercase leading-[0.86] sm:text-8xl">
							Mock checkout
						</h1>
						<div className="mt-8 flex gap-2 text-[0.65rem] uppercase tracking-[0.13em]">
							<span
								className={`border px-3 py-2 ${step === "shipping" ? "border-[#c7ff1a] text-[#c7ff1a]" : "border-white/14 text-[#7e867f]"}`}
							>
								01 Shipping
							</span>
							<span
								className={`border px-3 py-2 ${step === "review" ? "border-[#c7ff1a] text-[#c7ff1a]" : "border-white/14 text-[#7e867f]"}`}
							>
								02 Review
							</span>
						</div>

						{items.length === 0 ? (
							<div className="mt-12 border-y border-white/14 py-10">
								<h2 className="text-2xl">The acquisition list is empty.</h2>
								<p className="mt-2 text-[#aeb5ad]">Configure a pair before opening checkout.</p>
								<AppLink href="/" className="archive-button-primary mt-6">
									Browse releases
								</AppLink>
							</div>
						) : step === "shipping" ? (
							<form className="mt-10 grid gap-5" onSubmit={continueToReview}>
								<label className="grid gap-2">
									<span className="archive-kicker">Email address</span>
									<input
										required
										type="email"
										autoComplete="email"
										value={details.email}
										onChange={(event) => updateField("email", event.target.value)}
										className="min-h-12 border border-white/18 bg-[#171b18] px-4 text-[#edf0e9] focus:border-[#c7ff1a]"
										placeholder="name@example.com"
									/>
								</label>
								<label className="grid gap-2">
									<span className="archive-kicker">Full name</span>
									<input
										required
										autoComplete="name"
										value={details.name}
										onChange={(event) => updateField("name", event.target.value)}
										className="min-h-12 border border-white/18 bg-[#171b18] px-4 text-[#edf0e9] focus:border-[#c7ff1a]"
									/>
								</label>
								<label className="grid gap-2">
									<span className="archive-kicker">Street address</span>
									<input
										required
										autoComplete="street-address"
										value={details.address}
										onChange={(event) => updateField("address", event.target.value)}
										className="min-h-12 border border-white/18 bg-[#171b18] px-4 text-[#edf0e9] focus:border-[#c7ff1a]"
									/>
								</label>
								<div className="grid gap-5 sm:grid-cols-2">
									<label className="grid gap-2">
										<span className="archive-kicker">City</span>
										<input
											required
											autoComplete="address-level2"
											value={details.city}
											onChange={(event) => updateField("city", event.target.value)}
											className="min-h-12 border border-white/18 bg-[#171b18] px-4 text-[#edf0e9] focus:border-[#c7ff1a]"
										/>
									</label>
									<label className="grid gap-2">
										<span className="archive-kicker">Postal code</span>
										<input
											required
											autoComplete="postal-code"
											value={details.postalCode}
											onChange={(event) => updateField("postalCode", event.target.value)}
											className="min-h-12 border border-white/18 bg-[#171b18] px-4 text-[#edf0e9] focus:border-[#c7ff1a]"
										/>
									</label>
								</div>
								<button type="submit" className="archive-button-primary mt-3">
									Review mock order
								</button>
							</form>
						) : (
							<div className="mt-10">
								<div className="border-y border-white/14 py-6">
									<p className="archive-kicker">Deliver to</p>
									<p className="mt-3">
										{details.name}
										<br />
										{details.address}
										<br />
										{details.city}, {details.postalCode}
									</p>
								</div>
								<div className="mt-6 flex gap-3 border border-[#c7ff1a]/45 bg-[#c7ff1a]/5 p-4 text-sm text-[#d8ded6]">
									<LockKeyhole className="mt-0.5 size-4 shrink-0 text-[#c7ff1a]" />
									No payment details are requested. Placing this order creates a local demonstration
									confirmation only.
								</div>
								<div className="mt-6 grid gap-3 sm:grid-cols-2">
									<button
										type="button"
										onClick={() => setStep("shipping")}
										className="archive-button-secondary"
									>
										Edit shipping
									</button>
									<button type="button" onClick={placeMockOrder} className="archive-button-primary">
										Place mock order
									</button>
								</div>
							</div>
						)}
					</section>

					<aside className="border-t border-white/14 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
						<div className="flex items-baseline justify-between">
							<h2 className="font-display text-4xl uppercase">Order summary</h2>
							<span className="archive-kicker">{itemCount} pairs</span>
						</div>
						<div className="mt-5 divide-y divide-white/12 border-y border-white/12">
							{items.map((item) => (
								<div key={item.id} className="grid grid-cols-[1fr_auto] gap-5 py-5 text-sm">
									<div>
										<p>
											{item.product.code} / {item.product.name} × {item.quantity}
										</p>
										<p className="mt-1 text-xs uppercase tracking-[0.1em] text-[#8f978f]">
											US {item.configuration.size} · {item.configuration.materialLabel} ·{" "}
											{item.configuration.colorwayLabel}
										</p>
									</div>
									<p className="tabular-nums">
										{formatMoney({
											amount: BigInt(item.product.amount * item.quantity),
											currency: CURRENCY,
											locale: LOCALE,
										})}
									</p>
								</div>
							))}
						</div>
						<div className="mt-5 space-y-3 text-sm">
							<div className="flex justify-between text-[#aeb5ad]">
								<span>Shipping</span>
								<span>Complimentary</span>
							</div>
							<div className="flex items-baseline justify-between border-t border-white/12 pt-4">
								<span className="archive-kicker">Subtotal</span>
								<span className="text-2xl tabular-nums">
									{formatMoney({ amount: subtotal, currency: CURRENCY, locale: LOCALE })}
								</span>
							</div>
						</div>
					</aside>
				</div>
			</div>
		</main>
	);
}
