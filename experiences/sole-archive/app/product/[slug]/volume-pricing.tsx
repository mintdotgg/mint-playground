import { useMemo } from "react";
import { CURRENCY, LOCALE } from "@/lib/constants";
import { formatMoney } from "@/lib/money";

export type VolumeTier = {
	id: string;
	price: string;
	minQuantity: number;
	maxQuantity: number | null;
	productVariantId: string | null;
};

export function useVolumePricing(
	tiers: VolumeTier[],
	selectedVariantId: string | undefined,
	quantity: number,
) {
	const resolvedTiers = useMemo(() => {
		if (tiers.length === 0 || !selectedVariantId) return [];
		const variantTiers = tiers.filter((t) => t.productVariantId === selectedVariantId);
		const productTiers = tiers.filter((t) => !t.productVariantId);
		return (variantTiers.length > 0 ? variantTiers : productTiers).sort(
			(a, b) => a.minQuantity - b.minQuantity,
		);
	}, [tiers, selectedVariantId]);

	const volumePrice = useMemo(() => {
		return (
			[...resolvedTiers]
				.reverse()
				.find(
					(tier) =>
						quantity >= tier.minQuantity && (tier.maxQuantity === null || quantity <= tier.maxQuantity),
				)?.price ?? null
		);
	}, [resolvedTiers, quantity]);

	return { resolvedTiers, volumePrice };
}

export function VolumePricingDisplay({
	tiers,
	quantity,
	volumePrice,
}: {
	tiers: VolumeTier[];
	quantity: number;
	volumePrice: string | null;
}) {
	if (tiers.length === 0) return null;

	return (
		<>
			{volumePrice && (
				<p className="text-sm text-foreground/60">
					{formatMoney({ amount: BigInt(volumePrice), currency: CURRENCY, locale: LOCALE })} per unit at qty{" "}
					{quantity}
				</p>
			)}

			<div>
				<p className="mb-2 text-sm font-medium">Buy more, save more</p>
				<div className="overflow-hidden rounded-lg border border-foreground/15 text-sm">
					<table className="w-full">
						<thead>
							<tr className="bg-muted/50 text-foreground/60">
								<th className="px-3 py-1.5 text-left font-medium">Quantity</th>
								<th className="px-3 py-1.5 text-right font-medium">Price per unit</th>
							</tr>
						</thead>
						<tbody>
							{tiers.map((tier, index) => {
								const isActive =
									quantity >= tier.minQuantity && (tier.maxQuantity === null || quantity <= tier.maxQuantity);
								return (
									<tr
										key={tier.id}
										className={
											isActive ? "bg-foreground/5 font-semibold" : index % 2 === 1 ? "bg-muted/20" : ""
										}
									>
										<td className="px-3 py-1.5">
											{tier.maxQuantity ? `${tier.minQuantity}-${tier.maxQuantity}` : `${tier.minQuantity}+`}
										</td>
										<td className="px-3 py-1.5 text-right font-medium">
											{formatMoney({ amount: BigInt(tier.price), currency: CURRENCY, locale: LOCALE })}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>
		</>
	);
}
