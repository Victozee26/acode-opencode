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
