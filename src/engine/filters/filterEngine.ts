import { AestheticFilterState, PixelateFilterConfig, VoronoiFilterConfig, Rect } from '../types';

export const DEFAULT_PIXELATE_CONFIG: PixelateFilterConfig = {
  blockSizeMm: 4.0,
  sampleMethod: 'mean',
  gridSnap: true,
  cornerStyle: 'orthogonal',
};

export const DEFAULT_VORONOI_CONFIG: VoronoiFilterConfig = {
  facetCount: 150,
  jitter: 65,
  sampleMethod: 'mean',
  seed: 1,
  cornerStyle: 'orthogonal',
};

export const DEFAULT_AESTHETIC_FILTER_STATE: AestheticFilterState = {
  enabled: false,
  type: 'none',
  pixelate: DEFAULT_PIXELATE_CONFIG,
  voronoi: DEFAULT_VORONOI_CONFIG,
};

function createPRNG(seed: number) {
  let s = (seed | 0) + 0x6d2b79f5;
  return function () {
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    s = (s + 0x9e3779b9) | 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Applies Pixelate filter to full-color ImageData
 */
export function applyPixelateFilterToImageData(
  source: ImageData,
  config: PixelateFilterConfig,
  pxPerMm: number,
  imageBounds?: Rect
): ImageData {
  const { width, height, data } = source;
  const rawBlockSizePx = Math.max(1, Math.round(config.blockSizeMm * pxPerMm));
  const blockSizePx = rawBlockSizePx;

  let originX = imageBounds ? imageBounds.x : 0;
  let originY = imageBounds ? imageBounds.y : 0;

  if (config.gridSnap) {
    originX = Math.round(originX);
    originY = Math.round(originY);
  }

  const outData = new Uint8ClampedArray(data.length);
  const minBx = Math.floor((0 - originX) / blockSizePx);
  const maxBx = Math.floor((width - 1 - originX) / blockSizePx);
  const minBy = Math.floor((0 - originY) / blockSizePx);
  const maxBy = Math.floor((height - 1 - originY) / blockSizePx);

  for (let by = minBy; by <= maxBy; by++) {
    const startY = Math.max(0, Math.floor(originY + by * blockSizePx));
    const endY = Math.min(height, Math.floor(originY + (by + 1) * blockSizePx));
    if (startY >= endY) continue;

    for (let bx = minBx; bx <= maxBx; bx++) {
      const startX = Math.max(0, Math.floor(originX + bx * blockSizePx));
      const endX = Math.min(width, Math.floor(originX + (bx + 1) * blockSizePx));
      if (startX >= endX) continue;

      let validCount = 0;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumA = 0;

      for (let y = startY; y < endY; y++) {
        const row = y * width;
        for (let x = startX; x < endX; x++) {
          const idx = (row + x) * 4;
          const a = data[idx + 3];
          if (a >= 128) {
            sumR += data[idx];
            sumG += data[idx + 1];
            sumB += data[idx + 2];
            sumA += a;
            validCount++;
          }
        }
      }

      const meanR = validCount > 0 ? Math.round(sumR / validCount) : 0;
      const meanG = validCount > 0 ? Math.round(sumG / validCount) : 0;
      const meanB = validCount > 0 ? Math.round(sumB / validCount) : 0;
      const meanA = validCount > 0 ? 255 : 0;

      for (let y = startY; y < endY; y++) {
        const row = y * width;
        for (let x = startX; x < endX; x++) {
          const idx = (row + x) * 4;
          if (data[idx + 3] < 128) {
            outData[idx] = 0;
            outData[idx + 1] = 0;
            outData[idx + 2] = 0;
            outData[idx + 3] = 0;
          } else {
            outData[idx] = meanR;
            outData[idx + 1] = meanG;
            outData[idx + 2] = meanB;
            outData[idx + 3] = meanA;
          }
        }
      }
    }
  }

  return new ImageData(outData, width, height);
}

/**
 * Applies Voronoi polygonal facets filter to full-color ImageData
 */
export function applyVoronoiFilterToImageData(
  source: ImageData,
  config: VoronoiFilterConfig,
  pxPerMm: number,
  imageBounds?: Rect
): ImageData {
  const { width, height, data } = source;
  const bounds = imageBounds || { x: 0, y: 0, width, height };

  const prng = createPRNG(config.seed || 1);
  const facetCount = Math.max(10, Math.min(600, config.facetCount || 150));
  const jitterFactor = Math.max(0, Math.min(100, config.jitter !== undefined ? config.jitter : 65)) / 100;

  const w = Math.max(1, bounds.width);
  const h = Math.max(1, bounds.height);
  const cellArea = (w * h) / facetCount;
  const spacing = Math.sqrt(cellArea * 1.1547);
  const dx = spacing;
  const dy = spacing * 0.866025;

  interface Seed {
    x: number;
    y: number;
    id: number;
  }

  const seeds: Seed[] = [];
  let id = 0;
  const minX = bounds.x - dx * 1.5;
  const maxX = bounds.x + w + dx * 1.5;
  const minY = bounds.y - dy * 1.5;
  const maxY = bounds.y + h + dy * 1.5;

  let row = 0;
  for (let gy = minY; gy <= maxY; gy += dy) {
    const rowOffset = row % 2 === 1 ? dx * 0.5 : 0;
    for (let gx = minX + rowOffset; gx <= maxX; gx += dx) {
      const jx = (prng() - 0.5) * dx * jitterFactor * 0.95;
      const jy = (prng() - 0.5) * dy * jitterFactor * 0.95;
      seeds.push({ x: gx + jx, y: gy + jy, id: id++ });
    }
    row++;
  }

  const numSeeds = seeds.length;
  if (numSeeds === 0) return source;

  // Spatial grid
  const bucketSize = Math.max(16, Math.round(Math.sqrt((width * height) / numSeeds) * 1.25));
  const gridCols = Math.ceil(width / bucketSize);
  const gridRows = Math.ceil(height / bucketSize);
  const grid: number[][] = Array.from({ length: gridCols * gridRows }, () => []);

  for (let i = 0; i < numSeeds; i++) {
    const s = seeds[i];
    const col = Math.floor(s.x / bucketSize);
    const rIdx = Math.floor(s.y / bucketSize);
    for (let r = Math.max(0, rIdx - 1); r <= Math.min(gridRows - 1, rIdx + 1); r++) {
      for (let c = Math.max(0, col - 1); c <= Math.min(gridCols - 1, col + 1); c++) {
        grid[r * gridCols + c].push(i);
      }
    }
  }

  const sumR = new Float64Array(numSeeds);
  const sumG = new Float64Array(numSeeds);
  const sumB = new Float64Array(numSeeds);
  const cellCounts = new Int32Array(numSeeds);
  const pixelToSeed = new Int32Array(width * height);

  for (let y = 0; y < height; y++) {
    const rowIdx = y * width;
    const gRow = Math.min(gridRows - 1, Math.max(0, Math.floor(y / bucketSize)));

    for (let x = 0; x < width; x++) {
      const pIdx = rowIdx + x;
      const gCol = Math.min(gridCols - 1, Math.max(0, Math.floor(x / bucketSize)));
      const candidates = grid[gRow * gridCols + gCol];

      let bestDistSq = Infinity;
      let bestSeed = 0;

      if (candidates && candidates.length > 0) {
        for (let k = 0; k < candidates.length; k++) {
          const sIdx = candidates[k];
          const s = seeds[sIdx];
          const dSq = (x - s.x) * (x - s.x) + (y - s.y) * (y - s.y);
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestSeed = sIdx;
          }
        }
      } else {
        for (let sIdx = 0; sIdx < numSeeds; sIdx++) {
          const s = seeds[sIdx];
          const dSq = (x - s.x) * (x - s.x) + (y - s.y) * (y - s.y);
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestSeed = sIdx;
          }
        }
      }

      pixelToSeed[pIdx] = bestSeed;
      const dIdx = pIdx * 4;
      if (data[dIdx + 3] >= 128) {
        sumR[bestSeed] += data[dIdx];
        sumG[bestSeed] += data[dIdx + 1];
        sumB[bestSeed] += data[dIdx + 2];
        cellCounts[bestSeed]++;
      }
    }
  }

  const meanR = new Uint8Array(numSeeds);
  const meanG = new Uint8Array(numSeeds);
  const meanB = new Uint8Array(numSeeds);

  for (let i = 0; i < numSeeds; i++) {
    const cnt = cellCounts[i];
    if (cnt > 0) {
      meanR[i] = Math.round(sumR[i] / cnt);
      meanG[i] = Math.round(sumG[i] / cnt);
      meanB[i] = Math.round(sumB[i] / cnt);
    }
  }

  const outData = new Uint8ClampedArray(data.length);
  for (let i = 0; i < width * height; i++) {
    const dIdx = i * 4;
    if (data[dIdx + 3] < 128) {
      outData[dIdx] = 0;
      outData[dIdx + 1] = 0;
      outData[dIdx + 2] = 0;
      outData[dIdx + 3] = 0;
    } else {
      const s = pixelToSeed[i];
      outData[dIdx] = meanR[s];
      outData[dIdx + 1] = meanG[s];
      outData[dIdx + 2] = meanB[s];
      outData[dIdx + 3] = 255;
    }
  }

  return new ImageData(outData, width, height);
}

/**
 * Main aesthetic filter runner on full-color ImageData
 */
export function applyAestheticFilterToImage(
  imageData: ImageData,
  filterState: AestheticFilterState,
  pxPerMm: number,
  imageBounds?: Rect
): ImageData {
  if (!filterState || !filterState.enabled || filterState.type === 'none') {
    return imageData;
  }

  if (filterState.type === 'pixelate') {
    return applyPixelateFilterToImageData(
      imageData,
      filterState.pixelate || DEFAULT_PIXELATE_CONFIG,
      pxPerMm,
      imageBounds
    );
  }

  if (filterState.type === 'voronoi') {
    return applyVoronoiFilterToImageData(
      imageData,
      filterState.voronoi || DEFAULT_VORONOI_CONFIG,
      pxPerMm,
      imageBounds
    );
  }

  return imageData;
}
