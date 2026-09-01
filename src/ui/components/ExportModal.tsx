import React, { useState } from 'react';
import { ChromaLayerState, CanvasSettings, VectorLayerResult, SourceImage } from '../../engine/types';
import { generateMasterCombinedSVG } from '../../export/svgGenerator';
import { createZipPackage, downloadBlob } from '../../export/zipPackage';
import { exportDigitalMockup } from '../../export/imageExporter';
import { generateExportBaseName, getExportFilename } from '../../export/naming';
import {
  X,
  Download,
  FileArchive,
  Printer,
  Layers,
  FileCode,
  Image as ImageIcon,
  Sparkles,
  Scissors,
  Check,
  Eye,
  Sliders,
  SunMedium,
  Palette
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  layers: ChromaLayerState[];
  vectorResults: Map<string, VectorLayerResult>;
  canvas: CanvasSettings;
  sourceImage?: SourceImage | null;
  registrationMarks?: boolean;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  layers,
  vectorResults,
  canvas,
  sourceImage = null,
  registrationMarks = false,
}) => {
  const [activeTab, setActiveTab] = useState<'fabrication' | 'digital'>('fabrication');
  const [projectName, setProjectName] = useState(() =>
    generateExportBaseName(sourceImage, canvas, layers.length)
  );

  // Digital Mockup Options
  const [includeShadows, setIncludeShadows] = useState(true);
  const [includePaperTexture, setIncludePaperTexture] = useState(true);
  const [transparentBg, setTransparentBg] = useState(false);
  const [digitalFormat, setDigitalFormat] = useState<'png' | 'jpeg'>('png');
  const [dpiMultiplier, setDpiMultiplier] = useState<number>(3); // 3x = ~300 DPI
  const [isExportingMockup, setIsExportingMockup] = useState(false);

  // Master SVG Stroke Only Toggle
  const [masterStrokeOnly, setMasterStrokeOnly] = useState(false);

  if (!isOpen) return null;

  const baseName = projectName.trim() || generateExportBaseName(sourceImage, canvas, layers.length);

  const getProcessingDimensions = () => {
    const firstVec = Array.from(vectorResults.values())[0];
    return firstVec?.width && firstVec?.height
      ? { width: firstVec.width, height: firstVec.height }
      : undefined;
  };

  const handleDownloadMasterSVG = () => {
    const processingDims = getProcessingDimensions();
    const svgStr = generateMasterCombinedSVG(
      layers,
      vectorResults,
      canvas,
      {
        strokeOnly: masterStrokeOnly,
        includeRegistrationMarks: registrationMarks,
      },
      processingDims
    );
    const filename = getExportFilename(baseName, 'master_svg');
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(blob, filename);
  };

  const handleDownloadZip = () => {
    const processingDims = getProcessingDimensions();
    const zipBlob = createZipPackage(
      layers,
      vectorResults,
      canvas,
      baseName,
      registrationMarks,
      processingDims
    );
    const filename = getExportFilename(baseName, 'layer_package_zip');
    downloadBlob(zipBlob, filename);
  };

  const handleExportDigitalMockup = async () => {
    try {
      setIsExportingMockup(true);
      const processingDims = getProcessingDimensions();
      const filename = getExportFilename(
        baseName,
        digitalFormat === 'png' ? 'mockup_png' : 'mockup_jpg'
      );

      await exportDigitalMockup(
        layers,
        vectorResults,
        canvas,
        filename,
        {
          includePaperTexture,
          includeShadows,
          transparentBackground: transparentBg,
          format: digitalFormat,
          dpiMultiplier,
        },
        processingDims
      );
    } catch (err) {
      console.error('Failed to export digital mockup:', err);
    } finally {
      setIsExportingMockup(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fade-in print-hide">
      <div className="relative w-full max-w-xl rounded-xl bg-moss-900 border border-sand-400/25 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-sand-400/15 bg-moss-950/70">
          <div className="flex items-center gap-2.5">
            <Download className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-semibold text-sand-100 font-gorton tracking-wide">
              Export Production & Digital Assets
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-sand-400 hover:text-sand-100 hover:bg-moss-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-sand-400/15 bg-moss-950/40 px-5 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('fabrication')}
            className={`pb-2 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'fabrication'
                ? 'border-emerald-400 text-sand-100'
                : 'border-transparent text-sand-400 hover:text-sand-200'
            }`}
          >
            <Scissors className="w-3.5 h-3.5 text-emerald-400" />
            <span>Physical Fabrication (SVGs & ZIP)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('digital')}
            className={`pb-2 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'digital'
                ? 'border-emerald-400 text-sand-100'
                : 'border-transparent text-sand-400 hover:text-sand-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
            <span>High-DPI Digital Art & Mockups</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto text-xs text-sand-200">
          {/* Project Filename Base */}
          <div className="space-y-1.5 p-3 rounded-lg bg-moss-950/50 border border-sand-400/15">
            <label className="text-[11px] uppercase font-gorton text-sand-300 font-medium flex justify-between">
              <span>Project Filename Base</span>
              <span className="text-[10px] text-sand-400 font-normal">
                {canvas.width}×{canvas.height} {canvas.unit} • {layers.length} Layers
              </span>
            </label>
            <input
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              className="w-full bg-moss-900 border border-sand-400/25 rounded px-3 py-1.5 text-xs text-sand-100 focus:border-emerald-400 outline-none font-mono"
              placeholder="Project_Name"
            />
          </div>

          {/* TAB 1: PHYSICAL FABRICATION */}
          {activeTab === 'fabrication' && (
            <div className="space-y-4">
              {/* Option A: Layer-by-Layer Production Package (ZIP) */}
              <div className="p-4 rounded-lg bg-moss-950/70 border border-emerald-500/30 hover:border-emerald-500/50 transition flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sand-100 font-semibold text-xs">
                    <FileArchive className="w-4 h-4 text-emerald-400" />
                    <span>Layer-by-Layer Production Package (.zip)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/50 font-mono">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-sand-400 leading-relaxed">
                    Complete manufacturing bundle with individual 1:1 scale SVG cut sheets for each color layer,
                    a Master Combined SVG, and a fabrication README. Ideal for laser cutting, Cricut/Silhouette,
                    and screenprint positive separations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center justify-center gap-2 shadow-md transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Layer-by-Layer ZIP ({layers.length} Sheets)</span>
                </button>
              </div>

              {/* Option B: Master Combined Multi-Color SVG */}
              <div className="p-4 rounded-lg bg-moss-950/70 border border-sand-400/20 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sand-100 font-semibold text-xs">
                      <FileCode className="w-4 h-4 text-amber-400" />
                      <span>Master Combined Multi-Color SVG</span>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-sand-300">
                      <input
                        type="checkbox"
                        checked={masterStrokeOnly}
                        onChange={e => setMasterStrokeOnly(e.target.checked)}
                        className="w-3.5 h-3.5 accent-amber-500 rounded"
                      />
                      <span>Stroke Cut Lines Only</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-sand-400 leading-relaxed">
                    A single unit-accurate SVG with color-coded vector paths grouped into Inkscape/Illustrator layers.
                    Supports direct loading into Glowforge, LightBurn, or CAD tools.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadMasterSVG}
                  className="w-full py-2 px-3 rounded-lg bg-moss-800 hover:bg-moss-750 text-sand-100 font-medium border border-sand-400/30 flex items-center justify-center gap-2 transition"
                >
                  <Download className="w-4 h-4 text-sand-300" />
                  <span>Download Master Combined SVG</span>
                </button>
              </div>

              {/* Option C: 1:1 Scale Print Template */}
              <div className="p-4 rounded-lg bg-moss-950/70 border border-sand-400/20 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-sand-100 font-semibold text-xs">
                    <Printer className="w-4 h-4 text-sky-400" />
                    <span>Direct 1:1 Scale Print / PDF</span>
                  </div>
                  <p className="text-[11px] text-sand-400">
                    Prints current viewport to your local printer or PDF at exact physical dimensions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="py-2 px-4 rounded-lg bg-moss-800 hover:bg-moss-750 text-sand-100 font-medium border border-sand-400/30 flex items-center gap-1.5 transition shrink-0"
                >
                  <Printer className="w-3.5 h-3.5 text-sand-300" />
                  <span>Print Template</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: HIGH-DPI DIGITAL ART & MOCKUPS */}
          {activeTab === 'digital' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-moss-950/70 border border-sand-400/20 space-y-4">
                <div className="flex items-center gap-2 text-sand-100 font-semibold text-xs">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>3D Layered Relief Mockup (High-DPI Raster)</span>
                </div>
                <p className="text-[11px] text-sand-400 leading-relaxed">
                  Renders the layered physical relief composite stack into a high-resolution 300 DPI digital presentation image with tactile drop shadows and paper texture.
                </p>

                {/* Toggles Grid */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {/* Drop Shadows */}
                  <label className="flex items-center justify-between p-2 rounded bg-moss-900 border border-sand-400/15 cursor-pointer">
                    <span className="text-[11px] text-sand-300">Inter-Layer Shadows</span>
                    <input
                      type="checkbox"
                      checked={includeShadows}
                      onChange={e => setIncludeShadows(e.target.checked)}
                      className="w-3.5 h-3.5 accent-emerald-500 rounded"
                    />
                  </label>

                  {/* Paper Texture */}
                  <label className="flex items-center justify-between p-2 rounded bg-moss-900 border border-sand-400/15 cursor-pointer">
                    <span className="text-[11px] text-sand-300">Paper Grain Texture</span>
                    <input
                      type="checkbox"
                      checked={includePaperTexture}
                      onChange={e => setIncludePaperTexture(e.target.checked)}
                      className="w-3.5 h-3.5 accent-emerald-500 rounded"
                    />
                  </label>

                  {/* Transparent Background */}
                  <label className="flex items-center justify-between p-2 rounded bg-moss-900 border border-sand-400/15 cursor-pointer">
                    <span className="text-[11px] text-sand-300">Transparent (Void Base)</span>
                    <input
                      type="checkbox"
                      checked={transparentBg}
                      disabled={digitalFormat === 'jpeg'}
                      onChange={e => setTransparentBg(e.target.checked)}
                      className="w-3.5 h-3.5 accent-emerald-500 rounded"
                    />
                  </label>

                  {/* Format & Resolution */}
                  <div className="flex items-center justify-between p-2 rounded bg-moss-900 border border-sand-400/15">
                    <span className="text-[11px] text-sand-300">Format & Quality</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setDigitalFormat('png')}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          digitalFormat === 'png'
                            ? 'bg-emerald-700 text-white'
                            : 'text-sand-400 hover:text-sand-200'
                        }`}
                      >
                        PNG
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDigitalFormat('jpeg');
                          setTransparentBg(false);
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          digitalFormat === 'jpeg'
                            ? 'bg-emerald-700 text-white'
                            : 'text-sand-400 hover:text-sand-200'
                        }`}
                      >
                        JPG
                      </button>
                    </div>
                  </div>
                </div>

                {/* Resolution Multiplier Selector */}
                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-sand-300">Export Resolution:</span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { label: '2x (Standard)', val: 2 },
                      { label: '3x (300 DPI Print)', val: 3 },
                      { label: '4x (Ultra HD)', val: 4 },
                    ].map(r => (
                      <button
                        key={r.val}
                        type="button"
                        onClick={() => setDpiMultiplier(r.val)}
                        className={`px-2 py-1 rounded border text-[10px] ${
                          dpiMultiplier === r.val
                            ? 'border-emerald-400 bg-moss-800 text-white font-semibold'
                            : 'border-sand-400/20 text-sand-400 hover:border-sand-400/40'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isExportingMockup}
                  onClick={handleExportDigitalMockup}
                  className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium flex items-center justify-center gap-2 shadow-md transition"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {isExportingMockup
                      ? 'Rendering High-DPI Digital Mockup...'
                      : `Download ${digitalFormat.toUpperCase()} Mockup (${dpiMultiplier * 100} DPI)`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-sand-400/15 bg-moss-950/80 flex items-center justify-between">
          <span className="text-[11px] text-sand-400">
            {registrationMarks ? '✓ Registration marks enabled' : '○ Registration marks disabled'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-moss-800 hover:bg-moss-700 text-sand-200 text-xs font-medium transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
