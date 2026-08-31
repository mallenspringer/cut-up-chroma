import { SourceImage } from '../types';

/**
 * Generates an 8x6 (48-patch) Perceptual Color Calibration Test Pattern
 * with rich hue distributions, neutral lightness ramps, earth tones, and saturated jewel tones.
 * All color patches are guaranteed to be exact squares.
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

  // Dark slate background
  ctx.fillStyle = '#1b281f';
  ctx.fillRect(0, 0, width, height);

  // Calibration Matrix: 8 columns x 6 rows = 48 distinct perceptual color patches
  const cols = 8;
  const rows = 6;
  const marginX = 16;
  const marginY = 16;
  const gap = 8;

  const availW = width - marginX * 2;
  const availH = height - marginY * 2;

  const rawCellW = (availW - (cols - 1) * gap) / cols;
  const rawCellH = (availH - (rows - 1) * gap) / rows;

  // Enforce perfectly square swatches
  const patchSize = Math.floor(Math.min(rawCellW, rawCellH));

  const totalGridW = cols * patchSize + (cols - 1) * gap;
  const totalGridH = rows * patchSize + (rows - 1) * gap;

  // Center the grid of square patches inside the image
  const startX = Math.round((width - totalGridW) / 2);
  const startY = Math.round((height - totalGridH) / 2);

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
      const px = startX + c * (patchSize + gap);
      const py = startY + r * (patchSize + gap);

      // Subtle drop shadow / bevel
      ctx.fillStyle = '#0f1712';
      ctx.fillRect(px - 1, py - 1, patchSize + 2, patchSize + 2);

      // Patch Fill
      ctx.fillStyle = color;
      ctx.fillRect(px, py, patchSize, patchSize);

      // Subtle border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, patchSize - 1, patchSize - 1);
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

/**
 * Extracts ImageData from an HTMLImageElement with optional max dimension downscaling
 */
export function extractImageDataFromImage(img: HTMLImageElement, maxDimension: number = 2048): ImageData {
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;

  if (w > maxDimension || h > maxDimension) {
    if (w >= h) {
      h = Math.round((h * maxDimension) / w);
      w = maxDimension;
    } else {
      w = Math.round((w * maxDimension) / h);
      h = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2d context for image data extraction');
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}
