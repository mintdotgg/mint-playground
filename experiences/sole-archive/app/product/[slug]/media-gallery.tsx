"use client";

import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { ProductMedia } from "@/lib/media";
import { cn, isVideoUrl } from "@/lib/utils";

type MediaGalleryProps = {
	images: readonly string[];
	productName: string;
};

export function MediaGallery({ images, productName }: MediaGalleryProps) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [isZoomed, setIsZoomed] = useState(false);
	const displayImages = images;

	const handlePrevious = useCallback(() => {
		setSelectedIndex((prev) => (prev === 0 ? displayImages.length - 1 : prev - 1));
	}, [displayImages.length]);

	const handleNext = useCallback(() => {
		setSelectedIndex((prev) => (prev === displayImages.length - 1 ? 0 : prev + 1));
	}, [displayImages.length]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>) => {
			if (displayImages.length <= 1) return;

			if (e.key === "ArrowLeft") {
				e.preventDefault();
				handlePrevious();
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				handleNext();
			}
		},
		[displayImages.length, handlePrevious, handleNext],
	);

	if (displayImages.length === 0) {
		return (
			<div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
				<div className="flex aspect-[4/5] items-center justify-center bg-secondary">
					<p className="text-foreground/55">No images available</p>
				</div>
			</div>
		);
	}

	const selectedImage = displayImages[selectedIndex] ?? displayImages[0];

	return (
		<div
			tabIndex={0}
			onKeyDown={handleKeyDown}
			className="flex flex-col gap-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:sticky lg:top-24 lg:self-start"
		>
			<div className="group relative aspect-[4/5] overflow-hidden bg-secondary">
				{isVideoUrl(selectedImage) ? (
					<video
						className="absolute inset-0 h-full w-full object-cover"
						src={selectedImage}
						muted
						loop
						autoPlay
						playsInline
						controls
					/>
				) : (
					<ProductMedia
						src={selectedImage}
						alt={`${productName} - View ${selectedIndex + 1}`}
						fill
						sizes="(max-width: 1024px) 100vw, 50vw"
						className={cn(
							"object-cover transition-transform duration-500",
							isZoomed && "scale-150 cursor-zoom-out",
						)}
						onClick={() => setIsZoomed(!isZoomed)}
						loading="eager"
					/>
				)}

				{displayImages.length > 1 && (
					<div className="absolute inset-x-4 top-1/2 flex -translate-y-1/2 justify-between opacity-0 transition-opacity group-hover:opacity-100">
						<Button
							variant="secondary"
							size="icon"
							className="h-10 w-10 rounded-full bg-background/90 shadow-lg backdrop-blur-sm hover:bg-background"
							onClick={(e) => {
								e.stopPropagation();
								handlePrevious();
							}}
							aria-label="Previous image"
						>
							<ChevronLeft className="size-5" />
						</Button>
						<Button
							variant="secondary"
							size="icon"
							className="h-10 w-10 rounded-full bg-background/90 shadow-lg backdrop-blur-sm hover:bg-background"
							onClick={(e) => {
								e.stopPropagation();
								handleNext();
							}}
							aria-label="Next image"
						>
							<ChevronRight className="size-5" />
						</Button>
					</div>
				)}

				{!isVideoUrl(selectedImage) && (
					<div className="absolute bottom-4 right-4 opacity-0 transition-opacity group-hover:opacity-100">
						<div className="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
							<ZoomIn className="size-3.5" />
							Click to zoom
						</div>
					</div>
				)}

				{displayImages.length > 1 && (
					<div className="absolute bottom-4 left-4 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
						{selectedIndex + 1} / {displayImages.length}
					</div>
				)}
			</div>

			{displayImages.length > 1 && (
				<div className="-m-2 flex gap-3 overflow-x-auto p-2">
					{displayImages.map((image, index) => (
						<button
							key={`${image}-${index}`}
							type="button"
							onClick={() => {
								setSelectedIndex(index);
								setIsZoomed(false);
							}}
							className={cn(
								"relative h-24 w-20 shrink-0 overflow-hidden bg-secondary transition-all",
								selectedIndex === index
									? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
									: "opacity-65 hover:opacity-100",
							)}
							aria-label={`View image ${index + 1}`}
						>
							{isVideoUrl(image) ? (
								<video className="h-full w-full object-cover" src={image} muted playsInline />
							) : (
								<ProductMedia
									src={image}
									alt={`${productName} thumbnail ${index + 1}`}
									fill
									sizes="80px"
									loading={index === 0 ? "eager" : "lazy"}
									className="object-cover"
								/>
							)}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
