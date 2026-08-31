export type TexturePatternStyle = 'ribbons' | 'webbed_halftone' | 'slits' | 'crosshatch';
export type CutterPreset = 'drag_knife' | 'laser' | 'manual';

export interface SurfaceTextureConfig {
  enabled: boolean;
  patternStyle: TexturePatternStyle;
  cutterPreset: CutterPreset;
  frequencyMm: number; // Spacing/pitch between texture elements (mm)
  bridgeWidthMm: number; // Minimum structural paper bridge width (mm)
  blendReachMm: number; // How far the texture gradient extends into adjacent layer boundaries (mm)
  angleDeg: number; // Orientation angle for directional textures (0..180 deg)
}

export const DEFAULT_SURFACE_TEXTURE_CONFIG: SurfaceTextureConfig = {
  enabled: false,
  patternStyle: 'ribbons',
  cutterPreset: 'drag_knife',
  frequencyMm: 3.5,
  bridgeWidthMm: 1.5,
  blendReachMm: 5.0,
  angleDeg: 45,
};
