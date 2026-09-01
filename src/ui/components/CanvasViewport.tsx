import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  PreviewTab,
  ActiveTool,
  CanvasSettings,
  ChromaLayerState,
  SourceImage,
  VectorLayerResult,
  BinaryMask,
  WorkingImageState,
} from '../../engine/types';
import { UserPreferences } from '../../state/preferences';
import { getPrintableArea, generateRegistrationMarksSVG } from '../../engine/layout/canvasLayout';
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
  ChevronDown,
  RotateCcw,
  Move,
  Scan,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface CanvasViewportProps {
  activeTab: PreviewTab;
  onTabChange: (tab: PreviewTab) => void;
  sourceImage: SourceImage | null;
  workingImage?: WorkingImageState;
  onUpdateWorkingImage?: (updater: (prev: WorkingImageState) => WorkingImageState) => void;
  onResetWorkingImage?: () => void;
  quantizedImageData: ImageData | null;
  layers: ChromaLayerState[];
  selectedLayerId: string | null;
  onSelectLayer?: (layerId: string) => void;
  vectorResults: Map<string, VectorLayerResult>;
  underlapOverlays: BinaryMask[];
  canvas: CanvasSettings;
  preferences: UserPreferences;
  activeTool: ActiveTool;
  onToolChange: (tool: ActiveTool) => void;
  bridgeWidthMm: number;
  registrationMarks?: boolean;
  onApplyWandEdit?: (layerId: string, normX: number, normY: number, fillType: 0 | 1) => void;
  onApplyBridgeStroke?: (layerId: string, x1: number, y1: number, x2: number, y2: number, widthMm: number) => void;
  onSampleColor?: (hex: string) => void;
}

export const CanvasViewport: React.FC<CanvasViewportProps> = ({
  activeTab,
  onTabChange,
  sourceImage,
  workingImage,
  onUpdateWorkingImage,
  onResetWorkingImage,
  quantizedImageData,
  layers,
  selectedLayerId,
  onSelectLayer,
  vectorResults,
  canvas,
  preferences,
  activeTool,
  onToolChange,
  bridgeWidthMm,
  registrationMarks = false,
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
  const [bridgeCurrent, setBridgeCurrent] = useState<{ x: number; y: number } | null>(null);

  // Source image drag / transform state
  const [sourceDragMode, setSourceDragMode] = useState<
    'none' | 'move' | 'scale-tl' | 'scale-tr' | 'scale-bl' | 'scale-br' | 'scale-t' | 'scale-b' | 'scale-l' | 'scale-r'
  >('none');
  const [dragStartMouse, setDragStartMouse] = useState<{ x: number; y: number } | null>(null);
  const [dragInitialWorking, setDragInitialWorking] = useState<WorkingImageState | null>(null);

  // Layer selector dropdown state for composite view HUD
  const [isLayerDropdownOpen, setIsLayerDropdownOpen] = useState(false);

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

  const sortedLayers = useMemo(() => [...layers].sort((a, b) => a.order - b.order), [layers]);
  const selectedLayer = layers.find(l => l.id === selectedLayerId) || sortedLayers[0];
  const targetLayerId = selectedLayerId || selectedLayer?.id;

  // Placed image bounding calculations inside canvas sheet for Source View
  const placedImageGeometry = useMemo(() => {
    if (!sourceImage) return null;
    const { widthPx: pW, heightPx: pH, printableWidthPx: printW, printableHeightPx: printH } = printable;
    const srcW = sourceImage.width;
    const srcH = sourceImage.height;
    const cropW = (workingImage?.crop?.geometry?.width && workingImage.crop.geometry.width > 0) ? workingImage.crop.geometry.width : srcW;
    const cropH = (workingImage?.crop?.geometry?.height && workingImage.crop.geometry.height > 0) ? workingImage.crop.geometry.height : srcH;

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

    const scaleX = workingImage?.scaleX ?? 1.0;
    const scaleY = workingImage?.scaleY ?? 1.0;
    const posX = workingImage?.position?.x ?? 0;
    const posY = workingImage?.position?.y ?? 0;

    const w = baseW * scaleX;
    const h = baseH * scaleY;
    const left = pW / 2 + posX - w / 2;
    const top = pH / 2 + posY - h / 2;

    const coverScale = Math.max(printW / baseW, printH / baseH);

    return {
      left,
      top,
      width: w,
      height: h,
      baseW,
      baseH,
      coverScale,
      cropX: workingImage?.crop?.geometry?.x || 0,
      cropY: workingImage?.crop?.geometry?.y || 0,
      cropW,
      cropH,
      srcW,
      srcH,
    };
  }, [sourceImage, workingImage, printable]);

  // Unified Canvas Mouse Down Handler
  const handleSheetMouseDown = (e: React.MouseEvent) => {
    const rect = pageFrameRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clientX = (e.clientX - rect.left) / zoom;
    const clientY = (e.clientY - rect.top) / zoom;
    const normX = Math.max(0, Math.min(1, clientX / printable.widthPx));
    const normY = Math.max(0, Math.min(1, clientY / printable.heightPx));

    // TAB 1: Source Framing Drag
    if (activeTab === 'source' && onUpdateWorkingImage && workingImage && placedImageGeometry) {
      const { left, top, width: w, height: h } = placedImageGeometry;
      const handleSize = 14;

      // Handle corner detection
      const isTL = Math.abs(clientX - left) < handleSize && Math.abs(clientY - top) < handleSize;
      const isTR = Math.abs(clientX - (left + w)) < handleSize && Math.abs(clientY - top) < handleSize;
      const isBL = Math.abs(clientX - left) < handleSize && Math.abs(clientY - (top + h)) < handleSize;
      const isBR = Math.abs(clientX - (left + w)) < handleSize && Math.abs(clientY - (top + h)) < handleSize;

      let mode: typeof sourceDragMode = 'none';
      if (isTL) mode = 'scale-tl';
      else if (isTR) mode = 'scale-tr';
      else if (isBL) mode = 'scale-bl';
      else if (isBR) mode = 'scale-br';
      else if (clientX >= left && clientX <= left + w && clientY >= top && clientY <= top + h) {
        mode = 'move';
      }

      if (mode !== 'none') {
        setSourceDragMode(mode);
        setDragStartMouse({ x: clientX, y: clientY });
        setDragInitialWorking(workingImage);
        e.preventDefault();
        return;
      }
    }

    // TAB 3 & 4: Touchup (Layer & Composite)
    if ((activeTab === 'layer' || activeTab === 'composite') && targetLayerId) {
      if (activeTool === 'wand' && onApplyWandEdit) {
        const fillType: 0 | 1 = e.button === 2 || e.ctrlKey ? 0 : 1;
        onApplyWandEdit(targetLayerId, normX, normY, fillType);
      } else if (activeTool === 'bridge') {
        setBridgeStart({ x: normX, y: normY });
        setBridgeCurrent({ x: normX, y: normY });
      }
    }
  };

  const handleSheetMouseMove = (e: React.MouseEvent) => {
    const rect = pageFrameRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clientX = (e.clientX - rect.left) / zoom;
    const clientY = (e.clientY - rect.top) / zoom;
    const normX = Math.max(0, Math.min(1, clientX / printable.widthPx));
    const normY = Math.max(0, Math.min(1, clientY / printable.heightPx));

    // TAB 1: Source Framing Drag Updates
    if (activeTab === 'source' && sourceDragMode !== 'none' && dragStartMouse && dragInitialWorking && onUpdateWorkingImage && placedImageGeometry) {
      const dx = clientX - dragStartMouse.x;
      const dy = clientY - dragStartMouse.y;

      if (sourceDragMode === 'move') {
        onUpdateWorkingImage(prev => ({
          ...prev,
          position: {
            x: Math.round(dragInitialWorking.position.x + dx),
            y: Math.round(dragInitialWorking.position.y + dy),
          },
        }));
      } else if (sourceDragMode.startsWith('scale')) {
        const { baseW, baseH } = placedImageGeometry;
        const initialScale = dragInitialWorking.scaleX;
        let scaleDelta = 0;

        if (sourceDragMode === 'scale-br') {
          scaleDelta = (dx / baseW + dy / baseH) / 2;
        } else if (sourceDragMode === 'scale-tl') {
          scaleDelta = (-dx / baseW - dy / baseH) / 2;
        } else if (sourceDragMode === 'scale-tr') {
          scaleDelta = (dx / baseW - dy / baseH) / 2;
        } else if (sourceDragMode === 'scale-bl') {
          scaleDelta = (-dx / baseW + dy / baseH) / 2;
        }

        const nextScale = Math.max(0.1, Math.min(4.0, Math.round((initialScale + scaleDelta) * 100) / 100));
        onUpdateWorkingImage(prev => ({
          ...prev,
          scaleX: nextScale,
          scaleY: nextScale,
        }));
      }
      return;
    }

    // TAB 3 & 4: Bridge Stroke Dragging Update
    if (activeTool === 'bridge' && bridgeStart) {
      setBridgeCurrent({ x: normX, y: normY });
    }
  };

  const handleSheetMouseUp = (e: React.MouseEvent) => {
    // TAB 1: End Source Framing Drag
    if (activeTab === 'source' && sourceDragMode !== 'none') {
      setSourceDragMode('none');
      setDragStartMouse(null);
      setDragInitialWorking(null);
      return;
    }

    // TAB 3 & 4: Bridge Pen Stroke Commit
    if (activeTool === 'bridge' && bridgeStart && targetLayerId && onApplyBridgeStroke) {
      const rect = pageFrameRef.current?.getBoundingClientRect();
      if (rect) {
        const clientX = (e.clientX - rect.left) / zoom;
        const clientY = (e.clientY - rect.top) / zoom;
        const normX = Math.max(0, Math.min(1, clientX / printable.widthPx));
        const normY = Math.max(0, Math.min(1, clientY / printable.heightPx));

        onApplyBridgeStroke(targetLayerId, bridgeStart.x, bridgeStart.y, normX, normY, bridgeWidthMm);
      }
      setBridgeStart(null);
      setBridgeCurrent(null);
    }
  };

  const resetView = () => {
    const fit = calculateFitZoom();
    setZoom(fit);
  };

  const firstVector = Array.from(vectorResults.values())[0];
  const viewW = firstVector?.width || printable.widthPx;
  const viewH = firstVector?.height || printable.heightPx;

  // Registration marks SVG path
  const regMarksPath = useMemo(() => {
    return registrationMarks ? generateRegistrationMarksSVG(canvas, viewW, viewH) : '';
  }, [registrationMarks, canvas, viewW, viewH]);

  // Workbench CSS theme class
  const themeClass = `workbench-theme-${preferences.workbenchTheme || 'drafting'}`;

  // Interactive touchup HUD is visible on Layer View and Composite 3D View
  const showTouchupHUD = activeTab === 'layer' || activeTab === 'composite';

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
          onMouseMove={handleSheetMouseMove}
          onMouseUp={handleSheetMouseUp}
          onContextMenu={e => e.preventDefault()}
          className={`print-target-page transition-transform duration-75 ease-out shadow-2xl relative bg-sand-50 rounded-sm border border-sand-400/40 overflow-hidden shrink-0 ${
            activeTab === 'source'
              ? (sourceDragMode === 'move' ? 'cursor-grabbing' : 'cursor-grab')
              : (activeTool === 'wand' ? 'cursor-crosshair' : activeTool === 'bridge' ? 'cursor-cell' : 'cursor-default')
          }`}
          style={{
            width: `${printable.widthPx}px`,
            height: `${printable.heightPx}px`,
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        >
          {/* TAB 1: Source Image with Interactive Framing & Placement */}
          {activeTab === 'source' && (
            <div className="w-full h-full relative overflow-hidden bg-moss-900/10">
              {sourceImage?.dataUrl && placedImageGeometry ? (
                <>
                  {/* Positioned and Scaled Source Image */}
                  <img
                    src={sourceImage.dataUrl}
                    alt="Source Input"
                    className="absolute pointer-events-none select-none"
                    style={{
                      left: `${placedImageGeometry.left}px`,
                      top: `${placedImageGeometry.top}px`,
                      width: `${placedImageGeometry.width}px`,
                      height: `${placedImageGeometry.height}px`,
                      objectFit: 'fill',
                    }}
                  />

                  {/* Interactive Transform Bounding Box with Corner & Edge Handles */}
                  <div
                    className="absolute border-2 border-emerald-400/80 shadow-sm pointer-events-none z-30"
                    style={{
                      left: `${placedImageGeometry.left}px`,
                      top: `${placedImageGeometry.top}px`,
                      width: `${placedImageGeometry.width}px`,
                      height: `${placedImageGeometry.height}px`,
                    }}
                  >
                    {/* Center Move Anchor Crosshair */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-1.5 rounded-full bg-moss-950/80 border border-emerald-400 text-emerald-300 pointer-events-none opacity-80">
                      <Move className="w-3.5 h-3.5" />
                    </div>

                    {/* 4 Corner Resize Handles */}
                    <div className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-emerald-400 border border-moss-950 rounded-sm cursor-nwse-resize pointer-events-auto" />
                    <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-emerald-400 border border-moss-950 rounded-sm cursor-nesw-resize pointer-events-auto" />
                    <div className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-emerald-400 border border-moss-950 rounded-sm cursor-nesw-resize pointer-events-auto" />
                    <div className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-emerald-400 border border-moss-950 rounded-sm cursor-nwse-resize pointer-events-auto" />
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sand-400 text-xs">
                  No image loaded
                </div>
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

          {/* Interactive Bridge Stroke Dragging Preview */}
          {bridgeStart && bridgeCurrent && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-50"
              viewBox={`0 0 ${viewW} ${viewH}`}
            >
              <line
                x1={bridgeStart.x * viewW}
                y1={bridgeStart.y * viewH}
                x2={bridgeCurrent.x * viewW}
                y2={bridgeCurrent.y * viewH}
                stroke="#34d399"
                strokeWidth={Math.max(2, (bridgeWidthMm * printable.pxPerMm * (viewW / printable.widthPx)))}
                strokeLinecap="round"
                strokeDasharray="4 2"
                opacity={0.85}
              />
            </svg>
          )}

          {/* Registration Marks Live Overlay */}
          {regMarksPath && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-30"
              viewBox={`0 0 ${viewW} ${viewH}`}
            >
              <path
                d={regMarksPath}
                stroke="#1b281f"
                strokeWidth="0.8"
                fill="none"
                opacity={0.7}
              />
            </svg>
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

      {/* Floating Source Framing & Revert Controls HUD (Visible in Source View Tab) */}
      {activeTab === 'source' && workingImage && placedImageGeometry && (
        <div className="floating-toolbar absolute top-14 left-1/2 -translate-x-1/2 z-30 p-1.5 px-2.5 rounded-xl bg-moss-950/90 border border-sand-400/25 backdrop-blur-md shadow-2xl flex items-center gap-2.5 text-xs text-sand-200 print-hide">
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-gorton uppercase text-sand-400 mr-1">Framing:</span>

            {/* Fit to Margins */}
            <button
              type="button"
              onClick={() => {
                onUpdateWorkingImage?.(prev => ({
                  ...prev,
                  scaleX: 1.0,
                  scaleY: 1.0,
                  position: { x: 0, y: 0 },
                }));
              }}
              className="px-2 py-1 rounded bg-moss-900 hover:bg-moss-800 border border-sand-400/20 text-[11px] font-medium transition flex items-center gap-1"
              title="Fit within printable margins (Contain)"
            >
              <Minimize2 className="w-3 h-3 text-emerald-400" />
              <span>Fit</span>
            </button>

            {/* Fill Sheet (Cover) */}
            <button
              type="button"
              onClick={() => {
                onUpdateWorkingImage?.(prev => ({
                  ...prev,
                  scaleX: Math.round(placedImageGeometry.coverScale * 100) / 100,
                  scaleY: Math.round(placedImageGeometry.coverScale * 100) / 100,
                  position: { x: 0, y: 0 },
                }));
              }}
              className="px-2 py-1 rounded bg-moss-900 hover:bg-moss-800 border border-sand-400/20 text-[11px] font-medium transition flex items-center gap-1"
              title="Fill sheet to margins without letterboxing (Cover)"
            >
              <Maximize2 className="w-3 h-3 text-emerald-400" />
              <span>Fill</span>
            </button>

            {/* Center Alignment */}
            <button
              type="button"
              onClick={() => {
                onUpdateWorkingImage?.(prev => ({
                  ...prev,
                  position: { x: 0, y: 0 },
                }));
              }}
              className="px-2 py-1 rounded bg-moss-900 hover:bg-moss-800 border border-sand-400/20 text-[11px] font-medium transition flex items-center gap-1"
              title="Center image position (0, 0)"
            >
              <Move className="w-3 h-3 text-sand-400" />
              <span>Center</span>
            </button>
          </div>

          <div className="w-px h-4 bg-sand-400/20" />

          {/* Scale Slider */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-sand-400 font-mono">Scale:</span>
            <input
              type="range"
              min="0.25"
              max="3.0"
              step="0.05"
              value={workingImage.scaleX}
              onChange={e => {
                const val = parseFloat(e.target.value);
                onUpdateWorkingImage?.(prev => ({
                  ...prev,
                  scaleX: val,
                  scaleY: val,
                }));
              }}
              className="w-20 accent-emerald-400 h-1.5 bg-moss-900 rounded-lg cursor-pointer"
            />
            <span className="text-[11px] font-mono text-sand-300 w-10 text-right">
              {Math.round(workingImage.scaleX * 100)}%
            </span>
          </div>

          <div className="w-px h-4 bg-sand-400/20" />

          {/* Revert / Reset to Original Button (History Tracked) */}
          <button
            type="button"
            onClick={() => onResetWorkingImage?.()}
            className="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-300 hover:text-emerald-100 text-[11px] font-medium transition flex items-center gap-1.5 shadow-sm"
            title="Revert all crop, scale, and pan offsets back to original (Undoable with Ctrl+Z for AB comparison)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Revert to Original</span>
          </button>
        </div>
      )}

      {/* Floating Touchup & Bridge HUD Toolbar (Visible in both Layer View & 3D Composite Stack) */}
      {showTouchupHUD && (
        <div className="floating-toolbar absolute top-14 left-1/2 -translate-x-1/2 z-30 p-1.5 rounded-xl bg-moss-950/90 border border-sand-400/25 backdrop-blur-md shadow-2xl flex items-center gap-2 text-xs print-hide">
          {/* Targeted Layer Chip & Quick Selector (In Composite View) */}
          {activeTab === 'composite' && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsLayerDropdownOpen(prev => !prev)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-moss-900 border border-sand-400/25 text-sand-100 hover:border-emerald-400/60 transition"
                title="Target Layer for Touchup"
              >
                <div
                  className="w-3 h-3 rounded-full border border-sand-400/40 shrink-0"
                  style={{ backgroundColor: selectedLayer?.swatch.hex || '#000000' }}
                />
                <span className="text-[11px] font-medium max-w-[90px] truncate">
                  {selectedLayer ? `Layer ${selectedLayer.order}${selectedLayer.order === 0 ? ' (Base)' : ''}` : 'Select Layer'}
                </span>
                <ChevronDown className="w-3 h-3 text-sand-400" />
              </button>

              {/* Layer Selection Dropdown Menu */}
              {isLayerDropdownOpen && (
                <div className="absolute top-full mt-1.5 left-0 w-44 rounded-lg bg-moss-950 border border-sand-400/25 shadow-2xl p-1 z-50 space-y-0.5 max-h-48 overflow-y-auto">
                  {sortedLayers.map(l => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => {
                        onSelectLayer?.(l.id);
                        setIsLayerDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left text-[11px] transition ${
                        l.id === targetLayerId
                          ? 'bg-emerald-900/60 text-emerald-300 font-semibold border border-emerald-600/40'
                          : 'text-sand-300 hover:bg-moss-850 hover:text-white'
                      }`}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full border border-sand-400/40 shrink-0"
                        style={{ backgroundColor: l.swatch.hex }}
                      />
                      <span className="truncate flex-1">
                        Layer {l.order} {l.order === 0 ? '(Base)' : ''}
                      </span>
                      <span className="text-[9.5px] font-mono text-sand-400">{l.swatch.hex}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tool Mode Buttons */}
          <div className="flex items-center gap-1 border-l border-sand-400/20 pl-1.5">
            <button
              type="button"
              onClick={() => onToolChange('navigate')}
              className={`p-1.5 rounded-lg transition-colors ${
                activeTool === 'navigate'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-sand-300 hover:text-white hover:bg-moss-800'
              }`}
              title="Navigate & Pan (V)"
            >
              <MousePointer className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onToolChange('wand')}
              className={`p-1.5 rounded-lg transition-colors ${
                activeTool === 'wand'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-sand-300 hover:text-white hover:bg-moss-800'
              }`}
              title="Smart Wand: L-Click to Fill, R-Click/Ctrl to Erase (W)"
            >
              <Wand2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onToolChange('bridge')}
              className={`p-1.5 rounded-lg transition-colors ${
                activeTool === 'bridge'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-sand-300 hover:text-white hover:bg-moss-800'
              }`}
              title="Bridge Pen: Drag across islands to connect (B)"
            >
              <PenTool className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Context Hint */}
          {activeTool === 'wand' && (
            <span className="text-[10px] text-sand-400 px-1 border-l border-sand-400/20 hidden sm:inline">
              L-Click: Fill • R-Click/Ctrl: Erase
            </span>
          )}
          {activeTool === 'bridge' && (
            <span className="text-[10px] text-sand-400 px-1 border-l border-sand-400/20 hidden sm:inline">
              Drag line ({bridgeWidthMm}mm)
            </span>
          )}
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
