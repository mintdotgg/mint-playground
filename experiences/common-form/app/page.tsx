import { ArrowRight, Layers3, PackageCheck, ScanLine } from "lucide-react";
import Image from "next/image";
import { Suspense } from "react";
import { AppLink } from "@/components/app-link";
import { ProductShowcase } from "@/components/product-showcase";
import { Newsletter } from "@/components/sections/newsletter";
import { ShowroomExperience } from "@/components/showroom/showroom-experience";
import { storeAssets } from "@/lib/store";

const principles = [
	{
		title: "Useful by nature",
		description:
			"Every object earns its place through simple utility, balanced proportion, and durable material choices.",
		icon: PackageCheck,
	},
	{
		title: "Quietly tactile",
		description:
			"Matte stoneware, woven cotton, linen, and powder-coated steel bring texture without visual noise.",
		icon: ScanLine,
	},
	{
		title: "Made to coexist",
		description:
			"A restrained palette lets the collection settle into a room together rather than compete for attention.",
		icon: Layers3,
	},
] as const;

function ProductShowcaseFallback() {
	return (
		<div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading collection">
			{Array.from({ length: 6 }).map((_, index) => (
				<div key={`product-fallback-${index}`} className="space-y-4">
					<div className="flex min-h-12 items-start justify-between gap-4">
						<div className="h-6 w-40 bg-secondary" />
						<div className="h-8 w-20 bg-secondary" />
					</div>
					<div className="aspect-[3/4] bg-secondary" />
					<div className="h-12 bg-secondary" />
				</div>
			))}
		</div>
	);
}

export default function Home() {
	return (
		<main>
			<ShowroomExperience />

			<section id="collection" className="store-container store-section scroll-mt-24">
				<div className="mb-12 grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
					<div>
						<p className="store-kicker">The complete edit</p>
						<h2 className="store-heading">Objects with a reason to stay.</h2>
					</div>
					<div className="flex flex-col items-start gap-5 lg:items-end">
						<p className="max-w-xl text-lg leading-[1.7] text-foreground/68 lg:text-right">
							Six familiar forms, reduced to what matters: honest material, balanced weight, and daily
							usefulness.
						</p>
						<AppLink
							prefetch="eager"
							href="/products"
							className="inline-flex items-center gap-2 border-b border-foreground/35 pb-1 text-sm font-semibold transition-colors hover:border-foreground"
						>
							Browse the collection
							<ArrowRight className="size-4" aria-hidden="true" />
						</AppLink>
					</div>
				</div>
				<Suspense fallback={<ProductShowcaseFallback />}>
					<ProductShowcase />
				</Suspense>
			</section>

			<section id="studio" className="relative isolate overflow-hidden bg-foreground text-primary-foreground">
				<Image
					src={storeAssets.hero}
					alt="A calm arrangement of shelves, packages, and everyday objects"
					fill
					sizes="100vw"
					className="object-cover opacity-45 grayscale"
				/>
				<div className="absolute inset-0 bg-linear-to-r from-foreground via-foreground/82 to-foreground/25" />
				<div className="store-container relative grid min-h-[38rem] gap-14 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-end lg:py-28">
					<div>
						<p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/58">
							Our point of view
						</p>
						<h2 className="max-w-[9ch] font-display text-[clamp(3.4rem,7vw,7.6rem)] font-medium leading-[0.86] tracking-[-0.065em]">
							Less, but more felt.
						</h2>
					</div>
					<div className="grid gap-8 border-t border-primary-foreground/20 pt-8">
						{principles.map((principle) => {
							const Icon = principle.icon;
							return (
								<article key={principle.title} className="grid grid-cols-[2rem_1fr] gap-4">
									<Icon className="mt-1 size-4 text-primary-foreground/54" aria-hidden="true" />
									<div>
										<h3 className="text-lg font-semibold">{principle.title}</h3>
										<p className="mt-2 max-w-md leading-[1.65] text-primary-foreground/62">
											{principle.description}
										</p>
									</div>
								</article>
							);
						})}
					</div>
				</div>
			</section>

			<Newsletter />
		</main>
	);
}
