"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type CatalogProduct, getProductBySlug } from "@/lib/products";

export type CartLineItem = {
	quantity: number;
	product: {
		slug: string;
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

type CartContextValue = {
	cart: Cart | null;
	items: CartLineItem[];
	itemCount: number;
	subtotal: bigint;
	isOpen: boolean;
	openCart: () => void;
	closeCart: () => void;
	addItem: (product: CatalogProduct, quantity?: number) => void;
	removeItem: (slug: string) => void;
	setItemQuantity: (slug: string, quantity: number) => void;
	clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const CART_STORAGE_KEY = "store_template_cart";

type CartProviderProps = {
	children: ReactNode;
};

function isCartLineItem(value: unknown): value is CartLineItem {
	if (!value || typeof value !== "object") return false;
	const item = value as Partial<CartLineItem>;
	const product = item.product as Partial<CartLineItem["product"]> | undefined;
	return (
		typeof item.quantity === "number" &&
		item.quantity > 0 &&
		!!product &&
		typeof product.slug === "string" &&
		typeof product.name === "string" &&
		Array.isArray(product.images) &&
		product.images.every((image) => typeof image === "string") &&
		typeof product.stripePriceId === "string" &&
		typeof product.amount === "number" &&
		typeof product.currency === "string" &&
		typeof product.inStock === "boolean"
	);
}

function readStoredCart() {
	try {
		const raw = window.localStorage.getItem(CART_STORAGE_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter(isCartLineItem)
			.map((item) => {
				const product = getProductBySlug(item.product.slug);
				return product ? toCartLineItem(product, item.quantity) : null;
			})
			.filter((item): item is CartLineItem => item !== null);
	} catch {
		return [];
	}
}

function toCartLineItem(product: CatalogProduct, quantity: number): CartLineItem {
	return {
		quantity,
		product: {
			slug: product.slug,
			name: product.name,
			images: [...product.images],
			stripePriceId: product.stripePriceId,
			amount: product.amount,
			currency: product.currency,
			inStock: product.inStock,
		},
	};
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

	const addItem = useCallback((product: CatalogProduct, quantity = 1) => {
		setItems((currentItems) => {
			const existingItem = currentItems.find((item) => item.product.slug === product.slug);
			if (existingItem) {
				return currentItems.map((item) =>
					item.product.slug === product.slug
						? { ...item, quantity: item.quantity + quantity, product: toCartLineItem(product, 0).product }
						: item,
				);
			}
			return [...currentItems, toCartLineItem(product, quantity)];
		});
	}, []);

	const removeItem = useCallback((slug: string) => {
		setItems((currentItems) => currentItems.filter((item) => item.product.slug !== slug));
	}, []);

	const setItemQuantity = useCallback((slug: string, quantity: number) => {
		setItems((currentItems) =>
			quantity <= 0
				? currentItems.filter((item) => item.product.slug !== slug)
				: currentItems.map((item) => (item.product.slug === slug ? { ...item, quantity } : item)),
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
	if (!context) {
		throw new Error("useCart must be used within a CartProvider");
	}
	return context;
}
