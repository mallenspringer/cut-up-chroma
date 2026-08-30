import { SourceImage } from '../types';

/**
 * Generates an 8x6 (48-patch) Perceptual Color Calibration Test Pattern
 * with rich hue distributions, neutral lightness ramps, earth tones, and saturated jewel tones.
 */
export function generateCalibrationPattern(width: number = 800, height: number = 600): SourceImage {
  if (typeof document === 'undefined') {
    return {
      id: 'sample-calibration-card',
      name: '48-Patch Chroma Calibration Card',
      width,
      height,
      aspectRatio: width / height,
      dataUrl: '',
    };
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create canvas context');
  }

  // Studio Slate / Dark Card Background
  ctx.fillStyle = '#1b281f';
  ctx.fillRect(0, 0, width, height);

  // Border & Framing
  ctx.strokeStyle = '#dfd29e';
  ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, width - 24, height - 24);

  // Calibration Matrix: 8 columns x 6 rows = 48 distinct perceptual color patches
  const cols = 8;
  const rows = 6;
  const padX = 24;
  const padY = 24;
  const gridW = width - padX * 2;
  const gridH = height - padY * 2;
  const patchGap = 8;
  const cellW = (gridW - (cols - 1) * patchGap) / cols;
  const cellH = (gridH - (rows - 1) * patchGap) / rows;

  const PALETTE_GRID: string[][] = [
    // Row 1: 8-Step Neutral Grayscale Ramp
    ['#111111', '#333333', '#555555', '#777777', '#999999', '#bbbbbb', '#dddddd', '#f8fafc'],

    // Row 2: Vivid Spectral Primaries & Secondaries
    ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'],

    // Row 3: Earth, Botanical & Mineral Cardstocks
    ['#78350f', '#92400e', '#b45309', '#4d7c0f', '#15803d', '#0f766e', '#1e3a8a', '#581c87'],

    // Row 4: Warm Terracottas, Ochres, Sands & Woodgrains
    ['#451a03', '#7c2d12', '#9a3412', '#c2410c', '#d97706', '#ca8a04', '#a16207', '#713f12'],

    // Row 5: Soft Pastels & Tint Tones
    ['#fecaca', '#fed7aa', '#fef08a', '#bbf7d0', '#a5f3fc', '#bfdbfe', '#ddd6fe', '#fbcfe8'],

    // Row 6: Deep Jewel Tones & Shadow Chrome
    ['#881337', '#701a75', '#4c1d95', '#1e1b4b', '#064e3b', '#14532d', '#365314', '#3b2010'],
  ];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const color = PALETTE_GRID[r][c];
      const px = padX + c * (cellW + patchGap);
      const py = padY + r * (cellH + patchGap);

      // Patch shadow / bevel
      ctx.fillStyle = '#0f1712';
      ctx.fillRect(px - 1, py - 1, cellW + 2, cellH + 2);

      // Patch Fill
      ctx.fillStyle = color;
      ctx.fillRect(px, py, cellW, cellH);

      // Fine inner border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, cellW - 1, cellH - 1);
    }
  }

  const dataUrl = canvas.toDataURL('image/png');
  const imageData = ctx.getImageData(0, 0, width, height);

  return {
    id: 'chroma-calibration-pattern',
    name: '48-Patch Chroma Calibration Card',
    width,
    height,
    aspectRatio: width / height,
    dataUrl,
    imageData,
  };
}

/** Extracts ImageData from an HTMLImageElement with max dimension protection */
export function extractImageDataFromImage(image: HTMLImageElement, maxDim: number = 2048): ImageData {
  const natW = image.naturalWidth || image.width || 800;
  const natH = image.naturalHeight || image.height || 600;

  const scale = Math.min(1, maxDim / Math.max(natW, natH));
  const targetW = Math.max(1, Math.round(natW * scale));
  const targetH = Math.max(1, Math.round(natH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0, targetW, targetH);
  return ctx.getImageData(0, 0, targetW, targetH);
}
