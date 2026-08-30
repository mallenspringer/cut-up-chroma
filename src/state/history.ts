import { AppState } from '../engine/types';

export interface HistoryState {
  past: AppState[];
  present: AppState;
  future: AppState[];
}

const MAX_HISTORY_LIMIT = 50;

/**
 * Creates initial history state container
 */
export function createInitialHistory(initialState: AppState): HistoryState {
  return {
    past: [],
    present: initialState,
    future: [],
  };
}

/**
 * Pushes a new state snapshot to history
 */
export function pushHistorySnapshot(
  history: HistoryState,
  newPresent: AppState,
  debounceKey?: string
): HistoryState {
  if (history.present === newPresent) {
    return history;
  }

  const newPast = [...history.past, history.present];
  if (newPast.length > MAX_HISTORY_LIMIT) {
    newPast.shift();
  }

  return {
    past: newPast,
    present: newPresent,
    future: [], // Clear redo stack on new action
  };
}

/**
 * Undos one step in history
 */
export function undoHistory(history: HistoryState): HistoryState {
  if (history.past.length === 0) return history;

  const previous = history.past[history.past.length - 1];
  const newPast = history.past.slice(0, history.past.length - 1);

  return {
    past: newPast,
    present: previous,
    future: [history.present, ...history.future],
  };
}

/**
 * Redos one step in history
 */
export function redoHistory(history: HistoryState): HistoryState {
  if (history.future.length === 0) return history;

  const next = history.future[0];
  const newFuture = history.future.slice(1);

  return {
    past: [...history.past, history.present],
    present: next,
    future: newFuture,
  };
}
