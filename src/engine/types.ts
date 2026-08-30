export type LengthUnit = 'in' | 'mm' | 'cm';

export type PreviewTab = 'source' | 'quantized' | 'layer' | 'composite';

export type ActiveTool = 'navigate' | 'wand' | 'bridge' | 'eyedropper';

export type AssemblyMode = 'stacked_relief' | 'inlay_mosaic';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropShape {
  type: 'rectangle';
  geometry: Rect;
}

export type RasterScaleMethod = 'nearest';

export interface SourceImage {
  id: string;
  name: string;
  width: number;
  height: number;
  aspectRatio: number;
  dataUrl: string;
  imageData?: ImageData;
}

export interface WorkingImageState {
  crop: CropShape;
  position: Point;
  scaleX: number;
  scaleY: number;
  lockAspect?: boolean;
  rasterScaleMethod: RasterScaleMethod;
}

export interface CanvasSettings {
  width: number;
  height: number;
  unit: LengthUnit;
  margin: number;
  orientation: 'portrait' | 'landscape';
}

export interface ChromaSwatch {
  id: string;
  name: string;
  hex: string;
  oklab: [number, number, number]; // [L, a, b]
  oklch: [number, number, number]; // [L, C, H]
}

export interface ManualBridgeStroke {
  id: string;
  x1: number; // normalized 0..1
  y1: number;
  x2: number;
  y2: number;
  widthMm: number;
}

export interface ManualFillPoint {
  id: string;
  x: number; // normalized 0..1
  y: number;
  fillType: 0 | 1; // 1 = solid, 0 = erase
}

export interface LayerManualEdits {
  bridges: ManualBridgeStroke[];
  fills: ManualFillPoint[];
}

export interface ChromaLayerState {
  id: string;
  order: number; // Z-index (0 = bottom base, N = top sheet)
  swatch: ChromaSwatch;
  isSolidBacking?: boolean; // Layer 0 solid backing option
  underlapBleedMm: number; // default: 0.5mm
  manualEdits?: LayerManualEdits;
  visible?: boolean;
  opacity?: number;
}

export interface ChromaProcessingSettings {
  assemblyMode: AssemblyMode;
  colorCount: number; // K (2 to 10)
  colorBias: number; // 0.0 (Graphic Hue) to 1.0 (Tonal Luma), default 0.5
  hueWeight: number; // 0.0 to 3.0 (default: 1.0)
  lightnessWeight: number; // 0.0 to 3.0 (default: 1.0)
  chromaWeight: number; // 0.0 to 3.0 (default: 1.0)
  chromaFloor: number; // 0.0 to 0.15 (default: 0.02)
  minimumFeatureSize: number; // in mm (0.0 to 10.0mm)
  smoothing: number; // 0 to 100
  underlapBleedMm: number; // 0.0 to 1.5mm (default: 0.5mm)
  inlayToleranceMm: number; // 0.0 to 0.5mm
}

export type AestheticFilterType = 'none' | 'pixelate' | 'voronoi';

export interface PixelateFilterConfig {
  blockSizeMm: number;
  sampleMethod: 'mean' | 'median';
  gridSnap: boolean;
  cornerStyle: 'orthogonal' | 'rounded';
}

export interface VoronoiFilterConfig {
  facetCount: number;
  jitter: number;
  sampleMethod: 'mean' | 'median';
  seed: number;
  cornerStyle: 'orthogonal' | 'rounded';
}

export interface AestheticFilterState {
  enabled: boolean;
  type: AestheticFilterType;
  pixelate: PixelateFilterConfig;
  voronoi: VoronoiFilterConfig;
}

export interface AppOutputSettings {
  registrationMarks: boolean;
  exportPrefix: string;
}

export interface AppState {
  sourceImage: SourceImage | null;
  workingImage: WorkingImageState;
  canvas: CanvasSettings;
  processing: ChromaProcessingSettings;
  aestheticFilter: AestheticFilterState;
  palette: ChromaSwatch[];
  layers: ChromaLayerState[];
  selectedLayerId: string | null;
  activeTool: ActiveTool;
  bridgeWidthMm: number;
  output: AppOutputSettings;
}

export interface BinaryMask {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface VectorLayerResult {
  layerId: string;
  pathData: string;
  underlapPathData?: string;
  pathCount: number;
  areaPercentage: number;
}
