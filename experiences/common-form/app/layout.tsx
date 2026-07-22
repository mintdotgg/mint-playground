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
	metadataBase: new URL(process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000"),
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
};

function CartProviderWrapper({ children }: { children: React.ReactNode }) {
	return (
		<CartProvider>
			<div className="flex min-h-screen flex-col bg-background">
				<header className="sticky top-0 z-50 border-b border-foreground/10 bg-background/94 backdrop-blur-md">
					<div className="mx-auto w-full px-[39px] lg:px-0">
						<div className="flex h-20 items-center justify-between gap-3 lg:relative">
							<StoreLogo
								text="always"
								className="lg:absolute lg:left-[max(39px,calc((100vw-1180px)/2))] lg:top-1/2 lg:-translate-y-1/2"
								markClassName="size-8 lg:size-10"
							/>
							<div className="hidden lg:absolute lg:left-1/2 lg:top-1/2 lg:block lg:-translate-x-1/2 lg:-translate-y-1/2">
								<Navbar />
							</div>
							<div className="flex items-center gap-3 lg:absolute lg:right-[39px] lg:top-1/2 lg:-translate-y-1/2 lg:gap-[138px]">
								<AppLink
									prefetch="eager"
									href="/#showroom"
									className="inline-flex h-11 w-24 items-center justify-center bg-[var(--store-rust)] text-sm font-semibold text-[var(--store-paper)] transition-colors hover:bg-[var(--store-rust-dark)] lg:w-[133px]"
								>
									Showroom
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
		<html lang="en" data-scroll-behavior="smooth">
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
