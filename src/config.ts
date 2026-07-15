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

// Where the server's stdout/stderr are redirected by buildStartCommand()
// (see opencode/server.ts).
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

// Spinner animation: degrees rotated per second. The rAF loop advances by
// exactly this many degrees per second using wall-clock delta time, so the
// visual speed stays constant regardless of actual frame timing.
export const SPINNER_DEG_PER_SEC = 450;

// Floating action button: milliseconds of pointer inactivity before the button
// fades to a reduced opacity (so it stays out of the way during reading).
export const FLOATING_BUTTON_IDLE_OPACITY_TIMEOUT = 5000;

// Floating action button scrim/backdrop overlay shown while the menu is open:
// a full-viewport dimmed + blurred layer that closes the menu when tapped.
export const FAB_SCRIM_BACKGROUND = 'rgba(0, 0, 0, 0.45)';
export const FAB_SCRIM_BLUR = '4px';
// Scrim is a child of the FAB element with a negative z-index, so it shares the
// FAB's stacking context and always paints BEHIND the button (and its menu) yet
// above page content. A separate root-level scrim would paint above the FAB
// subtree (because $page forms its own stacking context), stealing the click.
export const FAB_SCRIM_Z_INDEX = -1;
export const FAB_Z_INDEX = 1001;

// Spinner animation: reference frame rate (unused since switching to rAF).
// Kept as documentation of the intended target rate.
export const SPINNER_FPS = 30;
