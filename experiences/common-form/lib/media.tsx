"use client";

import Image, { getImageProps } from "next/image";
import { type ComponentProps, useEffect, useState } from "react";
import { isVideoUrl } from "@/lib/utils";

type ImageProps = ComponentProps<typeof Image>;

const ImageWithPolling = (props: ImageProps) => {
	const { props: resolvedProps } = getImageProps(props as Parameters<typeof getImageProps>[0]);
	const [readySrc, setReadySrc] = useState<string | null>(null);

	const src = resolvedProps.src;

	useEffect(() => {
		let cancelled = false;

		const probe = () => {
			const img = new window.Image();
			img.onload = () => {
				if (!cancelled) setReadySrc(src);
			};
			img.onerror = () => {
				if (cancelled) return;
				setTimeout(probe, 1000);
			};
			img.src = src;
		};

		probe();

		return () => {
			cancelled = true;
		};
	}, [src]);

	if (readySrc !== src) {
		const style: React.CSSProperties = props.fill
			? { position: "absolute", inset: 0, width: "100%", height: "100%" }
			: { width: resolvedProps.width, height: resolvedProps.height };

		return <div className={`product-image-shimmer ${props.className ?? ""}`} style={style} />;
	}

	return <Image {...props} alt={props.alt ?? ""} />;
};

const ProductImage = process.env.NODE_ENV === "development" ? ImageWithPolling : Image;

type ProductMediaProps = ImageProps & {
	autoPlay?: boolean;
	controls?: boolean;
};

export const ProductMedia = ({ autoPlay = true, controls = false, ...props }: ProductMediaProps) => {
	const src = typeof props.src === "string" ? props.src : "";
	if (isVideoUrl(src)) {
		return (
			<video
				className={typeof props.className === "string" ? props.className : undefined}
				style={
					props.fill
						? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }
						: undefined
				}
				src={src}
				muted
				loop
				autoPlay={autoPlay}
				playsInline
				controls={controls}
			/>
		);
	}
	return <ProductImage {...props} alt={props.alt ?? ""} />;
};
