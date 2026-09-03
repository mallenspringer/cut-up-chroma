import { CanvasSettings, LengthUnit, Point } from '../types';

export const MM_PER_INCH = 25.4;
export const MM_PER_CM = 10.0;
export const DEFAULT_DPI = 96;

/**
 * Converts value from specified unit to millimeters
 */
export function convertToMm(value: number, unit: LengthUnit): number {
  switch (unit) {
    case 'in':
      return value * MM_PER_INCH;
    case 'cm':
      return value * MM_PER_CM;
    case 'mm':
    default:
      return value;
  }
}

/**
 * Converts value from millimeters to specified unit
 */
export function convertFromMm(valueMm: number, unit: LengthUnit): number {
  switch (unit) {
    case 'in':
      return valueMm / MM_PER_INCH;
    case 'cm':
      return valueMm / MM_PER_CM;
    case 'mm':
    default:
      return valueMm;
  }
}

/**
 * Converts a length measurement between any two supported units (in, mm, cm).
 * Preserves high precision and rounds cleanly to 2 decimal places.
 */
export function convertUnit(value: number, fromUnit: LengthUnit, toUnit: LengthUnit): number {
  if (fromUnit === toUnit) return value;
  const mm = convertToMm(value, fromUnit);
  const converted = convertFromMm(mm, toUnit);
  return Math.round(converted * 100) / 100;
}

/**
 * Converts physical unit value to screen pixels (at given DPI)
 */
export function convertToPixels(value: number, unit: LengthUnit, dpi: number = DEFAULT_DPI): number {
  const inches = convertToMm(value, unit) / MM_PER_INCH;
  return Math.round(inches * dpi);
}

export interface PrintableArea {
  widthPx: number;
  heightPx: number;
  printableWidthPx: number;
  printableHeightPx: number;
  marginPx: number;
  widthMm: number;
  heightMm: number;
  printableWidthMm: number;
  printableHeightMm: number;
  marginMm: number;
  pxPerMm: number;
}

/**
 * Computes full canvas and printable area dimensions in pixels and millimeters
 */
export function getPrintableArea(canvas: CanvasSettings, dpi: number = DEFAULT_DPI): PrintableArea {
  const isLandscape = canvas.orientation === 'landscape';
  const rawW = isLandscape ? Math.max(canvas.width, canvas.height) : Math.min(canvas.width, canvas.height);
  const rawH = isLandscape ? Math.min(canvas.width, canvas.height) : Math.max(canvas.width, canvas.height);

  const widthMm = convertToMm(rawW, canvas.unit);
  const heightMm = convertToMm(rawH, canvas.unit);
  const marginMm = convertToMm(canvas.margin, canvas.unit);

  const printableWidthMm = Math.max(0, widthMm - 2 * marginMm);
  const printableHeightMm = Math.max(0, heightMm - 2 * marginMm);

  const pxPerMm = (dpi / MM_PER_INCH);
  const widthPx = Math.round(widthMm * pxPerMm);
  const heightPx = Math.round(heightMm * pxPerMm);
  const marginPx = Math.round(marginMm * pxPerMm);
  const printableWidthPx = Math.round(printableWidthMm * pxPerMm);
  const printableHeightPx = Math.round(printableHeightMm * pxPerMm);

  return {
    widthPx,
    heightPx,
    printableWidthPx,
    printableHeightPx,
    marginPx,
    widthMm,
    heightMm,
    printableWidthMm,
    printableHeightMm,
    marginMm,
    pxPerMm,
  };
}

/**
 * Generates SVG path string for professional printmaker-grade registration targets.
 * Includes concentric bullseye circles, extended quadrant crosshairs, and perimeter crop ticks.
 */
export function generateRegistrationMarksSVG(canvas: CanvasSettings, viewW?: number, viewH?: number): string {
  const { widthPx, heightPx, marginPx, pxPerMm } = getPrintableArea(canvas);
  const w = viewW || widthPx;
  const h = viewH || heightPx;
  const scale = w / Math.max(1, widthPx);

  // Target bullseye dimensions in pixels
  const outerR = Math.max(4, Math.round(3.5 * pxPerMm * scale)); // ~3.5mm radius
  const innerR = Math.max(2, Math.round(1.8 * pxPerMm * scale)); // ~1.8mm radius
  const crosshairSpan = Math.max(6, Math.round(5.0 * pxPerMm * scale)); // ~5mm half-span

  // Safe offset within margin margin space
  const effectiveMargin = Math.max(8, marginPx * scale);
  const offset = Math.max(outerR + 2, Math.round(effectiveMargin / 2));

  // 4 Corner Bullseye Targets + 2 Center Pin Register Targets (Top-Center & Bottom-Center)
  const targets: Point[] = [
    { x: offset, y: offset },         // Top-Left
    { x: w - offset, y: offset },     // Top-Right
    { x: offset, y: h - offset },    // Bottom-Left
    { x: w - offset, y: h - offset }, // Bottom-Right
    { x: Math.round(w / 2), y: offset },         // Top-Center (3-Point Pin Registration)
    { x: Math.round(w / 2), y: h - offset },     // Bottom-Center
  ];

  let pathData = '';

  // 1. Concentric Bullseye Targets & Crosshairs
  targets.forEach(p => {
    const cx = p.x;
    const cy = p.y;

    // Crosshair Lines extending through circle
    pathData += `M ${cx - crosshairSpan} ${cy} H ${cx + crosshairSpan} `;
    pathData += `M ${cx} ${cy - crosshairSpan} V ${cy + crosshairSpan} `;

    // Outer Circle
    pathData += `M ${cx - outerR} ${cy} A ${outerR} ${outerR} 0 1 0 ${cx + outerR} ${cy} A ${outerR} ${outerR} 0 1 0 ${cx - outerR} ${cy} `;

    // Inner Circle
    pathData += `M ${cx - innerR} ${cy} A ${innerR} ${innerR} 0 1 0 ${cx + innerR} ${cy} A ${innerR} ${innerR} 0 1 0 ${cx - innerR} ${cy} `;
  });

  // 2. L-Shaped Corner Crop Ticks at Printable Margin Perimeter
  const cropTickLen = Math.max(3, Math.round(3.0 * pxPerMm * scale));
  const mLeft = effectiveMargin;
  const mTop = effectiveMargin;
  const mRight = w - effectiveMargin;
  const mBottom = h - effectiveMargin;

  // Top-Left Corner Crop
  pathData += `M ${mLeft - cropTickLen} ${mTop} H ${mLeft} V ${mTop - cropTickLen} `;
  // Top-Right Corner Crop
  pathData += `M ${mRight + cropTickLen} ${mTop} H ${mRight} V ${mTop - cropTickLen} `;
  // Bottom-Left Corner Crop
  pathData += `M ${mLeft - cropTickLen} ${mBottom} H ${mLeft} V ${mBottom + cropTickLen} `;
  // Bottom-Right Corner Crop
  pathData += `M ${mRight + cropTickLen} ${mBottom} H ${mRight} V ${mBottom + cropTickLen} `;

  return pathData.trim();
}
