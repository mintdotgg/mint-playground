import { describe, expect, test } from "bun:test";
import { generatedProducts } from "@/lib/generated/catalog";

describe("Sole Archive catalog", () => {
	test("contains exactly six fictional releases", () => {
		expect(generatedProducts).toHaveLength(6);
		expect(new Set(generatedProducts.map((product) => product.slug)).size).toBe(6);
	});

	test("keeps remaining inventory synchronized with per-size inventory", () => {
		generatedProducts.map((product) => {
			const total = Object.values(product.inventoryBySize).reduce((sum, quantity) => sum + quantity, 0);
			expect(total).toBe(product.remainingInventory);
			return product;
		});
	});

	test("defaults resolve to valid material and colorway options", () => {
		generatedProducts.map((product) => {
			expect(product.materials.some((material) => material.id === product.defaultMaterialId)).toBe(true);
			expect(product.colorways.some((colorway) => colorway.id === product.defaultColorwayId)).toBe(true);
			return product;
		});
	});
});
