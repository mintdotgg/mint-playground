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
			className={cn("group inline-flex items-center gap-3", className)}
			aria-label={STORE_NAME}
		>
			<span
				className={cn("archive-logo-mark relative block size-8 shrink-0", markClassName)}
				aria-hidden="true"
			>
				<span />
			</span>
			<span
				className={cn(
					"font-display text-[1.75rem] uppercase leading-none tracking-[0.035em] text-[#edf0e9] sm:text-[2.15rem]",
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
