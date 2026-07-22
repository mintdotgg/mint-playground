"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type CatalogProduct, getProductBySlug } from "@/lib/products";

export type CartConfiguration = {
	size: string;
	materialId: string;
	materialLabel: string;
	colorwayId: string;
	colorwayLabel: string;
};

export type CartLineItem = {
	id: string;
	quantity: number;
	configuration: CartConfiguration;
	maxQuantity: number;
	product: {
		slug: string;
		code: string;
		name: string;
		images: string[];
		stripePriceId: string;
		amount: number;
		currency: CatalogProduct["currency"];
		inStock: boolean;
	};
};

export type Cart = {
	lineItems: CartLineItem[];
};

export function getLineItemUnitPrice(item: CartLineItem): bigint {
	return BigInt(item.product.amount);
}

function getDefaultConfiguration(product: CatalogProduct): CartConfiguration {
	const size =
		product.sizes.find((candidate) => (product.inventoryBySize[candidate] ?? 0) > 0) ??
		product.sizes[0] ??
		"One size";
	const material =
		product.materials.find((candidate) => candidate.id === product.defaultMaterialId) ?? product.materials[0];
	const colorway =
		product.colorways.find((candidate) => candidate.id === product.defaultColorwayId) ?? product.colorways[0];

	return {
		size,
		materialId: material?.id ?? "standard",
		materialLabel: material?.label ?? "Standard",
		colorwayId: colorway?.id ?? "default",
		colorwayLabel: colorway?.label ?? "Default",
	};
}

export function getCartLineId(slug: string, configuration: CartConfiguration) {
	return [slug, configuration.size, configuration.materialId, configuration.colorwayId].join("::");
}

type CartContextValue = {
	cart: Cart | null;
	items: CartLineItem[];
	itemCount: number;
	subtotal: bigint;
	isOpen: boolean;
	openCart: () => void;
	closeCart: () => void;
	addItem: (product: CatalogProduct, quantity?: number, configuration?: CartConfiguration) => void;
	removeItem: (id: string) => void;
	setItemQuantity: (id: string, quantity: number) => void;
	clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const CART_STORAGE_KEY = "sole_archive_cart_v1";

type CartProviderProps = {
	children: ReactNode;
};

function isStoredLineItem(value: unknown): value is CartLineItem {
	if (!value || typeof value !== "object") return false;
	const item = value as Partial<CartLineItem>;
	return (
		typeof item.id === "string" &&
		typeof item.quantity === "number" &&
		item.quantity > 0 &&
		!!item.configuration &&
		typeof item.configuration.size === "string" &&
		!!item.product &&
		typeof item.product.slug === "string"
	);
}

function toCartLineItem(
	product: CatalogProduct,
	quantity: number,
	configuration?: CartConfiguration,
): CartLineItem {
	const resolvedConfiguration = configuration ?? getDefaultConfiguration(product);
	const maxQuantity = product.inventoryBySize[resolvedConfiguration.size] ?? 0;

	return {
		id: getCartLineId(product.slug, resolvedConfiguration),
		quantity: Math.min(Math.max(1, quantity), Math.max(1, maxQuantity)),
		configuration: resolvedConfiguration,
		maxQuantity,
		product: {
			slug: product.slug,
			code: product.code,
			name: product.name,
			images: [...product.images],
			stripePriceId: product.stripePriceId,
			amount: product.amount,
			currency: product.currency,
			inStock: product.inStock,
		},
	};
}

function readStoredCart() {
	try {
		const raw = window.localStorage.getItem(CART_STORAGE_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter(isStoredLineItem)
			.map((item) => {
				const product = getProductBySlug(item.product.slug);
				return product ? toCartLineItem(product, item.quantity, item.configuration) : null;
			})
			.filter((item): item is CartLineItem => item !== null && item.maxQuantity > 0);
	} catch {
		return [];
	}
}

export function CartProvider({ children }: CartProviderProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [items, setItems] = useState<CartLineItem[]>([]);
	const [hasHydrated, setHasHydrated] = useState(false);

	useEffect(() => {
		setItems(readStoredCart());
		setHasHydrated(true);
	}, []);

	useEffect(() => {
		if (!hasHydrated) return;
		window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
	}, [hasHydrated, items]);

	const subtotal = useMemo(
		() => items.reduce((sum, item) => sum + getLineItemUnitPrice(item) * BigInt(item.quantity), BigInt(0)),
		[items],
	);
	const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

	const openCart = useCallback(() => setIsOpen(true), []);
	const closeCart = useCallback(() => setIsOpen(false), []);

	const addItem = useCallback((product: CatalogProduct, quantity = 1, configuration?: CartConfiguration) => {
		const nextItem = toCartLineItem(product, quantity, configuration);
		if (nextItem.maxQuantity <= 0) return;
		setItems((currentItems) => {
			const existingItem = currentItems.find((item) => item.id === nextItem.id);
			if (existingItem) {
				return currentItems.map((item) =>
					item.id === nextItem.id
						? { ...item, quantity: Math.min(item.quantity + quantity, item.maxQuantity) }
						: item,
				);
			}
			return [...currentItems, nextItem];
		});
	}, []);

	const removeItem = useCallback((id: string) => {
		setItems((currentItems) => currentItems.filter((item) => item.id !== id));
	}, []);

	const setItemQuantity = useCallback((id: string, quantity: number) => {
		setItems((currentItems) =>
			quantity <= 0
				? currentItems.filter((item) => item.id !== id)
				: currentItems.map((item) =>
						item.id === id ? { ...item, quantity: Math.min(quantity, item.maxQuantity) } : item,
					),
		);
	}, []);

	const clearCart = useCallback(() => setItems([]), []);

	const value = useMemo(
		() => ({
			cart: items.length ? { lineItems: items } : null,
			items,
			itemCount,
			subtotal,
			isOpen,
			openCart,
			closeCart,
			addItem,
			removeItem,
			setItemQuantity,
			clearCart,
		}),
		[
			items,
			itemCount,
			subtotal,
			isOpen,
			openCart,
			closeCart,
			addItem,
			removeItem,
			setItemQuantity,
			clearCart,
		],
	);

	return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
	const context = useContext(CartContext);
	if (!context) throw new Error("useCart must be used within a CartProvider");
	return context;
}
