export enum AppState {
  Idle = 'idle',
  CheckingInstall = 'checking-install',
  Installing = 'installing',
  CheckingServer = 'checking-server',
  StartingServer = 'starting-server',
  Ready = 'ready',
  Error = 'error',
}

export interface ErrorInfo {
  message: string;
  logTail: string;
}

export interface StateContext {
  currentState: AppState;
  projectPath?: string | null;
  error: ErrorInfo | null;
}

export type StateListener = (state: AppState, context: StateContext) => void;

export interface CommandBinding {
  id: string;
  description: string;
  callback: () => void;
}
