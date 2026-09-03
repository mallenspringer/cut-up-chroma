import React, { useState } from 'react';
import { ChromaLayerState, VectorLayerResult } from '../../engine/types';
import { Layers, Palette, RotateCcw, GripVertical } from 'lucide-react';
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
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);

  // Sort layers from top of physical stack down to base
  // Top layer = highest order, Base = order 0
  const visualStack = [...layers].sort((a, b) => b.order - a.order);

  const handleDragStart = (e: React.DragEvent, layerId: string) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', layerId);
    setDraggedLayerId(layerId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverLayerId !== targetId) {
      setDragOverLayerId(targetId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedLayerId || draggedLayerId === targetId) {
      setDraggedLayerId(null);
      setDragOverLayerId(null);
      return;
    }

    const currentVisual = [...visualStack];
    const fromIdx = currentVisual.findIndex(l => l.id === draggedLayerId);
    let toIdx = currentVisual.findIndex(l => l.id === targetId);

    if (fromIdx === -1 || toIdx === -1) {
      setDraggedLayerId(null);
      setDragOverLayerId(null);
      return;
    }

    // Base layer (order 0) is always pinned at the bottom of visualStack
    const baseIndex = currentVisual.length - 1;
    if (toIdx === baseIndex) {
      toIdx = baseIndex - 1; // Drop immediately above base
    }

    const reorderedVisual = [...currentVisual];
    const [moved] = reorderedVisual.splice(fromIdx, 1);
    reorderedVisual.splice(toIdx, 0, moved);

    // Reassign orders: bottom item has order 0 (Base), top has order N-1
    const total = reorderedVisual.length;
    const newLayers = reorderedVisual.map((layer, vIdx) => ({
      ...layer,
      order: total - 1 - vIdx,
    }));

    onReorderLayers(newLayers);
    setDraggedLayerId(null);
    setDragOverLayerId(null);
  };

  const handleDragEnd = () => {
    setDraggedLayerId(null);
    setDragOverLayerId(null);
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
              draggable={!isBase}
              onDragStart={e => !isBase && handleDragStart(e, layer.id)}
              onDragOver={e => handleDragOver(e, layer.id)}
              onDrop={e => handleDrop(e, layer.id)}
              onDragEnd={handleDragEnd}
              onClick={() => onSelectLayer(layer.id)}
              className={`p-2 rounded-lg border transition-all cursor-pointer ${
                draggedLayerId === layer.id
                  ? 'opacity-40 scale-[0.99] border-dashed border-emerald-400/60'
                  : dragOverLayerId === layer.id
                  ? 'border-emerald-400 bg-moss-800/90 ring-1 ring-emerald-400 shadow-md'
                  : isSelected
                  ? 'border-emerald-400 bg-moss-800/80 shadow-md ring-1 ring-emerald-400/40'
                  : 'border-sand-400/20 bg-moss-900/60 hover:bg-moss-800/40 hover:border-sand-400/35'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                {/* Left: Swatch picker & Label */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
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

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 leading-tight">
                      <span className="font-semibold text-sand-100 text-xs truncate">
                        {isBase ? 'Layer 0 (Base)' : `Layer ${layer.order}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-sand-400 font-mono leading-tight whitespace-nowrap overflow-hidden">
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

                {/* Right controls: Persistent Reset button, Solid/Void switch for Base, or Drag handle */}
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  {!isBase ? (
                    <>
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

                      <div
                        className="p-1 text-sand-500 hover:text-emerald-400 cursor-grab active:cursor-grabbing transition-colors"
                        title="Drag to reorder layer in stack"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>
                    </>
                  ) : (
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
