import { ChromaSwatch } from '../types';
import { rgbToOklab, oklabToRgb, oklabToOklch, oklabToHex, OKLab } from './oklab';

interface SamplePoint {
  L: number;
  a: number;
  b: number;
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

/**
 * Extracts dominant color palette from ImageData using OKLab K-Means++ clustering
 */
export function extractDominantPalette(
  imageData: ImageData,
  k: number = 5,
  maxSampleDim: number = 200
): ChromaSwatch[] {
  const clampedK = Math.max(2, Math.min(12, Math.round(k)));
  const { width, height, data } = imageData;

  // 1. Fast Sampling Buffer
  const totalPixels = width * height;
  const targetSamples = 5000;
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
      samples.push({ L: lab.L, a: lab.a, b: lab.b });
      if (samples.length >= 8000) break;
    }
    if (samples.length >= 8000) break;
  }

  if (samples.length === 0) {
    // Fallback if image is completely empty
    return createFallbackPalette(clampedK);
  }

  // 2. K-Means++ Centroid Initialization
  const centroids: SamplePoint[] = [];
  const numSamples = samples.length;

  // First centroid: choose random sample
  const firstIdx = Math.floor(Math.random() * numSamples);
  centroids.push({ ...samples[firstIdx] });

  const distances = new Float64Array(numSamples).fill(Infinity);

  for (let c = 1; c < clampedK; c++) {
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
      // Pick random remaining
      centroids.push({ ...samples[Math.floor(Math.random() * numSamples)] });
      continue;
    }

    // Roulette-wheel selection
    let target = Math.random() * sumDistSq;
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

  // 3. Lloyd's Iteration Loop (Max 25 iterations)
  const maxIterations = 25;
  const tolerance = 0.0005;
  const assignments = new Int32Array(numSamples);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assignment Step
    for (let i = 0; i < numSamples; i++) {
      const s = samples[i];
      let bestCluster = 0;
      let minD = Infinity;

      for (let c = 0; c < clampedK; c++) {
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

    // Update Step
    const sumL = new Float64Array(clampedK);
    const sumA = new Float64Array(clampedK);
    const sumB = new Float64Array(clampedK);
    const counts = new Int32Array(clampedK);

    for (let i = 0; i < numSamples; i++) {
      const cluster = assignments[i];
      const s = samples[i];
      sumL[cluster] += s.L;
      sumA[cluster] += s.a;
      sumB[cluster] += s.b;
      counts[cluster]++;
    }

    let maxShift = 0;
    for (let c = 0; c < clampedK; c++) {
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

  // 4. Sort Centroids by Lightness L ascending (Layer 0 = darkest, Layer N = lightest)
  centroids.sort((a, b) => a.L - b.L);

  // 5. Convert to Swatches
  return centroids.map((c, index) => {
    const hex = oklabToHex(c.L, c.a, c.b);
    const oklch = oklabToOklch(c.L, c.a, c.b);
    const name = COLOR_NAMES[index % COLOR_NAMES.length] || `Color ${index + 1}`;

    return {
      id: `swatch-${index + 1}`,
      name,
      hex,
      oklab: [c.L, c.a, c.b],
      oklch: [oklch.L, oklch.C, oklch.h],
    };
  });
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
      oklab: [L, 0, 0],
      oklch: [oklch.L, oklch.C, oklch.h],
    });
  }
  return swatches;
}
