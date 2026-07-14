// Master switch for verbose debug logging across the plugin.
export const DEBUG = true;

// Hard constraint: fixed port. OpenCode is always launched on 4096 and bound
// to loopback only (see HOSTNAME). A static port keeps the embedded iframe URL
// predictable and avoids port negotiation; loopback-only binding prevents the
// server from being reachable off-device without auth.
export const PORT = 4096;

// Loopback only. Never change to '0.0.0.0' without adding auth — the WebView
// and server both live inside Acode's local Alpine terminal, so no external
// network exposure is ever needed or desired.
export const HOSTNAME = '127.0.0.1';

// Convenience base URL for the embedded iframe and health checks.
export const BASE_URL = `http://${HOSTNAME}:${PORT}`;

// Where the server's stdout/stderr are redirected (see buildStartCommand).
export const LOG_PATH = '/tmp/opencode.log';

// Grace period after issuing the start command before we begin polling, giving
// the process a moment to bind the socket.
export const STARTUP_CHECK_DELAY = 500;

// How many trailing log lines to surface in the error UI for diagnostics.
export const LOG_TAIL_LINES = 20;

// Endpoint used for the no-cors health probe (see opencode/server.ts).
export const HEALTH_CHECK_URL = `${BASE_URL}/global/health`;

// Max time to wait for a single health probe before treating it as failed.
export const HEALTH_CHECK_TIMEOUT = 2000;

// Shown in the error UI when no log tail could be captured.
export const ERROR_FALLBACK_MESSAGE = 'No output captured. Check /tmp/opencode.log in Alpine terminal.';

// Polling cadence while waiting for the server to become Ready.
export const READY_POLL_INTERVAL = 1000;

// Hard cap on total time spent waiting for Ready before giving up.
// This environment's cold boot (file picker, watcher, project refresh, location
// services) takes ~19s before the server is actually serveable, so 15s was
// cutting it off too early. 30s gives the first boot comfortable headroom while
// still failing fast on a genuinely dead process.
export const READY_TIMEOUT = 30000;

// Alpine package install for the runtime (node/npm) OpenCode needs.
export const INSTALL_DEPS_COMMAND = 'apk add --no-cache nodejs npm';

// Global install of the OpenCode CLI itself.
export const INSTALL_OPENCODE_COMMAND = 'npm install -g opencode-ai';

// Presence check for the opencode binary.
export const CHECK_COMMAND = 'which opencode';

// Graceful and forced shutdown of any running server instance.
export const KILL_COMMAND = 'pkill -f "opencode serve"';
export const HARD_KILL_COMMAND = 'pkill -9 -f "opencode serve"';

// Returns success (exit 0) regardless of whether a server is running, so the
// caller can detect liveness without a nonzero exit aborting the flow.
export const PROCESS_CHECK_COMMAND = 'pgrep -f "opencode serve" || true';

// Bounds for polling the stop sequence: how long and how often to check that
// the process has actually exited.
export const STOP_POLL_TIMEOUT = 3000;
export const STOP_POLL_INTERVAL = 500;

// Builds the command that launches OpenCode as a detached background server.
//
// CRITICAL CONSTRAINT (discovered empirically): Acode's `Executor.execute`
// treats the command as finished the moment its stdout pipe reaches EOF. If we
// redirect the server's output to a FILE (`> LOG_PATH 2>&1`), the backgrounded
// process writes to the file, the executor's pipe closes immediately, execute()
// resolves, and Acode tears down the shell session — reaping the server (it
// never shows in the inspector and the health probe misses it). The server must
// therefore KEEP THE EXECUTOR'S STDOUT PIPE OPEN so the session survives.
//
// We achieve both survival AND a log file with `2>&1 | tee LOG_PATH`: tee holds
// the pipe open (so the session isn't torn down) while also mirroring output to
// the log file for diagnostics. `nohup ... &` lets execute() return at once and
// ignores SIGHUP. `--print-logs` makes OpenCode echo its logs (line-buffered) so
// the log file holds the real startup sequence.
//
// `setsid` was also tried but, combined with a file redirect, still got reaped;
// keeping the executor pipe open via tee is the validated approach.
export function buildStartCommand(): string {
  return `nohup opencode serve --port ${PORT} --hostname ${HOSTNAME} --print-logs 2>&1 | tee ${LOG_PATH} &`;
}

// Human-readable status line shown in the UI per state. Keys are AppState
// values so the render layer can index directly by the current state enum.
export const STATUS_MESSAGES: Record<string, string> = {
  [AppState.CheckingInstall]: 'Checking OpenCode installation…',
  [AppState.Installing]: 'Installing OpenCode…',
  [AppState.CheckingServer]: 'Checking server status…',
  [AppState.StartingServer]: 'Starting OpenCode server…',
};

// Import kept at the bottom on purpose: config.ts is loaded very early and
// only needs AppState for the STATUS_MESSAGES keys above. Putting it last
// avoids circular-eval surprises and matches the established repo pattern
// (see AGENTS.md). Do not move this import to the top.
import { AppState } from './types';
