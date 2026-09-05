export type TexturePatternStyle = 'ribbons' | 'webbed_halftone' | 'slits' | 'crosshatch';
export type CutterPreset = 'drag_knife' | 'laser' | 'manual';
export type TextureMode = 'full_field' | 'boundary';

export interface SurfaceTextureConfig {
  enabled: boolean;
  textureMode: TextureMode; // 'full_field' = across layer tone map; 'boundary' = edge gradient
  patternStyle: TexturePatternStyle;
  cutterPreset: CutterPreset;
  frequencyMm: number; // Spacing/pitch between texture elements (mm)
  bridgeWidthMm: number; // Minimum structural paper bridge width (mm)
  slotWidthMm: number; // Kerf-aware slot/aperture cut width for slits and ribbons (mm)
  blendReachMm: number; // How far the texture gradient extends in boundary mode (mm)
  angleDeg: number; // Orientation angle for directional textures (0..180 deg)
  bridgingTabsEnabled: boolean; // Transverse structural tabs to keep paper ribbons/slits intact
}

export const DEFAULT_SURFACE_TEXTURE_CONFIG: SurfaceTextureConfig = {
  enabled: false,
  textureMode: 'full_field',
  patternStyle: 'ribbons',
  cutterPreset: 'drag_knife',
  frequencyMm: 4.0,
  bridgeWidthMm: 1.5,
  slotWidthMm: 0.8,
  blendReachMm: 6.0,
  angleDeg: 45,
  bridgingTabsEnabled: true,
};

