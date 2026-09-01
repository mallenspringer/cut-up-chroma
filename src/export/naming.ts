import { CanvasSettings, SourceImage } from '../engine/types';

export type ExportFileType =
  | 'master_svg'
  | 'layer_package_zip'
  | 'mockup_png'
  | 'mockup_jpg'
  | 'screenprint_svg'
  | 'single_layer_svg';

/**
 * Generates clean, standardized filenames based on project metadata
 */
export function generateExportBaseName(
  sourceImage: SourceImage | null,
  canvas: CanvasSettings,
  colorCount: number,
  customPrefix?: string
): string {
  if (customPrefix && customPrefix.trim().length > 0) {
    return customPrefix.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  const rawName = sourceImage?.name
    ? sourceImage.name.replace(/\.[^/.]+$/, '')
    : 'CutUp_Chroma';

  const cleanName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const sizeStr = `${canvas.width}x${canvas.height}${canvas.unit}`;
  const countStr = `${colorCount}Colors`;

  return `${cleanName}_${sizeStr}_${countStr}`;
}

export function getExportFilename(
  baseName: string,
  type: ExportFileType,
  layerIndex?: number,
  layerName?: string
): string {
  switch (type) {
    case 'master_svg':
      return `${baseName}_Master_Combined.svg`;
    case 'layer_package_zip':
      return `${baseName}_Production_Package.zip`;
    case 'mockup_png':
      return `${baseName}_3D_Mockup.png`;
    case 'mockup_jpg':
      return `${baseName}_3D_Mockup.jpg`;
    case 'screenprint_svg':
      return `${baseName}_2D_Screenprint_Poster.svg`;
    case 'single_layer_svg': {
      const idx = layerIndex ?? 0;
      const idxStr = String(idx).padStart(2, '0');
      const isBase = idx === 0;
      const hexClean = (layerName || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const hexPart = hexClean ? `_${hexClean}` : '';
      return isBase ? `${idxStr}_Layer_Base${hexPart}.svg` : `${idxStr}_Layer${hexPart}.svg`;
    }
  }
}
