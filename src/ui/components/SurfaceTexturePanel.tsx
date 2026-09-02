import React from 'react';
import { SurfaceTextureConfig, TexturePatternStyle, CutterPreset } from '../../engine/texturing/types';
import { CUTTER_PRESETS, enforceCutterSafety } from '../../engine/texturing/cutterPresets';
import { Sparkles, Scissors, ShieldAlert, Sliders, Waves, Grid, AlignJustify, Hash } from 'lucide-react';

interface SurfaceTexturePanelProps {
  config: SurfaceTextureConfig;
  onChange: (updater: (prev: SurfaceTextureConfig) => SurfaceTextureConfig) => void;
}

export const SurfaceTexturePanel: React.FC<SurfaceTexturePanelProps> = ({
  config,
  onChange,
}) => {
  const currentPreset = CUTTER_PRESETS[config.cutterPreset] || CUTTER_PRESETS.drag_knife;

  const handlePatternChange = (style: TexturePatternStyle) => {
    onChange(prev => enforceCutterSafety({ ...prev, patternStyle: style, enabled: true }));
  };

  const handlePresetChange = (preset: CutterPreset) => {
    onChange(prev => enforceCutterSafety({ ...prev, cutterPreset: preset }));
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Enable Texturing Toggle */}
      <div className="flex items-center justify-between p-2 rounded-lg bg-moss-950/70 border border-sand-400/20">
        <label htmlFor="surface-texturing-toggle" className="flex items-center gap-2 font-medium text-sand-200 cursor-pointer">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Enable Physical Textures & Gradients</span>
        </label>
        <input
          id="surface-texturing-toggle"
          type="checkbox"
          checked={config.enabled}
          onChange={e => onChange(prev => ({ ...prev, enabled: e.target.checked }))}
          className="w-4 h-4 accent-amber-300 cursor-pointer rounded bg-moss-900 border-sand-400/30"
        />
      </div>

      {config.enabled && (
        <div className="space-y-4 pt-1 animate-fade-in">
          {/* Cutter Device Preset */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-sand-300 uppercase font-gorton flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5 text-emerald-400" />
              <span>Target Cutter Preset</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['drag_knife', 'laser', 'manual'] as CutterPreset[]).map(p => {
                const isSelected = config.cutterPreset === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePresetChange(p)}
                    className={`py-1.5 px-2 rounded border text-center transition-all ${
                      isSelected
                        ? 'border-emerald-400 bg-moss-700/80 text-white font-medium shadow-sm'
                        : 'border-sand-400/20 bg-moss-800/40 text-sand-300 hover:border-sand-400/40'
                    }`}
                  >
                    <div className="text-[11px] font-semibold">
                      {p === 'drag_knife' ? 'Blade' : p === 'laser' ? 'Laser' : 'Manual'}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-sand-400/80 leading-relaxed">
              {currentPreset.description}
            </p>
          </div>

          {/* Pattern Style Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-sand-300 uppercase font-gorton">
              Negative-Space Pattern Style
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handlePatternChange('ribbons')}
                className={`p-2 rounded-lg border text-left flex items-start gap-2 transition ${
                  config.patternStyle === 'ribbons'
                    ? 'border-emerald-400 bg-moss-700/80 text-white font-medium shadow-sm'
                    : 'border-sand-400/20 bg-moss-800/40 text-sand-300 hover:border-sand-400/40'
                }`}
              >
                <Waves className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold">Continuous Ribbons</div>
                  <div className="text-[10px] text-sand-400 font-normal">Cricut & Laser Safe</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handlePatternChange('webbed_halftone')}
                className={`p-2 rounded-lg border text-left flex items-start gap-2 transition ${
                  config.patternStyle === 'webbed_halftone'
                    ? 'border-emerald-400 bg-moss-700/80 text-white font-medium shadow-sm'
                    : 'border-sand-400/20 bg-moss-800/40 text-sand-300 hover:border-sand-400/40'
                }`}
              >
                <Grid className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold">Webbed Halftone</div>
                  <div className="text-[10px] text-sand-400 font-normal">Bridged Matrix</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handlePatternChange('slits')}
                className={`p-2 rounded-lg border text-left flex items-start gap-2 transition ${
                  config.patternStyle === 'slits'
                    ? 'border-emerald-400 bg-moss-700/80 text-white font-medium shadow-sm'
                    : 'border-sand-400/20 bg-moss-800/40 text-sand-300 hover:border-sand-400/40'
                }`}
              >
                <AlignJustify className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold">Stippled Slits</div>
                  <div className="text-[10px] text-sand-400 font-normal">Micro-Slits</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handlePatternChange('crosshatch')}
                className={`p-2 rounded-lg border text-left flex items-start gap-2 transition ${
                  config.patternStyle === 'crosshatch'
                    ? 'border-emerald-400 bg-moss-700/80 text-white font-medium shadow-sm'
                    : 'border-sand-400/20 bg-moss-800/40 text-sand-300 hover:border-sand-400/40'
                }`}
              >
                <Hash className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold">Crosshatch Slats</div>
                  <div className="text-[10px] text-sand-400 font-normal">Woodcut Ribs</div>
                </div>
              </button>
            </div>
          </div>

          {/* Pattern Sliders */}
          <div className="space-y-3 pt-2 border-t border-sand-400/10">
            {/* Pattern Pitch / Frequency */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-sand-300 font-medium">Pattern Pitch / Spacing</span>
                <span className="font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-moss-950/70 border border-sand-400/20">
                  {config.frequencyMm.toFixed(1)} mm
                </span>
              </div>
              <input
                type="range"
                min="1.5"
                max="10.0"
                step="0.5"
                value={config.frequencyMm}
                onChange={e => onChange(prev => enforceCutterSafety({ ...prev, frequencyMm: parseFloat(e.target.value) }))}
              />
            </div>

            {/* Min Structural Bridge Width */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-sand-300 font-medium">Min Structural Bridge Width</span>
                <span className="font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-moss-950/70 border border-sand-400/20">
                  {config.bridgeWidthMm.toFixed(1)} mm
                </span>
              </div>
              <input
                type="range"
                min={currentPreset.minSafeBridgeMm}
                max="3.5"
                step="0.1"
                value={config.bridgeWidthMm}
                onChange={e => onChange(prev => enforceCutterSafety({ ...prev, bridgeWidthMm: parseFloat(e.target.value) }))}
              />
              <div className="text-[10px] text-sand-400 flex items-center justify-between">
                <span>Safe minimum for {currentPreset.name.split(' ')[0]}: {currentPreset.minSafeBridgeMm}mm</span>
              </div>
            </div>

            {/* Gradient Blend Reach */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-sand-300 font-medium">Gradient Transition Depth</span>
                <span className="font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-moss-950/70 border border-sand-400/20">
                  {config.blendReachMm.toFixed(1)} mm
                </span>
              </div>
              <input
                type="range"
                min="1.0"
                max="15.0"
                step="0.5"
                value={config.blendReachMm}
                onChange={e => onChange(prev => ({ ...prev, blendReachMm: parseFloat(e.target.value) }))}
              />
            </div>

            {/* Pattern Angle */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-sand-300 font-medium">Pattern Angle</span>
                <span className="font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-moss-950/70 border border-sand-400/20">
                  {config.angleDeg}°
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="180"
                step="5"
                value={config.angleDeg}
                onChange={e => onChange(prev => ({ ...prev, angleDeg: parseInt(e.target.value, 10) }))}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
