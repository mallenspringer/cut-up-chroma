import { CutterPreset, SurfaceTextureConfig } from './types';

export interface CutterPresetProfile {
  name: string;
  description: string;
  minSafeBridgeMm: number;
  recommendedFrequencyMm: number;
  recommendedBlendReachMm: number;
  defaultSlotWidthMm: number;
  minSlotWidthMm: number;
  supportsMicroDots: boolean;
}

export const CUTTER_PRESETS: Record<CutterPreset, CutterPresetProfile> = {
  drag_knife: {
    name: 'Blade / Drag-Knife',
    description: 'Enforces wide structural bridges and continuous cut contours to prevent mat snagging and fragile tearing on blade cutters.',
    minSafeBridgeMm: 1.5,
    recommendedFrequencyMm: 4.0,
    recommendedBlendReachMm: 6.0,
    defaultSlotWidthMm: 0.8,
    minSlotWidthMm: 0.6,
    supportsMicroDots: false,
  },
  laser: {
    name: 'Laser Cutter (CO2 / Diode)',
    description: 'Enables fine micro-slits, intricate halftones, and precise narrow webbing without mechanical friction.',
    minSafeBridgeMm: 0.6,
    recommendedFrequencyMm: 2.5,
    recommendedBlendReachMm: 4.0,
    defaultSlotWidthMm: 0.5,
    minSlotWidthMm: 0.3,
    supportsMicroDots: true,
  },
  manual: {
    name: 'Manual Craft (X-Acto / Scalpel)',
    description: 'Generates bold, continuous linework and generous spacing suitable for hand cutting.',
    minSafeBridgeMm: 2.0,
    recommendedFrequencyMm: 5.0,
    recommendedBlendReachMm: 8.0,
    defaultSlotWidthMm: 1.2,
    minSlotWidthMm: 0.8,
    supportsMicroDots: false,
  },
};

/**
 * Applies recommended defaults when switching cutter presets
 */
export function applyCutterPreset(
  prev: SurfaceTextureConfig,
  preset: CutterPreset
): SurfaceTextureConfig {
  const profile = CUTTER_PRESETS[preset] || CUTTER_PRESETS.drag_knife;
  return {
    ...prev,
    cutterPreset: preset,
    bridgeWidthMm: profile.minSafeBridgeMm,
    frequencyMm: profile.recommendedFrequencyMm,
    blendReachMm: profile.recommendedBlendReachMm,
    slotWidthMm: profile.defaultSlotWidthMm,
  };
}

/**
 * Checks if current config is below recommended physical safety guidelines for the active cutter
 */
export function isBelowSafeThreshold(config: SurfaceTextureConfig): boolean {
  const profile = CUTTER_PRESETS[config.cutterPreset] || CUTTER_PRESETS.drag_knife;
  return config.bridgeWidthMm < profile.minSafeBridgeMm || config.slotWidthMm < profile.minSlotWidthMm;
}

/**
 * Sanitizes texture settings against invalid NaN / negative values without hard-clamping user overrides
 */
export function enforceCutterSafety(config: SurfaceTextureConfig): SurfaceTextureConfig {
  return {
    ...config,
    frequencyMm: Math.max(0.5, isNaN(config.frequencyMm) ? 3.0 : config.frequencyMm),
    bridgeWidthMm: Math.max(0.1, isNaN(config.bridgeWidthMm) ? 1.0 : config.bridgeWidthMm),
    slotWidthMm: Math.max(0.1, isNaN(config.slotWidthMm) ? 0.8 : config.slotWidthMm),
    blendReachMm: Math.max(0.5, isNaN(config.blendReachMm) ? 5.0 : config.blendReachMm),
    angleDeg: isNaN(config.angleDeg) ? 45 : ((config.angleDeg % 360) + 360) % 360,
  };
}

