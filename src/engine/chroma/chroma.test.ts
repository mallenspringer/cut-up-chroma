import { describe, it, expect } from 'vitest';
import {
  rgbToOklab,
  oklabToRgb,
  oklabToOklch,
  oklchToOklab,
  hexToOklab,
  oklabToHex,
  calculateWeightedDeltaE,
} from './oklab';
import { extractDominantPalette } from './kmeans';
import { classifyImagePixels } from './classifier';
import { generatePhysicalLayerMasks, dilateBinaryMask } from './underlap';
import { BinaryMask, ChromaLayerState, ChromaProcessingSettings } from '../types';

// Polyfill minimal ImageData for Node test runner if needed
function makeImageData(data: Uint8ClampedArray, width: number, height: number): ImageData {
  if (typeof ImageData !== 'undefined') {
    return new (ImageData as any)(data, width, height);
  }
  return {
    data,
    width,
    height,
    colorSpace: 'srgb',
  } as unknown as ImageData;
}

describe('OKLab & OKLCH Color Space Transforms', () => {
  it('should roundtrip sRGB -> OKLab -> sRGB accurately for pure colors', () => {
    const testColors = [
      { r: 255, g: 255, b: 255 }, // White
      { r: 0, g: 0, b: 0 },       // Black
      { r: 255, g: 0, b: 0 },     // Red
      { r: 0, g: 255, b: 0 },     // Green
      { r: 0, g: 0, b: 255 },     // Blue
      { r: 128, g: 128, b: 128 }, // Mid Gray
      { r: 245, g: 240, b: 219 }, // Sand
      { r: 27, g: 40, b: 31 },    // Moss
    ];

    for (const c of testColors) {
      const lab = rgbToOklab(c.r, c.g, c.b);
      const rgb = oklabToRgb(lab.L, lab.a, lab.b);
      expect(Math.abs(rgb.r - c.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(rgb.g - c.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(rgb.b - c.b)).toBeLessThanOrEqual(1);
    }
  });

  it('should roundtrip OKLab -> OKLCH -> OKLab correctly', () => {
    const lab = rgbToOklab(180, 100, 50);
    const lch = oklabToOklch(lab.L, lab.a, lab.b);
    const backLab = oklchToOklab(lch.L, lch.C, lch.h);

    expect(Math.abs(backLab.L - lab.L)).toBeLessThan(0.0001);
    expect(Math.abs(backLab.a - lab.a)).toBeLessThan(0.0001);
    expect(Math.abs(backLab.b - lab.b)).toBeLessThan(0.0001);
  });

  it('should calculate weighted Delta-E correctly', () => {
    // Exact same color -> distance 0
    const d0 = calculateWeightedDeltaE(0.5, 0.1, 45, 0.5, 0.1, 45);
    expect(d0).toBe(0);

    // Difference in lightness
    const dL = calculateWeightedDeltaE(0.8, 0.1, 45, 0.2, 0.1, 45, 1.0, 1.0, 1.0);
    expect(dL).toBeCloseTo(0.6, 2);

    // Hue weighting sensitivity
    const dH1 = calculateWeightedDeltaE(0.5, 0.1, 0, 0.5, 0.1, 180, 1.0, 1.0, 1.0);
    const dH2 = calculateWeightedDeltaE(0.5, 0.1, 0, 0.5, 0.1, 180, 1.0, 2.0, 1.0);
    expect(dH2).toBeGreaterThan(dH1);
  });
});

describe('K-Means Palette Extraction', () => {
  it('should extract K clusters from a synthetic multi-color image', () => {
    const width = 20;
    const height = 20;
    const data = new Uint8ClampedArray(width * height * 4);

    // Left half: Red (#ff0000), Right half: Blue (#0000ff)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (x < 10) {
          data[idx] = 255;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
        } else {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 255;
        }
        data[idx + 3] = 255;
      }
    }

    const imgData = makeImageData(data, width, height);
    const palette = extractDominantPalette(imgData, 2);

    expect(palette.length).toBe(2);
    // Swatches should be ordered by lightness L ascending
    expect(palette[0].oklab[0]).toBeLessThanOrEqual(palette[1].oklab[0]);
  });
});

describe('Pixel Classification & Underlap Dilation', () => {
  it('should classify pixels to the closest swatch and produce masks', () => {
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4);

    // Top half: Black, Bottom half: White
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      const isBottom = i >= 50;
      data[idx] = isBottom ? 255 : 0;
      data[idx + 1] = isBottom ? 255 : 0;
      data[idx + 2] = isBottom ? 255 : 0;
      data[idx + 3] = 255;
    }

    const imgData = makeImageData(data, width, height);
    const palette = [
      {
        id: 'swatch-1',
        name: 'Black',
        hex: '#000000',
        oklab: [0, 0, 0] as [number, number, number],
        oklch: [0, 0, 0] as [number, number, number],
      },
      {
        id: 'swatch-2',
        name: 'White',
        hex: '#ffffff',
        oklab: [1, 0, 0] as [number, number, number],
        oklch: [1, 0, 0] as [number, number, number],
      },
    ];

    const settings: ChromaProcessingSettings = {
      assemblyMode: 'stacked_relief',
      colorCount: 2,
      hueWeight: 1.0,
      lightnessWeight: 1.0,
      chromaFloor: 0.02,
      minimumFeatureSize: 1.0,
      smoothing: 0,
      underlapBleedMm: 0.5,
      inlayToleranceMm: 0.1,
    };

    const res = classifyImagePixels(imgData, palette, settings);
    expect(res.layerMasks.length).toBe(2);
    expect(res.pixelCounts[0]).toBe(50);
    expect(res.pixelCounts[1]).toBe(50);
  });

  it('should dilate lower layer beneath upper layer in stacked relief without leaking into void', () => {
    const width = 10;
    const height = 10;
    const mask0 = new Uint8Array(100);
    const mask1 = new Uint8Array(100);

    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const idx = y * 10 + x;
        if (x < 4) mask0[idx] = 1;
        else if (x < 8) mask1[idx] = 1;
      }
    }

    const rawMasks: BinaryMask[] = [
      { width, height, data: mask0 },
      { width, height, data: mask1 },
    ];

    const layers: ChromaLayerState[] = [
      {
        id: 'layer-0',
        order: 0, // bottom
        swatch: { id: 's0', name: 'Base', hex: '#000000', oklab: [0, 0, 0], oklch: [0, 0, 0] },
        underlapBleedMm: 1.0,
        isSolidBacking: false,
      },
      {
        id: 'layer-1',
        order: 1, // top
        swatch: { id: 's1', name: 'Top', hex: '#ffffff', oklab: [1, 0, 0], oklch: [1, 0, 0] },
        underlapBleedMm: 1.0,
      },
    ];

    const { finalMasks } = generatePhysicalLayerMasks(rawMasks, layers, 'stacked_relief', 1.0, 1.0);

    // Layer 0 should have dilated into column 4 (underneath Layer 1)
    expect(finalMasks[0].data[0 * 10 + 4]).toBe(1);
    // But Layer 0 should NOT leak into column 9 (which is empty void)
    expect(finalMasks[0].data[0 * 10 + 9]).toBe(0);
    // Top layer (Layer 1) should remain unchanged
    expect(finalMasks[1].data[0 * 10 + 4]).toBe(1);
    expect(finalMasks[1].data[0 * 10 + 3]).toBe(0);
  });
});
