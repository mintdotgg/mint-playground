import { AppLink } from "@/components/app-link";
import { STORE_NAME } from "@/lib/store";
import { cn } from "@/lib/utils";

type StoreLogoProps = {
	href?: string;
	text?: "always" | "mobile" | "none";
	className?: string;
	markClassName?: string;
	textClassName?: string;
};

export function StoreLogo({
	href = "/",
	text = "always",
	className,
	markClassName,
	textClassName,
}: StoreLogoProps) {
	return (
		<AppLink
			prefetch="eager"
			href={href}
			className={cn("group inline-flex items-center gap-2", className)}
			aria-label={STORE_NAME}
		>
			<span className={cn("relative block size-8 shrink-0 rounded-full border border-foreground/35 bg-[var(--store-rust)]", markClassName)} aria-hidden="true">
				<span className="absolute inset-[24%] rounded-full border border-[var(--store-paper)]/85" />
			</span>
			<span
				className={cn(
					"font-display text-[1.35rem] font-semibold leading-none tracking-[-0.04em] text-foreground sm:text-[1.85rem]",
					text === "mobile" && "lg:hidden",
					text === "none" && "sr-only",
					textClassName,
				)}
			>
				{STORE_NAME}
			</span>
		</AppLink>
	);
}
