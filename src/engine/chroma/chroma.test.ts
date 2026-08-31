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
    // Expect one red-ish cluster and one blue-ish cluster
    const hexes = palette.map(p => p.hex.toLowerCase());
    const hasRed = hexes.some(h => h.startsWith('#f') || h.startsWith('#e'));
    const hasBlue = hexes.some(h => h.endsWith('f') || h.endsWith('e') || h.endsWith('d'));
    expect(hasRed).toBe(true);
    expect(hasBlue).toBe(true);
  });
});

describe('Chroma Classification & Underlap Dilation', () => {
  it('should segment pixels into binary masks matching extracted palette', () => {
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < 50; i++) {
      data[i * 4] = 255;
      data[i * 4 + 1] = 0;
      data[i * 4 + 2] = 0;
      data[i * 4 + 3] = 255;
    }
    for (let i = 50; i < 100; i++) {
      data[i * 4] = 0;
      data[i * 4 + 1] = 255;
      data[i * 4 + 2] = 0;
      data[i * 4 + 3] = 255;
    }

    const imgData = makeImageData(data, width, height);
    const palette: ChromaSwatch[] = [
      { id: '1', name: 'Red', hex: '#ff0000', computedHex: '#ff0000', oklab: [0.628, 0.225, 0.126], oklch: [0.628, 0.257, 29.2] },
      { id: '2', name: 'Green', hex: '#00ff00', computedHex: '#00ff00', oklab: [0.866, -0.234, 0.179], oklch: [0.866, 0.295, 142.5] },
    ];

    const settings: ChromaProcessingSettings = {
      assemblyMode: 'stacked_relief',
      colorCount: 2,
      colorBias: 0.5,
      hueWeight: 1.0,
      lightnessWeight: 1.0,
      chromaWeight: 1.0,
      chromaFloor: 0.02,
      minimumFeatureSize: 0,
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
    const mask2 = new Uint8Array(100);

    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const idx = y * 10 + x;
        if (x < 2) mask0[idx] = 1;
        else if (x < 5) mask1[idx] = 1;
        else if (x < 8) mask2[idx] = 1;
      }
    }

    const rawMasks: BinaryMask[] = [
      { width, height, data: mask0 },
      { width, height, data: mask1 },
      { width, height, data: mask2 },
    ];

    const layers: ChromaLayerState[] = [
      {
        id: 'layer-0',
        order: 0, // bottom
        swatch: { id: 's0', name: 'Base', hex: '#000000', oklab: [0, 0, 0], oklch: [0, 0, 0] },
        underlapBleedMm: 1.0,
        isSolidBacking: true,
      },
      {
        id: 'layer-1',
        order: 1, // middle
        swatch: { id: 's1', name: 'Mid', hex: '#888888', oklab: [0.5, 0, 0], oklch: [0.5, 0, 0] },
        underlapBleedMm: 1.0,
      },
      {
        id: 'layer-2',
        order: 2, // top
        swatch: { id: 's2', name: 'Top', hex: '#ffffff', oklab: [1, 0, 0], oklch: [1, 0, 0] },
        underlapBleedMm: 1.0,
      },
    ];

    const { finalMasks } = generatePhysicalLayerMasks(rawMasks, layers, 'stacked_relief', 1.0, 1.0);

    // Layer 1 should have dilated into column 5 (underneath Layer 2)
    expect(finalMasks[1].data[0 * 10 + 5]).toBe(1);
    // But Layer 1 should NOT leak into column 9 (which is empty void)
    expect(finalMasks[1].data[0 * 10 + 9]).toBe(0);
    // Top layer (Layer 2) should remain unchanged at its boundary
    expect(finalMasks[2].data[0 * 10 + 5]).toBe(1);
    expect(finalMasks[2].data[0 * 10 + 4]).toBe(0);
  });

  it('should union margin positive space (alpha < 128) seamlessly into stacked relief cut sheets', () => {
    // 4x4 canvas: center 2x2 is active image (alpha=255), outer perimeter is margin (alpha=0)
    const width = 4;
    const height = 4;
    const alpha = new Uint8Array(16);
    const mask0 = new Uint8Array(16);
    const mask1 = new Uint8Array(16);

    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const idx = y * 4 + x;
        if (x >= 1 && x <= 2 && y >= 1 && y <= 2) {
          alpha[idx] = 255;
          // (1,1) belongs to Layer 0, (2,1) belongs to Layer 1
          if (x === 1 && y === 1) mask0[idx] = 1;
          else if (x === 2 && y === 1) mask1[idx] = 1;
        } else {
          alpha[idx] = 0; // Margin / extra-canvas space
        }
      }
    }

    const rawMasks: BinaryMask[] = [
      { width, height, data: mask0 },
      { width, height, data: mask1 },
    ];

    const layers: ChromaLayerState[] = [
      {
        id: 'layer-0',
        order: 0,
        swatch: { id: 's0', name: 'Base', hex: '#000000', oklab: [0, 0, 0], oklch: [0, 0, 0] },
        underlapBleedMm: 0,
        isSolidBacking: true, // Solid base
      },
      {
        id: 'layer-1',
        order: 1,
        swatch: { id: 's1', name: 'Red', hex: '#ff0000', oklab: [0.6, 0.2, 0.1], oklch: [0.6, 0.2, 30] },
        underlapBleedMm: 0,
      },
    ];

    const { finalMasks } = generatePhysicalLayerMasks(rawMasks, layers, 'stacked_relief', 1.0, 0, alpha);

    // Layer 0 is Solid Backing -> 100% solid paper across all 16 pixels
    for (let i = 0; i < 16; i++) {
      expect(finalMasks[0].data[i]).toBe(1);
    }

    // Layer 1 (Cut Layer):
    // 1. Margin pixels (alpha < 128) MUST be solid paper (1)
    expect(finalMasks[1].data[0]).toBe(1); // (0,0) margin -> solid
    expect(finalMasks[1].data[1]).toBe(1); // (1,0) margin -> solid
    expect(finalMasks[1].data[3]).toBe(1); // (3,0) margin -> solid
    expect(finalMasks[1].data[1 * 4 + 3]).toBe(1); // (3,1) margin -> solid

    // 2. Inside image: (1,1) is Layer 0 -> Layer 1 has a cutout hole (0)
    expect(finalMasks[1].data[1 * 4 + 1]).toBe(0);

    // 3. Inside image: (2,1) belongs to Layer 1 -> solid (1)
    expect(finalMasks[1].data[1 * 4 + 2]).toBe(1);

    // 4. (2,1) is solid (1) and adjacent to margin (3,1) which is solid (1) -> continuous piece of cardstock!
    expect(finalMasks[1].data[1 * 4 + 2]).toBe(1);
    expect(finalMasks[1].data[1 * 4 + 3]).toBe(1);
  });

  it('should support 100% void base layer mode in stacked relief', () => {
    const width = 4;
    const height = 4;
    const rawMasks: BinaryMask[] = [
      { width, height, data: new Uint8Array(16) },
      { width, height, data: new Uint8Array(16) },
    ];

    const layers: ChromaLayerState[] = [
      {
        id: 'layer-0',
        order: 0,
        swatch: { id: 's0', name: 'Base', hex: '#000000', oklab: [0, 0, 0], oklch: [0, 0, 0] },
        underlapBleedMm: 0,
        isSolidBacking: false, // Void base!
      },
      {
        id: 'layer-1',
        order: 1,
        swatch: { id: 's1', name: 'Red', hex: '#ff0000', oklab: [0.6, 0.2, 0.1], oklch: [0.6, 0.2, 30] },
        underlapBleedMm: 0,
      },
    ];

    const { finalMasks } = generatePhysicalLayerMasks(rawMasks, layers, 'stacked_relief', 1.0, 0);
    // Void base must be completely empty (all 0s)
    for (let i = 0; i < 16; i++) {
      expect(finalMasks[0].data[i]).toBe(0);
    }
  });

  describe('Multi-Algorithm Clustering Engines', () => {
    it('should extract Luma Ramp palette with strictly monotonic lightness', () => {
      const width = 20;
      const height = 20;
      const data = new Uint8ClampedArray(width * height * 4);

      // Gradient from black to white
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const val = Math.round((x / (width - 1)) * 255);
          data[idx] = val;
          data[idx + 1] = val;
          data[idx + 2] = val;
          data[idx + 3] = 255;
        }
      }

      const imgData = makeImageData(data, width, height);
      const palette = extractDominantPalette(imgData, 4, { algorithm: 'luma_ramp', lumaRampGamma: 1.0 });

      expect(palette.length).toBe(4);
      // Verify strict L ordering
      for (let i = 1; i < palette.length; i++) {
        expect(palette[i].oklab[0]).toBeGreaterThanOrEqual(palette[i - 1].oklab[0]);
      }
    });

    it('should extract Median Cut palette with K clusters and computedHex', () => {
      const width = 10;
      const height = 10;
      const data = new Uint8ClampedArray(width * height * 4);

      for (let i = 0; i < 100; i++) {
        data[i * 4] = (i * 2) % 256;
        data[i * 4 + 1] = (i * 5) % 256;
        data[i * 4 + 2] = (i * 9) % 256;
        data[i * 4 + 3] = 255;
      }

      const imgData = makeImageData(data, width, height);
      const palette = extractDominantPalette(imgData, 3, { algorithm: 'median_cut' });

      expect(palette.length).toBe(3);
      palette.forEach(swatch => {
        expect(swatch.computedHex).toBeDefined();
        expect(swatch.hex).toBe(swatch.computedHex);
        expect(swatch.hex.startsWith('#')).toBe(true);
      });
    });

    it('should extract Saliency palette prioritizing high-chroma accent seeds', () => {
      const width = 20;
      const height = 20;
      const data = new Uint8ClampedArray(width * height * 4);

      // Fill 95% of image with neutral gray, 5% with vivid red
      for (let i = 0; i < 400; i++) {
        if (i < 20) {
          // Vivid Red
          data[i * 4] = 255;
          data[i * 4 + 1] = 0;
          data[i * 4 + 2] = 0;
        } else {
          // Neutral Slate
          data[i * 4] = 100;
          data[i * 4 + 1] = 100;
          data[i * 4 + 2] = 100;
        }
        data[i * 4 + 3] = 255;
      }

      const imgData = makeImageData(data, width, height);
      const palette = extractDominantPalette(imgData, 2, { algorithm: 'saliency', accentSensitivity: 1.0 });

      expect(palette.length).toBe(2);
      const hexes = palette.map(p => p.hex.toLowerCase());
      const hasVividRed = hexes.some(h => h.startsWith('#f') || h.startsWith('#e'));
      expect(hasVividRed).toBe(true);
    });
  });
});
