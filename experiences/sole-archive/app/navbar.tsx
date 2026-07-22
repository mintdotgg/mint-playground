import { AppLink } from "@/components/app-link";
import { storeNavItems } from "@/lib/store";

export function Navbar() {
	return (
		<nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
			{storeNavItems.map((item) => (
				<AppLink
					prefetch="eager"
					key={item.href}
					href={item.href}
					className="text-[0.68rem] uppercase tracking-[0.15em] text-[#aeb5ad] transition-colors hover:text-[#c7ff1a]"
				>
					{item.label}
				</AppLink>
			))}
		</nav>
	);
}
