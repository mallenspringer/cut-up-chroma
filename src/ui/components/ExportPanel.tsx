import React, { useState } from 'react';
import { ChromaLayerState, CanvasSettings, VectorLayerResult, AppState } from '../../engine/types';
import { Download, Archive, Printer, Target, FileCode } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';
import { ExportModal } from './ExportModal';

interface ExportPanelProps {
  layers: ChromaLayerState[];
  vectorResults: Map<string, VectorLayerResult>;
  canvas: CanvasSettings;
  output: AppState['output'];
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  defaultOpen?: boolean;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  layers,
  vectorResults,
  canvas,
  output,
  onUpdateState,
  defaultOpen = true,
}) => {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  return (
    <CollapsibleSection
      title="Export & Print"
      icon={<Download className="w-3.5 h-3.5 text-sand-400" />}
      defaultExpanded={defaultOpen}
    >
      <div className="space-y-3 pt-0.5 text-xs">
        {/* Registration Marks Toggle */}
        <div className="flex items-center justify-between p-2 bg-moss-950/70 rounded-lg border border-sand-400/20">
          <label htmlFor="reg-marks-toggle" className="flex items-center gap-2 font-medium text-sand-200 cursor-pointer text-xs">
            <Target className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Registration Marks</span>
          </label>
          <input
            id="reg-marks-toggle"
            type="checkbox"
            checked={output.registrationMarks}
            onChange={e => {
              const registrationMarks = e.target.checked;
              onUpdateState(prev => ({
                ...prev,
                output: { ...prev.output, registrationMarks },
              }));
            }}
            className="w-4 h-4 accent-emerald-600 cursor-pointer rounded bg-moss-900 border-sand-400/30"
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="w-full btn btn-primary flex items-center justify-center gap-2 py-2 text-xs font-semibold"
          >
            <Download className="w-4 h-4" /> Export Combined SVG
          </button>

          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="w-full btn btn-secondary flex items-center justify-center gap-2 py-2 text-xs text-sand-200"
          >
            <Archive className="w-4 h-4 text-emerald-400" /> Export Layer Package (.zip)
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="w-full btn btn-secondary flex items-center justify-center gap-2 py-2 text-xs text-sand-200 hover:text-white"
          >
            <Printer className="w-4 h-4 text-sand-400" /> Print (100% Scale)
          </button>
        </div>
      </div>

      {/* Export Naming & File Generation Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        layers={layers}
        vectorResults={vectorResults}
        canvas={canvas}
        registrationMarks={output.registrationMarks}
      />
    </CollapsibleSection>
  );
};
