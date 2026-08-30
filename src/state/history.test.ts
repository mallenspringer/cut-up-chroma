import { describe, it, expect } from 'vitest';
import { createInitialHistory, pushHistorySnapshot, undoHistory, redoHistory } from './history';
import { AppState } from '../engine/types';

describe('History State Manager', () => {
  const dummyState1 = { selectedLayerId: 'layer-1' } as unknown as AppState;
  const dummyState2 = { selectedLayerId: 'layer-2' } as unknown as AppState;
  const dummyState3 = { selectedLayerId: 'layer-3' } as unknown as AppState;

  it('should initialize cleanly', () => {
    const hist = createInitialHistory(dummyState1);
    expect(hist.present).toBe(dummyState1);
    expect(hist.past.length).toBe(0);
    expect(hist.future.length).toBe(0);
  });

  it('should push state and allow undo/redo', () => {
    let hist = createInitialHistory(dummyState1);
    hist = pushHistorySnapshot(hist, dummyState2);
    hist = pushHistorySnapshot(hist, dummyState3);

    expect(hist.present).toBe(dummyState3);
    expect(hist.past.length).toBe(2);

    // Undo 1
    hist = undoHistory(hist);
    expect(hist.present).toBe(dummyState2);
    expect(hist.future.length).toBe(1);

    // Undo 2
    hist = undoHistory(hist);
    expect(hist.present).toBe(dummyState1);
    expect(hist.future.length).toBe(2);

    // Redo 1
    hist = redoHistory(hist);
    expect(hist.present).toBe(dummyState2);

    // Redo 2
    hist = redoHistory(hist);
    expect(hist.present).toBe(dummyState3);
  });
});
