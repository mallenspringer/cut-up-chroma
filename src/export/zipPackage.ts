import { zipSync, strToU8 } from 'fflate';
import { ChromaLayerState, CanvasSettings, VectorLayerResult } from '../engine/types';
import { generateMasterCombinedSVG, generateSingleLayerSVG } from './svgGenerator';

export interface ZipPackageOptions {
  includeRegistrationMarks?: boolean;
  solidBlack?: boolean;
  mirrorHorizontal?: boolean;
  strokeOnly?: boolean;
}

/**
 * Packages all cut sheets and master SVG into a downloadable ZIP archive using fflate
 */
export function createZipPackage(
  layers: ChromaLayerState[],
  vectorResults: Map<string, VectorLayerResult>,
  canvas: CanvasSettings,
  prefix: string = 'CutUp_Chroma',
  options: boolean | ZipPackageOptions = false,
  processingDimensions?: { width: number; height: number }
): Blob {
  const files: Record<string, Uint8Array> = {};

  const cleanPrefix = (prefix || 'CutUp_Chroma').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const opts: ZipPackageOptions = typeof options === 'boolean'
    ? { includeRegistrationMarks: options }
    : options;

  // 1. Master Combined Multi-Color SVG
  const masterSvg = generateMasterCombinedSVG(
    layers,
    vectorResults,
    canvas,
    {
      strokeOnly: opts.strokeOnly ?? false,
      includeRegistrationMarks: opts.includeRegistrationMarks ?? false,
      mirrorHorizontal: opts.mirrorHorizontal ?? false,
      solidBlack: opts.solidBlack ?? false,
    },
    processingDimensions
  );
  files[`${cleanPrefix}_Master_Combined.svg`] = strToU8(masterSvg);

  // 2. Individual Per-Layer SVG Cut Files
  const sortedLayers = [...layers].sort((a, b) => a.order - b.order);

  sortedLayers.forEach((layer, idx) => {
    const isLayer0 = idx === 0;
    const isVoid = isLayer0 && layer.isSolidBacking === false;
    if (isVoid) return; // Void base has no physical cut material

    const vec = vectorResults.get(layer.id);
    const layerSvg = generateSingleLayerSVG(
      layer,
      vec,
      canvas,
      {
        strokeOnly: opts.strokeOnly ?? (opts.solidBlack ? false : true),
        includeRegistrationMarks: opts.includeRegistrationMarks ?? false,
        mirrorHorizontal: opts.mirrorHorizontal ?? false,
        solidBlack: opts.solidBlack ?? false,
      },
      processingDimensions
    );

    const sheetNum = String(idx).padStart(2, '0');
    const hexClean = layer.swatch.hex.replace('#', '').toUpperCase();
    const blackSuffix = opts.solidBlack ? '_FilmPositive_K100' : `_${hexClean}`;
    const filename = isLayer0 ? `${sheetNum}_Layer_Base${blackSuffix}.svg` : `${sheetNum}_Layer${blackSuffix}.svg`;

    files[filename] = strToU8(layerSvg);
  });

  // 3. Assembly Readme text
  const readmeContent = `CutUp Chroma — Layer-by-Layer Production Package
==================================================
Project Name: ${cleanPrefix}
Sheet Dimensions: ${canvas.width} x ${canvas.height} ${canvas.unit}
Total Color Layers: ${layers.length}
Registration Marks: ${opts.includeRegistrationMarks ? 'Included' : 'None'}

Layer Assembly Order (Z-Stack: 00 = Base Foundation -> Top Layer):
--------------------------------------------------
${sortedLayers.map((l, i) => `${String(i).padStart(2, '0')}. Layer ${i}${i === 0 ? ' (Base Foundation)' : ''} (${l.swatch.hex}) - ${l.isSolidBacking ? '[Solid Foundation Base]' : 'Cutout Sheet'}`).join('\n')}

Production & Fabrication Notes:
- Physical Cutting (Laser / Cricut / Silhouette): Import individual SVG files at 1:1 scale (${canvas.width}x${canvas.height}${canvas.unit}). Assemble sequentially from 00 up to ${String(layers.length - 1).padStart(2, '0')}.
- Screen Printing & Risograph: Use individual SVG separation sheets as film positives / stencils.
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
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // Defer cleanup by 45 seconds so Chrome background download manager stream doesn't get aborted
  setTimeout(() => {
    try {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    } catch {
      // Ignore if already revoked
    }
  }, 45000);
}
