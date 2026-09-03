import React, { useState, useEffect, useRef } from 'react';
import { ChromaProcessingSettings, ClusteringAlgorithm } from '../../engine/types';

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
  const [localAccentSensitivity, setLocalAccentSensitivity] = useState(settings.accentSensitivity ?? 0.5);
  const [localLumaGamma, setLocalLumaGamma] = useState(settings.lumaRampGamma ?? 1.0);

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

  useEffect(() => {
    setLocalAccentSensitivity(settings.accentSensitivity ?? 0.5);
  }, [settings.accentSensitivity]);

  useEffect(() => {
    setLocalLumaGamma(settings.lumaRampGamma ?? 1.0);
  }, [settings.lumaRampGamma]);

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

  const currentAlgo = settings.clusteringAlgorithm || 'kmeans_pp';

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

      {/* Number of Colors (K) - Anchored at top of section */}
      <div className="space-y-1.5 pt-2 border-t border-sand-400/10">
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
          <span>6 (Balanced)</span>
          <span>10 (Rich)</span>
        </div>
      </div>

      {/* Clustering Engine Selector */}
      <div className="space-y-1.5 pt-2 border-t border-sand-400/10">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-sand-300 font-semibold uppercase font-gorton">Clustering Engine</span>
        </div>
        <select
          value={currentAlgo}
          onChange={e => {
            const algo = e.target.value as ClusteringAlgorithm;
            dispatchChange(s => ({ ...s, clusteringAlgorithm: algo }), true);
          }}
          className="w-full bg-moss-950/80 border border-sand-400/25 rounded px-2.5 py-1.5 text-xs text-sand-100 font-medium focus:border-emerald-400 focus:outline-none"
        >
          <option value="kmeans_pp">Perceptual (K-Means++)</option>
          <option value="saliency">Accent Saliency (Focal Details)</option>
          <option value="luma_ramp">Tonal Luma Ramp (Relief Depth)</option>
          <option value="median_cut">Graphic Median Cut (Posterized)</option>
        </select>
        <p className="text-[10px] text-sand-400/80 leading-relaxed">
          {currentAlgo === 'kmeans_pp' && 'Balanced statistical color centroids optimized in perceptual OKLab space.'}
          {currentAlgo === 'saliency' && 'Forces small, vivid accent colors into the palette instead of being swallowed by large backgrounds.'}
          {currentAlgo === 'luma_ramp' && 'Equalizes lightness stratification across sheets for deep woodcarvings and shadowboxes.'}
          {currentAlgo === 'median_cut' && 'Partitions color volume into crisp, bold graphic blocks suited for silkscreen styles.'}
        </p>
      </div>

      {/* Dynamic Saliency Sub-slider */}
      {currentAlgo === 'saliency' && (
        <div className="space-y-1.5 p-2 rounded-lg bg-moss-950/60 border border-sand-400/20">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-sand-300 font-medium">Accent Sensitivity</span>
            <span className="font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-moss-900 border border-sand-400/20">
              {(localAccentSensitivity * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={localAccentSensitivity}
            onChange={e => {
              const val = parseFloat(e.target.value);
              setLocalAccentSensitivity(val);
              dispatchChange(s => ({ ...s, accentSensitivity: val }));
            }}
            onPointerUp={e => {
              const val = parseFloat((e.target as HTMLInputElement).value);
              dispatchChange(s => ({ ...s, accentSensitivity: val }), true);
            }}
          />
          <div className="flex justify-between text-[10px] text-sand-400/80 px-0.5">
            <span>Area Biased</span>
            <span>Vivid Accent Priority</span>
          </div>
        </div>
      )}

      {/* Dynamic Luma Gamma Sub-slider */}
      {currentAlgo === 'luma_ramp' && (
        <div className="space-y-1.5 p-2 rounded-lg bg-moss-950/60 border border-sand-400/20">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-sand-300 font-medium">Dynamic Range Gamma</span>
            <span className="font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-moss-900 border border-sand-400/20">
              {localLumaGamma.toFixed(2)}γ
            </span>
          </div>
          <input
            type="range"
            min="0.2"
            max="1.8"
            step="0.1"
            value={localLumaGamma}
            onChange={e => {
              const val = parseFloat(e.target.value);
              setLocalLumaGamma(val);
              dispatchChange(s => ({ ...s, lumaRampGamma: val }));
            }}
            onPointerUp={e => {
              const val = parseFloat((e.target as HTMLInputElement).value);
              dispatchChange(s => ({ ...s, lumaRampGamma: val }), true);
            }}
          />
          <div className="flex justify-between text-[10px] text-sand-400/80 px-0.5">
            <span>Highlight Skew</span>
            <span>1.0 (Linear)</span>
            <span>Shadow Skew</span>
          </div>
        </div>
      )}

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
            <span>Graphic Hue (Colors)</span>
            <span>Tonal Luma (Depth)</span>
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
            Removes colorful specs in neutral shadows and backgrounds.
          </p>
        </div>
      </div>
    </div>
  );
};
