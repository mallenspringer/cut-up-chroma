import { BinaryMask, ChromaLayerState } from '../types';
import { SurfaceTextureConfig } from './types';
import { enforceCutterSafety } from './cutterPresets';

/**
 * Applies physical negative-space texturing and gradient modulation to layered binary masks.
 * Ensures the physical paper retains structural continuity and respects cutter presets.
 */
export function applySurfaceTexturing(
  layerMasks: BinaryMask[],
  layers: ChromaLayerState[],
  config: SurfaceTextureConfig,
  pxPerMm: number,
  alpha?: Uint8Array | null
): BinaryMask[] {
  if (!config.enabled || layerMasks.length === 0) {
    return layerMasks;
  }

  const safeConfig = enforceCutterSafety(config);
  const numLayers = layerMasks.length;
  const { width, height } = layerMasks[0];
  const totalPixels = width * height;

  const pitchPx = Math.max(2, safeConfig.frequencyMm * pxPerMm);
  const bridgePx = Math.max(1, safeConfig.bridgeWidthMm * pxPerMm);
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

  // Process cut layers from Layer 1 up to N-1 (Layer 0 solid backing remains intact)
  for (let k = 1; k < numLayers - 1; k++) {
    const currentMask = texturedMasks[k].data;
    const upperMask = texturedMasks[k + 1].data;

    // Fast Distance Transform from upper layer boundary into current layer
    const distMap = computeBoundaryDistanceMap(currentMask, upperMask, width, height, blendReachPx);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;

        // Skip margin pixels (preserve solid margin border)
        if (alpha && alpha[idx] < 128) continue;
        if (currentMask[idx] === 0) continue;

        const dist = distMap[idx];
        if (dist >= blendReachPx || dist < 0) continue; // Outside gradient transition reach

        // Normalized gradient factor: 0.0 (near upper layer edge) -> 1.0 (deep interior of current layer)
        const tone = dist / blendReachPx;

        // Compute rotated coordinates
        const u = x * cosA + y * sinA;
        const v = -x * sinA + y * cosA;

        let isVoidSlot = false;

        switch (safeConfig.patternStyle) {
          case 'ribbons': {
            // Continuous undulating ribbons with variable slot opening
            const periodOffset = ((u % pitchPx) + pitchPx) % pitchPx;
            const distFromCenter = Math.abs(periodOffset - pitchPx * 0.5);
            // Max slot opening is pitch minus structural bridge
            const maxSlotWidth = Math.max(0, pitchPx - bridgePx);
            const currentSlotWidth = (1.0 - tone) * maxSlotWidth;

            if (currentSlotWidth > 1.0 && distFromCenter < currentSlotWidth * 0.5) {
              isVoidSlot = true;
            }
            break;
          }

          case 'webbed_halftone': {
            // Grid-based halftone with guaranteed orthogonal cross-bridges
            const cellU = ((u % pitchPx) + pitchPx) % pitchPx;
            const cellV = ((v % pitchPx) + pitchPx) % pitchPx;

            const distU = Math.abs(cellU - pitchPx * 0.5);
            const distV = Math.abs(cellV - pitchPx * 0.5);
            const radialDist = Math.sqrt(distU * distU + distV * distV);

            // Radius scales with gradient tone
            const maxRadius = Math.max(0, (pitchPx - bridgePx) * 0.5);
            const currentRadius = Math.sqrt(Math.max(0, 1.0 - tone)) * maxRadius;

            // Preserve cross webbing along cell borders
            const isNearBorder = cellU < bridgePx * 0.5 || cellU > (pitchPx - bridgePx * 0.5) ||
                                cellV < bridgePx * 0.5 || cellV > (pitchPx - bridgePx * 0.5);

            if (!isNearBorder && currentRadius > 1.0 && radialDist < currentRadius) {
              isVoidSlot = true;
            }
            break;
          }

          case 'slits': {
            // Staggered micro-slits
            const rowIdx = Math.floor(v / pitchPx);
            const colShift = (rowIdx % 2 === 0) ? 0 : pitchPx * 0.5;
            const cellU = (((u + colShift) % pitchPx) + pitchPx) % pitchPx;
            const cellV = ((v % pitchPx) + pitchPx) % pitchPx;

            const distV = Math.abs(cellV - pitchPx * 0.5);
            const slitLength = (1.0 - tone) * (pitchPx - bridgePx);

            if (slitLength > 1.0 && distV < 1.0) {
              const distU = Math.abs(cellU - pitchPx * 0.5);
              if (distU < slitLength * 0.5) {
                isVoidSlot = true;
              }
            }
            break;
          }

          case 'crosshatch': {
            // Slat cutouts with transverse bridging ribs
            const slatU = ((u % pitchPx) + pitchPx) % pitchPx;
            const ribV = ((v % (pitchPx * 3)) + (pitchPx * 3)) % (pitchPx * 3);

            const slatDist = Math.abs(slatU - pitchPx * 0.5);
            const isRib = ribV < bridgePx;

            const maxSlatWidth = Math.max(0, pitchPx - bridgePx);
            const currentSlatWidth = (1.0 - tone) * maxSlatWidth;

            if (!isRib && currentSlatWidth > 1.0 && slatDist < currentSlatWidth * 0.5) {
              isVoidSlot = true;
            }
            break;
          }
        }

        if (isVoidSlot) {
          currentMask[idx] = 0; // Negative space aperture cutout
        }
      }
    }
  }

  return texturedMasks;
}

/**
 * Fast Euclidean/Chamfer distance transform measuring distance from upper boundary into current layer
 */
function computeBoundaryDistanceMap(
  currentMask: Uint8Array,
  upperMask: Uint8Array,
  width: number,
  height: number,
  maxDistance: number
): Float32Array {
  const total = width * height;
  const dist = new Float32Array(total).fill(Infinity);

  // 1. Initialize boundary seeds: pixels in current layer that touch upper layer
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (currentMask[idx] === 0) continue;

      let touchesUpper = false;
      const x0 = Math.max(0, x - 1), x1 = Math.min(width - 1, x + 1);
      const y0 = Math.max(0, y - 1), y1 = Math.min(height - 1, y + 1);

      for (let ny = y0; ny <= y1 && !touchesUpper; ny++) {
        for (let nx = x0; nx <= x1; nx++) {
          if (upperMask[ny * width + nx] === 1) {
            touchesUpper = true;
            break;
          }
        }
      }

      if (touchesUpper) {
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
      if (currentMask[idx] === 0) continue;

      let d = dist[idx];
      if (x > 0 && currentMask[idx - 1] === 1) d = Math.min(d, dist[idx - 1] + d1);
      if (y > 0 && currentMask[(y - 1) * width + x] === 1) d = Math.min(d, dist[(y - 1) * width + x] + d1);
      if (x > 0 && y > 0 && currentMask[(y - 1) * width + x - 1] === 1) d = Math.min(d, dist[(y - 1) * width + x - 1] + d2);
      if (x < width - 1 && y > 0 && currentMask[(y - 1) * width + x + 1] === 1) d = Math.min(d, dist[(y - 1) * width + x + 1] + d2);
      dist[idx] = d;
    }
  }

  // 3. Backward Pass
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const idx = y * width + x;
      if (currentMask[idx] === 0) continue;

      let d = dist[idx];
      if (x < width - 1 && currentMask[idx + 1] === 1) d = Math.min(d, dist[idx + 1] + d1);
      if (y < height - 1 && currentMask[(y + 1) * width + x] === 1) d = Math.min(d, dist[(y + 1) * width + x] + d1);
      if (x < width - 1 && y < height - 1 && currentMask[(y + 1) * width + x + 1] === 1) d = Math.min(d, dist[(y + 1) * width + x + 1] + d2);
      if (x > 0 && y < height - 1 && currentMask[(y + 1) * width + x - 1] === 1) d = Math.min(d, dist[(y + 1) * width + x - 1] + d2);
      dist[idx] = d;
    }
  }

  return dist;
}
