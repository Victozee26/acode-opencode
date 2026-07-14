// The plugin's state-machine states. The happy path is a linear flow:
// Idle -> CheckingInstall -> Installing -> CheckingServer -> StartingServer
// -> Ready. Error can be entered from any state (see setError in state.ts),
// and Ready is the terminal "serving" state. String values are used (rather
// than numeric) so they read clearly in logs and map cleanly to STATUS_MESSAGES.
export enum AppState {
  Idle = 'idle',
  CheckingInstall = 'checking-install',
  Installing = 'installing',
  CheckingServer = 'checking-server',
  StartingServer = 'starting-server',
  Ready = 'ready',
  Error = 'error',
}

// Structured error payload surfaced to the UI. `message` is the user-facing
// summary; `logTail` carries the last buffered server output for diagnostics.
export interface ErrorInfo {
  message: string;
  logTail: string;
}

// The single immutable snapshot of plugin state broadcast on every transition.
// Contrast with ErrorInfo: ErrorInfo is ONLY the error detail, whereas
// StateContext is the whole app snapshot (including which state we're in and
// the optional project path). A transition carries StateContext; an error
// carries ErrorInfo that then lives under StateContext.error.
export interface StateContext {
  currentState: AppState;
  projectPath?: string | null;
  error: ErrorInfo | null;
}

// Subscriber signature for state changes (see onStateChange in state.ts).
// Receives the new state plus the full context snapshot.
export type StateListener = (state: AppState, context: StateContext) => void;
