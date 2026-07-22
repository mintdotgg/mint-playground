"use client";

import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { useState } from "react";

export function Newsletter() {
	const [complete, setComplete] = useState(false);

	return (
		<section className="overflow-hidden bg-foreground text-background">
			<div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					{complete ? (
						<div>
							<div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-background/10">
								<CheckIcon className="h-6 w-6" />
							</div>
							<h2 className="text-2xl font-medium tracking-tight sm:text-3xl">You&apos;re on the demo list</h2>
							<p className="mt-3 text-background/60">Nothing was transmitted; this interaction stays in your browser.</p>
						</div>
					) : (
						<>
							<h2 className="text-3xl font-medium tracking-tight sm:text-4xl lg:text-5xl">Stay in the loop</h2>
							<p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-background/60">
								Try the storefront newsletter interaction without sending personal data.
							</p>
							<form
								className="mx-auto mt-10 flex max-w-md flex-col gap-3 sm:flex-row"
								onSubmit={(event) => { event.preventDefault(); setComplete(true); }}
							>
								<input type="email" placeholder="your@email.com" required className="h-12 w-full flex-1 rounded-full border border-background/20 bg-background/10 px-5 text-background outline-none placeholder:text-background/30" />
								<button type="submit" className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-background px-8 font-medium text-foreground">
									Try demo <ArrowRightIcon className="h-4 w-4" />
								</button>
							</form>
						</>
					)}
				</div>
			</div>
		</section>
	);
}
