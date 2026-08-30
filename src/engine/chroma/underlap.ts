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
 * Computes physical layer masks with seam underlap for stacked relief or inlay mosaic.
 * Completely guarded against layer/mask array length mismatches during slider changes.
 */
export function generatePhysicalLayerMasks(
  rawMasks: BinaryMask[],
  layers: ChromaLayerState[],
  assemblyMode: AssemblyMode,
  pxPerMm: number,
  globalUnderlapBleedMm: number = 0.5
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
    const finalMasks: BinaryMask[] = [];
    const underlapOverlays: BinaryMask[] = [];
    for (let i = 0; i < numLayers; i++) {
      finalMasks.push({
        width,
        height,
        data: new Uint8Array(rawMasks[i].data),
      });
      underlapOverlays.push({
        width,
        height,
        data: new Uint8Array(totalPixels),
      });
    }

    return { finalMasks, underlapOverlays };
  }

  // Mode A: Stacked Relief
  const validLayers = layers.slice(0, numLayers);
  const sortedIndices = validLayers
    .map((l, index) => ({
      index,
      order: l.order,
      isSolidBacking: !!l.isSolidBacking,
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
    if (z === 0 && isSolidBacking) {
      const solidData = new Uint8Array(totalPixels);
      for (let k = 0; k < numLayers; k++) {
        const kMask = rawMasks[k];
        if (!kMask?.data) continue;
        const kData = kMask.data;
        for (let i = 0; i < totalPixels; i++) {
          if (kData[i] === 1) solidData[i] = 1;
        }
      }
      finalMasks[originalIdx] = { width, height, data: solidData };
      continue;
    }

    if (z === sortedIndices.length - 1) {
      // Top layer never dilates
      finalMasks[originalIdx] = { width, height, data: new Uint8Array(rawData) };
      continue;
    }

    // If bleed is zero, return exact cut shape
    if (bleed <= 0) {
      finalMasks[originalIdx] = { width, height, data: new Uint8Array(rawData) };
      continue;
    }

    // Dilate raw mask by bleed radius into upper layer regions
    const bleedPx = Math.max(1, Math.round(bleed * pxPerMm));
    const dilated = dilateBinaryMask(rawMask, bleedPx);

    const outData = new Uint8Array(totalPixels);
    const overlayData = new Uint8Array(totalPixels);
    const upperMask = upperUnions[z] || new Uint8Array(totalPixels);

    for (let i = 0; i < totalPixels; i++) {
      if (rawData[i] === 1) {
        outData[i] = 1;
      } else if (dilated.data[i] === 1 && upperMask[i] === 1) {
        outData[i] = 1;
        overlayData[i] = 1;
      }
    }

    finalMasks[originalIdx] = { width, height, data: outData };
    underlapOverlays[originalIdx] = { width, height, data: overlayData };
  }

  return { finalMasks, underlapOverlays };
}
