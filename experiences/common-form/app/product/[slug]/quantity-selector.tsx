"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type QuantitySelectorProps = {
	quantity: number;
	onQuantityChange: (quantity: number) => void;
	min?: number;
	max?: number;
	disabled?: boolean;
};

export function QuantitySelector({
	quantity,
	onQuantityChange,
	min = 1,
	max = 99,
	disabled = false,
}: QuantitySelectorProps) {
	return (
		<div>
			<span className="mb-3 block text-sm font-medium">Quantity</span>
			<div className="inline-flex items-center rounded-full border border-foreground/25">
				<Button
					variant="ghost"
					size="icon"
					className="h-10 w-10 rounded-l-full rounded-r-none"
					onClick={() => onQuantityChange(Math.max(min, quantity - 1))}
					disabled={disabled || quantity <= min}
					aria-label="Decrease quantity"
				>
					<Minus className="size-4" />
				</Button>
				<span className="flex h-10 w-14 items-center justify-center text-sm font-medium">{quantity}</span>
				<Button
					variant="ghost"
					size="icon"
					className="h-10 w-10 rounded-l-none rounded-r-full"
					onClick={() => onQuantityChange(Math.min(max, quantity + 1))}
					disabled={disabled || quantity >= max}
					aria-label="Increase quantity"
				>
					<Plus className="size-4" />
				</Button>
			</div>
		</div>
	);
}
