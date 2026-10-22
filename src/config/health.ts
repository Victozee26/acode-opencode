import { BASE_URL } from './server';

// API path of V2 servers (opencode 2.x), relative to the server base URL.
// The route answers JSON when the request carries valid basic auth and `401`
// when it does not; V1 has no /api/* routes and answers this path with the
// SPA shell.
export const HEALTH_CONFIG_PATH = '/api/config';

// Health path of V1 servers (opencode 1.x), relative to the server base URL.
// A real route that answers `{"healthy":true,...}` as JSON. Kept as the
// fallback probe — V2 serves its API under /api/* and answers this path with
// the SPA shell instead.
export const HEALTH_CHECK_PATH = '/global/health';

// Probe target for V1 servers (opencode 1.x) on the local server.
export const HEALTH_CHECK_URL = `${BASE_URL}${HEALTH_CHECK_PATH}`;

// Probe target for V2 servers (opencode 2.x) on the local server.
export const HEALTH_CONFIG_URL = `${BASE_URL}${HEALTH_CONFIG_PATH}`;

// HTTP status the V2 API answers with when the request carries no (or a
// wrong) password. Proof that an auth-walled OpenCode server is listening.
export const HEALTH_STATUS_UNAUTHORIZED = 401;

// Lower/upper bound of a successful HTTP status (inclusive).
export const HEALTH_STATUS_SUCCESS_MIN = 200;
export const HEALTH_STATUS_SUCCESS_MAX = 299;

// Response type requested from the native HTTP plugin — the probe inspects
// the body to tell a real API answer from the SPA shell.
export const HEALTH_RESPONSE_TYPE = 'text';

// Extra grace added to the probe watchdog so a slow native callback still
// loses to the watchdog instead of racing it.
export const HEALTH_WATCHDOG_MARGIN = 500;

// Max time to wait for a single health probe before treating it as failed.
export const HEALTH_CHECK_TIMEOUT = 2000;

// The native HTTP plugin takes its timeout in seconds, ours is in ms.
export const MILLISECONDS_PER_SECOND = 1000;

// Shown in the error UI when no error message was captured.
export const ERROR_FALLBACK_MESSAGE = 'An unknown error occurred.';

// Interval in ms between periodic health probes while the server is in
// the Ready state. Used by the background crash detector.
export const HEALTH_PROBE_INTERVAL = 5000;

// How many consecutive failed probes it takes to declare the Ready server
// down. A single miss can be a transient hiccup (GC pause, busy bridge),
// so the crash detector only errors after this many downs in a row.
export const HEALTH_CRASH_CONFIRM_ATTEMPTS = 3;

// Delay in ms between the confirmation probes above.
export const HEALTH_CRASH_RETRY_INTERVAL = 1000;

// Error text shown when the Ready health detector confirms a crash. The
// saved server log tail is attached as diagnostics alongside it.
export const HEALTH_CONNECTION_LOST_MESSAGE = 'Server connection lost';
