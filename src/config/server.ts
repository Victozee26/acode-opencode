// Hard constraint: fixed port. OpenCode is always launched on 4123 and bound
// to loopback only (see HOSTNAME). A static port keeps the embedded iframe URL
// predictable and avoids port negotiation; loopback-only binding prevents the
// server from being reachable off-device without auth. 4123 is deliberately
// NOT the upstream default 4096, so the plugin never clashes with (or gets
// confused by) a manually started `opencode serve`.
export const PORT = 4123;

// Loopback only. Never change to '0.0.0.0' without adding auth — the WebView
// and server both live inside Acode's local Alpine terminal, so no external
// network exposure is ever needed or desired.
export const HOSTNAME = '127.0.0.1';

// Convenience base URL for the embedded iframe and health checks.
export const BASE_URL = `http://${HOSTNAME}:${PORT}`;

// Default HTTP basic-auth username for `opencode serve`. Overridable upstream
// via OPENCODE_SERVER_USERNAME, but the plugin never overrides it — the fixed
// default keeps the pairing flow predictable.
export const SERVER_USERNAME = 'opencode';

// Environment variable the plugin prefixes onto the serve command to set a
// known per-launch password (V2 requires auth even on loopback).
export const SERVER_PASSWORD_ENV = 'OPENCODE_SERVER_PASSWORD';

// Query parameter the V2 web UI reads for passwordless sign-in:
// `?auth_token=<base64url(user:password)>`. The SPA scrubs it from the address
// bar and holds the password in memory for its API calls (see auth.ts).
export const AUTH_TOKEN_PARAM = 'auth_token';
