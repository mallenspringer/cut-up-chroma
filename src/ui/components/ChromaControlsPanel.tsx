import React, { useState, useEffect, useRef } from 'react';
import { ChromaProcessingSettings } from '../../engine/types';

interface ChromaControlsPanelProps {
  settings: ChromaProcessingSettings;
  onChange: (updater: (prev: ChromaProcessingSettings) => ChromaProcessingSettings) => void;
  onReExtractPalette?: () => void;
}

export const ChromaControlsPanel: React.FC<ChromaControlsPanelProps> = ({
  settings,
  onChange,
  onReExtractPalette,
}) => {
  const [localColorCount, setLocalColorCount] = useState(settings.colorCount);
  const [localColorBias, setLocalColorBias] = useState(settings.colorBias ?? 0.5);
  const [localChromaFloor, setLocalChromaFloor] = useState(settings.chromaFloor);

  const throttleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setLocalColorCount(settings.colorCount);
  }, [settings.colorCount]);

  useEffect(() => {
    setLocalColorBias(settings.colorBias ?? 0.5);
  }, [settings.colorBias]);

  useEffect(() => {
    setLocalChromaFloor(settings.chromaFloor);
  }, [settings.chromaFloor]);

  const dispatchChange = (updater: (prev: ChromaProcessingSettings) => ChromaProcessingSettings, immediate: boolean = false) => {
    if (immediate) {
      if (throttleTimerRef.current) {
        window.clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      onChange(updater);
      return;
    }

    if (!throttleTimerRef.current) {
      onChange(updater);
      throttleTimerRef.current = window.setTimeout(() => {
        throttleTimerRef.current = null;
      }, 200);
    }
  };

  const getBiasLabel = (bias: number) => {
    if (bias < 0.35) return 'Graphic Hue (Poster)';
    if (bias < 0.45) return 'Slight Hue Bias';
    if (bias <= 0.55) return 'Balanced (1:1)';
    if (bias <= 0.65) return 'Slight Luma Bias';
    return 'Tonal Luma (Depth)';
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Assembly Mode Selector */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-sand-300 uppercase font-gorton flex items-center justify-between">
          <span>Assembly Mode</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => dispatchChange(s => ({ ...s, assemblyMode: 'stacked_relief' }), true)}
            className={`py-2 px-2.5 rounded-lg border text-center transition-all ${
              settings.assemblyMode === 'stacked_relief'
                ? 'border-emerald-400 bg-moss-700/80 text-white font-medium shadow-sm'
                : 'border-sand-400/20 bg-moss-800/40 text-sand-300 hover:border-sand-400/40'
            }`}
          >
            <div className="font-semibold text-xs">Stacked Relief</div>
            <div className="text-[10px] text-sand-400 font-normal">Layered Z-Sheets</div>
          </button>

          <button
            type="button"
            onClick={() => dispatchChange(s => ({ ...s, assemblyMode: 'inlay_mosaic' }), true)}
            className={`py-2 px-2.5 rounded-lg border text-center transition-all ${
              settings.assemblyMode === 'inlay_mosaic'
                ? 'border-emerald-400 bg-moss-700/80 text-white font-medium shadow-sm'
                : 'border-sand-400/20 bg-moss-800/40 text-sand-300 hover:border-sand-400/40'
            }`}
          >
            <div className="font-semibold text-xs">Inlay / Intarsia</div>
            <div className="text-[10px] text-sand-400 font-normal">Flat Mosaic Tiles</div>
          </button>
        </div>
      </div>

      {/* Number of Colors (K) */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-sand-300 font-medium">Color Sheet Count (K)</span>
          <span className="font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-moss-950/70 border border-sand-400/20">
            {localColorCount} Colors
          </span>
        </div>
        <input
          type="range"
          min="2"
          max="10"
          step="1"
          value={localColorCount}
          onChange={e => {
            const count = parseInt(e.target.value, 10);
            setLocalColorCount(count);
            dispatchChange(s => ({ ...s, colorCount: count }));
          }}
          onPointerUp={e => {
            const count = parseInt((e.target as HTMLInputElement).value, 10);
            dispatchChange(s => ({ ...s, colorCount: count }), true);
          }}
        />
        <div className="flex justify-between text-[10px] text-sand-400/80 px-0.5">
          <span>2 (Minimal)</span>
          <span>5 (Balanced)</span>
          <span>10 (Rich)</span>
        </div>
      </div>

      {/* Primary Color Separation Controls */}
      <div className="space-y-3 pt-2 border-t border-sand-400/10">
        {/* Color Separation Bias Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-sand-300 font-medium">Color Separation Bias</span>
            <span className="font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-moss-950/70 border border-sand-400/20">
              {getBiasLabel(localColorBias)}
            </span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={localColorBias}
            onChange={e => {
              const val = parseFloat(e.target.value);
              setLocalColorBias(val);
              dispatchChange(s => ({ ...s, colorBias: val }));
            }}
            onPointerUp={e => {
              const val = parseFloat((e.target as HTMLInputElement).value);
              dispatchChange(s => ({ ...s, colorBias: val }), true);
            }}
          />
          <div className="flex justify-between text-[10px] text-sand-400/80 px-0.5">
            <span>◄ Graphic Hue (Colors)</span>
            <span>Tonal Luma (Depth) ►</span>
          </div>
          <p className="text-[10px] text-sand-400/80 leading-relaxed">
            Balances solid color object silhouettes vs 3D photographic light and shadow depth.
          </p>
        </div>

        {/* Chroma Floor Slider */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-sand-300">Chroma Floor (De-noise Grays)</span>
            <span className="font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-moss-950/70 border border-sand-400/20">
              {(localChromaFloor * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0.0"
            max="0.15"
            step="0.01"
            value={localChromaFloor}
            onChange={e => {
              const val = parseFloat(e.target.value);
              setLocalChromaFloor(val);
              dispatchChange(s => ({ ...s, chromaFloor: val }));
            }}
            onPointerUp={e => {
              const val = parseFloat((e.target as HTMLInputElement).value);
              dispatchChange(s => ({ ...s, chromaFloor: val }), true);
            }}
          />
          <p className="text-[10px] text-sand-400/80 leading-relaxed">
            Suppresses stray rainbow specks in neutral shadows, backgrounds, and off-white paper.
          </p>
        </div>
      </div>
    </div>
  );
};
