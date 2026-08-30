import React from 'react';
import { ChromaLayerState, VectorLayerResult } from '../../engine/types';
import { hexToOklab, oklabToOklch } from '../../engine/chroma/oklab';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface LayerManagerPanelProps {
  layers: ChromaLayerState[];
  selectedLayerId: string | null;
  onSelectLayer: (layerId: string) => void;
  onUpdateLayer: (layerId: string, updater: (prev: ChromaLayerState) => ChromaLayerState) => void;
  onReorderLayers: (newLayers: ChromaLayerState[]) => void;
  vectorResults: Map<string, VectorLayerResult>;
  pixelPercentages: number[];
}

export const LayerManagerPanel: React.FC<LayerManagerPanelProps> = ({
  layers,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  onReorderLayers,
  vectorResults,
  pixelPercentages,
}) => {
  // Sort from Top sheet (highest order) down to Base sheet (order 0)
  const sortedLayers = [...layers].sort((a, b) => b.order - a.order);

  const moveLayer = (layerId: string, direction: 'up' | 'down') => {
    const currentOrder = layers.find(l => l.id === layerId)?.order;
    if (currentOrder === undefined) return;

    const targetOrder = direction === 'up' ? currentOrder + 1 : currentOrder - 1;
    if (targetOrder < 0 || targetOrder >= layers.length) return;

    const otherLayer = layers.find(l => l.order === targetOrder);
    if (!otherLayer) return;

    const newLayers = layers.map(l => {
      if (l.id === layerId) return { ...l, order: targetOrder };
      if (l.id === otherLayer.id) return { ...l, order: currentOrder };
      return l;
    });

    onReorderLayers(newLayers);
  };

  const handleColorChange = (layerId: string, newHex: string) => {
    const lab = hexToOklab(newHex);
    const lch = oklabToOklch(lab.L, lab.a, lab.b);

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

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between text-[11px] text-sand-400 pb-1 border-b border-sand-400/10">
        <span className="font-gorton uppercase">Stack Z-Order (Top to Base)</span>
        <span className="font-mono">{layers.length} Layers</span>
      </div>

      <div className="space-y-1.5">
        {sortedLayers.map((layer) => {
          const isSelected = selectedLayerId === layer.id;
          const isBase = layer.order === 0;
          const isTop = layer.order === layers.length - 1;
          const isSolid = layer.isSolidBacking !== false;
          const vec = vectorResults.get(layer.id);
          const coveragePct = pixelPercentages[layer.order] ?? vec?.areaPercentage ?? 0;

          return (
            <div
              key={layer.id}
              onClick={() => onSelectLayer(layer.id)}
              className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? 'border-emerald-400 bg-moss-700/80 shadow-md ring-1 ring-emerald-400/30'
                  : 'border-sand-400/15 bg-moss-800/40 hover:bg-moss-800/70 hover:border-sand-400/30'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                {/* Color Swatch Chip & Label */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative group shrink-0">
                    <input
                      type="color"
                      value={layer.swatch.hex}
                      disabled={isBase && !isSolid}
                      onClick={e => e.stopPropagation()}
                      onChange={e => handleColorChange(layer.id, e.target.value)}
                      className={`absolute inset-0 opacity-0 cursor-pointer w-6 h-6 z-10 ${
                        isBase && !isSolid ? 'cursor-not-allowed pointer-events-none' : ''
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
                        {isBase ? 'Base Foundation' : `Layer ${layer.order + 1}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-sand-400 font-mono">
                      <span>{isBase && !isSolid ? 'TRANSPARENT' : layer.swatch.hex.toUpperCase()}</span>
                      <span>•</span>
                      <span>{isBase && isSolid ? '100% area' : `${coveragePct.toFixed(1)}% area`}</span>
                      {vec?.pathCount !== undefined && vec.pathCount > 0 && (
                        <>
                          <span>•</span>
                          <span>{vec.pathCount} paths</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right controls: Solid/Void switch for Base, or Order arrows for other layers */}
                <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
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
