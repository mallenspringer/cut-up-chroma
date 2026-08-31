import { Potrace } from '@kcaitech/potrace-ts';
import { BinaryMask, VectorLayerResult } from '../types';

export interface PotraceOptions {
  turdSize?: number;
  alphaMax?: number;
  optCurve?: boolean;
  optTolerance?: number;
  traceHolesOnly?: boolean;
}

/** Calculates turdSize (minimum island area in square pixels) from feature diameter mm and pxPerMm scale */
export function calculateTurdSize(minimumFeatureSizeMm: number, pxPerMm: number): number {
  if (minimumFeatureSizeMm <= 0) return 0;
  const diameterPx = minimumFeatureSizeMm * pxPerMm;
  return Math.round(diameterPx * diameterPx);
}

/** Calculates Potrace corner alphaMax threshold (0.0 to 1.33) from smoothing percentage (0 to 100) */
export function calculateAlphaMax(smoothingPercent: number): number {
  return (Math.min(100, Math.max(0, smoothingPercent)) / 100) * 1.33;
}

/** Calculates Potrace curve optimization tolerance (0.2 to 1.2) from smoothing percentage (0 to 100) */
export function calculateOptTolerance(smoothingPercent: number): number {
  const factor = Math.min(100, Math.max(0, smoothingPercent)) / 100;
  return 0.2 + factor * 1.0;
}

/**
 * Traces a binary material mask into a clean, optimized SVG compound path using Potrace.
 */
export function traceBinaryMaskToSVG(
  mask: BinaryMask,
  layerId: string = 'layer-1',
  options: PotraceOptions = {}
): VectorLayerResult {
  if (typeof document === 'undefined' || typeof ImageData === 'undefined') {
    return {
      layerId,
      pathData: '',
      pathCount: 0,
      areaPercentage: 0,
    };
  }

  const { width, height, data } = mask;
  if (!width || !height || !data || data.length === 0) {
    return {
      layerId,
      pathData: '',
      pathCount: 0,
      areaPercentage: 0,
    };
  }

  const totalPixels = width * height;
  const pixelArray = new Uint8ClampedArray(totalPixels * 4);
  let activePixels = 0;

  for (let i = 0; i < totalPixels; i++) {
    // By default for stacked sheet layers, trace cutout holes (0) as foreground (0)
    // or positive material if traceHolesOnly is false
    const isMaterial = data[i] === 1;
    if (isMaterial) activePixels++;

    const val = options.traceHolesOnly ? (isMaterial ? 255 : 0) : (isMaterial ? 0 : 255);
    pixelArray[i * 4] = val;
    pixelArray[i * 4 + 1] = val;
    pixelArray[i * 4 + 2] = val;
    pixelArray[i * 4 + 3] = 255;
  }

  const areaPercentage = totalPixels > 0 ? (activePixels / totalPixels) * 100 : 0;

  if (activePixels === 0) {
    return {
      layerId,
      pathData: '',
      pathCount: 0,
      areaPercentage: 0,
    };
  }

  const imgData = new ImageData(pixelArray, width, height);
  let rawPathData = '';

  const potraceParams = {
    turdSize: options.turdSize !== undefined ? options.turdSize : 2,
    alphaMax: options.alphaMax !== undefined ? options.alphaMax : 1.0,
    optCurve: options.optCurve !== undefined ? options.optCurve : true,
    optTolerance: options.optTolerance !== undefined ? options.optTolerance : 0.2,
  };

  try {
    new Potrace(
      imgData,
      function (this: any) {
        if (this && typeof this.getPathTag === 'function') {
          const pathTag = this.getPathTag();
          const match = pathTag.match(/d="([^"]+)"/);
          if (match && match[1]) {
            rawPathData = match[1];
          }
        }
      },
      potraceParams
    );
  } catch (err) {
    console.error('Error during Potrace vectorization:', err);
  }

  // Estimate number of subpaths by counting 'M' commands
  const pathCount = (rawPathData.match(/M/g) || []).length;

  return {
    layerId,
    pathData: rawPathData,
    pathCount,
    areaPercentage,
    width,
    height,
  };
}
