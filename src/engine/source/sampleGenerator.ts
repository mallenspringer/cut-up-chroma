import { SourceImage } from '../types';

/**
 * Generates a Multi-Zone Calibration Gradient & Step-Wedge Target.
 * Specifically engineered for validating layered cuts, negative-space pattern engines,
 * full-field tone modulation, boundary feathering, and kerf/bridge clearances.
 * 
 * Zones:
 * 1. Top: Continuous Horizontal Linear Gradient Ramp (Full-field tone modulation test)
 * 2. Middle Left: 5-Tier Stepped Value Blocks (Boundary gradient feathering test)
 * 3. Middle Right: Radial Gradient Disc (Angle orientation & isotropic aperture test)
 * 4. Bottom: Graduated Kerf & Bridge Line Gauge (Physical clearance & bridge test)
 */
export function generateCalibrationPattern(width: number = 800, height: number = 600): SourceImage {
  if (typeof document === 'undefined') {
    return {
      id: 'sample-calibration-card',
      name: 'Chroma Calibration Target & Gradient Suite',
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

  // Deep neutral drafting background
  ctx.fillStyle = '#141c16';
  ctx.fillRect(0, 0, width, height);

  const padX = 24;
  const padY = 24;
  const contentW = width - padX * 2;
  const contentH = height - padY * 2;

  // Title / Target Header (Small, clean technical typography)
  ctx.font = '10px monospace';
  ctx.fillStyle = '#6b8273';
  ctx.fillText('CUTUP CHROMA // NEGATIVE-SPACE CALIBRATION TARGET & GRADIENT SUITE', padX, padY - 8);

  // --------------------------------------------------------------------------
  // ZONE 1: Continuous Horizontal Gradient Ramp (Top 28% of height)
  // --------------------------------------------------------------------------
  const z1Y = padY;
  const z1H = Math.round(contentH * 0.28);

  const linearGrad = ctx.createLinearGradient(padX, z1Y, padX + contentW, z1Y);
  linearGrad.addColorStop(0.0, '#fffbf5'); // Highlight Light Sand
  linearGrad.addColorStop(0.28, '#fcd34d'); // Warm Yellow
  linearGrad.addColorStop(0.55, '#ea580c'); // Mid Orange / Terracotta
  linearGrad.addColorStop(0.80, '#991b1b'); // Crimson
  linearGrad.addColorStop(1.0, '#0f172a'); // Deep Shadow Navy

  ctx.fillStyle = linearGrad;
  ctx.fillRect(padX, z1Y, contentW, z1H);

  // Outline
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(padX + 0.5, z1Y + 0.5, contentW - 1, z1H - 1);

  // --------------------------------------------------------------------------
  // ZONE 2 & 3: Middle Band (Height ~42% of contentH)
  // Left: 5 Stepped Value Blocks | Right: Radial Gradient Target
  // --------------------------------------------------------------------------
  const z2Y = z1Y + z1H + 16;
  const z2H = Math.round(contentH * 0.42);
  const gapMid = 16;
  const z2LeftW = Math.round((contentW - gapMid) * 0.58);
  const z2RightW = contentW - gapMid - z2LeftW;
  const z2RightX = padX + z2LeftW + gapMid;

  // ZONE 2: 5 Stepped Value Blocks
  const stepColors = [
    '#fffdfa', // Tier 1 (Lightest)
    '#fed7aa', // Tier 2
    '#f97316', // Tier 3
    '#9a3412', // Tier 4
    '#1e1b4b', // Tier 5 (Darkest)
  ];
  const stepW = z2LeftW / stepColors.length;

  for (let s = 0; s < stepColors.length; s++) {
    const sx = Math.round(padX + s * stepW);
    const sw = Math.round(padX + (s + 1) * stepW) - sx;
    ctx.fillStyle = stepColors[s];
    ctx.fillRect(sx, z2Y, sw, z2H);

    // Subtle divider
    if (s > 0) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.moveTo(sx, z2Y);
      ctx.lineTo(sx, z2Y + z2H);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.strokeRect(padX + 0.5, z2Y + 0.5, z2LeftW - 1, z2H - 1);

  // ZONE 3: Concentric / Radial Gradient Target
  const radCenterX = z2RightX + z2RightW * 0.5;
  const radCenterY = z2Y + z2H * 0.5;
  const radRadius = Math.min(z2RightW, z2H) * 0.48;

  // Backdrop for radial target
  ctx.fillStyle = '#0b110e';
  ctx.fillRect(z2RightX, z2Y, z2RightW, z2H);

  const radialGrad = ctx.createRadialGradient(radCenterX, radCenterY, 0, radCenterX, radCenterY, radRadius);
  radialGrad.addColorStop(0.0, '#fffbf5');
  radialGrad.addColorStop(0.4, '#fbbf24');
  radialGrad.addColorStop(0.75, '#b91c1c');
  radialGrad.addColorStop(1.0, '#0f172a');

  ctx.beginPath();
  ctx.arc(radCenterX, radCenterY, radRadius, 0, Math.PI * 2);
  ctx.fillStyle = radialGrad;
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.strokeRect(z2RightX + 0.5, z2Y + 0.5, z2RightW - 1, z2H - 1);

  // --------------------------------------------------------------------------
  // ZONE 4: Bottom Gauge (Height ~18% of contentH)
  // Graduated Kerf / Bridge Gauge Bars (0.5mm to 3.0mm equivalent lines)
  // --------------------------------------------------------------------------
  const z4Y = z2Y + z2H + 16;
  const z4H = (padY + contentH) - z4Y;

  ctx.fillStyle = '#0f1712';
  ctx.fillRect(padX, z4Y, contentW, z4H);

  const barCounts = 14;
  const gaugeLeft = padX + 16;
  const gaugeW = contentW - 32;
  const barSpacing = gaugeW / barCounts;

  for (let b = 0; b < barCounts; b++) {
    const bx = gaugeLeft + b * barSpacing;
    const barWidth = 1 + Math.round((b / barCounts) * 12);
    ctx.fillStyle = b % 2 === 0 ? '#f8fafc' : '#38bdf8';
    ctx.fillRect(bx, z4Y + 8, barWidth, z4H - 16);
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.strokeRect(padX + 0.5, z4Y + 0.5, contentW - 1, z4H - 1);

  const dataUrl = canvas.toDataURL('image/png');
  const imageData = ctx.getImageData(0, 0, width, height);

  return {
    id: 'chroma-calibration-target-suite',
    name: 'Calibration Target & Gradient Suite',
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
