import { CutterPreset, SurfaceTextureConfig } from './types';

export interface CutterPresetProfile {
  name: string;
  description: string;
  minSafeBridgeMm: number;
  recommendedFrequencyMm: number;
  recommendedBlendReachMm: number;
  supportsMicroDots: boolean;
}

export const CUTTER_PRESETS: Record<CutterPreset, CutterPresetProfile> = {
  drag_knife: {
    name: 'Drag-Knife (Cricut / Silhouette)',
    description: 'Enforces wide structural bridges and continuous cuts to prevent mat snagging and tedious weeding.',
    minSafeBridgeMm: 1.5,
    recommendedFrequencyMm: 4.0,
    recommendedBlendReachMm: 6.0,
    supportsMicroDots: false,
  },
  laser: {
    name: 'Laser Cutter (CO2 / Diode)',
    description: 'Enables fine micro-slits, intricate halftones, and precise narrow webbing without mechanical friction.',
    minSafeBridgeMm: 0.6,
    recommendedFrequencyMm: 2.5,
    recommendedBlendReachMm: 4.0,
    supportsMicroDots: true,
  },
  manual: {
    name: 'Manual Craft (X-Acto / Scalpel)',
    description: 'Generates bold, continuous linework and generous spacing suitable for hand cutting.',
    minSafeBridgeMm: 2.0,
    recommendedFrequencyMm: 5.0,
    recommendedBlendReachMm: 8.0,
    supportsMicroDots: false,
  },
};

/**
 * Validates and clamps texture settings against device safety constraints
 */
export function enforceCutterSafety(config: SurfaceTextureConfig): SurfaceTextureConfig {
  const profile = CUTTER_PRESETS[config.cutterPreset] || CUTTER_PRESETS.drag_knife;
  const safeBridge = Math.max(profile.minSafeBridgeMm, config.bridgeWidthMm);
  const safeFrequency = Math.max(safeBridge * 1.5, config.frequencyMm);

  return {
    ...config,
    bridgeWidthMm: safeBridge,
    frequencyMm: safeFrequency,
  };
}
