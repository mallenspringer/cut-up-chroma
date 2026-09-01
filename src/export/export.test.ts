import { describe, it, expect } from 'vitest';
import { generateExportBaseName, getExportFilename } from './naming';
import { CanvasSettings, SourceImage } from '../engine/types';

describe('Export Naming Engine', () => {
  const mockCanvas: CanvasSettings = {
    width: 8.5,
    height: 11,
    unit: 'in',
    margin: 0.5,
    sheetType: 'Letter (8.5 x 11 in)',
    orientation: 'portrait',
  };

  const mockSource: SourceImage = {
    id: 'src-1',
    name: 'Vintage Poster.png',
    dataUrl: 'data:image/png;base64,123',
    width: 1000,
    height: 1200,
    aspectRatio: 1000 / 1200,
  };

  it('should generate sanitized human-readable base filename', () => {
    const base = generateExportBaseName(mockSource, mockCanvas, 5);
    expect(base).toBe('Vintage_Poster_8.5x11in_5Colors');
  });

  it('should generate correct extension filenames for all export types', () => {
    const base = 'Botanical_8.5x11in_4Colors';

    expect(getExportFilename(base, 'master_svg')).toBe('Botanical_8.5x11in_4Colors_Master_Combined.svg');
    expect(getExportFilename(base, 'layer_package_zip')).toBe('Botanical_8.5x11in_4Colors_Production_Package.zip');
    expect(getExportFilename(base, 'mockup_png')).toBe('Botanical_8.5x11in_4Colors_3D_Mockup.png');
    expect(getExportFilename(base, 'mockup_jpg')).toBe('Botanical_8.5x11in_4Colors_3D_Mockup.jpg');
    expect(getExportFilename(base, 'single_layer_svg', 0, 'Base Shadow')).toBe('01_Base_Shadow.svg');
    expect(getExportFilename(base, 'single_layer_svg', 2, 'Forest Green')).toBe('03_Forest_Green.svg');
  });

  it('should support custom project name prefix override', () => {
    const base = generateExportBaseName(mockSource, mockCanvas, 5, 'My Custom Project!');
    expect(base).toBe('My_Custom_Project_');
  });
});
