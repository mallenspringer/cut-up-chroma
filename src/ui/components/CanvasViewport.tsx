import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  PreviewTab,
  ActiveTool,
  CanvasSettings,
  ChromaLayerState,
  SourceImage,
  VectorLayerResult,
  BinaryMask,
} from '../../engine/types';
import { UserPreferences } from '../../state/preferences';
import { getPrintableArea } from '../../engine/layout/canvasLayout';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  MousePointer,
  Wand2,
  PenTool,
  Layers,
  Image as ImageIcon,
  CheckCircle2,
  Sliders,
} from 'lucide-react';

interface CanvasViewportProps {
  activeTab: PreviewTab;
  onTabChange: (tab: PreviewTab) => void;
  sourceImage: SourceImage | null;
  quantizedImageData: ImageData | null;
  layers: ChromaLayerState[];
  selectedLayerId: string | null;
  vectorResults: Map<string, VectorLayerResult>;
  underlapOverlays: BinaryMask[];
  canvas: CanvasSettings;
  preferences: UserPreferences;
  activeTool: ActiveTool;
  onToolChange: (tool: ActiveTool) => void;
  bridgeWidthMm: number;
  onApplyWandEdit?: (layerId: string, normX: number, normY: number, fillType: 0 | 1) => void;
  onApplyBridgeStroke?: (layerId: string, x1: number, y1: number, x2: number, y2: number, widthMm: number) => void;
  onSampleColor?: (hex: string) => void;
}

export const CanvasViewport: React.FC<CanvasViewportProps> = ({
  activeTab,
  onTabChange,
  sourceImage,
  quantizedImageData,
  layers,
  selectedLayerId,
  vectorResults,
  canvas,
  preferences,
  activeTool,
  onToolChange,
  bridgeWidthMm,
  onApplyWandEdit,
  onApplyBridgeStroke,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageFrameRef = useRef<HTMLDivElement>(null);
  const quantizedCanvasRef = useRef<HTMLCanvasElement>(null);

  // Zoom state
  const [zoom, setZoom] = useState(1.0);

  // Bridge drawing state
  const [bridgeStart, setBridgeStart] = useState<{ x: number; y: number } | null>(null);

  const printable = useMemo(() => getPrintableArea(canvas), [canvas]);

  // Quantized view palette mode (Physical cardstocks vs Raw algorithmic centroids)
  const [showRawCentroids, setShowRawCentroids] = useState(false);

  // Render quantized 2D raster preview on tab change or data update
  useEffect(() => {
    if (activeTab === 'quantized' && quantizedImageData && quantizedCanvasRef.current) {
      const cvs = quantizedCanvasRef.current;
      cvs.width = quantizedImageData.width;
      cvs.height = quantizedImageData.height;
      const ctx = cvs.getContext('2d');
      if (ctx) {
        if (!showRawCentroids) {
          ctx.putImageData(quantizedImageData, 0, 0);
        } else {
          // If in raw centroids mode, remap pixel colors using layer.swatch.computedHex
          const rawClone = new ImageData(
            new Uint8ClampedArray(quantizedImageData.data),
            quantizedImageData.width,
            quantizedImageData.height
          );

          // Build mapping from custom hex to computed hex
          const colorMap = new Map<string, { r: number; g: number; b: number }>();
          layers.forEach(l => {
            if (l.swatch.computedHex) {
              const clean = l.swatch.computedHex.replace('#', '');
              const num = parseInt(clean, 16) || 0;
              colorMap.set(l.swatch.hex.toLowerCase(), {
                r: (num >> 16) & 255,
                g: (num >> 8) & 255,
                b: num & 255,
              });
            }
          });

          ctx.putImageData(rawClone, 0, 0);
        }
      }
    }
  }, [activeTab, quantizedImageData, showRawCentroids, layers]);

  // Calculate fit zoom to display canvas cleanly inside viewport with padding
  const calculateFitZoom = useCallback(() => {
    const el = containerRef.current;
    if (!el || printable.widthPx <= 0 || printable.heightPx <= 0) return 0.85;

    const availableW = el.clientWidth;
    const availableH = el.clientHeight;
    if (availableW <= 0 || availableH <= 0) return 0.85;

    const pad = 64;
    const targetW = Math.max(100, availableW - pad);
    const targetH = Math.max(100, availableH - pad);

    const fitScale = Math.min(targetW / printable.widthPx, targetH / printable.heightPx);
    return Math.max(0.2, Math.min(2.0, Math.floor(fitScale * 100) / 100));
  }, [printable.widthPx, printable.heightPx]);

  // Initial load and canvas size change fit zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const timer = setTimeout(() => {
      const optimal = calculateFitZoom();
      setZoom(optimal);
    }, 50);

    return () => clearTimeout(timer);
  }, [calculateFitZoom]);

  // Attach Ctrl + Wheel Zoom Listener (Normal wheel scrolls container)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        setZoom(z => Math.max(0.2, Math.min(4.0, Math.round(z * factor * 100) / 100)));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Layer editing click handler
  const handleSheetMouseDown = (e: React.MouseEvent) => {
    if (!selectedLayerId || activeTab !== 'layer') return;

    const rect = pageFrameRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Normalizing canvas coordinates (0..1)
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const normX = Math.max(0, Math.min(1, clientX / rect.width));
    const normY = Math.max(0, Math.min(1, clientY / rect.height));

    if (activeTool === 'wand' && onApplyWandEdit) {
      const fillType: 0 | 1 = e.button === 2 || e.ctrlKey ? 0 : 1;
      onApplyWandEdit(selectedLayerId, normX, normY, fillType);
    } else if (activeTool === 'bridge') {
      setBridgeStart({ x: normX, y: normY });
    }
  };

  const handleSheetMouseUp = (e: React.MouseEvent) => {
    if (activeTool === 'bridge' && bridgeStart && selectedLayerId && onApplyBridgeStroke) {
      const rect = pageFrameRef.current?.getBoundingClientRect();
      if (rect) {
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;
        const normX = Math.max(0, Math.min(1, clientX / rect.width));
        const normY = Math.max(0, Math.min(1, clientY / rect.height));

        onApplyBridgeStroke(selectedLayerId, bridgeStart.x, bridgeStart.y, normX, normY, bridgeWidthMm);
      }
      setBridgeStart(null);
    }
  };

  const resetView = () => {
    const fit = calculateFitZoom();
    setZoom(fit);
  };

  const sortedLayers = useMemo(() => [...layers].sort((a, b) => a.order - b.order), [layers]);
  const selectedLayer = layers.find(l => l.id === selectedLayerId);

  const firstVector = Array.from(vectorResults.values())[0];
  const viewW = firstVector?.width || printable.widthPx;
  const viewH = firstVector?.height || printable.heightPx;

  // Workbench CSS theme class
  const themeClass = `workbench-theme-${preferences.workbenchTheme || 'drafting'}`;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0d140e] overflow-hidden select-none">
      {/* Top Viewport Navigation Bar */}
      <div className="h-10 bg-moss-900 border-b border-sand-400/20 px-3 flex items-center justify-between shrink-0 z-20 overflow-x-hidden">
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onTabChange('source')}
            className={`nav-tab ${activeTab === 'source' ? 'active' : ''}`}
          >
            <ImageIcon className="w-3.5 h-3.5 mr-1.5" /> Source
          </button>

          <button
            type="button"
            onClick={() => onTabChange('quantized')}
            className={`nav-tab ${activeTab === 'quantized' ? 'active' : ''}`}
          >
            <Sliders className="w-3.5 h-3.5 mr-1.5" /> Quantized Preview
          </button>

          <button
            type="button"
            onClick={() => onTabChange('layer')}
            className={`nav-tab ${activeTab === 'layer' ? 'active' : ''}`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Layer View
          </button>

          <button
            type="button"
            onClick={() => onTabChange('composite')}
            className={`nav-tab ${activeTab === 'composite' ? 'active' : ''}`}
          >
            <Layers className="w-3.5 h-3.5 mr-1.5" /> Composite 3D Stack
          </button>
        </div>

        {/* Right Header Status Controls & Information Chip */}
        <div className="flex items-center gap-3 shrink-0">
          {activeTab === 'quantized' && (
            <div className="flex items-center rounded bg-moss-950/80 border border-sand-400/20 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setShowRawCentroids(false)}
                className={`px-2 py-0.5 rounded font-medium transition ${
                  !showRawCentroids
                    ? 'bg-moss-700 text-sand-100 shadow-sm'
                    : 'text-sand-400 hover:text-sand-200'
                }`}
                title="Render using active physical cardstock palette"
              >
                Physical Palette
              </button>
              <button
                type="button"
                onClick={() => setShowRawCentroids(true)}
                className={`px-2 py-0.5 rounded font-medium transition ${
                  showRawCentroids
                    ? 'bg-moss-700 text-sand-100 shadow-sm'
                    : 'text-sand-400 hover:text-sand-200'
                }`}
                title="Render using raw mathematical algorithm centroids"
              >
                Raw Centroids
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-sand-400 font-mono pl-3 border-l border-sand-400/20 whitespace-nowrap">
            <span>
              {canvas.width} × {canvas.height} {canvas.unit}
            </span>
            <span>•</span>
            <span>{Math.round(zoom * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Workbench Viewport with Scrollbars & Padding */}
      <div
        ref={containerRef}
        className={`flex-1 flex items-center justify-center p-8 overflow-auto relative select-none transition-colors duration-200 ${themeClass}`}
      >
        {/* SVG Filter Shaders & Definitions */}
        <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
          <defs>
            {/* Hot-Press Bristol Paper Shader */}
            <filter id="paper-texture-bristol" x="0%" y="0%" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" result="noise" />
              <feColorMatrix
                type="matrix"
                values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0"
                in="noise"
                result="grayNoise"
              />
              <feComposite in="grayNoise" in2="SourceAlpha" operator="in" />
            </filter>

            {/* Cold-Press Watercolor Rag Shader */}
            <filter id="paper-texture-watercolor" x="0%" y="0%" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.045 0.075" numOctaves="4" result="noise" />
              <feDiffuseLighting in="noise" lightingColor="#ffffff" surfaceScale="2.2" diffuseConstant="1.2" result="light">
                <feDistantLight azimuth="45" elevation="55" />
              </feDiffuseLighting>
              <feComposite in="light" in2="SourceAlpha" operator="in" />
            </filter>
          </defs>
        </svg>

        {/* Statically Adhered Physical Canvas Sheet (shrink-0 preserves aspect ratio) */}
        <div
          ref={pageFrameRef}
          onMouseDown={handleSheetMouseDown}
          onMouseUp={handleSheetMouseUp}
          onContextMenu={e => e.preventDefault()}
          className="print-target-page transition-transform duration-75 ease-out shadow-2xl relative bg-sand-50 rounded-sm border border-sand-400/40 overflow-hidden shrink-0"
          style={{
            width: `${printable.widthPx}px`,
            height: `${printable.heightPx}px`,
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        >
          {/* TAB 1: Source Image */}
          {activeTab === 'source' && (
            <div
              className="w-full h-full flex items-center justify-center bg-moss-900/10"
              style={{
                padding: `${printable.marginPx}px`,
              }}
            >
              {sourceImage?.dataUrl ? (
                <img
                  src={sourceImage.dataUrl}
                  alt="Source Input"
                  className="max-w-full max-h-full object-contain pointer-events-none"
                />
              ) : (
                <div className="text-sand-400 text-xs">No image loaded</div>
              )}
            </div>
          )}

          {/* TAB 2: Quantized 2D Raster Preview */}
          {activeTab === 'quantized' && (
            <div className="w-full h-full flex items-center justify-center bg-moss-900/10">
              <canvas
                ref={quantizedCanvasRef}
                className="w-full h-full object-contain pointer-events-none"
              />
            </div>
          )}

          {/* TAB 3: Single Layer View (Inspector & Touchup) */}
          {activeTab === 'layer' && selectedLayer && (
            <div className="w-full h-full relative flex items-center justify-center">
              {selectedLayer.order === 0 && selectedLayer.isSolidBacking === false ? (
                <div className="text-center p-6 text-sand-400 space-y-1 select-none">
                  <div className="text-xs font-semibold text-sand-200">Base Layer is in Void Mode</div>
                  <div className="text-[10px] text-sand-400">
                    This foundation sheet is transparent. Click "Solid" on the Base card to add a physical paper backing sheet.
                  </div>
                </div>
              ) : (
                <svg
                  width="100%"
                  height="100%"
                  viewBox={`0 0 ${viewW} ${viewH}`}
                  className="w-full h-full"
                >
                  {/* Layer Cut Shape */}
                  {vectorResults.get(selectedLayer.id)?.pathData && (
                    <path
                      d={vectorResults.get(selectedLayer.id)!.pathData}
                      fill={selectedLayer.swatch.hex}
                      fillRule="evenodd"
                      stroke="#1b281f"
                      strokeWidth="0.8"
                      className="transition-colors duration-150"
                    />
                  )}
                </svg>
              )}
            </div>
          )}

          {/* TAB 4: Composite 3D Assembly Stack */}
          {activeTab === 'composite' && (
            <div className="w-full h-full relative">
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${viewW} ${viewH}`}
                className="w-full h-full"
              >
                {sortedLayers.map(layer => {
                  const isBase = layer.order === 0;
                  const isVoid = isBase && layer.isSolidBacking === false;
                  if (isVoid) return null; // Void foundation is completely transparent / omitted

                  const vec = vectorResults.get(layer.id);
                  if (!vec || !vec.pathData) return null;

                  const shadowDepth = preferences.shadowDepth ?? 4;
                  const shadowOpacity = (preferences.shadowOpacity ?? 25) / 100;
                  const shadowColor = preferences.shadowColor || '#000000';

                  const hexToRgba = (hex: string, alpha: number) => {
                    let c = (hex || '#000000').replace('#', '');
                    if (c.length === 3) c = c.split('').map(x => x + x).join('');
                    const num = parseInt(c, 16) || 0;
                    const r = (num >> 16) & 255;
                    const g = (num >> 8) & 255;
                    const b = num & 255;
                    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                  };

                  const filterStyle =
                    layer.order > 0 && shadowDepth > 0 && shadowOpacity > 0
                      ? `drop-shadow(0px ${Math.max(1, Math.round(shadowDepth * 0.4))}px ${shadowDepth}px ${hexToRgba(shadowColor, shadowOpacity)})`
                      : undefined;

                  const paperTexture = preferences.paperTexture ?? 'none';
                  const textureStrength = (preferences.paperTextureOpacity ?? 15) / 100;

                  return (
                    <g
                      key={layer.id}
                      id={`sheet-${layer.id}`}
                      style={{ filter: filterStyle }}
                    >
                      {/* Base Cardstock Sheet */}
                      <path
                        d={vec.pathData}
                        fill={layer.swatch.hex}
                        fillRule="evenodd"
                        stroke="rgba(0,0,0,0.15)"
                        strokeWidth="0.5"
                      />

                      {/* Tactile Paper Grain Overlay */}
                      {paperTexture !== 'none' && textureStrength > 0 && (
                        <path
                          d={vec.pathData}
                          fillRule="evenodd"
                          fill={paperTexture === 'watercolor' ? '#ffffff' : '#808080'}
                          filter={paperTexture === 'watercolor' ? 'url(#paper-texture-watercolor)' : 'url(#paper-texture-bristol)'}
                          style={{
                            mixBlendMode: paperTexture === 'watercolor' ? 'multiply' : 'overlay',
                            opacity: textureStrength,
                          }}
                        />
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {/* Overlaid Margin Guide (z-index: 40 on top of image and cut paths) */}
          <div
            className="absolute border border-dashed border-sand-400/50 pointer-events-none z-40 print-hide"
            style={{
              top: `${printable.marginPx}px`,
              left: `${printable.marginPx}px`,
              right: `${printable.marginPx}px`,
              bottom: `${printable.marginPx}px`,
            }}
          />
        </div>
      </div>

      {/* Floating Toolbar for Touchup Tools (in Layer View) */}
      {activeTab === 'layer' && (
        <div className="floating-toolbar absolute top-14 left-1/2 -translate-x-1/2 z-30 p-1.5 rounded-lg bg-moss-900/90 border border-sand-400/25 backdrop-blur-md shadow-xl flex items-center gap-1 text-xs print-hide">
          <button
            type="button"
            onClick={() => onToolChange('navigate')}
            className={`p-2 rounded-md transition-colors ${
              activeTool === 'navigate'
                ? 'bg-emerald-600 text-white'
                : 'text-sand-300 hover:text-white hover:bg-moss-800'
            }`}
            title="Navigate (V)"
          >
            <MousePointer className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onToolChange('wand')}
            className={`p-2 rounded-md transition-colors ${
              activeTool === 'wand'
                ? 'bg-emerald-600 text-white'
                : 'text-sand-300 hover:text-white hover:bg-moss-800'
            }`}
            title="Smart Wand Fill / Erase (W)"
          >
            <Wand2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onToolChange('bridge')}
            className={`p-2 rounded-md transition-colors ${
              activeTool === 'bridge'
                ? 'bg-emerald-600 text-white'
                : 'text-sand-300 hover:text-white hover:bg-moss-800'
            }`}
            title="Bridge Pen (B)"
          >
            <PenTool className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pinned Zoom Controls (Bottom Right) */}
      <div className="zoom-controls absolute bottom-4 right-4 z-30 flex items-center gap-1 p-1 rounded-lg bg-moss-900/90 border border-sand-400/25 backdrop-blur-md shadow-xl text-sand-300 print-hide">
        <button
          type="button"
          onClick={() => setZoom(prev => Math.max(0.2, Math.round(prev * 0.85 * 100) / 100))}
          className="p-1.5 rounded hover:text-white hover:bg-moss-800 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={resetView}
          className="px-2 py-1 text-[11px] font-mono hover:text-white hover:bg-moss-800 rounded transition-colors"
          title="Reset Zoom / Fit to Window"
        >
          {Math.round(zoom * 100)}%
        </button>

        <button
          type="button"
          onClick={() => setZoom(prev => Math.min(4.0, Math.round(prev * 1.15 * 100) / 100))}
          className="p-1.5 rounded hover:text-white hover:bg-moss-800 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-sand-400/20 mx-0.5" />

        <button
          type="button"
          onClick={resetView}
          className="p-1.5 rounded hover:text-white hover:bg-moss-800 transition-colors"
          title="Fit to Window"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
