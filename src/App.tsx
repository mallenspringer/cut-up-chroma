import React, { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue } from 'react';
import {
  AppState,
  PreviewTab,
  ActiveTool,
  ChromaSwatch,
  ChromaLayerState,
  ChromaProcessingSettings,
  CanvasSettings,
  VectorLayerResult,
  BinaryMask,
  SourceImage,
} from './engine/types';
import { createInitialHistory, pushHistorySnapshot, undoHistory, redoHistory, HistoryState } from './state/history';
import { loadUserPreferences, saveUserPreferences, UserPreferences } from './state/preferences';
import { extractDominantPalette } from './engine/chroma/kmeans';
import { classifyImagePixels, precomputeOklchBuffer } from './engine/chroma/classifier';
import { generatePhysicalLayerMasks } from './engine/chroma/underlap';
import { applyManualEditsToMask } from './engine/layers/manualEdits';
import { traceBinaryMaskToSVG, calculateTurdSize, calculateAlphaMax, calculateOptTolerance } from './engine/vector/potraceEngine';
import { getPrintableArea } from './engine/layout/canvasLayout';
import { applyAestheticFilterToImage, DEFAULT_AESTHETIC_FILTER_STATE } from './engine/filters/filterEngine';
import { generateCalibrationPattern, extractImageDataFromImage } from './engine/source/sampleGenerator';
import { resampleWorkingImage } from './engine/working/transform';

import { CanvasViewport } from './ui/components/CanvasViewport';
import { CanvasSettingsPanel } from './ui/components/CanvasSettingsPanel';
import { ChromaControlsPanel } from './ui/components/ChromaControlsPanel';
import { ClearancePanel } from './ui/components/ClearancePanel';
import { LayerManagerPanel } from './ui/components/LayerManagerPanel';
import { AdvancedChannelWeightsPanel } from './ui/components/AdvancedChannelWeightsPanel';
import { ExportPanel } from './ui/components/ExportPanel';
import { CollapsibleSection } from './ui/components/CollapsibleSection';
import { PreferencesModal } from './ui/components/PreferencesModal';
import { CookieConsentBanner } from './ui/components/CookieConsentBanner';
import { filterBinaryMaskCanvas } from './engine/manufacturing/canvasFilter';

import {
  Scissors,
  Upload,
  Undo2,
  Redo2,
  Settings,
  Download,
  Palette,
  Sparkles,
  Sliders,
  Maximize2,
  RefreshCw,
} from 'lucide-react';

const INITIAL_CANVAS: CanvasSettings = {
  width: 8.5,
  height: 11,
  unit: 'in',
  margin: 0.25,
  orientation: 'portrait',
};

const INITIAL_PROCESSING: ChromaProcessingSettings = {
  assemblyMode: 'stacked_relief',
  colorCount: 5,
  colorBias: 0.5,
  hueWeight: 1.0,
  lightnessWeight: 1.0,
  chromaWeight: 1.0,
  chromaFloor: 0.02,
  minimumFeatureSize: 2.5,
  smoothing: 15,
  underlapBleedMm: 0.5,
  inlayToleranceMm: 0.1,
};

const ROYGBIV_COLORS = [
  '#f87171', // Red
  '#fb923c', // Orange
  '#facc15', // Yellow
  '#34d399', // Green
  '#38bdf8', // Blue
  '#818cf8', // Indigo
  '#c084fc', // Violet
];

/**
 * Custom hook providing throttled updates during rapid slider dragging (every 220ms),
 * followed by an immediate settle render when dragging finishes.
 */
function useThrottledValue<T>(value: T, intervalMs: number = 220): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastUpdatedRef = useRef<number>(Date.now());
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const now = Date.now();
    const elapsed = now - lastUpdatedRef.current;

    if (elapsed >= intervalMs) {
      lastUpdatedRef.current = now;
      setThrottledValue(value);
    } else {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        lastUpdatedRef.current = Date.now();
        setThrottledValue(value);
      }, intervalMs - elapsed);
    }

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [value, intervalMs]);

  return throttledValue;
}

export const App: React.FC = () => {
  // Random ROYGBIV accent color for "Chroma" brand title on app load
  const [chromaTitleColor] = useState(() => ROYGBIV_COLORS[Math.floor(Math.random() * ROYGBIV_COLORS.length)]);

  // Generate calibration test pattern for initial launch
  const initialPattern = useMemo(() => generateCalibrationPattern(800, 600), []);
  const initialPalette = useMemo(
    () => (initialPattern.imageData ? extractDominantPalette(initialPattern.imageData, 5) : []),
    [initialPattern]
  );

  const initialLayers: ChromaLayerState[] = useMemo(() => {
    return initialPalette.map((swatch, idx) => ({
      id: `layer-${idx + 1}`,
      order: idx,
      swatch,
      isSolidBacking: idx === 0,
      underlapBleedMm: 0.5,
      manualEdits: { bridges: [], fills: [] },
    }));
  }, [initialPalette]);

  const initialAppState: AppState = {
    sourceImage: initialPattern,
    workingImage: {
      crop: { type: 'rectangle', geometry: { x: 0, y: 0, width: 800, height: 600 } },
      position: { x: 0, y: 0 },
      scaleX: 1.0,
      scaleY: 1.0,
      rasterScaleMethod: 'nearest',
    },
    canvas: INITIAL_CANVAS,
    processing: INITIAL_PROCESSING,
    aestheticFilter: DEFAULT_AESTHETIC_FILTER_STATE,
    palette: initialPalette,
    layers: initialLayers,
    selectedLayerId: initialLayers[0]?.id || 'layer-1',
    activeTool: 'navigate',
    bridgeWidthMm: 2.0,
    output: {
      registrationMarks: false,
      exportPrefix: 'CutUp_Chroma',
    },
  };

  const [history, setHistory] = useState<HistoryState>(() => createInitialHistory(initialAppState));
  const state = history.present;
  const [activeTab, setActiveTab] = useState<PreviewTab>('composite');

  // Modals & User Preferences
  const [preferences, setPreferences] = useState<UserPreferences>(() => loadUserPreferences());
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const updatePreferences = (updater: (prev: UserPreferences) => UserPreferences) => {
    setPreferences(prev => {
      const next = updater(prev);
      saveUserPreferences(next);
      return next;
    });
  };

  // State update helper with history snapshot
  const updateState = useCallback((updater: (prev: AppState) => AppState) => {
    setHistory(current => {
      const nextPresent = updater(current.present);
      return pushHistorySnapshot(current, nextPresent);
    });
  }, []);

  const handleUndo = useCallback(() => {
    setHistory(current => undoHistory(current));
  }, []);

  const handleRedo = useCallback(() => {
    setHistory(current => redoHistory(current));
  }, []);

  // Image Upload Handler
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const imgData = extractImageDataFromImage(img, 2048);
        const extracted = extractDominantPalette(imgData, state.processing.colorCount);

        const newLayers: ChromaLayerState[] = extracted.map((swatch, idx) => ({
          id: `layer-${idx + 1}`,
          order: idx,
          swatch,
          isSolidBacking: idx === 0,
          underlapBleedMm: state.processing.underlapBleedMm,
          manualEdits: { bridges: [], fills: [] },
        }));

        const newSource: SourceImage = {
          id: `img-${Date.now()}`,
          name: file.name,
          width: imgData.width,
          height: imgData.height,
          aspectRatio: imgData.width / imgData.height,
          dataUrl,
          imageData: imgData,
        };

        // Detect orientation from image dimensions
        const isImageLandscape = imgData.width > imgData.height;
        const orientation: 'portrait' | 'landscape' = isImageLandscape ? 'landscape' : 'portrait';

        updateState(prev => {
          const canvasW = isImageLandscape
            ? Math.max(prev.canvas.width, prev.canvas.height)
            : Math.min(prev.canvas.width, prev.canvas.height);
          const canvasH = isImageLandscape
            ? Math.min(prev.canvas.width, prev.canvas.height)
            : Math.max(prev.canvas.width, prev.canvas.height);

          return {
            ...prev,
            sourceImage: newSource,
            workingImage: {
              ...prev.workingImage,
              crop: { type: 'rectangle', geometry: { x: 0, y: 0, width: imgData.width, height: imgData.height } },
              position: { x: 0, y: 0 },
              scaleX: 1.0,
              scaleY: 1.0,
            },
            canvas: {
              ...prev.canvas,
              width: canvasW,
              height: canvasH,
              orientation,
            },
            palette: extracted,
            layers: newLayers,
            selectedLayerId: newLayers[0]?.id || null,
          };
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Re-extract palette from current source image
  const handleReExtractPalette = () => {
    if (!state.sourceImage?.imageData) return;
    const extracted = extractDominantPalette(state.sourceImage.imageData, state.processing.colorCount);

    const newLayers: ChromaLayerState[] = extracted.map((swatch, idx) => ({
      id: `layer-${idx + 1}`,
      order: idx,
      swatch,
      isSolidBacking: idx === 0,
      underlapBleedMm: state.processing.underlapBleedMm,
      manualEdits: { bridges: [], fills: [] },
    }));

    updateState(prev => ({
      ...prev,
      palette: extracted,
      layers: newLayers,
      selectedLayerId: newLayers[0]?.id || null,
    }));
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (isInput) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === '1') {
        setActiveTab('source');
      } else if (e.key === '2') {
        setActiveTab('quantized');
      } else if (e.key === '3') {
        setActiveTab('layer');
      } else if (e.key === '4') {
        setActiveTab('composite');
      } else if (e.key.toLowerCase() === 'v') {
        updateState(p => ({ ...p, activeTool: 'navigate' }));
      } else if (e.key.toLowerCase() === 'w') {
        updateState(p => ({ ...p, activeTool: 'wand' }));
      } else if (e.key.toLowerCase() === 'b') {
        updateState(p => ({ ...p, activeTool: 'bridge' }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, updateState]);

  // -------------------------------------------------------------
  // Pipeline Step 1: Resample Working Image to Canvas Dimensions
  // -------------------------------------------------------------
  const resampled = useMemo(() => {
    if (!state.sourceImage) return null;
    const printable = getPrintableArea(state.canvas);
    return resampleWorkingImage(
      state.sourceImage,
      state.workingImage,
      printable.printableWidthPx,
      printable.printableHeightPx,
      printable.printableWidthPx,
      printable.printableHeightPx
    );
  }, [state.sourceImage, state.workingImage, state.canvas]);

  // -------------------------------------------------------------
  // Pipeline Step 2: Preprocess ImageData (Aesthetic Filters)
  // -------------------------------------------------------------
  const preprocessedImageData = useMemo(() => {
    if (!resampled?.imageData) return null;
    const printable = getPrintableArea(state.canvas);
    return applyAestheticFilterToImage(
      resampled.imageData,
      state.aestheticFilter,
      printable.pxPerMm,
      resampled.imageBounds
        ? {
            x: resampled.imageBounds.left,
            y: resampled.imageBounds.top,
            width: resampled.imageBounds.width,
            height: resampled.imageBounds.height,
          }
        : undefined
    );
  }, [resampled, state.aestheticFilter, state.canvas]);

  // Throttled processing settings and layers to provide 220ms mid-drag refresh and instant settle
  const throttledProcessing = useThrottledValue(state.processing, 220);
  const throttledLayers = useThrottledValue(state.layers, 220);
  const vectorCacheRef = useRef<Map<string, VectorLayerResult>>(new Map());

  // Invalidate vector cache when palette or source image changes
  useEffect(() => {
    vectorCacheRef.current.clear();
  }, [state.palette, state.sourceImage]);

  // -------------------------------------------------------------
  // Precompute OKLCH Float32Array Cache (Runs once on image load/filter change)
  // -------------------------------------------------------------
  const precomputedOklch = useMemo(() => {
    if (!preprocessedImageData) return null;
    return precomputeOklchBuffer(preprocessedImageData);
  }, [preprocessedImageData]);

  // -------------------------------------------------------------
  // Pipeline Step 3: Fast Pixel Classification (OKLab & Delta-E)
  // -------------------------------------------------------------
  const classification = useMemo(() => {
    if (!precomputedOklch || state.palette.length === 0) {
      return { layerMasks: [], quantizedImageData: null, pixelCounts: [], totalPixels: 0 };
    }

    return classifyImagePixels(precomputedOklch, state.palette, throttledProcessing);
  }, [precomputedOklch, state.palette, throttledProcessing]);

  // Calculate pixel coverage percentages
  const pixelPercentages = useMemo(() => {
    if (classification.totalPixels === 0) return [];
    return classification.pixelCounts.map(count => (count / classification.totalPixels) * 100);
  }, [classification]);

  // -------------------------------------------------------------
  // Pipeline Step 3b: Morphological Underlap Dilation (Skip if in Source tab)
  // -------------------------------------------------------------
  const { finalMasks, underlapOverlays } = useMemo(() => {
    if (activeTab === 'source') {
      return { finalMasks: [], underlapOverlays: [] };
    }
    if (classification.layerMasks.length === 0 || throttledLayers.length === 0) {
      return { finalMasks: [], underlapOverlays: [] };
    }

    const printable = getPrintableArea(state.canvas);
    return generatePhysicalLayerMasks(
      classification.layerMasks,
      throttledLayers,
      throttledProcessing.assemblyMode,
      printable.pxPerMm,
      throttledProcessing.underlapBleedMm
    );
  }, [activeTab, classification.layerMasks, throttledLayers, throttledProcessing.assemblyMode, throttledProcessing.underlapBleedMm, state.canvas]);

  // -------------------------------------------------------------
  // Pipeline Step 4: Tab-Aware, Selective & Cached Potrace Vector Tracing
  // -------------------------------------------------------------
  const vectorResults = useMemo(() => {
    const results = new Map<string, VectorLayerResult>();
    if (activeTab === 'source' || activeTab === 'quantized') {
      return results;
    }
    if (finalMasks.length === 0 || throttledLayers.length === 0) {
      return results;
    }

    const printable = getPrintableArea(state.canvas);
    const activeSelectedId = state.selectedLayerId || (throttledLayers[0] ? throttledLayers[0].id : null);

    // If in Layer View tab, prioritize computing the active selected layer
    const targetLayers = activeTab === 'layer'
      ? throttledLayers.filter(l => l.id === activeSelectedId)
      : throttledLayers;

    targetLayers.forEach((layer) => {
      const idx = throttledLayers.findIndex(l => l.id === layer.id);
      const rawMask = finalMasks[idx];
      if (!rawMask) return;

      // Cache key for vector path
      const editsHash = JSON.stringify(layer.manualEdits || {});
      const cacheKey = `${layer.id}:${rawMask.width}x${rawMask.height}:${throttledProcessing.minimumFeatureSize}:${throttledProcessing.smoothing}:${throttledProcessing.assemblyMode}:${throttledProcessing.underlapBleedMm}:${throttledProcessing.colorBias}:${throttledProcessing.hueWeight}:${throttledProcessing.lightnessWeight}:${throttledProcessing.chromaWeight}:${throttledProcessing.chromaFloor}:${editsHash}`;

      const cached = vectorCacheRef.current.get(cacheKey);
      if (cached) {
        results.set(layer.id, cached);
        return;
      }

      // 1. Hardware-accelerated morphological clearance & organic contour smoothing
      const clearedMask = filterBinaryMaskCanvas(
        rawMask,
        throttledProcessing.minimumFeatureSize,
        printable.pxPerMm,
        throttledProcessing.smoothing
      );

      // 2. Apply non-destructive manual wand/bridge edits
      const editedMask = applyManualEditsToMask(
        clearedMask,
        layer.manualEdits,
        clearedMask.width,
        clearedMask.height,
        printable.pxPerMm
      );

      const turdSize = calculateTurdSize(throttledProcessing.minimumFeatureSize, printable.pxPerMm);
      const alphaMax = calculateAlphaMax(throttledProcessing.smoothing);
      const optTol = calculateOptTolerance(throttledProcessing.smoothing);

      // 3. Tracing compound vector path
      const vec = traceBinaryMaskToSVG(editedMask, layer.id, {
        turdSize,
        alphaMax,
        optCurve: true,
        optTolerance: optTol,
        traceHolesOnly: false,
      });

      vectorCacheRef.current.set(cacheKey, vec);
      results.set(layer.id, vec);
    });

    return results;
  }, [activeTab, finalMasks, throttledLayers, state.selectedLayerId, throttledProcessing, state.canvas]);

  // Touchup tools handlers
  const handleApplyWandEdit = (layerId: string, normX: number, normY: number, fillType: 0 | 1) => {
    updateState(prev => ({
      ...prev,
      layers: prev.layers.map(l => {
        if (l.id !== layerId) return l;
        const currentFills = l.manualEdits?.fills || [];
        return {
          ...l,
          manualEdits: {
            ...l.manualEdits,
            bridges: l.manualEdits?.bridges || [],
            fills: [...currentFills, { id: `fill-${Date.now()}`, x: normX, y: normY, fillType }],
          },
        };
      }),
    }));
  };

  const handleApplyBridgeStroke = (
    layerId: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    widthMm: number
  ) => {
    updateState(prev => ({
      ...prev,
      layers: prev.layers.map(l => {
        if (l.id !== layerId) return l;
        const currentBridges = l.manualEdits?.bridges || [];
        return {
          ...l,
          manualEdits: {
            ...l.manualEdits,
            fills: l.manualEdits?.fills || [],
            bridges: [
              ...currentBridges,
              { id: `bridge-${Date.now()}`, x1, y1, x2, y2, widthMm },
            ],
          },
        };
      }),
    }));
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-moss-950 text-sand-100 overflow-hidden select-none font-sans">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={e => {
          if (e.target.files && e.target.files[0]) {
            handleImageFile(e.target.files[0]);
          }
        }}
      />

      {/* Top Application Header */}
      <header className="h-12 bg-moss-900 border-b border-sand-400/20 px-4 flex items-center justify-between shrink-0 z-30 print-hide">
        {/* Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className="p-1.5 rounded-lg border transition-colors duration-300"
              style={{
                backgroundColor: `${chromaTitleColor}20`,
                borderColor: `${chromaTitleColor}50`,
                color: chromaTitleColor,
              }}
            >
              <Scissors className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-wide text-sand-100 font-gorton">
                  CutUp{' '}
                  <span
                    style={{ color: chromaTitleColor }}
                    className="font-normal transition-colors duration-300"
                  >
                    Chroma
                  </span>
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-moss-800 text-sand-400 border border-sand-400/15">
                  V1.0
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Global Action Controls: Undo/Redo, Settings Cog, Upload Image */}
        <div className="flex items-center gap-2">
          {/* Undo / Redo */}
          <div className="flex items-center bg-moss-800/60 rounded-lg p-0.5 border border-sand-400/15">
            <button
              type="button"
              disabled={history.past.length === 0}
              onClick={handleUndo}
              className="p-1.5 rounded text-sand-300 hover:text-white hover:bg-moss-700 disabled:opacity-30 transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={history.future.length === 0}
              onClick={handleRedo}
              className="p-1.5 rounded text-sand-300 hover:text-white hover:bg-moss-700 disabled:opacity-30 transition-colors"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="w-px h-5 bg-sand-400/15 mx-0.5" />

          {/* Preferences Button */}
          <button
            type="button"
            onClick={() => setIsPreferencesOpen(true)}
            className="p-2 rounded-lg bg-moss-800/80 hover:bg-moss-700 text-sand-300 hover:text-white border border-sand-400/20 transition-colors"
            title="Workspace Preferences & Simulation"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Upload Image Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/85 hover:bg-emerald-600 text-white font-medium text-xs border border-emerald-500/30 shadow-sm transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image</span>
          </button>
        </div>
      </header>

      {/* Main Studio Workspace: Central Viewport + Unified Right Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Central Viewport with 4 Preview Tabs */}
        <main className="flex-1 flex flex-col min-w-0">
          <CanvasViewport
            activeTab={activeTab}
            onTabChange={setActiveTab}
            sourceImage={state.sourceImage}
            quantizedImageData={classification.quantizedImageData}
            layers={state.layers}
            selectedLayerId={state.selectedLayerId}
            vectorResults={vectorResults}
            underlapOverlays={underlapOverlays}
            canvas={state.canvas}
            preferences={preferences}
            activeTool={state.activeTool}
            onToolChange={tool => updateState(prev => ({ ...prev, activeTool: tool }))}
            bridgeWidthMm={state.bridgeWidthMm}
            onApplyWandEdit={handleApplyWandEdit}
            onApplyBridgeStroke={handleApplyBridgeStroke}
          />
        </main>

        {/* Right Sidebar: All Tools Unified (+20% Wider: w-88 / 350px) */}
        <aside className="w-88 sm:w-[350px] bg-moss-900/95 border-l border-sand-400/15 flex flex-col shrink-0 overflow-y-auto p-3.5 space-y-3.5 print-hide">
          {/* 1. Clearance and Filters Section (Collapsed on load) */}
          <ClearancePanel
            settings={state.processing}
            onChange={updater => updateState(prev => ({ ...prev, processing: updater(prev.processing) }))}
            aestheticFilter={state.aestheticFilter}
            onAestheticFilterChange={updater =>
              updateState(prev => ({
                ...prev,
                aestheticFilter: updater(prev.aestheticFilter),
              }))
            }
            defaultOpen={false}
          />

          {/* 2. Canvas & Material Sizing Section (Directly below Clearance, closed on load) */}
          <CollapsibleSection
            title="Canvas & Material Sizing"
            icon={<Maximize2 className="w-3.5 h-3.5 text-sand-400" />}
            defaultExpanded={false}
          >
            <CanvasSettingsPanel
              canvas={state.canvas}
              onChange={updater => updateState(prev => ({ ...prev, canvas: updater(prev.canvas) }))}
            />
          </CollapsibleSection>

          {/* 3. Chroma Separation & Tolerances (Below Canvas Sizing, default open on load) */}
          <CollapsibleSection
            title="Chroma Separation & Tolerances"
            icon={<Sliders className="w-3.5 h-3.5 text-sand-400" />}
            badge={`${state.processing.colorCount} Colors`}
            defaultExpanded={true}
          >
            <ChromaControlsPanel
              settings={state.processing}
              onChange={updater => {
                const nextSettings = updater(state.processing);
                if (nextSettings.colorCount !== state.processing.colorCount && state.sourceImage?.imageData) {
                  const newPalette = extractDominantPalette(state.sourceImage.imageData, nextSettings.colorCount);
                  const newLayers: ChromaLayerState[] = newPalette.map((swatch, idx) => ({
                    id: `layer-${idx + 1}`,
                    order: idx,
                    swatch,
                    isSolidBacking: idx === 0,
                    underlapBleedMm: nextSettings.underlapBleedMm,
                    manualEdits: { bridges: [], fills: [] },
                  }));

                  updateState(prev => ({
                    ...prev,
                    processing: nextSettings,
                    palette: newPalette,
                    layers: newLayers,
                    selectedLayerId: newLayers[0]?.id || null,
                  }));
                } else {
                  updateState(prev => ({ ...prev, processing: nextSettings }));
                }
              }}
              onReExtractPalette={handleReExtractPalette}
            />
          </CollapsibleSection>

          {/* 4. Physical Color Sheets Section */}
          <CollapsibleSection
            title="Physical Color Sheets"
            icon={<Palette className="w-3.5 h-3.5 text-sand-400" />}
            badge={`${state.layers.length}`}
            defaultExpanded={true}
          >
            <LayerManagerPanel
              layers={state.layers}
              selectedLayerId={state.selectedLayerId}
              onSelectLayer={id => updateState(prev => ({ ...prev, selectedLayerId: id }))}
              onUpdateLayer={(id, updater) =>
                updateState(prev => ({
                  ...prev,
                  layers: prev.layers.map(l => (l.id === id ? updater(l) : l)),
                }))
              }
              onReorderLayers={newLayers => updateState(prev => ({ ...prev, layers: newLayers }))}
              vectorResults={vectorResults}
              pixelPercentages={pixelPercentages}
            />
          </CollapsibleSection>

          {/* 5. Advanced Channel Weights Section (Below Layers, closed on load) */}
          <CollapsibleSection
            title="Advanced Channel Weights"
            icon={<Sliders className="w-3.5 h-3.5 text-sand-400" />}
            defaultExpanded={false}
          >
            <AdvancedChannelWeightsPanel
              settings={state.processing}
              onChange={updater => updateState(prev => ({ ...prev, processing: updater(prev.processing) }))}
            />
          </CollapsibleSection>

          {/* 6. Export & Print Section */}
          <ExportPanel
            layers={state.layers}
            vectorResults={vectorResults}
            canvas={state.canvas}
            output={state.output}
            onUpdateState={updateState}
          />
        </aside>
      </div>

      {/* Preferences Modal */}
      <PreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
        preferences={preferences}
        onUpdate={updatePreferences}
      />

      {/* Cookie Consent Banner */}
      {!preferences.cookieConsentAccepted && (
        <CookieConsentBanner
          onAccept={() => updatePreferences(p => ({ ...p, cookieConsentAccepted: true }))}
          onDecline={() => updatePreferences(p => ({ ...p, cookieConsentAccepted: false }))}
        />
      )}
    </div>
  );
};
