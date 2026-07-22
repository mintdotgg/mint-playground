import type { LucideIcon } from "lucide-react";
import { RotateCcw, Shield, Truck } from "lucide-react";

type TrustBadge = {
	icon: LucideIcon;
	title: string;
	description: string;
};

const defaultBadges: TrustBadge[] = [
	{ icon: Truck, title: "Fast Shipping", description: "Packed with care" },
	{ icon: Shield, title: "Secure Checkout", description: "Stripe powered" },
	{ icon: RotateCcw, title: "Simple Returns", description: "Hassle-free" },
];

export function TrustBadges({ badges = defaultBadges }: { badges?: TrustBadge[] }) {
	return (
		<div className="grid grid-cols-3 gap-4 rounded-lg border border-foreground/10 bg-secondary/60 p-4">
			{badges.map((badge) => (
				<div key={badge.title} className="flex flex-col items-center text-center">
					<badge.icon className="mb-2 size-5 text-foreground/55" />
					<span className="text-xs font-medium">{badge.title}</span>
					<span className="text-[10px] text-foreground/55">{badge.description}</span>
				</div>
			))}
		</div>
	);
}
