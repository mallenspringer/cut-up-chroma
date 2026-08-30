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
 * Generates SVG path string for 4 corner registration targets
 */
export function generateRegistrationMarksSVG(canvas: CanvasSettings, viewW?: number, viewH?: number): string {
  const { widthPx, heightPx, marginPx } = getPrintableArea(canvas);
  const w = viewW || widthPx;
  const h = viewH || heightPx;
  const scale = w / Math.max(1, widthPx);

  const size = 12 * scale;
  const offset = Math.max(4, (marginPx / 2) * scale);

  const corners: Point[] = [
    { x: offset, y: offset },                     // Top-Left
    { x: w - offset, y: offset },                 // Top-Right
    { x: offset, y: h - offset },                // Bottom-Left
    { x: w - offset, y: h - offset },             // Bottom-Right
  ];

  let pathData = '';
  corners.forEach(p => {
    // Crosshairs + target circle
    pathData += `M ${p.x - size / 2} ${p.y} H ${p.x + size / 2} M ${p.x} ${p.y - size / 2} V ${p.y + size / 2} `;
  });

  return pathData;
}
