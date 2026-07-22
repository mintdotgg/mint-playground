"use client";

import { AlertCircleIcon } from "lucide-react";
import { AppLink } from "@/components/app-link";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
	return (
		<div
			className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center"
			style={{ minHeight: "90vh" }}
		>
			<AlertCircleIcon className="size-16 text-foreground/45" strokeWidth={1.5} />
			<h1 className="mt-6 text-7xl font-bold">Error</h1>
			<h2 className="mt-4 text-xl text-foreground/60">Something went wrong</h2>
			<p className="mt-2 text-sm text-foreground/60">
				An unexpected error occurred. Please try again or return to the store.
			</p>
			<div className="mt-8 flex items-center gap-4">
				<button type="button" onClick={reset} className="store-pill">
					Try Again
				</button>
				<AppLink href="/" className="store-outline-pill">
					Continue Shopping
				</AppLink>
			</div>
		</div>
	);
}
