import { describe, it, expect } from 'vitest';
import { applySurfaceTexturing } from './patternEngine';
import { SurfaceTextureConfig, DEFAULT_SURFACE_TEXTURE_CONFIG } from './types';
import { BinaryMask, ChromaLayerState } from '../types';
import { enforceCutterSafety, CUTTER_PRESETS } from './cutterPresets';

describe('Surface Texturing & Gradient Engine', () => {
  it('should enforce cutter safety minimum bridge limits for Drag-Knife', () => {
    const unsafeConfig: SurfaceTextureConfig = {
      enabled: true,
      patternStyle: 'ribbons',
      cutterPreset: 'drag_knife',
      frequencyMm: 2.0,
      bridgeWidthMm: 0.4, // Too thin for Cricut
      blendReachMm: 5.0,
      angleDeg: 45,
    };

    const safe = enforceCutterSafety(unsafeConfig);
    expect(safe.bridgeWidthMm).toBeGreaterThanOrEqual(CUTTER_PRESETS.drag_knife.minSafeBridgeMm);
    expect(safe.frequencyMm).toBeGreaterThanOrEqual(safe.bridgeWidthMm * 1.5);
  });

  it('should generate variable ribbon negative space in boundary transition zones', () => {
    const width = 30;
    const height = 30;

    // Layer 0: base (all 1), Layer 1: left half (1), Layer 2: right half (1)
    const mask0 = new Uint8Array(900).fill(1);
    const mask1 = new Uint8Array(900);
    const mask2 = new Uint8Array(900);

    for (let y = 0; y < 30; y++) {
      for (let x = 0; x < 30; x++) {
        const idx = y * 30 + x;
        if (x < 15) mask1[idx] = 1;
        else mask2[idx] = 1;
      }
    }

    const rawMasks: BinaryMask[] = [
      { width, height, data: mask0 },
      { width, height, data: mask1 },
      { width, height, data: mask2 },
    ];

    const layers: ChromaLayerState[] = [
      { id: 'layer-1', order: 0, swatch: { id: 's0', name: 'Base', hex: '#000', oklab: [0, 0, 0], oklch: [0, 0, 0] }, underlapBleedMm: 0 },
      { id: 'layer-2', order: 1, swatch: { id: 's1', name: 'Mid', hex: '#888', oklab: [0.5, 0, 0], oklch: [0.5, 0, 0] }, underlapBleedMm: 0 },
      { id: 'layer-3', order: 2, swatch: { id: 's2', name: 'Top', hex: '#fff', oklab: [1, 0, 0], oklch: [1, 0, 0] }, underlapBleedMm: 0 },
    ];

    const config: SurfaceTextureConfig = {
      enabled: true,
      patternStyle: 'ribbons',
      cutterPreset: 'laser',
      frequencyMm: 4.0,
      bridgeWidthMm: 1.0,
      blendReachMm: 8.0,
      angleDeg: 0,
    };

    const textured = applySurfaceTexturing(rawMasks, layers, config, 1.0);
    expect(textured.length).toBe(3);

    // Layer 1 (Mid) should now have some ribbon perforations near boundary (x ~ 10-14)
    let hasPerforations = false;
    for (let y = 0; y < 30; y++) {
      for (let x = 8; x < 15; x++) {
        if (textured[1].data[y * 30 + x] === 0) {
          hasPerforations = true;
          break;
        }
      }
    }
    expect(hasPerforations).toBe(true);
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
});
