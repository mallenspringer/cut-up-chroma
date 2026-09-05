import { BinaryMask, ChromaLayerState, ChromaSwatch } from '../types';
import { SurfaceTextureConfig } from './types';
import { enforceCutterSafety } from './cutterPresets';

/**
 * Applies physical negative-space texturing and gradient modulation to layered binary masks.
 * 
 * Stacking Mechanics (Stacked Relief):
 * - Layer 0 (Base backing) remains intact solid paper.
 * - Upper cut sheets (Layer 1 up to Top Layer N-1) receive negative-space apertures.
 * - Apertures in an upper layer reveal the underlying paper sheet beneath it.
 * 
 * Two Operating Modes:
 * 1. 'full_field' (default): Modulates aperture density across the entire layer using local lightness/tone.
 * 2. 'boundary': Modulates aperture density within a boundary transition zone (blendReachMm).
 */
export function applySurfaceTexturing(
  layerMasks: BinaryMask[],
  layers: ChromaLayerState[],
  config: SurfaceTextureConfig,
  pxPerMm: number,
  lightnessMap?: Float32Array | null,
  alpha?: Uint8Array | null
): BinaryMask[] {
  if (!config.enabled || layerMasks.length === 0) {
    return layerMasks;
  }

  const safeConfig = enforceCutterSafety(config);
  const numLayers = Math.min(layerMasks.length, layers.length);
  if (numLayers <= 1) {
    return layerMasks;
  }

  const { width, height } = layerMasks[0];
  const totalPixels = width * height;

  const pitchPx = Math.max(2, safeConfig.frequencyMm * pxPerMm);
  const bridgePx = Math.max(1, safeConfig.bridgeWidthMm * pxPerMm);
  const slotWidthPx = Math.max(1, (safeConfig.slotWidthMm || 0.8) * pxPerMm);
  const blendReachPx = Math.max(2, safeConfig.blendReachMm * pxPerMm);

  const angleRad = (safeConfig.angleDeg * Math.PI) / 180;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  // Clone masks so we don't mutate input
  const texturedMasks: BinaryMask[] = layerMasks.map(m => ({
    width: m.width,
    height: m.height,
    data: new Uint8Array(m.data),
  }));

  // Sort layer indices by Z-order ascending (0 = base, numLayers - 1 = top)
  const zOrder = layers
    .map((l, index) => ({ index, order: l.order, swatch: l.swatch }))
    .filter(item => item.index < numLayers && layerMasks[item.index]?.data)
    .sort((a, b) => a.order - b.order);

  // Tracks pixels that serve as backing beneath upper layer apertures,
  // preventing any lower layer from perforating those pixels.
  const backingReservedMask = new Uint8Array(totalPixels);

  const maxNeighborDistPx = Math.max(blendReachPx * 4, 50 * pxPerMm);

  // Process upper cut layers from top (z = N-1) down to layer 1 (Layer 0 solid base is never perforated)
  for (let z = zOrder.length - 1; z >= 1; z--) {
    const origIdx = zOrder[z].index;
    const currentMask = texturedMasks[origIdx].data;

    // Compute union of layers above z so this layer knows where it is an underlap backing
    const upperMask = new Uint8Array(totalPixels);
    for (let uz = z + 1; uz < zOrder.length; uz++) {
      const uData = layerMasks[zOrder[uz].index].data;
      for (let i = 0; i < totalPixels; i++) {
        if (uData[i] === 1) upperMask[i] = 1;
      }
    }

    // Spatial nearest-lower-layer map: determines which physical sheet beneath z is locally adjacent
    // in 2D space, preventing globally interleaved accents (e.g. blue bars) from being used in warm gradients
    const nearestLowerZ = computeNearestLowerLayerMap(
      layerMasks,
      zOrder,
      z,
      width,
      height,
      maxNeighborDistPx,
      alpha
    );

    // Boundary mode distance transform (inward from outer edge of current layer)
    let distMap: Float32Array | null = null;
    if (safeConfig.textureMode === 'boundary') {
      distMap = computeInwardBoundaryDistance(currentMask, width, height, blendReachPx, alpha);
    }

    const currLightness = zOrder[z].swatch?.oklab?.[0] ?? 0.7;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;

        // Skip margin pixels (preserve solid margin border)
        if (alpha && alpha[idx] < 128) continue;
        if (currentMask[idx] === 0) continue;

        // If this pixel is underlapping an upper layer, or acts as a backing beneath an upper aperture,
        // it MUST remain 100% solid paper so that it cleanly shows through!
        if (upperMask[idx] === 1 || backingReservedMask[idx] === 1) continue;

        const targetLowerZ = nearestLowerZ[idx];
        const lowerOrigIdx = zOrder[targetLowerZ].index;
        const lowerMask = texturedMasks[lowerOrigIdx].data;
        const lowerLightness = zOrder[targetLowerZ].swatch?.oklab?.[0] ?? 0.3;
        const isLightOnDark = currLightness >= lowerLightness;

        let tone = 0.5; // Aperture opening factor (0.0 = solid paper, 1.0 = maximum cutout)

        if (safeConfig.textureMode === 'boundary') {
          if (!distMap) continue;
          const dist = distMap[idx];
          if (dist >= blendReachPx || dist < 0) continue; // Outside boundary reach -> solid paper
          // At edge (dist = 0): tone = 1.0 (max cutout). Inside (dist = blendReachPx): tone = 0.0 (solid)
          tone = Math.max(0, Math.min(1, 1.0 - (dist / blendReachPx)));
        } else {
          // Full-Field Mode: modulated by source image tone/luminance
          if (lightnessMap && lightnessMap.length === totalPixels) {
            const pxL = lightnessMap[idx];
            // In stacked relief, reveal lower layer where image approaches lower layer's tone
            if (Math.abs(currLightness - lowerLightness) > 0.05) {
              const relTone = (pxL - currLightness) / (lowerLightness - currLightness);
              tone = Math.max(0.1, Math.min(0.95, relTone));
            } else {
              tone = isLightOnDark ? (1.0 - pxL) : pxL;
              tone = Math.max(0.15, Math.min(0.85, tone));
            }
          } else {
            // Uniform baseline texture when no lightness map is available
            tone = 0.5;
          }
        }

        if (tone <= 0.05) continue; // Closed aperture

        // Crucial Physical Craft Rule:
        // Ensure the locally adjacent lower sheet (lowerMask) has solid paper backing beneath
        // this texturing zone so that when currentMask is cut away, the true underlying sheet
        // shows through without punching through to the base or revealing alien accent colors!
        lowerMask[idx] = 1;
        backingReservedMask[idx] = 1;

        // Rotated coordinates for directional pattern orientation
        const u = x * cosA + y * sinA;
        const v = -x * sinA + y * cosA;

        let isVoidSlot = false;

        switch (safeConfig.patternStyle) {
          case 'ribbons': {
            // Parallel ribbons with tone-modulated slot width and transverse bridging tabs
            const periodOffset = ((u % pitchPx) + pitchPx) % pitchPx;
            const distFromCenter = Math.abs(periodOffset - pitchPx * 0.5);

            // Slot opening scales with tone, leaving at least bridgePx of paper
            const maxSlotWidth = Math.max(slotWidthPx, pitchPx - bridgePx);
            const currentSlotWidth = tone * maxSlotWidth;

            const inSlot = currentSlotWidth >= slotWidthPx && distFromCenter < currentSlotWidth * 0.5;

            if (inSlot) {
              if (safeConfig.bridgingTabsEnabled) {
                // Transverse bridging tabs staggered across alternate ribbon rows
                const tabPeriod = pitchPx * 4;
                const rowIdx = Math.floor(u / pitchPx);
                const shiftV = (rowIdx % 2 === 0) ? 0 : tabPeriod * 0.5;
                const cellV = (((v + shiftV) % tabPeriod) + tabPeriod) % tabPeriod;
                const isBridgeTab = cellV < bridgePx;

                if (!isBridgeTab) {
                  isVoidSlot = true;
                }
              } else {
                isVoidSlot = true;
              }
            }
            break;
          }

          case 'webbed_halftone': {
            // Hexagonal / staggered circular apertures for maximum tensile paper continuity
            const rowHeight = pitchPx * 0.866025; // sqrt(3)/2
            const rowIdx = Math.floor(v / rowHeight);
            const shiftU = (rowIdx % 2 === 0) ? 0 : pitchPx * 0.5;

            const cellU = (((u + shiftU) % pitchPx) + pitchPx) % pitchPx - pitchPx * 0.5;
            const cellV = ((v % rowHeight) + rowHeight) % rowHeight - rowHeight * 0.5;
            const dist = Math.sqrt(cellU * cellU + cellV * cellV);

            // Radius scales with tone, ensuring structural bridge between neighboring dots
            const maxRadius = Math.max(1, (pitchPx - bridgePx) * 0.5);
            const currentRadius = Math.sqrt(tone) * maxRadius;

            // Turd-guard: prevent sub-kerf micro-dots that shred on blade or get dropped by Potrace
            const minPrintableRadius = Math.max(1.2, 0.4 * pxPerMm);

            if (currentRadius >= minPrintableRadius && dist < currentRadius) {
              isVoidSlot = true;
            }
            break;
          }

          case 'slits': {
            // Staggered capsule / pill slots with physical kerf width and bridging tabs
            const slatPeriodV = pitchPx;
            const slotPeriodU = pitchPx * 3.5;
            const rowIdx = Math.floor(v / slatPeriodV);
            const shiftU = (rowIdx % 2 === 0) ? 0 : slotPeriodU * 0.5;

            const cellU = (((u + shiftU) % slotPeriodU) + slotPeriodU) % slotPeriodU - slotPeriodU * 0.5;
            const cellV = ((v % slatPeriodV) + slatPeriodV) % slatPeriodV - slatPeriodV * 0.5;

            const distV = Math.abs(cellV);
            const halfSlotH = slotWidthPx * 0.5;

            if (distV < halfSlotH) {
              // Slot length scales with tone
              const maxSlotLength = Math.max(slotWidthPx, slotPeriodU - bridgePx);
              const currentSlotLength = tone * maxSlotLength;

              if (currentSlotLength >= slotWidthPx) {
                const distU = Math.abs(cellU);
                const halfSlotL = currentSlotLength * 0.5;

                // Capsule pill ends
                if (distU <= halfSlotL) {
                  const cornerRadius = halfSlotH;
                  const dxCorner = distU - (halfSlotL - cornerRadius);
                  if (dxCorner <= 0 || (dxCorner * dxCorner + distV * distV <= cornerRadius * cornerRadius)) {
                    isVoidSlot = true;
                  }
                }
              }
            }
            break;
          }

          case 'crosshatch': {
            // Staggered brick-bond slat grating with transverse bridging ribs
            const slatU = ((u % pitchPx) + pitchPx) % pitchPx;
            const slatDist = Math.abs(slatU - pitchPx * 0.5);

            const ribPeriodV = pitchPx * 3;
            const colIdx = Math.floor(u / pitchPx);
            const shiftV = (colIdx % 2 === 0) ? 0 : ribPeriodV * 0.5;
            const ribV = (((v + shiftV) % ribPeriodV) + ribPeriodV) % ribPeriodV;

            const isRib = safeConfig.bridgingTabsEnabled ? (ribV < bridgePx) : false;

            const maxSlatWidth = Math.max(slotWidthPx, pitchPx - bridgePx);
            const currentSlatWidth = tone * maxSlatWidth;

            if (!isRib && currentSlatWidth >= slotWidthPx && slatDist < currentSlatWidth * 0.5) {
              isVoidSlot = true;
            }
            break;
          }
        }

        if (isVoidSlot) {
          currentMask[idx] = 0; // Cut negative-space aperture into upper layer
        }
      }
    }
  }

  return texturedMasks;
}

/**
 * Fast Euclidean/Chamfer distance transform measuring inward distance from layer outer perimeter
 */
function computeInwardBoundaryDistance(
  mask: Uint8Array,
  width: number,
  height: number,
  maxDistance: number,
  alpha?: Uint8Array | null
): Float32Array {
  const total = width * height;
  const dist = new Float32Array(total).fill(Infinity);

  // 1. Initialize boundary seeds: pixels in mask that touch an empty (0) pixel inside the artwork
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] === 0) continue;
      if (alpha && alpha[idx] < 128) continue;

      let isBoundary = false;
      const neighbors = [
        x > 0 ? idx - 1 : -1,
        x < width - 1 ? idx + 1 : -1,
        y > 0 ? idx - width : -1,
        y < height - 1 ? idx + width : -1,
      ];

      for (let n = 0; n < neighbors.length; n++) {
        const nIdx = neighbors[n];
        if (nIdx === -1) continue;
        if (mask[nIdx] === 0 && (!alpha || alpha[nIdx] >= 128)) {
          isBoundary = true;
          break;
        }
      }

      if (isBoundary) {
        dist[idx] = 0;
      }
    }
  }

  // 2. Forward Pass
  const d1 = 1.0;
  const d2 = 1.414;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] === 0) continue;

      let d = dist[idx];
      if (x > 0 && mask[idx - 1] === 1) d = Math.min(d, dist[idx - 1] + d1);
      if (y > 0 && mask[(y - 1) * width + x] === 1) d = Math.min(d, dist[(y - 1) * width + x] + d1);
      if (x > 0 && y > 0 && mask[(y - 1) * width + x - 1] === 1) d = Math.min(d, dist[(y - 1) * width + x - 1] + d2);
      if (x < width - 1 && y > 0 && mask[(y - 1) * width + x + 1] === 1) d = Math.min(d, dist[(y - 1) * width + x + 1] + d2);
      dist[idx] = d;
    }
  }

  // 3. Backward Pass
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const idx = y * width + x;
      if (mask[idx] === 0) continue;

      let d = dist[idx];
      if (x < width - 1 && mask[idx + 1] === 1) d = Math.min(d, dist[idx + 1] + d1);
      if (y < height - 1 && mask[(y + 1) * width + x] === 1) d = Math.min(d, dist[(y + 1) * width + x] + d1);
      if (x < width - 1 && y < height - 1 && mask[(y + 1) * width + x + 1] === 1) d = Math.min(d, dist[(y + 1) * width + x + 1] + d2);
      if (x > 0 && y < height - 1 && mask[(y + 1) * width + x - 1] === 1) d = Math.min(d, dist[(y + 1) * width + x - 1] + d2);
      dist[idx] = d;
    }
  }

  return dist;
}

/**
 * Computes a spatial map assigning each pixel to the nearest lower layer (lz < z) in 2D space.
 * This prevents globally-interleaved accent colors (e.g. blue bars in another zone) from
 * incorrectly being synthesized as the backing layer in unrelated gradients (e.g. yellow->orange).
 */
function computeNearestLowerLayerMap(
  masks: BinaryMask[],
  zOrder: Array<{ index: number; order: number; swatch?: ChromaSwatch }>,
  currentZ: number,
  width: number,
  height: number,
  maxNeighborDistPx: number,
  alpha?: Uint8Array | null
): Uint8Array {
  const total = width * height;
  const owner = new Uint8Array(total); // Defaults to 0 (Layer 0 Base)
  const dist = new Float32Array(total).fill(Infinity);

  // 1. Seed all intermediate lower color layers (lz from 1 to currentZ - 1)
  // Seed in ascending order so higher sheets win at overlapping underlap pixels
  let hasIntermediateLowerLayers = false;
  for (let lz = 1; lz < currentZ; lz++) {
    const lMask = masks[zOrder[lz].index]?.data;
    if (!lMask) continue;
    for (let i = 0; i < total; i++) {
      if (alpha && alpha[i] < 128) continue;
      if (lMask[i] === 1) {
        dist[i] = 0;
        owner[i] = lz;
        hasIntermediateLowerLayers = true;
      }
    }
  }

  // If there are no intermediate lower layers (e.g. currentZ === 1), everything falls back to Layer 0
  if (!hasIntermediateLowerLayers) {
    return owner; // all 0
  }

  // 2. Forward pass (Chamfer distance)
  const d1 = 1.0;
  const d2 = 1.414;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x;
      if (alpha && alpha[idx] < 128) continue;

      let curD = dist[idx];
      let curOwner = owner[idx];

      // Left neighbor
      if (x > 0) {
        const nD = dist[idx - 1] + d1;
        if (nD < curD || (nD === curD && owner[idx - 1] > curOwner)) {
          curD = nD;
          curOwner = owner[idx - 1];
        }
      }
      // Top neighbor
      if (y > 0) {
        const nD = dist[idx - width] + d1;
        if (nD < curD || (nD === curD && owner[idx - width] > curOwner)) {
          curD = nD;
          curOwner = owner[idx - width];
        }
      }
      // Top-left neighbor
      if (x > 0 && y > 0) {
        const nD = dist[idx - width - 1] + d2;
        if (nD < curD || (nD === curD && owner[idx - width - 1] > curOwner)) {
          curD = nD;
          curOwner = owner[idx - width - 1];
        }
      }
      // Top-right neighbor
      if (x < width - 1 && y > 0) {
        const nD = dist[idx - width + 1] + d2;
        if (nD < curD || (nD === curD && owner[idx - width + 1] > curOwner)) {
          curD = nD;
          curOwner = owner[idx - width + 1];
        }
      }

      dist[idx] = curD;
      owner[idx] = curOwner;
    }
  }

  // 3. Backward pass (Chamfer distance)
  for (let y = height - 1; y >= 0; y--) {
    const rowOffset = y * width;
    for (let x = width - 1; x >= 0; x--) {
      const idx = rowOffset + x;
      if (alpha && alpha[idx] < 128) continue;

      let curD = dist[idx];
      let curOwner = owner[idx];

      // Right neighbor
      if (x < width - 1) {
        const nD = dist[idx + 1] + d1;
        if (nD < curD || (nD === curD && owner[idx + 1] > curOwner)) {
          curD = nD;
          curOwner = owner[idx + 1];
        }
      }
      // Bottom neighbor
      if (y < height - 1) {
        const nD = dist[idx + width] + d1;
        if (nD < curD || (nD === curD && owner[idx + width] > curOwner)) {
          curD = nD;
          curOwner = owner[idx + width];
        }
      }
      // Bottom-right neighbor
      if (x < width - 1 && y < height - 1) {
        const nD = dist[idx + width + 1] + d2;
        if (nD < curD || (nD === curD && owner[idx + width + 1] > curOwner)) {
          curD = nD;
          curOwner = owner[idx + width + 1];
        }
      }
      // Bottom-left neighbor
      if (x > 0 && y < height - 1) {
        const nD = dist[idx + width - 1] + d2;
        if (nD < curD || (nD === curD && owner[idx + width - 1] > curOwner)) {
          curD = nD;
          curOwner = owner[idx + width - 1];
        }
      }

      dist[idx] = curD;
      owner[idx] = curOwner;
    }
  }

  // 4. Threshold pass: if nearest lower layer is too far away, fall back to Layer 0 Base
  for (let i = 0; i < total; i++) {
    if (dist[i] > maxNeighborDistPx) {
      owner[i] = 0;
    }
  }

  return owner;
}

