import { AppState, StateContext, StateListener, ErrorInfo } from './types';
import { createLogger } from './logger';

const log = createLogger('state');

let context: StateContext = {
  currentState: AppState.Idle,
  projectPath: null,
  error: null,
};

const listeners: Set<StateListener> = new Set();

export function getState(): Readonly<StateContext> {
  return context;
}

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

export function onStateChange(listener: StateListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function reset(): void {
  log.info('reset');
  context = {
    currentState: AppState.Idle,
    projectPath: null,
    error: null,
  };
}
