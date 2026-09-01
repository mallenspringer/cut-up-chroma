import { BinaryMask, ChromaLayerState, AssemblyMode } from '../types';

/**
 * Fast morphological dilation with circular structuring element of given radius
 */
export function dilateBinaryMask(mask: BinaryMask, radiusPx: number): BinaryMask {
  const r = Math.round(radiusPx);
  if (r <= 0) return { ...mask, data: new Uint8Array(mask.data) };

  const { width, height, data } = mask;
  const outData = new Uint8Array(width * height);

  // Precompute circle row horizontal spans: for each dy in [-r..r], span is [-dx..dx]
  const rowSpans: Array<{ dy: number; minDx: number; maxDx: number }> = [];
  const rSq = r * r;
  for (let dy = -r; dy <= r; dy++) {
    const maxDx = Math.floor(Math.sqrt(Math.max(0, rSq - dy * dy)));
    rowSpans.push({ dy, minDx: -maxDx, maxDx });
  }

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      if (data[rowOffset + x] === 1) {
        for (let s = 0; s < rowSpans.length; s++) {
          const { dy, minDx, maxDx } = rowSpans[s];
          const ny = y + dy;
          if (ny >= 0 && ny < height) {
            const nRowOffset = ny * width;
            const startX = Math.max(0, x + minDx);
            const endX = Math.min(width - 1, x + maxDx);
            for (let nx = startX; nx <= endX; nx++) {
              outData[nRowOffset + nx] = 1;
            }
          }
        }
      }
    }
  }

  return { width, height, data: outData };
}

/**
 * Computes physical layer masks with seam underlap and margin positive space union.
 * In Stacked Relief mode:
 * - Layer 0 (Solid): 100% solid paper sheet (or void if false)
 * - Layers 1..N-1: Margin space (alpha < 128) is solid paper (1), unioning seamlessly
 *   with abutting color shapes into continuous physical cardstock sheets.
 */
export function generatePhysicalLayerMasks(
  rawMasks: BinaryMask[],
  layers: ChromaLayerState[],
  assemblyMode: AssemblyMode,
  pxPerMm: number,
  globalUnderlapBleedMm: number = 0.5,
  alpha?: Uint8Array | null,
  unionMarginBorders: boolean = true
): {
  finalMasks: BinaryMask[];
  underlapOverlays: BinaryMask[];
} {
  const numLayers = Math.min(rawMasks.length, layers.length);
  if (numLayers === 0 || !rawMasks[0]) {
    return { finalMasks: [], underlapOverlays: [] };
  }

  const { width, height } = rawMasks[0];
  const totalPixels = width * height;

  if (assemblyMode === 'inlay_mosaic') {
    // Inlay Mode: discrete non-overlapping flat tiles with optional inter-piece tolerance gap
    const finalMasks: BinaryMask[] = [];
    const underlapOverlays: BinaryMask[] = [];

    for (let i = 0; i < numLayers; i++) {
      const raw = rawMasks[i];
      if (!raw?.data) {
        finalMasks.push({ width, height, data: new Uint8Array(totalPixels) });
        underlapOverlays.push({ width, height, data: new Uint8Array(totalPixels) });
        continue;
      }

      finalMasks.push({
        width,
        height,
        data: new Uint8Array(raw.data),
      });

      underlapOverlays.push({
        width,
        height,
        data: new Uint8Array(totalPixels),
      });
    }

    return { finalMasks, underlapOverlays };
  }

  // --------------------------------------------------------------------------
  // Stacked Relief Mode: Layer 0 Foundation Base + Layer Cutout Frames
  // --------------------------------------------------------------------------
  const validLayers = layers.slice(0, numLayers);
  const sortedIndices = validLayers
    .map((l, index) => ({
      index,
      order: l.order,
      isSolidBacking: l.isSolidBacking !== false,
      bleed: globalUnderlapBleedMm,
    }))
    .filter(item => item.index < numLayers && rawMasks[item.index]?.data)
    .sort((a, b) => a.order - b.order);

  // Compute union of upper layers above each Z-level
  const upperUnions: Uint8Array[] = [];
  for (let z = 0; z < numLayers; z++) {
    const unionData = new Uint8Array(totalPixels);
    for (let uz = z + 1; uz < numLayers; uz++) {
      if (!sortedIndices[uz]) continue;
      const uIdx = sortedIndices[uz].index;
      const uMask = rawMasks[uIdx];
      if (!uMask?.data) continue;
      const uData = uMask.data;
      for (let i = 0; i < totalPixels; i++) {
        if (uData[i] === 1) unionData[i] = 1;
      }
    }
    upperUnions.push(unionData);
  }

  const finalMasks: BinaryMask[] = [];
  const underlapOverlays: BinaryMask[] = [];
  for (let i = 0; i < numLayers; i++) {
    finalMasks.push({
      width,
      height,
      data: new Uint8Array(totalPixels),
    });
    underlapOverlays.push({
      width,
      height,
      data: new Uint8Array(totalPixels),
    });
  }

  for (let z = 0; z < sortedIndices.length; z++) {
    const { index: originalIdx, isSolidBacking, bleed } = sortedIndices[z];
    const rawMask = rawMasks[originalIdx];
    if (!rawMask?.data) continue;
    const rawData = rawMask.data;

    // Solid backing handling for base layer (z === 0)
    if (z === 0) {
      if (isSolidBacking) {
        const solidData = new Uint8Array(totalPixels);
        if (unionMarginBorders) {
          solidData.fill(1); // 100% solid paper cardstock base spanning full sheet
        } else {
          // Trim to artwork: fill 1 only where image content exists
          for (let i = 0; i < totalPixels; i++) {
            if (!alpha || alpha[i] >= 128) {
              solidData[i] = 1;
            }
          }
        }
        finalMasks[originalIdx] = { width, height, data: solidData };
      } else {
        const voidData = new Uint8Array(totalPixels);
        voidData.fill(0); // 100% void / empty space
        finalMasks[originalIdx] = { width, height, data: voidData };
      }
      continue;
    }

    const outData = new Uint8Array(totalPixels);
    const overlayData = new Uint8Array(totalPixels);

    if (z === sortedIndices.length - 1 || bleed <= 0) {
      // Top layer or zero bleed: Combine raw mask + optional margin positive space
      for (let i = 0; i < totalPixels; i++) {
        if (unionMarginBorders && alpha && alpha[i] < 128) {
          // Margin space is solid paper (1) unioned into the sheet
          outData[i] = 1;
        } else if (rawData[i] === 1) {
          outData[i] = 1;
        }
      }
      finalMasks[originalIdx] = { width, height, data: outData };
      continue;
    }

    // Dilate raw mask by bleed radius into upper layer regions
    const bleedPx = Math.max(1, Math.round(bleed * pxPerMm));
    const dilated = dilateBinaryMask(rawMask, bleedPx);
    const upperMask = upperUnions[z] || new Uint8Array(totalPixels);

    for (let i = 0; i < totalPixels; i++) {
      if (unionMarginBorders && alpha && alpha[i] < 128) {
        // Margin space is solid paper (1) unioned into the sheet
        outData[i] = 1;
      } else if (rawData[i] === 1) {
        outData[i] = 1;
      } else if (dilated.data[i] === 1 && upperMask[i] === 1) {
        // Dilation underlap beneath upper layers
        outData[i] = 1;
        overlayData[i] = 1;
      }
    }

    finalMasks[originalIdx] = { width, height, data: outData };
    underlapOverlays[originalIdx] = { width, height, data: overlayData };
  }

  return { finalMasks, underlapOverlays };
}
