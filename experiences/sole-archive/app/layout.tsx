import "@/app/globals.css";

import type { Metadata } from "next";
import { Suspense } from "react";
import { CartProvider } from "@/app/cart/cart-context";
import { CartSidebar } from "@/app/cart/cart-sidebar";
import { CartButton } from "@/app/cart-button";
import { Footer } from "@/app/footer";
import { Navbar } from "@/app/navbar";
import { AppLink } from "@/components/app-link";
import { ErrorOverlayRemover, NavigationReporter } from "@/components/devtools";
import { StoreLogo } from "@/components/store-logo";
import { StoreJsonLd } from "@/lib/json-ld";
import { STORE_DESCRIPTION, STORE_NAME, storeAssets } from "@/lib/store";

export const metadata: Metadata = {
	metadataBase: new URL(process.env.NEXT_PUBLIC_URL ?? "https://play.mint.gg"),
	title: STORE_NAME,
	description: STORE_DESCRIPTION,
	icons: {
		icon: [{ url: storeAssets.favicon, sizes: "any", type: "image/png" }],
		apple: [{ url: storeAssets.favicon, sizes: "180x180" }],
		shortcut: storeAssets.favicon,
	},
	openGraph: {
		title: STORE_NAME,
		description: STORE_DESCRIPTION,
		images: [storeAssets.openGraph],
	},
	twitter: {
		card: "summary_large_image",
		title: STORE_NAME,
		description: STORE_DESCRIPTION,
		images: [storeAssets.openGraph],
	},
	manifest: "/manifest.webmanifest",
};

function CartProviderWrapper({ children }: { children: React.ReactNode }) {
	return (
		<CartProvider>
			<div className="flex min-h-screen flex-col bg-background">
				<a href="#main-content" className="archive-skip-link">
					Skip to main content
				</a>
				<header className="sticky top-0 z-50 border-b border-white/12 bg-[#111411] text-[#edf0e9]">
					<div className="mx-auto w-full px-4 sm:px-7">
						<div className="flex h-20 items-center justify-between gap-3 lg:relative">
							<StoreLogo
								text="mobile"
								className="lg:absolute lg:left-0 lg:top-1/2 lg:-translate-y-1/2"
								markClassName="size-8 lg:size-10"
							/>
							<div className="hidden lg:absolute lg:left-1/2 lg:top-1/2 lg:block lg:-translate-x-1/2 lg:-translate-y-1/2">
								<Navbar />
							</div>
							<div className="flex items-center gap-3 lg:absolute lg:right-0 lg:top-1/2 lg:-translate-y-1/2 lg:gap-6">
								<AppLink
									prefetch="eager"
									href="/products"
									className="hidden min-h-11 items-center justify-center border border-white/18 px-5 text-[0.68rem] uppercase tracking-[0.14em] text-[#edf0e9] transition-colors hover:border-[#c7ff1a] hover:text-[#c7ff1a] sm:inline-flex"
								>
									Release index
								</AppLink>
								<CartButton />
							</div>
						</div>
					</div>
				</header>
				<div className="flex-1">{children}</div>
				<Footer />
			</div>
			<CartSidebar />
		</CartProvider>
	);
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const env = process.env.VERCEL_ENV || "development";

	return (
		<html lang="en">
			<body className="antialiased">
				<Suspense>
					<StoreJsonLd />
				</Suspense>
				<Suspense>
					<CartProviderWrapper>{children}</CartProviderWrapper>
				</Suspense>
				{env === "development" && (
					<>
						<NavigationReporter />
						<ErrorOverlayRemover />
					</>
				)}
			</body>
		</html>
	);
}
