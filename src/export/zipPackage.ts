import { zipSync, strToU8 } from 'fflate';
import { ChromaLayerState, CanvasSettings, VectorLayerResult } from '../engine/types';
import { generateMasterCombinedSVG, generateSingleLayerSVG } from './svgGenerator';

/**
 * Packages all cut sheets and master SVG into a downloadable ZIP archive using fflate
 */
export function createZipPackage(
  layers: ChromaLayerState[],
  vectorResults: Map<string, VectorLayerResult>,
  canvas: CanvasSettings,
  prefix: string = 'CutUp_Chroma',
  includeRegistrationMarks: boolean = false
): Blob {
  const files: Record<string, Uint8Array> = {};

  const cleanPrefix = (prefix || 'CutUp_Chroma').trim().replace(/[^a-zA-Z0-9_-]/g, '_');

  // 1. Master Combined Multi-Color SVG
  const masterSvg = generateMasterCombinedSVG(layers, vectorResults, canvas, {
    strokeOnly: false,
    includeRegistrationMarks,
  });
  files[`${cleanPrefix}_Master_Combined.svg`] = strToU8(masterSvg);

  // 2. Individual Per-Layer SVG Cut Files
  const sortedLayers = [...layers].sort((a, b) => a.order - b.order);

  sortedLayers.forEach((layer, idx) => {
    const vec = vectorResults.get(layer.id);
    const layerSvg = generateSingleLayerSVG(layer, vec, canvas, {
      strokeOnly: true,
      includeRegistrationMarks,
    });

    const sheetNum = String(idx + 1).padStart(2, '0');
    const colorLabel = layer.swatch.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${sheetNum}_Layer_${colorLabel}_${layer.swatch.hex.replace('#', '')}.svg`;

    files[filename] = strToU8(layerSvg);
  });

  // 3. Assembly Readme text
  const readmeContent = `CutUp Chroma — Production Cut Pattern Package
==================================================
Project Prefix: ${cleanPrefix}
Canvas Dimensions: ${canvas.width} x ${canvas.height} ${canvas.unit}
Total Color Layers: ${layers.length}
Registration Marks: ${includeRegistrationMarks ? 'Included' : 'None'}

Layer Assembly Order (Z-Stack: 01 = Base Sheet -> Top Sheet):
--------------------------------------------------
${sortedLayers.map((l, i) => `${String(i + 1).padStart(2, '0')}. ${l.swatch.name} (${l.swatch.hex}) - ${l.isSolidBacking ? '[Solid Backing Base]' : 'Cutout Layer'}`).join('\n')}

Instructions:
- Import individual SVG files into Glowforge, LightBurn, Cricut Design Space, or Silhouette Studio.
- Ensure 1:1 scale (unit dimensions: ${canvas.width}x${canvas.height}${canvas.unit}) without autoscaling.
- Assemble layers sequentially from 01 up to ${String(layers.length).padStart(2, '0')}.
`;

  files['README_Assembly_Guide.txt'] = strToU8(readmeContent);

  // Build synchronous ZIP archive
  const zippedData = zipSync(files, { level: 6 });
  return new Blob([zippedData], { type: 'application/zip' });
}

/**
 * Triggers a direct browser file download for a Blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
