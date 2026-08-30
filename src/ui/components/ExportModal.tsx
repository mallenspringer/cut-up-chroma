import React, { useState } from 'react';
import { ChromaLayerState, CanvasSettings, VectorLayerResult } from '../../engine/types';
import { generateMasterCombinedSVG } from '../../export/svgGenerator';
import { createZipPackage, downloadBlob } from '../../export/zipPackage';
import { X, Download, FileArchive, Printer, Layers, FileCode } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  layers: ChromaLayerState[];
  vectorResults: Map<string, VectorLayerResult>;
  canvas: CanvasSettings;
  registrationMarks?: boolean;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  layers,
  vectorResults,
  canvas,
  registrationMarks = false,
}) => {
  const [exportPrefix, setExportPrefix] = useState('CutUp_Chroma_Project');

  if (!isOpen) return null;

  const handleDownloadMasterSVG = () => {
    const svgStr = generateMasterCombinedSVG(layers, vectorResults, canvas, {
      strokeOnly: false,
      includeRegistrationMarks: registrationMarks,
    });
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    downloadBlob(blob, `${exportPrefix}_Master_Combined.svg`);
  };

  const handleDownloadZip = () => {
    const zipBlob = createZipPackage(layers, vectorResults, canvas, exportPrefix, registrationMarks);
    downloadBlob(zipBlob, `${exportPrefix}_Production_Cut_Package.zip`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fade-in print-hide">
      <div className="relative w-full max-w-lg rounded-xl bg-moss-900 border border-sand-400/25 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-sand-400/15 bg-moss-950/60">
          <div className="flex items-center gap-2.5">
            <Download className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-semibold text-sand-100 font-gorton tracking-wide">
              Export Production Cut Patterns
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-sand-400 hover:text-sand-100 hover:bg-moss-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto text-xs text-sand-200">
          {/* File Prefix */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase font-gorton text-sand-300 font-medium">
              Export Filename Prefix
            </label>
            <input
              type="text"
              value={exportPrefix}
              onChange={e => setExportPrefix(e.target.value)}
              className="w-full bg-moss-950/70 border border-sand-400/25 rounded px-3 py-2 text-xs text-sand-100"
              placeholder="Project_Name"
            />
          </div>

          {/* Export Options Cards */}
          <div className="space-y-3">
            {/* 1. Combined Master SVG */}
            <div className="p-3.5 rounded-lg bg-moss-800/40 border border-sand-400/20 flex items-center justify-between gap-3 hover:border-sand-400/35 transition-colors">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 font-medium text-sand-100 text-xs">
                  <FileCode className="w-4 h-4 text-emerald-400" />
                  <span>Combined Master Multi-Color SVG</span>
                </div>
                <p className="text-[11px] text-sand-400">
                  Single `.svg` containing all {layers.length} color groups with exact physical mm unit bounds {registrationMarks && '(with registration marks)'}.
                </p>
              </div>
              <button
                onClick={handleDownloadMasterSVG}
                className="px-3 py-1.5 rounded bg-moss-700 hover:bg-moss-600 text-white font-medium text-xs shrink-0 flex items-center gap-1.5 transition-colors border border-sand-400/20"
              >
                <Download className="w-3.5 h-3.5" /> SVG
              </button>
            </div>

            {/* 2. Layer-by-Layer ZIP Package */}
            <div className="p-3.5 rounded-lg bg-moss-800/40 border border-sand-400/20 flex items-center justify-between gap-3 hover:border-sand-400/35 transition-colors">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 font-medium text-sand-100 text-xs">
                  <FileArchive className="w-4 h-4 text-amber-400" />
                  <span>Layer-by-Layer ZIP Package (Recommended)</span>
                </div>
                <p className="text-[11px] text-sand-400">
                  Individual vector cut sheets formatted for Glowforge, LightBurn, Cricut & Silhouette + Assembly Guide.
                </p>
              </div>
              <button
                onClick={handleDownloadZip}
                className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shrink-0 flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <FileArchive className="w-3.5 h-3.5" /> Download ZIP
              </button>
            </div>

            {/* 3. Direct Browser Print / PDF */}
            <div className="p-3.5 rounded-lg bg-moss-800/40 border border-sand-400/20 flex items-center justify-between gap-3 hover:border-sand-400/35 transition-colors">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 font-medium text-sand-100 text-xs">
                  <Printer className="w-4 h-4 text-sky-400" />
                  <span>Direct 1:1 Print / PDF Templates</span>
                </div>
                <p className="text-[11px] text-sand-400">
                  Opens browser print dialog with UI chrome stripped for 1:1 physical cardstock printouts.
                </p>
              </div>
              <button
                onClick={handlePrint}
                className="px-3 py-1.5 rounded bg-moss-700 hover:bg-moss-600 text-white font-medium text-xs shrink-0 flex items-center gap-1.5 transition-colors border border-sand-400/20"
              >
                <Printer className="w-3.5 h-3.5" /> Print / PDF
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-sand-400/15 bg-moss-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-moss-800 hover:bg-moss-700 text-sand-200 text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
