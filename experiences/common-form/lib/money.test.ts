import assert from "node:assert/strict";
import test from "node:test";
import { formatMoney } from "./money.ts";

test("formatMoney handles USD minor units", () => {
	const result = formatMoney({ amount: 6800, currency: "USD", locale: "en-US" });

	assert.equal(result, "$68.00");
});
