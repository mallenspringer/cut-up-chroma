import { describe, it, expect } from 'vitest';
import { convertUnit, convertToMm, convertFromMm, getPrintableArea } from './canvasLayout';
import { CanvasSettings } from '../types';

describe('Canvas Layout and Unit Conversion', () => {
  it('converts inches to millimeters and vice versa accurately', () => {
    // 8.5 x 11 inches
    expect(convertUnit(8.5, 'in', 'mm')).toBe(215.9);
    expect(convertUnit(11, 'in', 'mm')).toBe(279.4);
    expect(convertUnit(0.25, 'in', 'mm')).toBe(6.35);

    // Symmetric round-trip
    expect(convertUnit(215.9, 'mm', 'in')).toBe(8.5);
    expect(convertUnit(279.4, 'mm', 'in')).toBe(11);
    expect(convertUnit(6.35, 'mm', 'in')).toBe(0.25);
  });

  it('converts inches to centimeters and vice versa', () => {
    expect(convertUnit(8.5, 'in', 'cm')).toBe(21.59);
    expect(convertUnit(11, 'in', 'cm')).toBe(27.94);
    expect(convertUnit(21.59, 'cm', 'in')).toBe(8.5);
  });

  it('converts millimeters to centimeters and vice versa', () => {
    expect(convertUnit(215.9, 'mm', 'cm')).toBe(21.59);
    expect(convertUnit(21.59, 'cm', 'mm')).toBe(215.9);
  });

  it('returns exact same value when fromUnit equals toUnit', () => {
    expect(convertUnit(8.5, 'in', 'in')).toBe(8.5);
    expect(convertUnit(210, 'mm', 'mm')).toBe(210);
  });

  it('preserves physical printable dimensions and pixel layout when switching units', () => {
    const canvasIn: CanvasSettings = {
      width: 8.5,
      height: 11,
      unit: 'in',
      margin: 0.25,
      orientation: 'portrait',
    };

    const canvasMm: CanvasSettings = {
      width: convertUnit(canvasIn.width, 'in', 'mm'),
      height: convertUnit(canvasIn.height, 'in', 'mm'),
      unit: 'mm',
      margin: convertUnit(canvasIn.margin, 'in', 'mm'),
      orientation: 'portrait',
    };

    const areaIn = getPrintableArea(canvasIn);
    const areaMm = getPrintableArea(canvasMm);

    // Physical sizes in mm should match
    expect(areaIn.widthMm).toBeCloseTo(areaMm.widthMm, 1);
    expect(areaIn.heightMm).toBeCloseTo(areaMm.heightMm, 1);
    expect(areaIn.marginMm).toBeCloseTo(areaMm.marginMm, 1);

    // Screen pixel sizes must match exactly
    expect(areaIn.widthPx).toBe(areaMm.widthPx);
    expect(areaIn.heightPx).toBe(areaMm.heightPx);
    expect(areaIn.marginPx).toBe(areaMm.marginPx);
    expect(areaIn.printableWidthPx).toBe(areaMm.printableWidthPx);
    expect(areaIn.printableHeightPx).toBe(areaMm.printableHeightPx);
  });
});
