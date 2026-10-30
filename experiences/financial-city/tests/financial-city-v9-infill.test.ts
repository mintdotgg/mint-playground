import assert from "node:assert/strict";
import test from "node:test";
import {
  buildingFootprintClearsV7Roads,
  FINANCIAL_CITY_V7_CALIBRATION,
} from "../app/financialCityV7Calibration.ts";
import { FINANCIAL_CITY_MINT_ASSETS } from "../app/financialCityMintAssets.ts";
import {
  FINANCIAL_CITY_V9_INFILL,
  FINANCIAL_CITY_V9_INFILL_RESERVED_FOOTPRINTS,
  getFinancialCityInfillTier,
  squareFootprintsOverlap,
} from "../app/financialCityV9Infill.ts";

const PARCEL_SETBACK = 0.25;

test("V9 fills forty anchors inside the measured V7 parcels and off every road", () => {
  assert.equal(FINANCIAL_CITY_V9_INFILL.length, 40);

  for (const spec of FINANCIAL_CITY_V9_INFILL) {
    const parcel = FINANCIAL_CITY_V7_CALIBRATION.parcels.find(
      (candidate) => candidate.id === spec.parcelId,
    );
    assert.ok(parcel, `parcel ${spec.parcelId} must exist`);

    const halfFootprint = spec.footprint / 2;
    const [parcelX, parcelZ] = parcel.center;
    const [parcelWidth, parcelDepth] = parcel.size;
    assert.ok(
      Math.abs(spec.x - parcelX) + halfFootprint + PARCEL_SETBACK
        <= parcelWidth / 2,
      `${spec.key} must stay inside ${spec.parcelId} on X`,
    );
    assert.ok(
      Math.abs(spec.z - parcelZ) + halfFootprint + PARCEL_SETBACK
        <= parcelDepth / 2,
      `${spec.key} must stay inside ${spec.parcelId} on Z`,
    );
    assert.equal(
      buildingFootprintClearsV7Roads(
        spec.x,
        spec.z,
        halfFootprint,
        halfFootprint,
      ),
      true,
      `${spec.key} must clear the V7 road mask`,
    );
  }
});

test("V9 infill anchors never collide with each other", () => {
  for (
    let leftIndex = 0;
    leftIndex < FINANCIAL_CITY_V9_INFILL.length;
    leftIndex += 1
  ) {
    const left = FINANCIAL_CITY_V9_INFILL[leftIndex];
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < FINANCIAL_CITY_V9_INFILL.length;
      rightIndex += 1
    ) {
      const right = FINANCIAL_CITY_V9_INFILL[rightIndex];
      assert.equal(
        squareFootprintsOverlap(left, right),
        false,
        `${left.key} must not collide with ${right.key}`,
      );
    }
  }
});

test("V9 reserved district sites either clear infill or explicitly replace it", () => {
  for (const infill of FINANCIAL_CITY_V9_INFILL) {
    for (const reserved of FINANCIAL_CITY_V9_INFILL_RESERVED_FOOTPRINTS) {
      if (infill.parcelId !== reserved.parcelId) continue;
      if (!squareFootprintsOverlap(infill, reserved)) continue;
      assert.ok(
        "hideWhen" in infill && infill.hideWhen.some(id => id === reserved.id),
        `${infill.key} overlaps ${reserved.id} without yielding its site`,
      );
    }
  }
});

test("V9 selects deferred, balanced, and luxury buildings from financial health", () => {
  const offTarget = {
    stage: 2,
    surplus: -300,
    goalMatch: 0.5,
    savingsRate: 0.08,
    debtLoad: 0.42,
    emergencyMonths: 0.5,
  };
  const balanced = {
    stage: 4,
    surplus: 600,
    goalMatch: 0.82,
    savingsRate: 0.22,
    debtLoad: 0.2,
    emergencyMonths: 3,
  };
  const ahead = {
    stage: 5,
    surplus: 1800,
    goalMatch: 0.96,
    savingsRate: 0.34,
    debtLoad: 0.08,
    emergencyMonths: 5,
  };

  assert.equal(getFinancialCityInfillTier(offTarget), "deferred");
  assert.equal(getFinancialCityInfillTier(balanced), "balanced");
  assert.equal(getFinancialCityInfillTier(ahead), "luxury");
});

test("V9 presets keep dense blocks while yielding active reserved districts", () => {
  const visibleWith = (blockers: ReadonlySet<string>) =>
    FINANCIAL_CITY_V9_INFILL.filter(
      (spec) => !("hideWhen" in spec && spec.hideWhen.some((id) => blockers.has(id))),
    ).length;

  assert.equal(visibleWith(new Set(["debtConstruction"])), 38);
  assert.equal(
    visibleWith(new Set(["skyline", "hospital", "fireStation"])),
    33,
  );
  assert.equal(
    visibleWith(
      new Set(["skyline", "hospital", "fireStation", "futureDistrict"]),
    ),
    30,
  );
});

test("V9 production state families reference only approved Mint GLBs", () => {
  const { deferred, luxury } = FINANCIAL_CITY_MINT_ASSETS.infillState;
  assert.equal(deferred.length, 6);
  assert.equal(luxury.length, 8);
  assert.equal(
    deferred.some((path) => path.includes("deferred-mixed-use-corner")),
    false,
  );
  assert.equal(
    deferred.some((path) => path.includes("deferred-small-hotel")),
    false,
  );

  for (const path of [...deferred, ...luxury]) {
    assert.match(
      path,
      /^https:\/\/cdn\.mint\.gg\/glb\/.+-normalized-[0-9a-f]{16}\.glb$/,
    );
  }
});

test("V9 balanced composition excludes variants rejected in the orbit review", () => {
  const activeAssets = new Set<string>(
    FINANCIAL_CITY_V9_INFILL.map((spec) => spec.asset),
  );

  assert.equal(activeAssets.has("charcoalTower"), false);
  assert.equal(activeAssets.has("convertedWarehouse"), false);
  assert.equal(activeAssets.has("serviceHouse"), false);
});
