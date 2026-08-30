import React, { useState, useEffect, useRef } from 'react';
import { ChromaProcessingSettings, AestheticFilterState } from '../../engine/types';
import { Shield, Sparkles } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';
import { AestheticFilterPanel } from './AestheticFilterPanel';

interface ClearancePanelProps {
  settings: ChromaProcessingSettings;
  onChange: (updater: (prev: ChromaProcessingSettings) => ChromaProcessingSettings) => void;
  aestheticFilter: AestheticFilterState;
  onAestheticFilterChange: (updater: (prev: AestheticFilterState) => AestheticFilterState) => void;
  defaultOpen?: boolean;
}

export const ClearancePanel: React.FC<ClearancePanelProps> = ({
  settings,
  onChange,
  aestheticFilter,
  onAestheticFilterChange,
  defaultOpen = false,
}) => {
  // Local state for instantaneous 60fps slider knob movement
  const [localMinFeature, setLocalMinFeature] = useState(settings.minimumFeatureSize);
  const [localSmoothing, setLocalSmoothing] = useState(settings.smoothing);
  const [localBleed, setLocalBleed] = useState(settings.underlapBleedMm);

  const throttleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setLocalMinFeature(settings.minimumFeatureSize);
  }, [settings.minimumFeatureSize]);

  useEffect(() => {
    setLocalSmoothing(settings.smoothing);
  }, [settings.smoothing]);

  useEffect(() => {
    setLocalBleed(settings.underlapBleedMm);
  }, [settings.underlapBleedMm]);

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
    <CollapsibleSection
      title="Clearance and Filters"
      icon={<Shield className="w-3.5 h-3.5 text-sand-400" />}
      defaultExpanded={defaultOpen}
    >
      <div className="space-y-4 pt-1 text-xs">
        {/* Min Clearance */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-sand-300 font-medium">Min Clearance</span>
            <span className="font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-moss-950/70 border border-sand-400/20">
              {localMinFeature <= 0 ? '0.0 mm (Off)' : `${localMinFeature.toFixed(1)} mm`}
            </span>
          </div>
          <input
            type="range"
            min="0.0"
            max="10.0"
            step="0.5"
            value={localMinFeature}
            onChange={e => {
              const val = parseFloat(e.target.value);
              setLocalMinFeature(val);
              dispatchChange(s => ({ ...s, minimumFeatureSize: val }));
            }}
            onPointerUp={e => {
              const val = parseFloat((e.target as HTMLInputElement).value);
              dispatchChange(s => ({ ...s, minimumFeatureSize: val }), true);
            }}
          />
          <div className="flex justify-between text-[10px] text-sand-400/80 px-0.5">
            <span>0mm (Off)</span>
            <span>2.5mm (Default)</span>
            <span>10.0mm</span>
          </div>
          <p className="text-[10px] text-sand-400/80 leading-relaxed">
            Eliminates fragile specks, islands, and skinny bridges narrower than your blade/laser cutting kerf.
          </p>
        </div>

        {/* Curve Smoothing */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-sand-300 font-medium">Curve Smoothing</span>
            <span className="font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-moss-950/70 border border-sand-400/20">
              {localSmoothing}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={localSmoothing}
            onChange={e => {
              const val = parseInt(e.target.value, 10);
              setLocalSmoothing(val);
              dispatchChange(s => ({ ...s, smoothing: val }));
            }}
            onPointerUp={e => {
              const val = parseInt((e.target as HTMLInputElement).value, 10);
              dispatchChange(s => ({ ...s, smoothing: val }), true);
            }}
          />
          <p className="text-[10px] text-sand-400/80 leading-relaxed">
            Organically fillets acute internal/external notches and smooths pixel staircasing into fluid papercraft curves.
          </p>
        </div>

        {/* Underlap Seam Bleed (Stacked Relief Mode) */}
        {settings.assemblyMode === 'stacked_relief' && (
          <div className="space-y-1.5 pt-2 border-t border-sand-400/10">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-sand-300 font-medium">Underlap Seam Bleed</span>
              <span className="font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-moss-950/70 border border-sand-400/20">
                +{localBleed.toFixed(1)} mm
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.5"
              step="0.1"
              value={localBleed}
              onChange={e => {
                const val = parseFloat(e.target.value);
                setLocalBleed(val);
                dispatchChange(s => ({ ...s, underlapBleedMm: val }));
              }}
              onPointerUp={e => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                dispatchChange(s => ({ ...s, underlapBleedMm: val }), true);
              }}
            />
            <p className="text-[10px] text-sand-400/80 leading-relaxed">
              Dilates lower layers beneath upper sheets to prevent visible cut seams or alignment gaps.
            </p>
          </div>
        )}

        {/* Integrated Stylization / Aesthetic Filters Section */}
        <div className="pt-3 border-t border-sand-400/10 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-sand-300 uppercase font-gorton">
            <Sparkles className="w-3.5 h-3.5 text-sand-400" />
            <span>Stylization Filters</span>
          </div>
          <AestheticFilterPanel
            filterState={aestheticFilter}
            onChange={onAestheticFilterChange}
          />
        </div>
      </div>
    </CollapsibleSection>
  );
};
