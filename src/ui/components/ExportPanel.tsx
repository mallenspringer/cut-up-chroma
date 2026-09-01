import React, { useState } from 'react';
import { ChromaLayerState, CanvasSettings, VectorLayerResult, AppState, SourceImage, ChromaProcessingSettings } from '../../engine/types';
import { Download, Target, Printer, Layers } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';
import { ExportModal } from './ExportModal';

interface ExportPanelProps {
  layers: ChromaLayerState[];
  vectorResults: Map<string, VectorLayerResult>;
  canvas: CanvasSettings;
  output: AppState['output'];
  processing: ChromaProcessingSettings;
  sourceImage?: SourceImage | null;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  defaultOpen?: boolean;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  layers,
  vectorResults,
  canvas,
  output,
  processing,
  sourceImage = null,
  onUpdateState,
  defaultOpen = true,
}) => {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  return (
    <CollapsibleSection
      title="Export & Production"
      icon={<Download className="w-3.5 h-3.5 text-sand-400" />}
      defaultExpanded={defaultOpen}
    >
      <div className="space-y-3 pt-0.5 text-xs">
        {/* Registration Marks Toggle with Warm Muted Cream/Yellow Accent */}
        <div className="flex items-center justify-between p-2 bg-moss-950/70 rounded-lg border border-sand-400/20">
          <label htmlFor="reg-marks-toggle" className="flex items-center gap-2 font-medium text-sand-200 cursor-pointer text-xs">
            <Target className="w-4 h-4 text-amber-300 shrink-0" />
            <span>Registration Marks (Corner Alignment)</span>
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
            className="w-4 h-4 accent-amber-300 cursor-pointer rounded bg-moss-900 border-sand-400/30"
          />
        </div>

        {/* Primary Single Launch Action */}
        <button
          type="button"
          onClick={() => setIsExportModalOpen(true)}
          className="w-full py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-2 shadow-md transition"
        >
          <Download className="w-4 h-4" />
          <span>Export Patterns & Digital Assets...</span>
        </button>
      </div>

      {/* Export Naming & File Generation Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        layers={layers}
        vectorResults={vectorResults}
        canvas={canvas}
        sourceImage={sourceImage}
        registrationMarks={output.registrationMarks}
        unionMarginBorders={processing.unionMarginBorders !== false}
        onToggleUnionMarginBorders={enabled =>
          onUpdateState(prev => ({
            ...prev,
            processing: { ...prev.processing, unionMarginBorders: enabled },
          }))
        }
      />
    </CollapsibleSection>
  );
};

