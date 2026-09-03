import React, { useState, useEffect, useRef } from 'react';
import { AestheticFilterState, AestheticFilterType } from '../../engine/types';
import { Sparkles, Grid, Hexagon, RefreshCw } from 'lucide-react';

interface AestheticFilterPanelProps {
  filterState: AestheticFilterState;
  onChange: (updater: (prev: AestheticFilterState) => AestheticFilterState) => void;
}

export const AestheticFilterPanel: React.FC<AestheticFilterPanelProps> = ({
  filterState,
  onChange,
}) => {
  const [localBlockSize, setLocalBlockSize] = useState(filterState.pixelate.blockSizeMm);
  const [localFacetCount, setLocalFacetCount] = useState(filterState.voronoi.facetCount);
  const [localJitter, setLocalJitter] = useState(filterState.voronoi.jitter);

  const throttleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setLocalBlockSize(filterState.pixelate.blockSizeMm);
  }, [filterState.pixelate.blockSizeMm]);

  useEffect(() => {
    setLocalFacetCount(filterState.voronoi.facetCount);
  }, [filterState.voronoi.facetCount]);

  useEffect(() => {
    setLocalJitter(filterState.voronoi.jitter);
  }, [filterState.voronoi.jitter]);

  const dispatchChange = (updater: (prev: AestheticFilterState) => AestheticFilterState, immediate: boolean = false) => {
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

  const handleTypeSelect = (type: AestheticFilterType) => {
    dispatchChange(prev => ({
      ...prev,
      enabled: type !== 'none',
      type,
    }), true);
  };

  return (
    <div className="space-y-3.5 text-xs">
      {/* Filter Type Segmented Buttons */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-moss-950/60 border border-sand-400/20">
        <button
          type="button"
          onClick={() => handleTypeSelect('none')}
          className={`py-1.5 px-2 rounded font-medium text-center transition-all ${
            filterState.type === 'none' || !filterState.enabled
              ? 'bg-moss-700 text-white shadow-sm'
              : 'text-sand-400 hover:text-sand-200'
          }`}
        >
          None
        </button>

        <button
          type="button"
          onClick={() => handleTypeSelect('pixelate')}
          className={`py-1.5 px-2 rounded font-medium text-center flex items-center justify-center gap-1 transition-all ${
            filterState.type === 'pixelate' && filterState.enabled
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-sand-400 hover:text-sand-200'
          }`}
        >
          <Grid className="w-3 h-3" />
          <span>Pixelate</span>
        </button>

        <button
          type="button"
          onClick={() => handleTypeSelect('voronoi')}
          className={`py-1.5 px-2 rounded font-medium text-center flex items-center justify-center gap-1 transition-all ${
            filterState.type === 'voronoi' && filterState.enabled
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-sand-400 hover:text-sand-200'
          }`}
        >
          <Hexagon className="w-3 h-3" />
          <span>Voronoi</span>
        </button>
      </div>

      {/* Pixelate Configuration */}
      {filterState.enabled && filterState.type === 'pixelate' && (
        <div className="space-y-3 pt-1 animate-fade-in">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-sand-300">Block Grid Size</span>
              <span className="font-mono text-sand-400">
                {localBlockSize.toFixed(1)} mm
              </span>
            </div>
            <input
              type="range"
              min="1.0"
              max="15.0"
              step="0.5"
              value={localBlockSize}
              onChange={e => {
                const val = parseFloat(e.target.value);
                setLocalBlockSize(val);
                dispatchChange(prev => ({
                  ...prev,
                  pixelate: { ...prev.pixelate, blockSizeMm: val },
                }));
              }}
              onPointerUp={e => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                dispatchChange(prev => ({
                  ...prev,
                  pixelate: { ...prev.pixelate, blockSizeMm: val },
                }), true);
              }}
            />
          </div>
        </div>
      )}

      {/* Voronoi Configuration */}
      {filterState.enabled && filterState.type === 'voronoi' && (
        <div className="space-y-3 pt-1 animate-fade-in">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-sand-300">Facet Density</span>
              <span className="font-mono text-sand-400">{localFacetCount} facets</span>
            </div>
            <input
              type="range"
              min="30"
              max="400"
              step="10"
              value={localFacetCount}
              onChange={e => {
                const val = parseInt(e.target.value, 10);
                setLocalFacetCount(val);
                dispatchChange(prev => ({
                  ...prev,
                  voronoi: { ...prev.voronoi, facetCount: val },
                }));
              }}
              onPointerUp={e => {
                const val = parseInt((e.target as HTMLInputElement).value, 10);
                dispatchChange(prev => ({
                  ...prev,
                  voronoi: { ...prev.voronoi, facetCount: val },
                }), true);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-sand-300">Edge Jitter</span>
              <span className="font-mono text-sand-400">{localJitter}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={localJitter}
              onChange={e => {
                const val = parseInt(e.target.value, 10);
                setLocalJitter(val);
                dispatchChange(prev => ({
                  ...prev,
                  voronoi: { ...prev.voronoi, jitter: val },
                }));
              }}
              onPointerUp={e => {
                const val = parseInt((e.target as HTMLInputElement).value, 10);
                dispatchChange(prev => ({
                  ...prev,
                  voronoi: { ...prev.voronoi, jitter: val },
                }), true);
              }}
            />
          </div>

          <div className="pt-1 flex items-center justify-between">
            <span className="text-[11px] text-sand-400">Jitter Seed #{filterState.voronoi.seed}</span>
            <button
              type="button"
              onClick={() => {
                dispatchChange(prev => ({
                  ...prev,
                  voronoi: { ...prev.voronoi, seed: (prev.voronoi.seed + 1) % 9999 },
                }), true);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-moss-800/60 border border-sand-400/20 hover:border-sand-400/40 text-sand-200 text-[10px] transition-colors"
            >
              <RefreshCw className="w-3 h-3 text-sand-400" />
              <span>Reshuffle</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
