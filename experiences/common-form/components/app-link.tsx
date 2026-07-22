"use client";

import { usePathname } from "next/navigation";
import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

const PORTABLE_BASE_PATH = "/_experiences/common-form";

export function toPortableHref(href: string) {
	if (!href.startsWith("/")) return href;

	const url = new URL(href, "https://portable.mint.invalid");
	const route = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
	return `${PORTABLE_BASE_PATH}${route}/index.html${url.search}${url.hash}`;
}

type AppLinkProps = Omit<ComponentPropsWithRef<"a">, "href"> & {
	href: string;
	exactHrefMatch?: boolean;
	activeClassName?: string;
	prefetch?: boolean | "eager";
};

export const AppLink = ({
	exactHrefMatch,
	activeClassName,
	className,
	prefetch: _prefetch,
	href,
	...props
}: AppLinkProps) => {
	const pathname = usePathname();
	const logicalHref = href.split(/[?#]/, 1)[0] || "/";
	const isActive = exactHrefMatch ? pathname === logicalHref : pathname.startsWith(logicalHref);

	return <a {...props} href={toPortableHref(href)} className={cn(className, isActive && activeClassName)} />;
};
