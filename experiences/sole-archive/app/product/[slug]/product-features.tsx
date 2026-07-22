import { Award, Hammer, type LucideIcon, PackageCheck } from "lucide-react";

type Feature = {
	title: string;
	description: string;
	icon?: LucideIcon;
};

type ProductFeaturesProps = {
	features?: Feature[];
};

const defaultFeatures: Feature[] = [
	{
		title: "Everyday Utility",
		description: "Simple forms and durable finishes make each item easy to use often.",
	},
	{
		title: "Considered Materials",
		description: "Neutral textures and quiet details keep the collection easy to adapt.",
	},
	{
		title: "Packed With Care",
		description: "Orders are prepared with clear labels and protective packaging.",
	},
];

const defaultIcons = [PackageCheck, Hammer, Award];

export function ProductFeatures({ features = defaultFeatures }: ProductFeaturesProps) {
	return (
		<section className="mt-20 border-t border-foreground/15 pt-16">
			<h2 className="mb-12 text-center text-3xl font-bold uppercase">Product details</h2>
			<div className="grid gap-8 md:grid-cols-3">
				{features.map((feature, index) => {
					const Icon = feature.icon ?? defaultIcons[index % defaultIcons.length];
					return (
						<div key={feature.title} className="group flex flex-col items-center text-center">
							<div className="mb-4 flex size-14 items-center justify-center rounded-full border border-foreground/15 bg-secondary transition-colors group-hover:bg-foreground">
								<Icon className="size-6 text-foreground/55 transition-colors group-hover:text-primary-foreground" />
							</div>
							<h3 className="mb-2 text-lg font-medium">{feature.title}</h3>
							<p className="text-sm leading-relaxed text-foreground/60">{feature.description}</p>
						</div>
					);
				})}
			</div>
		</section>
	);
}
