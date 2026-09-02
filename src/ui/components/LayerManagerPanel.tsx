import React from 'react';
import { ChromaLayerState, VectorLayerResult } from '../../engine/types';
import { Layers, ArrowUp, ArrowDown, Palette, RotateCcw } from 'lucide-react';
import { hexToOklab, hexToOklch } from '../../engine/chroma/oklab';

interface LayerManagerPanelProps {
  layers: ChromaLayerState[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string) => void;
  onUpdateLayer: (id: string, updater: (prev: ChromaLayerState) => ChromaLayerState) => void;
  onReorderLayers: (newLayers: ChromaLayerState[]) => void;
  vectorResults: Map<string, VectorLayerResult>;
  pixelPercentages?: number[];
}

export const LayerManagerPanel: React.FC<LayerManagerPanelProps> = ({
  layers,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  onReorderLayers,
  vectorResults,
  pixelPercentages = [],
}) => {
  // Sort layers from top of physical stack down to base
  // Top layer = highest order, Base = order 0
  const visualStack = [...layers].sort((a, b) => b.order - a.order);

  const moveLayer = (id: string, direction: 'up' | 'down') => {
    const sorted = [...layers].sort((a, b) => a.order - b.order);
    const currentIndex = sorted.findIndex(l => l.id === id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    // Swap order values
    const newSorted = [...sorted];
    const temp = newSorted[currentIndex];
    newSorted[currentIndex] = newSorted[targetIndex];
    newSorted[targetIndex] = temp;

    const reordered = newSorted.map((layer, index) => ({
      ...layer,
      order: index,
    }));

    onReorderLayers(reordered);
  };

  const handleColorChange = (layerId: string, newHex: string) => {
    const lab = hexToOklab(newHex);
    const lch = hexToOklch(newHex);

    onUpdateLayer(layerId, prev => ({
      ...prev,
      swatch: {
        ...prev.swatch,
        hex: newHex,
        oklab: [lab.L, lab.a, lab.b],
        oklch: [lch.L, lch.C, lch.h],
      },
    }));
  };

  const handleResetToComputed = (layerId: string, computedHex: string) => {
    const lab = hexToOklab(computedHex);
    const lch = hexToOklch(computedHex);

    onUpdateLayer(layerId, prev => ({
      ...prev,
      swatch: {
        ...prev.swatch,
        hex: computedHex,
        oklab: [lab.L, lab.a, lab.b],
        oklch: [lch.L, lch.C, lch.h],
      },
    }));
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between text-[11px] text-sand-400 font-gorton uppercase">
        <span>Z-Stack (Top to Base Sheet)</span>
        <span>{layers.length} Layers</span>
      </div>

      <div className="space-y-1.5">
        {visualStack.map((layer, visualIdx) => {
          const isSelected = layer.id === selectedLayerId;
          const isBase = layer.order === 0;
          const isTop = layer.order === layers.length - 1;
          const isSolid = layer.isSolidBacking !== false;
          const isCustomColor =
            layer.swatch.computedHex &&
            layer.swatch.hex.toLowerCase() !== layer.swatch.computedHex.toLowerCase();

          const vec = vectorResults.get(layer.id);
          const coveragePct = pixelPercentages[layer.order] ?? 0;

          return (
            <div
              key={layer.id}
              onClick={() => onSelectLayer(layer.id)}
              className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? 'border-emerald-400 bg-moss-800/80 shadow-md ring-1 ring-emerald-400/40'
                  : 'border-sand-400/20 bg-moss-900/60 hover:bg-moss-800/40 hover:border-sand-400/35'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                {/* Left: Swatch picker & Label */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0 flex items-center justify-center">
                    <input
                      type="color"
                      disabled={isBase && !isSolid}
                      value={isBase && !isSolid ? '#000000' : layer.swatch.hex}
                      onChange={e => handleColorChange(layer.id, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className={`absolute inset-0 w-full h-full opacity-0 cursor-pointer ${
                        isBase && !isSolid ? 'pointer-events-none' : ''
                      }`}
                      title={isBase && !isSolid ? "Void mode (transparent)" : "Change layer color"}
                    />
                    <div
                      className={`w-6 h-6 rounded-md border border-white/25 shadow-inner transition-opacity ${
                        isBase && !isSolid ? 'opacity-30 border-dashed' : ''
                      }`}
                      style={{ backgroundColor: isBase && !isSolid ? 'transparent' : layer.swatch.hex }}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sand-100 text-xs truncate">
                        {isBase ? 'Layer 0 (Base)' : `Layer ${layer.order}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-sand-400 font-mono">
                      <span>{isBase && !isSolid ? 'TRANSPARENT' : layer.swatch.hex.toUpperCase()}</span>
                      <span className="text-sand-600">|</span>
                      <span>{isBase && isSolid ? '100% area' : `${coveragePct.toFixed(1)}% area`}</span>
                      {vec?.pathCount !== undefined && vec.pathCount > 0 && (
                        <>
                          <span className="text-sand-600">|</span>
                          <span>{vec.pathCount} paths</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right controls: Persistent Reset button, Solid/Void switch for Base, or Order arrows */}
                <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                  {!isBase && (
                    <button
                      type="button"
                      disabled={!isCustomColor}
                      onClick={() => handleResetToComputed(layer.id, layer.swatch.computedHex!)}
                      className={`p-1 rounded transition-colors ${
                        isCustomColor
                          ? 'text-sand-400 hover:text-emerald-400 hover:bg-moss-950 cursor-pointer'
                          : 'text-sand-700 opacity-20 pointer-events-none cursor-default'
                      }`}
                      title={isCustomColor ? `Reset to computed centroid (${layer.swatch.computedHex!.toUpperCase()})` : undefined}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {isBase ? (
                    <button
                      type="button"
                      onClick={() => onUpdateLayer(layer.id, prev => ({ ...prev, isSolidBacking: !isSolid }))}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border transition ${
                        isSolid
                          ? 'bg-emerald-700/80 text-white border-emerald-600/60 shadow-sm'
                          : 'bg-moss-900 text-sand-400 border-sand-800 hover:text-sand-200'
                      }`}
                      title={isSolid ? "Solid paper backing sheet (Default)" : "Void (Transparent empty space behind stack)"}
                    >
                      {isSolid ? 'Solid' : 'Void'}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={isTop}
                        onClick={() => moveLayer(layer.id, 'up')}
                        className="p-1 rounded text-sand-400 hover:text-sand-100 hover:bg-moss-900 disabled:opacity-25 transition-colors"
                        title="Move Layer Higher in Stack"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isBase}
                        onClick={() => moveLayer(layer.id, 'down')}
                        className="p-1 rounded text-sand-400 hover:text-sand-100 hover:bg-moss-900 disabled:opacity-25 transition-colors"
                        title="Move Layer Lower in Stack"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
