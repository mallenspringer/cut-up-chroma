/**
 * OKLab & OKLCH Color Space Transformations & Perceptual Distance
 * Developed based on Björn Ottosson's OKLab color model.
 * Highly optimized with lookup tables for real-time 60fps raster processing.
 */

export interface RGB {
  r: number; // 0..255
  g: number; // 0..255
  b: number; // 0..255
}

export interface OKLab {
  L: number; // 0..1 (perceptual lightness)
  a: number; // roughly -0.4..0.4 (green to red)
  b: number; // roughly -0.4..0.4 (blue to yellow)
}

export interface OKLCH {
  L: number; // 0..1 (lightness)
  C: number; // 0..~0.4 (chroma / saturation)
  h: number; // 0..360 (hue angle in degrees)
}

// Precomputed 256-entry sRGB -> Linear RGB lookup table for lightning-fast de-gamma
const SRGB_TO_LINEAR_LUT = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const v = i / 255;
  SRGB_TO_LINEAR_LUT[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** Converts sRGB channel (0..255) to Linear RGB (0..1) de-gamma via O(1) LUT */
export function srgbChannelToLinear(c: number): number {
  const idx = Math.max(0, Math.min(255, Math.round(c)));
  return SRGB_TO_LINEAR_LUT[idx];
}

/** Converts Linear RGB channel (0..1) to sRGB (0..255) with gamma */
export function linearChannelToSrgb(v: number): number {
  const clamped = Math.max(0, Math.min(1, v));
  const s = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(255, s * 255)));
}

/** Converts sRGB (0..255) to OKLab (high speed) */
export function rgbToOklab(r: number, g: number, b: number): OKLab {
  const lr = SRGB_TO_LINEAR_LUT[r & 255];
  const lg = SRGB_TO_LINEAR_LUT[g & 255];
  const lb = SRGB_TO_LINEAR_LUT[b & 255];

  // Linear RGB to LMS
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  // Cube root transform
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  // LMS to OKLab
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const ob = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  return { L, a, b: ob };
}

/** Converts OKLab to sRGB (0..255) */
export function oklabToRgb(L: number, a: number, b: number): RGB {
  // OKLab to LMS cube-roots
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  // LMS to Linear RGB
  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  return {
    r: linearChannelToSrgb(lr),
    g: linearChannelToSrgb(lg),
    b: linearChannelToSrgb(lb),
  };
}

/** Converts OKLab to OKLCH (cylindrical) */
export function oklabToOklch(L: number, a: number, b: number): OKLCH {
  const C = Math.sqrt(a * a + b * b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C, h };
}

/** Converts OKLCH to OKLab */
export function oklchToOklab(L: number, C: number, h: number): OKLab {
  const hRad = (h * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);
  return { L, a, b };
}

/** Converts Hex string (#RRGGBB) to OKLab */
export function hexToOklab(hex: string): OKLab {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return rgbToOklab(r, g, b);
}

/** Converts Hex string (#RRGGBB) to OKLCH */
export function hexToOklch(hex: string): OKLCH {
  const lab = hexToOklab(hex);
  return oklabToOklch(lab.L, lab.a, lab.b);
}

/** Converts OKLab to Hex string (#RRGGBB) */
export function oklabToHex(L: number, a: number, b: number): string {
  const { r, g, b: bVal } = oklabToRgb(L, a, b);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(bVal)}`;
}

/** Converts RGB to Hex */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const DEG_TO_RAD = Math.PI / 180;

/**
 * Fast Artist-Weighted Delta-E metric in OKLCH space
 */
export function calculateWeightedDeltaE(
  pL: number,
  pC: number,
  pH: number,
  kL: number,
  kC: number,
  kH: number,
  wLightness: number = 1.0,
  wHue: number = 1.0,
  wChroma: number = 1.0
): number {
  const dL = pL - kL;
  const dC = pC - kC;

  let dH_deg = Math.abs(pH - kH);
  if (dH_deg > 180) dH_deg = 360 - dH_deg;

  const shortest_rad = dH_deg * DEG_TO_RAD;
  const deltaH_rad = 2 * Math.sin(shortest_rad * 0.5);

  const meanChroma = Math.sqrt(Math.max(0, pC * kC));

  const lComp = wLightness * dL * dL;
  const cComp = wChroma * dC * dC;
  const hComp = wHue * deltaH_rad * deltaH_rad * meanChroma * meanChroma;

  return Math.sqrt(lComp + cComp + hComp);
}
