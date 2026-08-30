import React from 'react';
import { UserPreferences, WorkbenchTheme, PaperTextureType, DEFAULT_PREFERENCES } from '../../state/preferences';
import { X, Sliders, SunMedium, Layers, Sparkles, Cookie, RotateCcw, Check } from 'lucide-react';

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onUpdate: (updater: (prev: UserPreferences) => UserPreferences) => void;
}

export const PreferencesModal: React.FC<PreferencesModalProps> = ({
  isOpen,
  onClose,
  preferences,
  onUpdate,
}) => {
  if (!isOpen) return null;

  const handleResetDefaults = () => {
    onUpdate(prev => ({
      ...DEFAULT_PREFERENCES,
      enableCookiePersistence: prev.enableCookiePersistence,
      cookieConsentAccepted: prev.cookieConsentAccepted,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in print-hide">
      <div className="relative w-full max-w-lg rounded-xl bg-moss-900 border border-sand-400/25 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-sand-400/15 bg-moss-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-semibold text-sand-100 font-gorton tracking-wide">
                Workspace Preferences & Simulation
              </h2>
              <p className="text-[11px] text-sand-400">
                Customize textures, shadows, and backdrop without altering raw SVG cut files.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-sand-400 hover:text-sand-100 hover:bg-moss-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto text-xs text-sand-200 flex-1">
          {/* SECTION 1: Workbench Backdrop Theme */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-sand-300 font-gorton">
              <span className="flex items-center gap-1.5">
                <SunMedium className="w-3.5 h-3.5 text-sand-400" /> Workbench Backdrop Theme
              </span>
              <span className="text-[11px] text-emerald-400 font-mono font-normal">
                {preferences.workbenchTheme === 'drafting'
                  ? 'Drafting Pad'
                  : preferences.workbenchTheme === 'cutting_mat'
                  ? 'Cutting Mat'
                  : 'Neutral Gray'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'drafting', name: 'Drafting Pad', desc: 'Dot grid paper' },
                { id: 'cutting_mat', name: 'Cutting Mat', desc: 'Workshop grid' },
                { id: 'clean_gray', name: 'Neutral Gray', desc: 'Photo vignette' },
              ].map(t => {
                const isSelected = preferences.workbenchTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onUpdate(p => ({ ...p, workbenchTheme: t.id as WorkbenchTheme }))}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-emerald-400 bg-moss-700/80 text-white font-medium shadow-sm'
                        : 'border-sand-400/20 bg-moss-800/40 text-sand-300 hover:border-sand-400/40'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold text-xs text-sand-100">
                      <span>{t.name}</span>
                      {isSelected && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                    </div>
                    <div className="text-[10px] text-sand-400 mt-0.5">{t.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: Tactile Paper Textures */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-sand-300 font-gorton">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sand-400" /> Tactile Cardstock Texture
              </span>
              <span className="text-[11px] text-emerald-400 font-mono font-normal">
                {preferences.paperTexture === 'none'
                  ? 'Smooth / Flat'
                  : preferences.paperTexture === 'bristol'
                  ? 'Hot-Press Bristol'
                  : 'Cold-Press Rag'}
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-moss-950/60 border border-sand-400/20 space-y-3.5">
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: 'none', name: 'Smooth / Flat', desc: 'Flat vector sheets' },
                  { id: 'bristol', name: 'Hot-Press Bristol', desc: 'Fine tooth satin' },
                  { id: 'watercolor', name: 'Cold-Press Rag', desc: 'Cotton dimpled relief' },
                ].map(tex => {
                  const isSelected = preferences.paperTexture === tex.id;
                  return (
                    <button
                      key={tex.id}
                      type="button"
                      onClick={() => onUpdate(p => ({ ...p, paperTexture: tex.id as PaperTextureType }))}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'border-emerald-400 bg-moss-700/80 text-white font-medium shadow-sm'
                          : 'border-sand-400/20 bg-moss-800/40 text-sand-300 hover:border-sand-400/40'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold text-xs text-sand-100">
                        <span>{tex.name}</span>
                        {isSelected && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                      </div>
                      <div className="text-[10px] text-sand-400 mt-0.5">{tex.desc}</div>
                    </button>
                  );
                })}
              </div>

              {preferences.paperTexture !== 'none' && (
                <div className="pt-2 border-t border-sand-400/10 space-y-1.5">
                  <div className="flex justify-between text-[11px] text-sand-300">
                    <span className="font-medium">
                      Texture Prominence ({preferences.paperTexture === 'bristol' ? 'Bristol' : 'Cold-Press'})
                    </span>
                    <span className="font-mono text-emerald-400 font-semibold">{preferences.paperTextureOpacity}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={preferences.paperTextureOpacity}
                    onChange={e => onUpdate(p => ({ ...p, paperTextureOpacity: Number(e.target.value) }))}
                  />
                  <p className="text-[10px] text-sand-400/80 leading-relaxed">
                    Adjusts tactile relief depth and grain opacity in Composite 3D view.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: 3D Stack Simulated Shadow Depth & Color */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-sand-300 font-gorton">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sand-400" /> Physical 3D Stack Shadow Lighting
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-moss-950/60 border border-sand-400/20 space-y-3">
              {/* Shadow Depth Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-sand-300">
                  <span className="font-medium">Layer Drop Shadow Depth</span>
                  <span className="font-mono text-emerald-400 font-semibold">{preferences.shadowDepth} px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="16"
                  step="1"
                  value={preferences.shadowDepth}
                  onChange={e => onUpdate(p => ({ ...p, shadowDepth: Number(e.target.value) }))}
                />
                <p className="text-[10px] text-sand-400/80 leading-relaxed">
                  Simulates realistic paper cardstock thickness and edge shadow in Composite View.
                </p>
              </div>

              {/* Shadow Darkness Slider */}
              <div className="space-y-1.5 pt-2 border-t border-sand-400/10">
                <div className="flex justify-between text-[11px] text-sand-300">
                  <span className="font-medium">Layer Shadow Darkness</span>
                  <span className="font-mono text-emerald-400 font-semibold">{preferences.shadowOpacity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="70"
                  step="5"
                  value={preferences.shadowOpacity}
                  onChange={e => onUpdate(p => ({ ...p, shadowOpacity: Number(e.target.value) }))}
                />
              </div>

              {/* Drop Shadow Color Picker with Reset to Pure Black */}
              <div className="space-y-2 pt-2 border-t border-sand-400/10">
                <div className="flex items-center justify-between text-[11px] text-sand-300">
                  <span className="font-medium">Drop Shadow Color / Tint</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={preferences.shadowColor || '#000000'}
                      onChange={e => onUpdate(p => ({ ...p, shadowColor: e.target.value }))}
                      className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent shrink-0"
                      title="Select custom shadow tint"
                    />
                    <span className="font-mono text-[11px] text-sand-400 uppercase">
                      {preferences.shadowColor || '#000000'}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => onUpdate(p => ({ ...p, shadowColor: '#000000' }))}
                    className="px-2.5 py-1 rounded bg-moss-800/80 hover:bg-moss-700 border border-sand-400/25 text-sand-200 text-[10px] flex items-center gap-1.5 transition-colors"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-black border border-sand-400/40" />
                    <span>Reset to Pure Black</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: Storage & Session Persistence */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-sand-300 font-gorton">
              <span className="flex items-center gap-1.5">
                <Cookie className="w-3.5 h-3.5 text-sand-400" /> Storage & Session Persistence
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-moss-950/60 border border-sand-400/20 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer text-sand-200">
                <input
                  type="checkbox"
                  checked={preferences.enableCookiePersistence}
                  onChange={e =>
                    onUpdate(p => ({
                      ...p,
                      enableCookiePersistence: e.target.checked,
                      cookieConsentAccepted: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 mt-0.5 rounded text-emerald-600 bg-moss-950 border-sand-400/30 shrink-0"
                />
                <div>
                  <div className="font-medium text-xs text-sand-100">Remember Settings Between Sessions</div>
                  <div className="text-[10px] text-sand-400/80 leading-relaxed">
                    Save your custom sliders, canvas defaults, and visual preferences in browser storage. Disabling clears saved data.
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-sand-400/15 bg-moss-950/60 flex items-center justify-between shrink-0 text-xs">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-1.5 rounded-lg bg-moss-800/80 hover:bg-moss-700 text-sand-300 hover:text-white border border-sand-400/25 flex items-center gap-1.5 transition-colors"
            title="Reset all settings to defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Defaults</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
