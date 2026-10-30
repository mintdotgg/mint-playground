import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  FINANCIAL_CITY_V7_CALIBRATION,
  trafficFootprintIsOnV7Road,
  v7NormalizedPointToFoundationLocal,
} from "../app/financialCityV7Calibration.ts";

const VEHICLE_FOOTPRINTS = [
  { length: 4.4, width: 2.15, routeKinds: ["perimeter", "internal"] },
  { length: 3.9, width: 2, routeKinds: ["perimeter", "internal"] },
  { length: 4.5, width: 2.25, routeKinds: ["perimeter", "internal"] },
  { length: 3.4, width: 1.85, routeKinds: ["perimeter", "internal"] },
  { length: 5.4, width: 2.3, routeKinds: ["perimeter"] },
  { length: 8.6, width: 3.4, routeKinds: ["perimeter"] },
] as const;

const NORMALIZED_ROUTES = [
  ...FINANCIAL_CITY_V7_CALIBRATION.perimeter.normalizedLaneAnchors.map(
    (anchors) => ({ anchors, kind: "perimeter" as const }),
  ),
  ...FINANCIAL_CITY_V7_CALIBRATION.internalRoadCenterlines.normalizedLaneAnchors.map(
    (anchors) => ({ anchors, kind: "internal" as const }),
  ),
];

test("V7 normalized space transforms through the measured foundation fit", () => {
  assert.deepEqual(v7NormalizedPointToFoundationLocal([-0.5, -0.5]), [
    -88,
    -76.5,
  ]);
  assert.deepEqual(v7NormalizedPointToFoundationLocal([0.5, 0.5]), [
    88,
    76.5,
  ]);

  assert.equal(
    FINANCIAL_CITY_V7_CALIBRATION.calibrationSource,
    "v7-isolated-top-down-visible-asphalt",
  );
  assert.equal(FINANCIAL_CITY_V7_CALIBRATION.roadWidth, 10);

  for (const route of NORMALIZED_ROUTES) {
    for (const [normalizedX, normalizedZ] of route.anchors) {
      assert.ok(normalizedX >= -0.5 && normalizedX <= 0.5);
      assert.ok(normalizedZ >= -0.5 && normalizedZ <= 0.5);
    }
  }

  assert.deepEqual(
    FINANCIAL_CITY_V7_CALIBRATION.normalizedIntersections.map(
      v7NormalizedPointToFoundationLocal,
    ),
    FINANCIAL_CITY_V7_CALIBRATION.intersections,
  );
  assert.deepEqual(
    FINANCIAL_CITY_V7_CALIBRATION.normalizedSidewalkAnchors.map(
      v7NormalizedPointToFoundationLocal,
    ),
    FINANCIAL_CITY_V7_CALIBRATION.sidewalkAnchors,
  );
});

test("every normalized V7 route keeps every production vehicle footprint on road", () => {
  let samples = 0;

  for (const route of NORMALIZED_ROUTES) {
    const curve = new THREE.CatmullRomCurve3(
      route.anchors.map((anchor) => {
        const [x, z] = v7NormalizedPointToFoundationLocal(anchor);
        return new THREE.Vector3(
          x,
          FINANCIAL_CITY_V7_CALIBRATION.board.surfaceY + 0.06,
          z,
        );
      }),
      true,
      "centripetal",
    );

    for (const vehicle of VEHICLE_FOOTPRINTS) {
      if (!vehicle.routeKinds.some(kind => kind === route.kind)) continue;
      for (let step = 0; step < 4_000; step += 1) {
        const progress = step / 4_000;
        const position = curve.getPointAt(progress);
        const tangent = curve.getTangentAt(progress);
        const yaw = Math.atan2(tangent.x, tangent.z);
        samples += 1;
        assert.equal(
          trafficFootprintIsOnV7Road(
            position.x,
            position.z,
            yaw,
            vehicle.length / 2 + 0.2,
            vehicle.width / 2 + 0.2,
          ),
          true,
          `route sample ${step} failed for ${vehicle.length} × ${vehicle.width} m vehicle`,
        );
      }
    }
  }

  assert.equal(samples, 80_000);
});

test("the superseded theoretical perimeter anchor is rejected by the measured V7 asphalt mask", () => {
  assert.equal(
    trafficFootprintIsOnV7Road(73.96, 0, 0, 2.4, 1.3),
    false,
  );
});
