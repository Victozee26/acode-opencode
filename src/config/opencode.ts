// Alpine package install for the runtime (node/npm) OpenCode needs.
export const INSTALL_DEPS_COMMAND = 'apk add --no-cache --verbose nodejs npm';

// Probe for the npm version inside the Alpine container. Decides which install
// command is usable (see NPM_ALLOW_SCRIPTS_MIN_VERSION).
export const NPM_VERSION_COMMAND = 'npm -v';

// Probe for the node runtime version — reported alongside npm in the error UI.
export const NODE_VERSION_COMMAND = 'node -v';

// Upper bound on the runtime-version probe (node + npm) so a hung terminal can
// never leave the error view stuck on its placeholder.
export const RUNTIME_VERSION_PROBE_TIMEOUT = 3000;

// Placeholder shown in the error view while the version probe is in flight.
export const VERSION_PENDING = '\u2026';

// Value reported once a version probe fails or times out.
export const VERSION_UNKNOWN = '?';

// Lowest npm version that understands `--allow-scripts`. Older npm rejects the
// unknown flag outright, so the install must fall back to the plain command.
export const NPM_ALLOW_SCRIPTS_MIN_VERSION = '11.16.0';

// Global install of the OpenCode CLI itself (npm older than the minimum above).
export const INSTALL_OPENCODE_COMMAND = 'npm install -g --loglevel verbose opencode-ai';

// Same install for npm >= NPM_ALLOW_SCRIPTS_MIN_VERSION: dependency lifecycle
// scripts are opt-in there, so opencode-ai must be allow-listed explicitly for
// its own install scripts to run. `--loglevel verbose` feeds the install
// progress UI.
export const INSTALL_OPENCODE_COMMAND_ALLOW_SCRIPTS =
  'npm install -g --loglevel verbose --allow-scripts=opencode-ai opencode-ai';

// Presence check for the opencode binary.
export const CHECK_COMMAND = 'which opencode';

// Uninstall the opencode-ai npm package.
export const UNINSTALL_COMMAND = 'npm uninstall -g opencode-ai';

// Polling cadence while waiting for the server to become Ready.
export const READY_POLL_INTERVAL = 1000;

// Hard cap on total time spent waiting for Ready before giving up.
// This environment's cold boot (file picker, watcher, project refresh, location
// services) takes ~19s before the server is actually serveable, so 15s was
// cutting it off too early. 30s gives the first boot comfortable headroom while
// still failing fast on a genuinely dead process.
export const READY_TIMEOUT = 30000;

// Number of recent server stdout/stderr lines to keep in the ring buffer for
// diagnostics (shown on startup failure / timeout).
export const SERVER_LOG_LINES = 40;

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
