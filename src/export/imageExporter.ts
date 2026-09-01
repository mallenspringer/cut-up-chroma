import { ChromaLayerState, CanvasSettings, VectorLayerResult } from '../engine/types';
import { getPrintableArea } from '../engine/layout/canvasLayout';
import { generateMasterCombinedSVG } from './svgGenerator';
import { downloadBlob } from './zipPackage';

export interface DigitalMockupExportOptions {
  includePaperTexture: boolean;
  includeShadows: boolean;
  transparentBackground: boolean;
  format: 'png' | 'jpeg';
  quality?: number; // 0.8 to 1.0 for jpeg
  dpiMultiplier?: number; // default 3 (approx 300 DPI)
}

/**
 * Generates and downloads a High-DPI raster image (PNG/JPEG) from the 3D SVG composite stack
 */
export async function exportDigitalMockup(
  layers: ChromaLayerState[],
  vectorResults: Map<string, VectorLayerResult>,
  canvas: CanvasSettings,
  filename: string,
  options: DigitalMockupExportOptions,
  processingDimensions?: { width: number; height: number }
): Promise<void> {
  const { widthPx, heightPx } = getPrintableArea(canvas);
  const viewW = processingDimensions?.width || widthPx;
  const viewH = processingDimensions?.height || heightPx;

  const multiplier = options.dpiMultiplier || 3;
  const exportW = Math.round(viewW * multiplier);
  const exportH = Math.round(viewH * multiplier);

  // Generate self-contained SVG string with inlined styles
  const sortedLayers = [...layers].sort((a, b) => a.order - b.order);

  const layerSvgs = sortedLayers.map((layer) => {
    const isBase = layer.order === 0;
    const isVoid = isBase && layer.isSolidBacking === false;
    if (isVoid) return '';

    const isSolid = isBase && layer.isSolidBacking !== false;
    const vec = vectorResults.get(layer.id);
    const pathData = vec?.pathData || (isSolid ? `M 0 0 H ${viewW} V ${viewH} H 0 Z` : '');
    if (!pathData) return '';

    const shadowFilter = options.includeShadows && layer.order > 0
      ? `filter="drop-shadow(0px ${Math.max(2, Math.round(multiplier * 2))}px ${Math.max(4, Math.round(multiplier * 4))}px rgba(0,0,0,0.30))"`
      : '';

    return `  <g id="layer-${layer.id}" ${shadowFilter}>
    <path d="${pathData}" fill="${layer.swatch.hex}" fill-rule="evenodd" stroke="rgba(0,0,0,0.15)" stroke-width="0.5" />
  </g>`;
  }).filter(Boolean).join('\n');

  const bgRect = !options.transparentBackground
    ? `<rect width="${viewW}" height="${viewH}" fill="#fdfbf7" />`
    : '';

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${exportW}" height="${exportH}" viewBox="0 0 ${viewW} ${viewH}">
  ${bgRect}
  ${layerSvgs}
</svg>`;

  const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(e);
    img.src = svgUrl;
  });

  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = exportW;
  offscreenCanvas.height = exportH;
  const ctx = offscreenCanvas.getContext('2d');
  if (!ctx) {
    URL.revokeObjectURL(svgUrl);
    throw new Error('Failed to create offscreen canvas context');
  }

  // Draw background if not transparent (especially for JPEG)
  if (!options.transparentBackground || options.format === 'jpeg') {
    ctx.fillStyle = '#fdfbf7';
    ctx.fillRect(0, 0, exportW, exportH);
  }

  ctx.drawImage(img, 0, 0, exportW, exportH);
  URL.revokeObjectURL(svgUrl);

  const mimeType = options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const dataBlob = await new Promise<Blob | null>((resolve) => {
    offscreenCanvas.toBlob(resolve, mimeType, options.quality ?? 0.95);
  });

  if (dataBlob) {
    downloadBlob(dataBlob, filename);
  }
}
