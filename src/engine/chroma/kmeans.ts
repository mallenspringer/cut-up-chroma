import { ChromaSwatch, ClusteringAlgorithm } from '../types';
import { rgbToOklab, oklabToOklch, oklabToHex } from './oklab';

export interface SamplePoint {
  L: number;
  a: number;
  b: number;
  C: number;
}

const COLOR_NAMES = [
  'Midnight Carbon',
  'Deep Navy',
  'Forest Moss',
  'Burnt Umber',
  'Rust Terracotta',
  'Mustard Ochre',
  'Sage Celadon',
  'Dusty Rose',
  'Sky Azure',
  'Sandstone Buff',
  'Alabaster Cream',
  'Arctic White',
];

export interface PaletteExtractionOptions {
  algorithm?: ClusteringAlgorithm;
  accentSensitivity?: number; // 0.0 to 1.0 (default: 0.5)
  lumaRampGamma?: number; // 0.2 to 3.0 (default: 1.0)
}

/**
 * Extracts dominant color palette from ImageData using the selected clustering engine
 */
export function extractDominantPalette(
  imageData: ImageData,
  k: number = 5,
  options: PaletteExtractionOptions = {}
): ChromaSwatch[] {
  const clampedK = Math.max(2, Math.min(12, Math.round(k)));
  const { width, height, data } = imageData;

  // 1. Fast Sampling Buffer
  const totalPixels = width * height;
  const targetSamples = 6000;
  const step = Math.max(1, Math.floor(Math.sqrt(totalPixels / targetSamples)));

  const samples: SamplePoint[] = [];

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const a = data[idx + 3];
      if (a < 128) continue; // Skip transparent pixels

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const lab = rgbToOklab(r, g, b);
      const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
      samples.push({ L: lab.L, a: lab.a, b: lab.b, C });
      if (samples.length >= 8000) break;
    }
    if (samples.length >= 8000) break;
  }

  if (samples.length === 0) {
    return createFallbackPalette(clampedK);
  }

  const algorithm = options.algorithm || 'kmeans_pp';
  let centroids: Array<{ L: number; a: number; b: number }>;

  switch (algorithm) {
    case 'saliency':
      centroids = extractSaliencyCentroids(samples, clampedK, options.accentSensitivity ?? 0.5);
      break;
    case 'luma_ramp':
      centroids = extractLumaRampCentroids(samples, clampedK, options.lumaRampGamma ?? 1.0);
      break;
    case 'median_cut':
      centroids = extractMedianCutCentroids(samples, clampedK);
      break;
    case 'kmeans_pp':
    default:
      centroids = extractKMeansCentroids(samples, clampedK);
      break;
  }

  // Sort Centroids by Lightness L ascending (Layer 0 = bottom base, Layer N = top sheet)
  centroids.sort((a, b) => a.L - b.L);

  // Convert to Swatches with dual-state computedHex & active hex
  return centroids.map((c, index) => {
    const hex = oklabToHex(c.L, c.a, c.b);
    const oklch = oklabToOklch(c.L, c.a, c.b);
    const name = COLOR_NAMES[index % COLOR_NAMES.length] || `Color ${index + 1}`;

    return {
      id: `swatch-${index + 1}`,
      name,
      hex,
      computedHex: hex,
      oklab: [c.L, c.a, c.b],
      oklch: [oklch.L, oklch.C, oklch.h],
    };
  });
}

/**
 * 1. Standard Perceptual K-Means++ in OKLab space
 */
function extractKMeansCentroids(
  samples: SamplePoint[],
  k: number
): Array<{ L: number; a: number; b: number }> {
  const numSamples = samples.length;
  const centroids: SamplePoint[] = [];

  // Deterministic seed: choose median sample
  const firstIdx = Math.floor(numSamples / 2);
  centroids.push({ ...samples[firstIdx] });

  const distances = new Float64Array(numSamples).fill(Infinity);

  for (let c = 1; c < k; c++) {
    let sumDistSq = 0;
    const prevCentroid = centroids[c - 1];

    for (let i = 0; i < numSamples; i++) {
      const s = samples[i];
      const dL = s.L - prevCentroid.L;
      const da = s.a - prevCentroid.a;
      const db = s.b - prevCentroid.b;
      const distSq = dL * dL + da * da + db * db;

      if (distSq < distances[i]) {
        distances[i] = distSq;
      }
      sumDistSq += distances[i];
    }

    if (sumDistSq === 0) {
      centroids.push({ ...samples[(firstIdx + c * 37) % numSamples] });
      continue;
    }

    let target = ((c * 0.381966) % 1.0) * sumDistSq;
    let selectedIdx = 0;
    for (let i = 0; i < numSamples; i++) {
      target -= distances[i];
      if (target <= 0) {
        selectedIdx = i;
        break;
      }
    }
    centroids.push({ ...samples[selectedIdx] });
  }

  return runLloydIterations(samples, centroids, k);
}

/**
 * 2. Accent / High-Chroma Saliency-Biased Clustering
 * Scales seed selection probability by Chroma, capturing small vivid accent details
 */
function extractSaliencyCentroids(
  samples: SamplePoint[],
  k: number,
  accentSensitivity: number
): Array<{ L: number; a: number; b: number }> {
  const numSamples = samples.length;
  let maxChroma = 0.001;
  for (let i = 0; i < numSamples; i++) {
    if (samples[i].C > maxChroma) maxChroma = samples[i].C;
  }

  const saliencyWeights = new Float64Array(numSamples);
  const sensitivityMultiplier = 1.0 + accentSensitivity * 8.0;

  for (let i = 0; i < numSamples; i++) {
    const chromaRatio = samples[i].C / maxChroma;
    saliencyWeights[i] = Math.pow(1.0 + chromaRatio * sensitivityMultiplier, 1.5);
  }

  const centroids: SamplePoint[] = [];
  // First centroid: highest saliency sample
  let bestInitialIdx = 0;
  let maxWeight = 0;
  for (let i = 0; i < numSamples; i++) {
    if (saliencyWeights[i] > maxWeight) {
      maxWeight = saliencyWeights[i];
      bestInitialIdx = i;
    }
  }
  centroids.push({ ...samples[bestInitialIdx] });

  const distances = new Float64Array(numSamples).fill(Infinity);

  for (let c = 1; c < k; c++) {
    let sumWeightedDist = 0;
    const prevCentroid = centroids[c - 1];

    for (let i = 0; i < numSamples; i++) {
      const s = samples[i];
      const dL = s.L - prevCentroid.L;
      const da = s.a - prevCentroid.a;
      const db = s.b - prevCentroid.b;
      const distSq = dL * dL + da * da + db * db;

      if (distSq < distances[i]) {
        distances[i] = distSq;
      }
      sumWeightedDist += distances[i] * saliencyWeights[i];
    }

    if (sumWeightedDist === 0) {
      centroids.push({ ...samples[(bestInitialIdx + c * 31) % numSamples] });
      continue;
    }

    let target = ((c * 0.414213) % 1.0) * sumWeightedDist;
    let selectedIdx = 0;
    for (let i = 0; i < numSamples; i++) {
      target -= distances[i] * saliencyWeights[i];
      if (target <= 0) {
        selectedIdx = i;
        break;
      }
    }
    centroids.push({ ...samples[selectedIdx] });
  }

  return runLloydIterations(samples, centroids, k);
}

/**
 * 3. Equalized Luma Stacking
 * Divides the image lightness spectrum into K equalized perceptual strata
 */
function extractLumaRampCentroids(
  samples: SamplePoint[],
  k: number,
  gamma: number = 1.0
): Array<{ L: number; a: number; b: number }> {
  // Sort samples by Lightness L ascending
  const sorted = [...samples].sort((a, b) => a.L - b.L);
  const numSamples = sorted.length;
  const centroids: Array<{ L: number; a: number; b: number }> = [];

  for (let c = 0; c < k; c++) {
    const normStart = Math.pow(c / k, gamma);
    const normEnd = Math.pow((c + 1) / k, gamma);

    const startIdx = Math.min(numSamples - 1, Math.floor(normStart * numSamples));
    const endIdx = Math.min(numSamples, Math.max(startIdx + 1, Math.floor(normEnd * numSamples)));

    let sumL = 0;
    let sumA = 0;
    let sumB = 0;
    let count = 0;

    for (let i = startIdx; i < endIdx; i++) {
      sumL += sorted[i].L;
      sumA += sorted[i].a;
      sumB += sorted[i].b;
      count++;
    }

    if (count > 0) {
      centroids.push({
        L: sumL / count,
        a: sumA / count,
        b: sumB / count,
      });
    } else {
      centroids.push({ ...sorted[startIdx] });
    }
  }

  return centroids;
}

/**
 * 4. Graphic Median Cut (Color Box Volume Partitioning in OKLab space)
 */
interface ColorBox {
  points: SamplePoint[];
}

function extractMedianCutCentroids(
  samples: SamplePoint[],
  k: number
): Array<{ L: number; a: number; b: number }> {
  const boxes: ColorBox[] = [{ points: [...samples] }];

  while (boxes.length < k) {
    // Find box with largest perceptual spread
    let bestBoxIdx = -1;
    let maxSpread = -1;
    let bestAxis: 'L' | 'a' | 'b' = 'L';

    for (let b = 0; b < boxes.length; b++) {
      const box = boxes[b];
      if (box.points.length < 2) continue;

      let minL = Infinity, maxL = -Infinity;
      let minA = Infinity, maxA = -Infinity;
      let minB = Infinity, maxB = -Infinity;

      for (let i = 0; i < box.points.length; i++) {
        const p = box.points[i];
        if (p.L < minL) minL = p.L;
        if (p.L > maxL) maxL = p.L;
        if (p.a < minA) minA = p.a;
        if (p.a > maxA) maxA = p.a;
        if (p.b < minB) minB = p.b;
        if (p.b > maxB) maxB = p.b;
      }

      const spreadL = maxL - minL;
      const spreadA = (maxA - minA) * 1.2;
      const spreadB = (maxB - minB) * 1.2;
      const currentMax = Math.max(spreadL, spreadA, spreadB);

      if (currentMax > maxSpread) {
        maxSpread = currentMax;
        bestBoxIdx = b;
        bestAxis = spreadA >= spreadL && spreadA >= spreadB ? 'a' : spreadB >= spreadL ? 'b' : 'L';
      }
    }

    if (bestBoxIdx === -1 || maxSpread <= 0) break;

    const targetBox = boxes.splice(bestBoxIdx, 1)[0];
    targetBox.points.sort((p1, p2) => p1[bestAxis] - p2[bestAxis]);

    const mid = Math.floor(targetBox.points.length / 2);
    boxes.push({ points: targetBox.points.slice(0, mid) });
    boxes.push({ points: targetBox.points.slice(mid) });
  }

  // Compute centroid of each box
  return boxes.map(box => {
    let sumL = 0, sumA = 0, sumB = 0;
    for (let i = 0; i < box.points.length; i++) {
      sumL += box.points[i].L;
      sumA += box.points[i].a;
      sumB += box.points[i].b;
    }
    const count = Math.max(1, box.points.length);
    return {
      L: sumL / count,
      a: sumA / count,
      b: sumB / count,
    };
  });
}

/**
 * Standard Lloyd's iteration refinement
 */
function runLloydIterations(
  samples: SamplePoint[],
  initialCentroids: SamplePoint[],
  k: number
): Array<{ L: number; a: number; b: number }> {
  const centroids = initialCentroids.map(c => ({ L: c.L, a: c.a, b: c.b }));
  const numSamples = samples.length;
  const maxIterations = 20;
  const tolerance = 0.0004;
  const assignments = new Int32Array(numSamples);

  for (let iter = 0; iter < maxIterations; iter++) {
    for (let i = 0; i < numSamples; i++) {
      const s = samples[i];
      let bestCluster = 0;
      let minD = Infinity;

      for (let c = 0; c < k; c++) {
        const cent = centroids[c];
        const dL = s.L - cent.L;
        const da = s.a - cent.a;
        const db = s.b - cent.b;
        const distSq = dL * dL + da * da + db * db;

        if (distSq < minD) {
          minD = distSq;
          bestCluster = c;
        }
      }
      assignments[i] = bestCluster;
    }

    const sumL = new Float64Array(k);
    const sumA = new Float64Array(k);
    const sumB = new Float64Array(k);
    const counts = new Int32Array(k);

    for (let i = 0; i < numSamples; i++) {
      const cluster = assignments[i];
      const s = samples[i];
      sumL[cluster] += s.L;
      sumA[cluster] += s.a;
      sumB[cluster] += s.b;
      counts[cluster]++;
    }

    let maxShift = 0;
    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) continue;
      const newL = sumL[c] / counts[c];
      const newA = sumA[c] / counts[c];
      const newB = sumB[c] / counts[c];

      const shift = Math.sqrt(
        Math.pow(newL - centroids[c].L, 2) +
        Math.pow(newA - centroids[c].a, 2) +
        Math.pow(newB - centroids[c].b, 2)
      );
      if (shift > maxShift) maxShift = shift;

      centroids[c].L = newL;
      centroids[c].a = newA;
      centroids[c].b = newB;
    }

    if (maxShift < tolerance) break;
  }

  return centroids;
}

function createFallbackPalette(k: number): ChromaSwatch[] {
  const swatches: ChromaSwatch[] = [];
  for (let i = 0; i < k; i++) {
    const L = 0.15 + (0.75 * i) / (k - 1 || 1);
    const hex = oklabToHex(L, 0, 0);
    const oklch = oklabToOklch(L, 0, 0);
    swatches.push({
      id: `swatch-${i + 1}`,
      name: COLOR_NAMES[i % COLOR_NAMES.length] || `Tone ${i + 1}`,
      hex,
      computedHex: hex,
      oklab: [L, 0, 0],
      oklch: [oklch.L, oklch.C, oklch.h],
    });
  }
  return swatches;
}
