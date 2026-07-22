import { describe, expect, test } from "bun:test";
import { type CartConfiguration, getCartLineId } from "@/app/cart/cart-context";

const baseConfiguration: CartConfiguration = {
	size: "9",
	materialId: "ballistic-mesh",
	materialLabel: "Ballistic mesh",
	colorwayId: "acid-fog",
	colorwayLabel: "Acid Fog",
};

describe("configured cart line identity", () => {
	test("is deterministic for an identical configuration", () => {
		expect(getCartLineId("sublevel-zero", baseConfiguration)).toBe(
			getCartLineId("sublevel-zero", { ...baseConfiguration }),
		);
	});

	test("keeps different sizes and materials as separate lines", () => {
		const baseId = getCartLineId("sublevel-zero", baseConfiguration);
		expect(getCartLineId("sublevel-zero", { ...baseConfiguration, size: "10" })).not.toBe(baseId);
		expect(
			getCartLineId("sublevel-zero", {
				...baseConfiguration,
				materialId: "brushed-suede",
				materialLabel: "Brushed suede",
			}),
		).not.toBe(baseId);
	});
});
