// Alpine package install for the runtime (node/npm) OpenCode needs.
export const INSTALL_DEPS_COMMAND = 'apk add --no-cache nodejs npm';

// Global install of the OpenCode CLI itself.
export const INSTALL_OPENCODE_COMMAND = 'npm install -g opencode-ai';

// Presence check for the opencode binary.
export const CHECK_COMMAND = 'which opencode';

// Grace period after issuing the start command before we begin polling, giving
// the process a moment to bind the socket.
export const STARTUP_CHECK_DELAY = 500;

// Polling cadence while waiting for the server to become Ready.
export const READY_POLL_INTERVAL = 1000;

// Hard cap on total time spent waiting for Ready before giving up.
// This environment's cold boot (file picker, watcher, project refresh, location
// services) takes ~19s before the server is actually serveable, so 15s was
// cutting it off too early. 30s gives the first boot comfortable headroom while
// still failing fast on a genuinely dead process.
export const READY_TIMEOUT = 30000;

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
