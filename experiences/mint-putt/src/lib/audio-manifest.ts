// Typed schema for the game's sound-effect manifest, plus validation used by
// tests and the debug audio panel. The manifest itself is generated from the
// canonical Mint audio records into `src/lib/audio-manifest.generated.ts`.

export type PuttIntensity = "soft" | "medium" | "hard";

export type AudioFileMeta = {
  /** Duration of the optimized file in seconds. */
  durationSeconds: number;
  /** Compressed size in bytes. */
  byteSize: number;
};

export type HoleAudioEntry = {
  complete: string;
};

export type AudioManifest = {
  schemaVersion: 1;
  /**
   * Delivery formats. Published manifests may use the same universally
   * supported format for both values when there is no alternate rendition.
   */
  formats: { primary: string; fallback: string };
  /** Restrained crowd response layered onto a confirmed sink. */
  applause: string;
  putt: Record<PuttIntensity, string[]>;
  cup: string[];
  /**
   * Milliseconds to wait after starting each cup sound (by index) before the
   * hole-completion accent plays. Derived from each cup take's real length.
   */
  cupAccentDelayMs: number[];
  /** Keyed by stable hole id ("hole-01"). */
  holes: Record<string, HoleAudioEntry>;
  /** Per-URL metadata for every file above (both formats). */
  meta: Record<string, AudioFileMeta>;
};

/** Stable audio id for a hole. Derived from the authored hole number in
 * course-data, never from an array index. */
export function holeAudioId(holeNumber: number): string {
  if (!Number.isInteger(holeNumber) || holeNumber < 1) {
    throw new Error(`Invalid hole number for audio id: ${holeNumber}`);
  }
  return `hole-${String(holeNumber).padStart(2, "0")}`;
}

export const PUTT_INTENSITIES: readonly PuttIntensity[] = [
  "soft",
  "medium",
  "hard",
];

export type ManifestIssue = {
  severity: "error" | "warning";
  message: string;
};

/**
 * Structural validation of the manifest against the authoritative hole list.
 * File-existence and decodability checks live in the test suite and the
 * asset-preparation script, where the filesystem is available.
 */
export function validateAudioManifest(
  manifest: AudioManifest,
  holeNumbers: readonly number[],
): ManifestIssue[] {
  const issues: ManifestIssue[] = [];
  const error = (message: string) =>
    issues.push({ severity: "error", message });

  if (manifest.schemaVersion !== 1) {
    error(`Unsupported schemaVersion: ${manifest.schemaVersion}`);
  }
  if (!manifest.formats?.primary || !manifest.formats?.fallback) {
    error("Manifest is missing the primary/fallback format declaration");
  }
  if (!manifest.applause) {
    error("Manifest is missing the successful-putt applause");
  }

  for (const intensity of PUTT_INTENSITIES) {
    const variants = manifest.putt[intensity] ?? [];
    if (variants.length < 2) {
      error(
        `putt.${intensity} needs at least 2 variations, found ${variants.length}`,
      );
    }
  }
  if (manifest.cup.length < 3) {
    error(`cup needs at least 3 variations, found ${manifest.cup.length}`);
  }
  if (manifest.cupAccentDelayMs.length !== manifest.cup.length) {
    error(
      `cupAccentDelayMs has ${manifest.cupAccentDelayMs.length} entries for ${manifest.cup.length} cup sounds`,
    );
  }

  const seen = new Set<number>();
  for (const holeNumber of holeNumbers) {
    if (seen.has(holeNumber)) {
      error(`Duplicate hole id in course data: ${holeNumber}`);
    }
    seen.add(holeNumber);
    const id = holeAudioId(holeNumber);
    if (!manifest.holes[id]?.complete) {
      error(`Hole ${id} has no completion accent in the manifest`);
    }
  }
  for (const id of Object.keys(manifest.holes)) {
    const numeric = Number(id.replace(/^hole-/, ""));
    if (!holeNumbers.includes(numeric)) {
      error(`Manifest hole id ${id} does not match any existing hole`);
    }
  }

  for (const url of allManifestUrls(manifest)) {
    if (!manifest.meta[url]) {
      issues.push({
        severity: "warning",
        message: `No metadata recorded for ${url}`,
      });
    }
  }

  return issues;
}

export function allManifestUrls(manifest: AudioManifest): string[] {
  return [
    manifest.applause,
    ...PUTT_INTENSITIES.flatMap((intensity) => manifest.putt[intensity] ?? []),
    ...manifest.cup,
    ...Object.values(manifest.holes).map((entry) => entry.complete),
  ];
}

/** Rewrites a primary-format manifest URL to its fallback rendition. */
export function fallbackUrlFor(manifest: AudioManifest, url: string): string {
  const { primary, fallback } = manifest.formats;
  if (!url.endsWith(`.${primary}`)) return url;
  return `${url.slice(0, -primary.length)}${fallback}`;
}
