import { ChromaSwatch, BinaryMask, ChromaProcessingSettings } from '../types';
import { rgbToOklab, oklabToOklch, calculateWeightedDeltaE, oklabToRgb } from './oklab';

export interface ClassificationResult {
  layerMasks: BinaryMask[];
  quantizedImageData: ImageData;
  pixelCounts: number[];
  totalPixels: number;
}

export interface PrecomputedOklchBuffer {
  width: number;
  height: number;
  totalPixels: number;
  L: Float32Array;
  C: Float32Array;
  h: Float32Array;
  alpha: Uint8Array;
}

const DEG_TO_RAD = Math.PI / 180;

/**
 * Precomputes OKLCH cylindrical color channels once into flat Float32Arrays.
 * This turns subsequent slider classifications into simple array lookups (~10ms).
 */
export function precomputeOklchBuffer(sourceImageData: ImageData): PrecomputedOklchBuffer {
  const { width, height, data } = sourceImageData;
  const totalPixels = width * height;

  const L = new Float32Array(totalPixels);
  const C = new Float32Array(totalPixels);
  const h = new Float32Array(totalPixels);
  const alpha = new Uint8Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const a = data[idx + 3];
    alpha[i] = a;
    if (a < 128) continue;

    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    const lab = rgbToOklab(r, g, b);
    const lch = oklabToOklch(lab.L, lab.a, lab.b);

    L[i] = lch.L;
    C[i] = lch.C;
    h[i] = lch.h;
  }

  return {
    width,
    height,
    totalPixels,
    L,
    C,
    h,
    alpha,
  };
}

/**
 * Classifies image pixels into discrete color layer masks and quantized preview.
 * Accepts either precomputed Float32 buffer (blazing fast) or raw ImageData.
 */
export function classifyImagePixels(
  source: ImageData | PrecomputedOklchBuffer,
  palette: ChromaSwatch[],
  settings: ChromaProcessingSettings
): ClassificationResult {
  const isPrecomputed = 'L' in source;
  const width = source.width;
  const height = source.height;
  const totalPixels = width * height;
  const numLayers = palette.length;

  const {
    colorBias = 0.5,
    hueWeight = 1.0,
    lightnessWeight = 1.0,
    chromaWeight = 1.0,
    chromaFloor = 0.02,
  } = settings;

  // Derive effective weights from colorBias (0.0 = Graphic Hue, 0.5 = Balanced, 1.0 = Tonal Luma)
  const biasLumaFactor = colorBias <= 0.5 ? colorBias * 2.0 : 1.0 + (colorBias - 0.5) * 2.0;
  const biasHueFactor = colorBias <= 0.5 ? 2.0 - colorBias * 2.0 : (1.0 - colorBias) * 2.0;

  const effLightnessWeight = lightnessWeight * biasLumaFactor;
  const effBaseHueWeight = hueWeight * biasHueFactor;
  const effChromaWeight = chromaWeight;

  // Pre-extract palette OKLCH data for fast inner loop
  const paletteOklch = palette.map(p => ({
    L: p.oklch[0],
    C: p.oklch[1],
    h: p.oklch[2],
  }));

  const paletteRgb = palette.map(p => oklabToRgb(p.oklab[0], p.oklab[1], p.oklab[2]));

  // Allocate binary masks for each layer
  const masksData: Uint8Array[] = [];
  for (let k = 0; k < numLayers; k++) {
    masksData.push(new Uint8Array(totalPixels));
  }

  const pixelCounts = new Array(numLayers).fill(0);
  const quantizedData = new Uint8ClampedArray(totalPixels * 4);

  if (isPrecomputed) {
    const { L, C, h, alpha } = source as PrecomputedOklchBuffer;

    for (let i = 0; i < totalPixels; i++) {
      const a = alpha[i];
      const idx = i * 4;

      if (a < 128) {
        quantizedData[idx] = 0;
        quantizedData[idx + 1] = 0;
        quantizedData[idx + 2] = 0;
        quantizedData[idx + 3] = 0;
        continue;
      }

      const pL = L[i];
      const pC = C[i];
      const pH = h[i];

      const isNearGray = pC < chromaFloor;
      const effC = isNearGray ? 0 : pC;
      const effH = isNearGray ? 0 : pH;
      const effHueWeight = isNearGray ? 0.0 : effBaseHueWeight;

      let bestLayer = 0;
      let minDeltaESq = Infinity;

      for (let k = 0; k < numLayers; k++) {
        const p = paletteOklch[k];
        const dL = pL - p.L;
        const dC = effC - p.C;

        let dH_deg = Math.abs(effH - p.h);
        if (dH_deg > 180) dH_deg = 360 - dH_deg;

        const shortest_rad = dH_deg * DEG_TO_RAD;
        const deltaH_rad = 2 * Math.sin(shortest_rad * 0.5);
        const meanChroma = Math.sqrt(Math.max(0, effC * p.C));

        const deltaESq =
          effLightnessWeight * dL * dL +
          effChromaWeight * dC * dC +
          effHueWeight * deltaH_rad * deltaH_rad * meanChroma * meanChroma;

        if (deltaESq < minDeltaESq) {
          minDeltaESq = deltaESq;
          bestLayer = k;
        }
      }

      masksData[bestLayer][i] = 1;
      pixelCounts[bestLayer]++;

      const chosenRgb = paletteRgb[bestLayer];
      quantizedData[idx] = chosenRgb.r;
      quantizedData[idx + 1] = chosenRgb.g;
      quantizedData[idx + 2] = chosenRgb.b;
      quantizedData[idx + 3] = 255;
    }
  } else {
    const rawData = (source as ImageData).data;

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const a = rawData[idx + 3];

      if (a < 128) {
        quantizedData[idx] = 0;
        quantizedData[idx + 1] = 0;
        quantizedData[idx + 2] = 0;
        quantizedData[idx + 3] = 0;
        continue;
      }

      const r = rawData[idx];
      const g = rawData[idx + 1];
      const b = rawData[idx + 2];

      const lab = rgbToOklab(r, g, b);
      const lch = oklabToOklch(lab.L, lab.a, lab.b);

      const isNearGray = lch.C < chromaFloor;
      const effC = isNearGray ? 0 : lch.C;
      const effH = isNearGray ? 0 : lch.h;
      const effHueWeight = isNearGray ? 0.0 : effBaseHueWeight;

      let bestLayer = 0;
      let minDeltaE = Infinity;

      for (let k = 0; k < numLayers; k++) {
        const p = paletteOklch[k];
        const deltaE = calculateWeightedDeltaE(
          lch.L,
          effC,
          effH,
          p.L,
          p.C,
          p.h,
          effLightnessWeight,
          effHueWeight,
          effChromaWeight
        );

        if (deltaE < minDeltaE) {
          minDeltaE = deltaE;
          bestLayer = k;
        }
      }

      masksData[bestLayer][i] = 1;
      pixelCounts[bestLayer]++;

      const chosenRgb = paletteRgb[bestLayer];
      quantizedData[idx] = chosenRgb.r;
      quantizedData[idx + 1] = chosenRgb.g;
      quantizedData[idx + 2] = chosenRgb.b;
      quantizedData[idx + 3] = 255;
    }
  }

  const layerMasks: BinaryMask[] = masksData.map(d => ({
    width,
    height,
    data: d,
  }));

  const quantizedImageData =
    typeof ImageData !== 'undefined'
      ? new ImageData(quantizedData, width, height)
      : ({ data: quantizedData, width, height, colorSpace: 'srgb' } as unknown as ImageData);

  return {
    layerMasks,
    quantizedImageData,
    pixelCounts,
    totalPixels,
  };
}
