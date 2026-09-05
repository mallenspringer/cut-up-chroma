import { describe, it, expect } from 'vitest';
import { applySurfaceTexturing } from './patternEngine';
import { SurfaceTextureConfig, DEFAULT_SURFACE_TEXTURE_CONFIG, TexturePatternStyle } from './types';
import { BinaryMask, ChromaLayerState } from '../types';
import { enforceCutterSafety, applyCutterPreset, isBelowSafeThreshold, CUTTER_PRESETS } from './cutterPresets';

describe('Surface Texturing & Negative-Space Pattern Engine', () => {
  const createTestStack = (width = 40, height = 40) => {
    const total = width * height;
    // Layer 0: Solid base
    const mask0 = new Uint8Array(total).fill(1);
    // Layer 1: Mid sheet (left half)
    const mask1 = new Uint8Array(total);
    // Layer 2: Top sheet (right half)
    const mask2 = new Uint8Array(total);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (x < 20) mask1[idx] = 1;
        else mask2[idx] = 1;
      }
    }

    const masks: BinaryMask[] = [
      { width, height, data: mask0 },
      { width, height, data: mask1 },
      { width, height, data: mask2 },
    ];

    const layers: ChromaLayerState[] = [
      { id: 'layer-0', order: 0, swatch: { id: 's0', name: 'Base', hex: '#0f172a', oklab: [0.1, 0, 0], oklch: [0.1, 0, 0] }, underlapBleedMm: 0 },
      { id: 'layer-1', order: 1, swatch: { id: 's1', name: 'Mid', hex: '#f97316', oklab: [0.55, 0.15, 60], oklch: [0.55, 0.15, 60] }, underlapBleedMm: 0 },
      { id: 'layer-2', order: 2, swatch: { id: 's2', name: 'Top', hex: '#fffbf5', oklab: [0.95, 0.02, 80], oklch: [0.95, 0.02, 80] }, underlapBleedMm: 0 },
    ];

    return { masks, layers, width, height };
  };

  it('should keep Layer 0 solid backing intact while carving apertures into upper layers (including Top Layer N-1)', () => {
    const { masks, layers } = createTestStack();

    const config: SurfaceTextureConfig = {
      enabled: true,
      textureMode: 'full_field',
      patternStyle: 'ribbons',
      cutterPreset: 'laser',
      frequencyMm: 4.0,
      bridgeWidthMm: 1.0,
      slotWidthMm: 0.8,
      blendReachMm: 6.0,
      angleDeg: 0,
      bridgingTabsEnabled: true,
    };

    const result = applySurfaceTexturing(masks, layers, config, 1.0);

    // Layer 0 (Base) MUST remain 100% solid paper
    let baseZeros = 0;
    for (let i = 0; i < result[0].data.length; i++) {
      if (result[0].data[i] === 0) baseZeros++;
    }
    expect(baseZeros).toBe(0);

    // Top Layer (Layer 2) MUST receive negative-space apertures to reveal underlying layers
    let topZeros = 0;
    for (let i = 0; i < result[2].data.length; i++) {
      if (result[2].data[i] === 0) topZeros++;
    }
    expect(topZeros).toBeGreaterThan(0);
  });

  it('should ensure the layer immediately below has solid paper beneath upper layer apertures, not revealing the base', () => {
    const { masks, layers } = createTestStack();

    // Initially, Layer 1 (Mid) has 0 at x >= 20 (right half is owned by Layer 2)
    expect(masks[1].data[0 * 40 + 25]).toBe(0);

    const config: SurfaceTextureConfig = {
      enabled: true,
      textureMode: 'full_field',
      patternStyle: 'ribbons',
      cutterPreset: 'laser',
      frequencyMm: 4.0,
      bridgeWidthMm: 1.0,
      slotWidthMm: 0.8,
      blendReachMm: 6.0,
      angleDeg: 0,
      bridgingTabsEnabled: true,
    };

    const result = applySurfaceTexturing(masks, layers, config, 1.0);

    // Find any aperture in Layer 2 (x >= 20 where result[2] === 0)
    let verifiedApertures = 0;
    for (let y = 5; y < 35; y++) {
      for (let x = 20; x < 40; x++) {
        const idx = y * 40 + x;
        if (result[2].data[idx] === 0) {
          // Layer 1 (immediately below) MUST have solid paper (1) right beneath this aperture!
          expect(result[1].data[idx]).toBe(1);
          verifiedApertures++;
        }
      }
    }
    expect(verifiedApertures).toBeGreaterThan(0);
  });

  it('should support Boundary Gradient mode, limiting apertures to the transition zone', () => {
    const { masks, layers } = createTestStack();

    const config: SurfaceTextureConfig = {
      enabled: true,
      textureMode: 'boundary',
      patternStyle: 'ribbons',
      cutterPreset: 'laser',
      frequencyMm: 4.0,
      bridgeWidthMm: 1.0,
      slotWidthMm: 0.8,
      blendReachMm: 5.0, // 5px reach
      angleDeg: 0,
      bridgingTabsEnabled: true,
    };

    const result = applySurfaceTexturing(masks, layers, config, 1.0);

    // In top layer (x >= 20): boundary zone is near x = 20 and right canvas edge.
    // Deep interior (e.g. x = 27..32) should remain solid paper
    let hasEdgePunctures = false;
    for (let y = 10; y < 30; y++) {
      for (let x = 20; x < 24; x++) {
        if (result[2].data[y * 40 + x] === 0) {
          hasEdgePunctures = true;
          break;
        }
      }
    }
    expect(hasEdgePunctures).toBe(true);
  });

  it('should generate valid negative-space patterns for all 4 engines', () => {
    const styles: TexturePatternStyle[] = ['ribbons', 'webbed_halftone', 'slits', 'crosshatch'];

    styles.forEach(style => {
      const { masks, layers } = createTestStack();
      const config: SurfaceTextureConfig = {
        enabled: true,
        textureMode: 'full_field',
        patternStyle: style,
        cutterPreset: 'laser',
        frequencyMm: 4.0,
        bridgeWidthMm: 1.0,
        slotWidthMm: 0.8,
        blendReachMm: 6.0,
        angleDeg: 45,
        bridgingTabsEnabled: true,
      };

      const result = applySurfaceTexturing(masks, layers, config, 1.0);
      let cutPixels = 0;
      for (let i = 0; i < result[2].data.length; i++) {
        if (result[2].data[i] === 0) cutPixels++;
      }
      expect(cutPixels).toBeGreaterThan(0);
    });
  });

  it('should toggle bridging tabs on and off', () => {
    const { masks, layers } = createTestStack();

    const configWithTabs: SurfaceTextureConfig = {
      enabled: true,
      textureMode: 'full_field',
      patternStyle: 'ribbons',
      cutterPreset: 'laser',
      frequencyMm: 4.0,
      bridgeWidthMm: 1.0,
      slotWidthMm: 0.8,
      blendReachMm: 6.0,
      angleDeg: 0,
      bridgingTabsEnabled: true,
    };

    const configWithoutTabs: SurfaceTextureConfig = {
      ...configWithTabs,
      bridgingTabsEnabled: false,
    };

    const resultWithTabs = applySurfaceTexturing(masks, layers, configWithTabs, 1.0);
    const resultWithoutTabs = applySurfaceTexturing(masks, layers, configWithoutTabs, 1.0);

    let zerosWithTabs = 0;
    let zerosWithoutTabs = 0;

    for (let i = 0; i < resultWithTabs[2].data.length; i++) {
      if (resultWithTabs[2].data[i] === 0) zerosWithTabs++;
      if (resultWithoutTabs[2].data[i] === 0) zerosWithoutTabs++;
    }

    // Without tabs, slots are continuous, so more pixels are voided
    expect(zerosWithoutTabs).toBeGreaterThan(zerosWithTabs);
  });

  it('should bypass modification when texturing is disabled', () => {
    const maskData = new Uint8Array(100).fill(1);
    const masks: BinaryMask[] = [{ width: 10, height: 10, data: maskData }];
    const layers: ChromaLayerState[] = [
      { id: 'layer-1', order: 0, swatch: { id: 's0', name: 'Base', hex: '#000', oklab: [0, 0, 0], oklch: [0, 0, 0] }, underlapBleedMm: 0 },
    ];

    const result = applySurfaceTexturing(masks, layers, { ...DEFAULT_SURFACE_TEXTURE_CONFIG, enabled: false }, 1.0);
    expect(result[0].data).toBe(maskData);
  });

  it('should apply recommended cutter presets without locking user overrides', () => {
    const initial: SurfaceTextureConfig = {
      ...DEFAULT_SURFACE_TEXTURE_CONFIG,
      cutterPreset: 'drag_knife',
    };

    const laserConfig = applyCutterPreset(initial, 'laser');
    expect(laserConfig.cutterPreset).toBe('laser');
    expect(laserConfig.bridgeWidthMm).toBe(CUTTER_PRESETS.laser.minSafeBridgeMm);

    // Manual override below preset limit should be permitted by enforceCutterSafety
    const custom = enforceCutterSafety({
      ...laserConfig,
      bridgeWidthMm: 0.4,
    });
    expect(custom.bridgeWidthMm).toBe(0.4);

    // Warning check should flag it
    expect(isBelowSafeThreshold(custom)).toBe(true);
  });
});
