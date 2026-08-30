import React, { useState, useEffect, useRef } from 'react';
import { ChromaProcessingSettings } from '../../engine/types';

interface AdvancedChannelWeightsPanelProps {
  settings: ChromaProcessingSettings;
  onChange: (updater: (prev: ChromaProcessingSettings) => ChromaProcessingSettings) => void;
}

export const AdvancedChannelWeightsPanel: React.FC<AdvancedChannelWeightsPanelProps> = ({
  settings,
  onChange,
}) => {
  const [localHueWeight, setLocalHueWeight] = useState(settings.hueWeight);
  const [localLightnessWeight, setLocalLightnessWeight] = useState(settings.lightnessWeight);
  const [localChromaWeight, setLocalChromaWeight] = useState(settings.chromaWeight ?? 1.0);

  const throttleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setLocalHueWeight(settings.hueWeight);
  }, [settings.hueWeight]);

  useEffect(() => {
    setLocalLightnessWeight(settings.lightnessWeight);
  }, [settings.lightnessWeight]);

  useEffect(() => {
    setLocalChromaWeight(settings.chromaWeight ?? 1.0);
  }, [settings.chromaWeight]);

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

  return (
    <div className="space-y-3.5 pt-1 text-xs">
      {/* Hue Weight */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-sand-300 font-medium">Hue Separation Weight</span>
          <span className="font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-moss-950/70 border border-sand-400/20">
            {localHueWeight.toFixed(1)}x
          </span>
        </div>
        <input
          type="range"
          min="0.0"
          max="3.0"
          step="0.1"
          value={localHueWeight}
          onChange={e => {
            const val = parseFloat(e.target.value);
            setLocalHueWeight(val);
            dispatchChange(s => ({ ...s, hueWeight: val }));
          }}
          onPointerUp={e => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            dispatchChange(s => ({ ...s, hueWeight: val }), true);
          }}
        />
        <p className="text-[10px] text-sand-400/80 leading-relaxed">
          Higher values force distinct color families into separate sheets regardless of lighting.
        </p>
      </div>

      {/* Lightness Weight */}
      <div className="space-y-1 pt-2 border-t border-sand-400/10">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-sand-300 font-medium">Luma Contrast Weight</span>
          <span className="font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-moss-950/70 border border-sand-400/20">
            {localLightnessWeight.toFixed(1)}x
          </span>
        </div>
        <input
          type="range"
          min="0.0"
          max="3.0"
          step="0.1"
          value={localLightnessWeight}
          onChange={e => {
            const val = parseFloat(e.target.value);
            setLocalLightnessWeight(val);
            dispatchChange(s => ({ ...s, lightnessWeight: val }));
          }}
          onPointerUp={e => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            dispatchChange(s => ({ ...s, lightnessWeight: val }), true);
          }}
        />
        <p className="text-[10px] text-sand-400/80 leading-relaxed">
          Higher values separate deep shadows and highlights into distinct tonal relief sheets.
        </p>
      </div>

      {/* Saturation (Chroma) Boost */}
      <div className="space-y-1 pt-2 border-t border-sand-400/10">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-sand-300 font-medium">Saturation (Chroma) Boost</span>
          <span className="font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-moss-950/70 border border-sand-400/20">
            {localChromaWeight.toFixed(1)}x
          </span>
        </div>
        <input
          type="range"
          min="0.0"
          max="3.0"
          step="0.1"
          value={localChromaWeight}
          onChange={e => {
            const val = parseFloat(e.target.value);
            setLocalChromaWeight(val);
            dispatchChange(s => ({ ...s, chromaWeight: val }));
          }}
          onPointerUp={e => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            dispatchChange(s => ({ ...s, chromaWeight: val }), true);
          }}
        />
        <p className="text-[10px] text-sand-400/80 leading-relaxed">
          Boosts sensitivity to muted, pastel, or low-saturation colors in washed-out photos.
        </p>
      </div>
    </div>
  );
};
