import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageRoot = new URL("../", import.meta.url);

test("the portable package uses only manifest-backed Mint CDN runtime assets", async () => {
  const [source, manifestText] = await Promise.all([
    readFile(new URL("app/memoryConstellationAssets.ts", packageRoot), "utf8"),
    readFile(new URL("mint-assets.json", packageRoot), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  const sourceUrls = new Set(
    source.match(/https:\/\/cdn\.mint\.gg\/[^"\s]+/g) ?? [],
  );
  const manifestUrls = new Set(
    Object.values(manifest.assets).flatMap((asset) =>
      Object.values(asset.artifacts).map((artifact) => artifact.runtimeUrl),
    ),
  );

  assert.equal(sourceUrls.size, 18);
  assert.deepEqual(sourceUrls, manifestUrls);
  assert.doesNotMatch(
    source,
    /["']\/(?:mint-assets|images|materials|models)\//,
  );
});

test("the package preserves the local-first archive contract", async () => {
  const source = await readFile(
    new URL("app/MemoryConstellation.tsx", packageRoot),
    "utf8",
  );

  assert.match(source, /indexedDB\.open\(MEDIA_DB/);
  assert.match(source, /localStorage\.setItem\(STORE_KEY/);
  assert.match(source, /DEMO_SCENARIOS/);
  assert.match(source, /inferMemoryConnections/);
});
