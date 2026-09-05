import React, { useState } from 'react';
import { SurfaceTextureConfig, TexturePatternStyle, CutterPreset, TextureMode } from '../../engine/texturing/types';
import { CUTTER_PRESETS, applyCutterPreset, isBelowSafeThreshold, enforceCutterSafety } from '../../engine/texturing/cutterPresets';
import { Sparkles, Scissors, ShieldAlert, Waves, Grid, AlignJustify, Hash, Layers, SlidersHorizontal, Info } from 'lucide-react';

interface SurfaceTexturePanelProps {
  config: SurfaceTextureConfig;
  onChange: (updater: (prev: SurfaceTextureConfig) => SurfaceTextureConfig) => void;
}

export const SurfaceTexturePanel: React.FC<SurfaceTexturePanelProps> = ({
  config,
  onChange,
}) => {
  const currentPreset = CUTTER_PRESETS[config.cutterPreset] || CUTTER_PRESETS.drag_knife;
  const isSafetyWarning = isBelowSafeThreshold(config);

  // Local state for freeform decimal angle editing
  const [isEditingAngle, setIsEditingAngle] = useState(false);
  const [angleInputText, setAngleInputText] = useState(config.angleDeg.toString());

  const handlePatternChange = (style: TexturePatternStyle) => {
    onChange(prev => enforceCutterSafety({ ...prev, patternStyle: style, enabled: true }));
  };

  const handlePresetChange = (preset: CutterPreset) => {
    onChange(prev => applyCutterPreset(prev, preset));
  };

  const handleModeChange = (mode: TextureMode) => {
    onChange(prev => ({ ...prev, textureMode: mode }));
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
          {/* Target Cutter Preset */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-sand-300 uppercase font-gorton flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-emerald-400" />
                <span>Target Cutter Preset</span>
              </label>
              {isSafetyWarning && (
                <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium" title="Current bridges or slots are below recommended mechanical guidelines for this cutter.">
                  <ShieldAlert className="w-3 h-3" />
                  <span>Below rec.</span>
                </span>
              )}
            </div>
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

          {/* Mode Selector: Full-Field vs Boundary Gradient */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-sand-300 uppercase font-gorton flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Application Mode</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handleModeChange('full_field')}
                className={`py-2 px-2.5 rounded border text-left transition ${
                  (config.textureMode || 'full_field') === 'full_field'
                    ? 'border-emerald-400 bg-moss-700/80 text-white font-medium shadow-sm'
                    : 'border-sand-400/20 bg-moss-800/40 text-sand-300 hover:border-sand-400/40'
                }`}
              >
                <div className="text-[11px] font-semibold">Full-Field Texture</div>
                <div className="text-[9px] text-sand-400 font-normal leading-tight mt-0.5">
                  Tone-mapped across entire layer
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('boundary')}
                className={`py-2 px-2.5 rounded border text-left transition ${
                  config.textureMode === 'boundary'
                    ? 'border-emerald-400 bg-moss-700/80 text-white font-medium shadow-sm'
                    : 'border-sand-400/20 bg-moss-800/40 text-sand-300 hover:border-sand-400/40'
                }`}
              >
                <div className="text-[11px] font-semibold">Boundary Gradient</div>
                <div className="text-[9px] text-sand-400 font-normal leading-tight mt-0.5">
                  Feathers edges into underlying sheet
                </div>
              </button>
            </div>
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
                  <div className="text-[10px] text-sand-400 font-normal">Bridged Slats</div>
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
                  <div className="text-[10px] text-sand-400 font-normal">Staggered Matrix</div>
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
                  <div className="text-[10px] text-sand-400 font-normal">Capsule Slots</div>
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
                  <div className="text-[10px] text-sand-400 font-normal">Woodcut Grate</div>
                </div>
              </button>
            </div>
          </div>

          {/* Bridging Tabs Toggle */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-moss-900/60 border border-sand-400/15">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold text-sand-200">Paper Bridging Tabs</span>
              <p className="text-[10px] text-sand-400/80 leading-tight">
                Adds transverse ties across slots to prevent paper tearing on cutters
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.bridgingTabsEnabled !== false}
              onChange={e => onChange(prev => ({ ...prev, bridgingTabsEnabled: e.target.checked }))}
              className="w-3.5 h-3.5 accent-emerald-400 cursor-pointer rounded bg-moss-950 border-sand-400/30"
            />
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
                min="1.0"
                max="12.0"
                step="0.2"
                value={config.frequencyMm}
                onChange={e => onChange(prev => enforceCutterSafety({ ...prev, frequencyMm: parseFloat(e.target.value) }))}
              />
            </div>

            {/* Min Structural Bridge Width */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-sand-300 font-medium">Structural Bridge Width</span>
                <span className={`font-mono font-semibold px-2 py-0.5 rounded bg-moss-950/70 border ${
                  config.bridgeWidthMm < currentPreset.minSafeBridgeMm
                    ? 'border-amber-400/40 text-amber-300'
                    : 'border-sand-400/20 text-emerald-400'
                }`}>
                  {config.bridgeWidthMm.toFixed(1)} mm
                </span>
              </div>
              <input
                type="range"
                min="0.2"
                max="4.0"
                step="0.1"
                value={config.bridgeWidthMm}
                onChange={e => onChange(prev => enforceCutterSafety({ ...prev, bridgeWidthMm: parseFloat(e.target.value) }))}
              />
              <div className="text-[10px] text-sand-400 flex items-center justify-between">
                <span>Recommended min for {currentPreset.name.split(' ')[0]}: {currentPreset.minSafeBridgeMm} mm</span>
              </div>
            </div>

            {/* Slot / Kerf Aperture Width (for Slits, Ribbons, Crosshatch) */}
            {(config.patternStyle === 'slits' || config.patternStyle === 'ribbons' || config.patternStyle === 'crosshatch') && (
              <div className="space-y-1.5 animate-fade-in">
                <div className="flex justify-between text-[11px]">
                  <span className="text-sand-300 font-medium">Slot Cut Width (Kerf)</span>
                  <span className={`font-mono font-semibold px-2 py-0.5 rounded bg-moss-950/70 border ${
                    (config.slotWidthMm || 0.8) < currentPreset.minSlotWidthMm
                      ? 'border-amber-400/40 text-amber-300'
                      : 'border-sand-400/20 text-emerald-400'
                  }`}>
                    {(config.slotWidthMm || 0.8).toFixed(1)} mm
                  </span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.1"
                  value={config.slotWidthMm || 0.8}
                  onChange={e => onChange(prev => enforceCutterSafety({ ...prev, slotWidthMm: parseFloat(e.target.value) }))}
                />
                <div className="text-[10px] text-sand-400 flex items-center justify-between">
                  <span>Blade safe kerf: {currentPreset.minSlotWidthMm} mm</span>
                </div>
              </div>
            )}

            {/* Gradient Transition Depth (Boundary Mode) */}
            {config.textureMode === 'boundary' && (
              <div className="space-y-1.5 animate-fade-in">
                <div className="flex justify-between text-[11px]">
                  <span className="text-sand-300 font-medium">Boundary Feather Reach</span>
                  <span className="font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-moss-950/70 border border-sand-400/20">
                    {config.blendReachMm.toFixed(1)} mm
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="20.0"
                  step="0.5"
                  value={config.blendReachMm}
                  onChange={e => onChange(prev => ({ ...prev, blendReachMm: parseFloat(e.target.value) }))}
                />
              </div>
            )}

            {/* Pattern Angle */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-sand-300 font-medium">Pattern Angle</span>
                <div className="flex items-center gap-0.5 font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-moss-950/70 border border-sand-400/20 focus-within:border-emerald-400/60 transition">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={
                      isEditingAngle
                        ? angleInputText
                        : config.angleDeg % 1 === 0
                        ? config.angleDeg.toString()
                        : Number(config.angleDeg.toFixed(2)).toString()
                    }
                    onFocus={() => {
                      setIsEditingAngle(true);
                      setAngleInputText(
                        config.angleDeg % 1 === 0
                          ? config.angleDeg.toString()
                          : Number(config.angleDeg.toFixed(2)).toString()
                      );
                    }}
                    onChange={e => {
                      setAngleInputText(e.target.value);
                    }}
                    onBlur={() => {
                      setIsEditingAngle(false);
                      const parsed = parseFloat(angleInputText);
                      if (!isNaN(parsed)) {
                        const clamped = Math.max(0, Math.min(360, Math.round(parsed * 100) / 100));
                        onChange(prev => ({ ...prev, angleDeg: clamped }));
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="w-12 bg-transparent text-right text-emerald-400 font-mono font-semibold focus:outline-none p-0 text-[11px]"
                  />
                  <span className="text-[11px] select-none text-emerald-400/70">°</span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="180"
                step="5"
                value={Math.max(0, Math.min(180, Math.round(config.angleDeg / 5) * 5))}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  onChange(prev => ({ ...prev, angleDeg: val }));
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
