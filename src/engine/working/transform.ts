import { SourceImage, WorkingImageState } from '../types';

export interface ImagePlacementBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ResampledBuffer {
  width: number;
  height: number;
  imageData: ImageData;
  imageBounds?: ImagePlacementBounds;
}

/**
 * Resamples the source image into a working target buffer according to crop, scale, and position.
 * Fits within the interior printable bounds (accounting for page margins) in the full canvas processing buffer.
 * Pixels outside the placed image boundary are tagged with alpha = 0 (margin space).
 */
export function resampleWorkingImage(
  source: SourceImage,
  workingState: WorkingImageState,
  targetWidth: number,
  targetHeight: number,
  pageWidthPx?: number,
  pageHeightPx?: number,
  printableWidthPx?: number,
  printableHeightPx?: number
): ResampledBuffer {
  const totalPixels = targetWidth * targetHeight;
  const result = new Uint8ClampedArray(totalPixels * 4);

  if (!source.imageData) {
    const emptyImg = typeof ImageData !== 'undefined'
      ? new ImageData(result, targetWidth, targetHeight)
      : ({ data: result, width: targetWidth, height: targetHeight, colorSpace: 'srgb' } as unknown as ImageData);
    return { width: targetWidth, height: targetHeight, imageData: emptyImg };
  }

  const srcData = source.imageData.data;
  const srcW = source.imageData.width;
  const srcH = source.imageData.height;

  // Crop geometry
  const crop = workingState.crop?.geometry;
  const cropX = crop?.x || 0;
  const cropY = crop?.y || 0;
  const cropW = (crop && crop.width > 0) ? crop.width : srcW;
  const cropH = (crop && crop.height > 0) ? crop.height : srcH;

  // Scale offset from display page pixels to target processing buffer pixels
  const pW = pageWidthPx || targetWidth;
  const pH = pageHeightPx || targetHeight;
  const scaleToTargetX = targetWidth / Math.max(1, pW);
  const scaleToTargetY = targetHeight / Math.max(1, pH);

  // Scaled printable boundary inside the full canvas processing buffer
  const printW = (printableWidthPx !== undefined ? printableWidthPx : pW) * scaleToTargetX;
  const printH = (printableHeightPx !== undefined ? printableHeightPx : pH) * scaleToTargetY;

  const targetPosX = (workingState.position?.x || 0) * scaleToTargetX;
  const targetPosY = (workingState.position?.y || 0) * scaleToTargetY;
  const scaleX = workingState.scaleX || 1.0;
  const scaleY = workingState.scaleY || 1.0;

  // Fit crop aspect ratio into printable area boundary (matching CSS object-contain)
  const cropAspect = cropW / Math.max(1, cropH);
  const targetAspect = printW / Math.max(1, printH);
  let baseW = printW;
  let baseH = printH;

  if (cropAspect > targetAspect) {
    baseW = printW;
    baseH = printW / cropAspect;
  } else {
    baseH = printH;
    baseW = printH * cropAspect;
  }

  const scaledWidth = baseW * scaleX;
  const scaledHeight = baseH * scaleY;

  // Center-aligned transform origin inside printable canvas
  const centerX = targetWidth / 2 + targetPosX;
  const centerY = targetHeight / 2 + targetPosY;

  const scaledLeft = centerX - scaledWidth / 2;
  const scaledTop = centerY - scaledHeight / 2;

  // Resampling loop
  for (let y = 0; y < targetHeight; y++) {
    const relY = y - scaledTop;
    const normY = relY / scaledHeight;

    for (let x = 0; x < targetWidth; x++) {
      const relX = x - scaledLeft;
      const normX = relX / scaledWidth;
      const targetIdx = (y * targetWidth + x) * 4;

      if (normX >= 0 && normX < 1 && normY >= 0 && normY < 1) {
        const srcXFloat = cropX + normX * cropW;
        const srcYFloat = cropY + normY * cropH;

        const srcX = Math.min(srcW - 1, Math.max(0, Math.floor(srcXFloat)));
        const srcY = Math.min(srcH - 1, Math.max(0, Math.floor(srcYFloat)));
        const srcIdx = (srcY * srcW + srcX) * 4;

        result[targetIdx] = srcData[srcIdx];
        result[targetIdx + 1] = srcData[srcIdx + 1];
        result[targetIdx + 2] = srcData[srcIdx + 2];
        result[targetIdx + 3] = srcData[srcIdx + 3];
      } else {
        // Transparent outside placed image bounds (margins / extra-image space)
        result[targetIdx] = 0;
        result[targetIdx + 1] = 0;
        result[targetIdx + 2] = 0;
        result[targetIdx + 3] = 0;
      }
    }
  }

  const resampledImageData = typeof ImageData !== 'undefined'
    ? new ImageData(result, targetWidth, targetHeight)
    : ({ data: result, width: targetWidth, height: targetHeight, colorSpace: 'srgb' } as unknown as ImageData);

  return {
    width: targetWidth,
    height: targetHeight,
    imageData: resampledImageData,
    imageBounds: {
      left: scaledLeft,
      top: scaledTop,
      width: scaledWidth,
      height: scaledHeight,
    },
  };
}
