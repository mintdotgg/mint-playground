import { AppLink } from "@/components/app-link";
import { storeNavItems } from "@/lib/store";

export function Navbar() {
	return (
		<nav className="hidden items-center gap-9 lg:flex" aria-label="Primary">
			{storeNavItems.map((item) => (
				<AppLink
					prefetch="eager"
					key={item.href}
					href={item.href}
					className="text-sm font-medium text-foreground transition-colors hover:text-foreground/65"
				>
					{item.label}
				</AppLink>
			))}
		</nav>
	);
}
