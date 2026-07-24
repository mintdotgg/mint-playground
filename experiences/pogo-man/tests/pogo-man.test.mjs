import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the complete Mint-authored Pogo Man runtime", async () => {
  const [component, runtimeMap, mintRegistry, social] = await Promise.all([
    readFile(new URL("app/PogoMan.tsx", root), "utf8"),
    readFile(new URL("app/pogoManMintAssets.ts", root), "utf8"),
    readFile(new URL("mint-assets.json", root), "utf8"),
    stat(
      new URL(
        "../../public/experience-assets/pogo-man/social-card.webp",
        root,
      ),
    ),
  ]);
  const registry = JSON.parse(mintRegistry);
  const artifacts = Object.values(registry.assets).flatMap((asset) =>
    Object.values(asset.artifacts),
  );

  assert.match(component, /TAP TO JUMP/);
  assert.match(component, /localStorage\.setItem\("pogo-man-best"/);
  assert.doesNotMatch(component, /new THREE\.AnimationMixer/);
  assert.doesNotMatch(component, /pogoVisual/);
  assert.match(component, /buildObstacle\("taxi"/);
  assert.match(component, /randomKind/);
  assert.match(component, /pointercancel/i);
  assert.match(component, /pogo-countdown/);
  assert.match(component, /KeyH/);
  assert.doesNotMatch(component, /SparkRenderer|SplatMesh|flyby|boostArmed/);
  assert.match(component, /immediateJumpVelocity/);
  assert.match(component, /MAX_JUMPS_PER_LANDING/);
  assert.match(component, /LAND TO RECHARGE/);
  assert.match(component, /jumpsAfterAttempt/);
  assert.match(component, /bounceVelocityForCharge\(charge\)/);
  assert.match(component, /speed \* dt \* 0\.42/);
  assert.doesNotMatch(component, /downtown-segment\.glb/);
  assert.match(runtimeMap, /tall-building-row-normalized-0c3687a9f3e6ab20\.glb/);
  assert.match(
    runtimeMap,
    /continuous-asphalt-road-normalized-cf4c45e949cbb198\.glb/,
  );
  assert.match(
    runtimeMap,
    /arcade-cloud-family-normalized-7b4b35da0d3098d3\.glb/,
  );
  assert.doesNotMatch(runtimeMap, /\.rad|downtown-segment\.glb|scrolling-street-v3\.glb|flyby-/);
  assert.ok(social.size > 100_000);
  assert.equal(registry.delivery, "mint_cdn");
  assert.equal(Object.keys(registry.assets).length, 9);
  assert.equal(artifacts.length, 11);
  assert.doesNotMatch(mintRegistry, /mint\.gg\/chat\//);
  assert.doesNotMatch(runtimeMap, /["']\/(?:models|audio)\//);

  for (const artifact of artifacts) {
    assert.match(artifact.runtimeUrl, /^https:\/\/cdn\.mint\.gg\//);
    assert.match(runtimeMap, new RegExp(artifact.runtimeUrl.replaceAll(".", "\\.")));
  }
});
