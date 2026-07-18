const CLEAR_COLOR = [2, 7, 5] as const;
const DEFAULT_COLOR_DISTANCE_THRESHOLD = 18;
const DIAGONAL_DISTANCE = Math.SQRT2;

export type SplatOccupancyAnalysis = {
  canvas: readonly [number, number];
  coordinateOrigin: "bottom-left";
  colorDistanceThreshold: number;
  occupiedPixels: number;
  coverageRatio: number;
  pixelBounds: {
    min: readonly [number, number];
    max: readonly [number, number];
    size: readonly [number, number];
  };
  centroid: readonly [number, number];
  interiorCenter: readonly [number, number];
  interiorClearancePx: number;
  maximumClearancePx: number;
  canvasCenter: readonly [number, number];
  centerOccupied: boolean;
  centerPatchOccupancy: number;
  offsetPx: readonly [number, number];
  distanceToCenterPx: number;
  accepted: boolean;
};

type AnalyzeOptions = {
  colorDistanceThreshold?: number;
  centerPatchRadius?: number;
};

export function analyzeSplatOccupancy(
  pixels: Uint8Array,
  width: number,
  height: number,
  options: AnalyzeOptions = {},
): SplatOccupancyAnalysis | null {
  if (width <= 0 || height <= 0 || pixels.length < width * height * 4) {
    return null;
  }

  const colorDistanceThreshold =
    options.colorDistanceThreshold ?? DEFAULT_COLOR_DISTANCE_THRESHOLD;
  const thresholdSquared = colorDistanceThreshold ** 2;
  const occupied = new Uint8Array(width * height);
  const distances = new Float32Array(width * height);
  const infiniteDistance = width + height;
  let occupiedPixels = 0;
  let sumX = 0;
  let sumY = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const pixelIndex = index * 4;
      const red = pixels[pixelIndex] - CLEAR_COLOR[0];
      const green = pixels[pixelIndex + 1] - CLEAR_COLOR[1];
      const blue = pixels[pixelIndex + 2] - CLEAR_COLOR[2];
      const isOccupied = red * red + green * green + blue * blue > thresholdSquared;
      if (!isOccupied) {
        distances[index] = 0;
        continue;
      }

      occupied[index] = 1;
      distances[index] =
        x === 0 || y === 0 || x === width - 1 || y === height - 1
          ? 1
          : infiniteDistance;
      occupiedPixels += 1;
      sumX += x;
      sumY += y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (occupiedPixels === 0) return null;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!occupied[index]) continue;
      let distance = distances[index];
      if (x > 0) distance = Math.min(distance, distances[index - 1] + 1);
      if (y > 0) distance = Math.min(distance, distances[index - width] + 1);
      if (x > 0 && y > 0) {
        distance = Math.min(
          distance,
          distances[index - width - 1] + DIAGONAL_DISTANCE,
        );
      }
      if (x < width - 1 && y > 0) {
        distance = Math.min(
          distance,
          distances[index - width + 1] + DIAGONAL_DISTANCE,
        );
      }
      distances[index] = distance;
    }
  }

  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const index = y * width + x;
      if (!occupied[index]) continue;
      let distance = distances[index];
      if (x < width - 1) {
        distance = Math.min(distance, distances[index + 1] + 1);
      }
      if (y < height - 1) {
        distance = Math.min(distance, distances[index + width] + 1);
      }
      if (x < width - 1 && y < height - 1) {
        distance = Math.min(
          distance,
          distances[index + width + 1] + DIAGONAL_DISTANCE,
        );
      }
      if (x > 0 && y < height - 1) {
        distance = Math.min(
          distance,
          distances[index + width - 1] + DIAGONAL_DISTANCE,
        );
      }
      distances[index] = distance;
    }
  }

  const centroidX = sumX / occupiedPixels;
  const centroidY = sumY / occupiedPixels;
  let maximumClearancePx = 0;
  for (let index = 0; index < occupied.length; index += 1) {
    if (occupied[index]) {
      maximumClearancePx = Math.max(maximumClearancePx, distances[index]);
    }
  }

  // The interior center is the center of the largest inscribed circle in the
  // rendered mask: no other occupied pixel is farther from empty space. Use
  // the visual centroid only to break near-equal distance-transform ties.
  const minimumInteriorClearance = Math.max(3, maximumClearancePx - 0.5);
  let interiorX = minX;
  let interiorY = minY;
  let interiorClearancePx = 0;
  let closestCentroidDistanceSquared = Number.POSITIVE_INFINITY;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const index = y * width + x;
      if (!occupied[index] || distances[index] < minimumInteriorClearance) {
        continue;
      }
      const centroidDistanceSquared =
        (x - centroidX) ** 2 + (y - centroidY) ** 2;
      if (centroidDistanceSquared < closestCentroidDistanceSquared) {
        closestCentroidDistanceSquared = centroidDistanceSquared;
        interiorX = x;
        interiorY = y;
        interiorClearancePx = distances[index];
      }
    }
  }

  const canvasCenterX = (width - 1) / 2;
  const canvasCenterY = (height - 1) / 2;
  const centerPixelX = Math.round(canvasCenterX);
  const centerPixelY = Math.round(canvasCenterY);
  const centerOccupied = Boolean(
    occupied[centerPixelY * width + centerPixelX],
  );
  const centerPatchRadius = options.centerPatchRadius ?? 4;
  let centerPatchPixels = 0;
  let occupiedCenterPatchPixels = 0;
  for (
    let y = Math.max(0, centerPixelY - centerPatchRadius);
    y <= Math.min(height - 1, centerPixelY + centerPatchRadius);
    y += 1
  ) {
    for (
      let x = Math.max(0, centerPixelX - centerPatchRadius);
      x <= Math.min(width - 1, centerPixelX + centerPatchRadius);
      x += 1
    ) {
      centerPatchPixels += 1;
      occupiedCenterPatchPixels += occupied[y * width + x];
    }
  }

  const offsetX = interiorX - canvasCenterX;
  const offsetY = interiorY - canvasCenterY;
  const distanceToCenterPx = Math.hypot(offsetX, offsetY);
  const centerPatchOccupancy =
    occupiedCenterPatchPixels / centerPatchPixels;
  const accepted =
    centerOccupied &&
    centerPatchOccupancy >= 0.95 &&
    distanceToCenterPx <= 1 &&
    interiorClearancePx >= 4;

  return {
    canvas: [width, height],
    coordinateOrigin: "bottom-left",
    colorDistanceThreshold,
    occupiedPixels,
    coverageRatio: occupiedPixels / (width * height),
    pixelBounds: {
      min: [minX, minY],
      max: [maxX, maxY],
      size: [maxX - minX + 1, maxY - minY + 1],
    },
    centroid: [centroidX, centroidY],
    interiorCenter: [interiorX, interiorY],
    interiorClearancePx,
    maximumClearancePx,
    canvasCenter: [canvasCenterX, canvasCenterY],
    centerOccupied,
    centerPatchOccupancy,
    offsetPx: [offsetX, offsetY],
    distanceToCenterPx,
    accepted,
  };
}
