import React from 'react';
import { CanvasSettings, LengthUnit } from '../../engine/types';
import { LayoutGrid, RotateCw } from 'lucide-react';

interface CanvasSettingsPanelProps {
  canvas: CanvasSettings;
  onChange: (updater: (prev: CanvasSettings) => CanvasSettings) => void;
}

const PRESETS: Array<{ name: string; width: number; height: number; unit: LengthUnit }> = [
  { name: 'Letter (8.5 × 11 in)', width: 8.5, height: 11, unit: 'in' },
  { name: 'Square (12 × 12 in)', width: 12, height: 12, unit: 'in' },
  { name: 'A4 (210 × 297 mm)', width: 210, height: 297, unit: 'mm' },
  { name: 'A3 (297 × 420 mm)', width: 297, height: 420, unit: 'mm' },
  { name: 'Compact (5 × 7 in)', width: 5, height: 7, unit: 'in' },
  { name: 'Small Square (8 × 8 in)', width: 8, height: 8, unit: 'in' },
];

export const CanvasSettingsPanel: React.FC<CanvasSettingsPanelProps> = ({ canvas, onChange }) => {
  const toggleOrientation = () => {
    onChange(prev => {
      const nextOrientation = prev.orientation === 'portrait' ? 'landscape' : 'portrait';
      const isNextLandscape = nextOrientation === 'landscape';
      const width = isNextLandscape
        ? Math.max(prev.width, prev.height)
        : Math.min(prev.width, prev.height);
      const height = isNextLandscape
        ? Math.min(prev.width, prev.height)
        : Math.max(prev.width, prev.height);

      return {
        ...prev,
        width,
        height,
        orientation: nextOrientation,
      };
    });
  };

  const handlePresetSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = PRESETS.find(p => p.name === e.target.value);
    if (selected) {
      onChange(prev => {
        const isLandscape = prev.orientation === 'landscape';
        const width = isLandscape
          ? Math.max(selected.width, selected.height)
          : Math.min(selected.width, selected.height);
        const height = isLandscape
          ? Math.min(selected.width, selected.height)
          : Math.max(selected.width, selected.height);

        return {
          ...prev,
          width,
          height,
          unit: selected.unit,
        };
      });
    }
  };

  return (
    <div className="space-y-3 text-xs">
      {/* Preset Selector */}
      <div className="space-y-1">
        <label className="text-[11px] text-sand-400">Standard Paper Presets</label>
        <select
          onChange={handlePresetSelect}
          defaultValue=""
          className="w-full bg-moss-950/70 border border-sand-400/25 rounded px-2.5 py-1.5 text-xs text-sand-100"
        >
          <option value="" disabled>
            Choose standard size...
          </option>
          {PRESETS.map(p => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Dimensions & Unit */}
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <label className="text-[11px] text-sand-400">Width</label>
          <input
            type="number"
            step="0.1"
            min="1"
            value={canvas.width}
            onChange={e => {
              const val = parseFloat(e.target.value) || 1;
              onChange(prev => ({ ...prev, width: val }));
            }}
            className="w-full"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-sand-400">Height</label>
          <input
            type="number"
            step="0.1"
            min="1"
            value={canvas.height}
            onChange={e => {
              const val = parseFloat(e.target.value) || 1;
              onChange(prev => ({ ...prev, height: val }));
            }}
            className="w-full"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-sand-400">Unit</label>
          <select
            value={canvas.unit}
            onChange={e => {
              const unit = e.target.value as LengthUnit;
              onChange(prev => ({ ...prev, unit }));
            }}
            className="w-full"
          >
            <option value="in">in</option>
            <option value="mm">mm</option>
            <option value="cm">cm</option>
          </select>
        </div>
      </div>

      {/* Margin & Orientation */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="space-y-1">
          <label className="text-[11px] text-sand-400">Border Margin ({canvas.unit})</label>
          <input
            type="number"
            step="0.05"
            min="0"
            value={canvas.margin}
            onChange={e => {
              const val = parseFloat(e.target.value) || 0;
              onChange(prev => ({ ...prev, margin: val }));
            }}
            className="w-full"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-sand-400">Orientation</label>
          <button
            type="button"
            onClick={toggleOrientation}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-moss-800/60 border border-sand-400/20 hover:border-sand-400/40 text-sand-200 capitalize transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5 text-sand-400" />
            <span>{canvas.orientation}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
