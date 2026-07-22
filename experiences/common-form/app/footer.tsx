import { AppLink } from "@/components/app-link";
import { StoreLogo } from "@/components/store-logo";
import { STORE_NAME, storeNavItems } from "@/lib/store";

export function Footer() {
	return (
		<footer className="border-t border-foreground/10 bg-background">
			<div className="store-container py-10">
				<div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
					<StoreLogo href="/" text="none" />
					<nav className="flex flex-wrap gap-5" aria-label="Footer">
						{storeNavItems.map((item) => (
							<AppLink
								key={item.href}
								prefetch="eager"
								href={item.href}
								className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
							>
								{item.label}
							</AppLink>
						))}
						<AppLink
							prefetch="eager"
							href="/products"
							className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
						>
							Products
						</AppLink>
					</nav>
				</div>
				<div className="mt-10 border-t border-foreground/10 pt-6">
					<p className="text-sm text-foreground/55">2026 {STORE_NAME}. All rights reserved.</p>
				</div>
			</div>
		</footer>
	);
}
