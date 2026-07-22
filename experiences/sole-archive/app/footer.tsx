import { AppLink } from "@/components/app-link";
import { StoreLogo } from "@/components/store-logo";
import { STORE_NAME, storeNavItems } from "@/lib/store";

export function Footer() {
	return (
		<footer className="border-t border-white/12 bg-[#0d100e] text-[#edf0e9]">
			<div className="mx-auto grid max-w-[1500px] gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_auto] lg:px-12">
				<div>
					<StoreLogo href="/" />
					<p className="mt-4 max-w-sm text-sm leading-relaxed text-[#8f978f]">
						Six fictional editions held below street level. No real payment is collected by this archive.
					</p>
				</div>
				<nav className="flex flex-wrap content-start gap-x-6 gap-y-3" aria-label="Footer">
					{storeNavItems.map((item) => (
						<AppLink
							key={item.href}
							prefetch="eager"
							href={item.href}
							className="archive-kicker transition-colors hover:text-[#c7ff1a]"
						>
							{item.label}
						</AppLink>
					))}
				</nav>
				<p className="archive-kicker lg:col-span-2">© 2026 {STORE_NAME} / Demonstration archive</p>
			</div>
		</footer>
	);
}
