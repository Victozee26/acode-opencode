import { AppState, StateContext, StateListener, ErrorInfo } from './types';
import { createLogger } from './logger';

const log = createLogger('state');

// The single source of truth for plugin state. Kept module-private and only
// ever replaced wholesale (never mutated in place) so getState() can hand out
// a stable Readonly snapshot that won't change under a consumer's feet.
let context: StateContext = {
  currentState: AppState.Idle,
  projectPath: null,
  error: null,
};

// Active state subscribers. A Set is used so re-adding the same listener is a
// no-op and teardown is O(1) via the returned unsubscribe fn.
const listeners: Set<StateListener> = new Set();

export function getState(): Readonly<StateContext> {
  return context;
}

// Move the state machine to a new state. `updates` (anything except
// currentState) is shallow-merged onto the prior context. Crucially, leaving
// the Error state (transitioning to anything other than Error) clears any
// stale error so a recovered flow doesn't keep showing the old failure.
export function transition(newState: AppState, updates?: Partial<Omit<StateContext, 'currentState'>>): void {
  log.info(`transition: ${context.currentState} -> ${newState}`);
  context = {
    ...context,
    ...updates,
    currentState: newState,
    error: newState === AppState.Error ? context.error : null,
  };

  for (const listener of listeners) {
    listener(newState, context);
  }
}

// Dedicated error entry point. Unlike transition(), this always forces the
// Error state and stores a fresh ErrorInfo, overwriting any prior error.
export function setError(message: string, logTail: string): void {
  log.error(`setError: ${message}`);
  if (logTail) log.debug(`setError logTail: ${logTail}`);
  context = {
    ...context,
    currentState: AppState.Error,
    error: { message, logTail },
  };

  for (const listener of listeners) {
    listener(AppState.Error, context);
  }
}

// Subscribe to state changes. Returns an unsubscribe function for clean
// teardown (e.g. on plugin destroy) so listeners don't leak across reloads.
export function onStateChange(listener: StateListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Return the machine to its initial state, dropping any error and project
// context — used when the plugin is torn down or the flow is restarted.
export function reset(): void {
  log.info('reset');
  context = {
    currentState: AppState.Idle,
    projectPath: null,
    error: null,
  };
}
