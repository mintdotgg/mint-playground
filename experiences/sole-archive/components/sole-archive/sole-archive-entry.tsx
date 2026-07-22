"use client";

import dynamic from "next/dynamic";

const SoleArchiveExperience = dynamic(
	() =>
		import("@/components/sole-archive/sole-archive-experience").then(
			(module) => module.SoleArchiveExperience,
		),
	{
		ssr: false,
		loading: () => (
			<div className="grid min-h-[calc(100svh-5rem)] place-items-center bg-[#111411] text-[#edf0e9]">
				<div className="text-center">
					<p className="archive-kicker">Sublevel access</p>
					<p className="mt-3 font-display text-5xl uppercase">Opening archive</p>
				</div>
			</div>
		),
	},
);

export function SoleArchiveEntry() {
	return <SoleArchiveExperience />;
}
