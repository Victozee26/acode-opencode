import { BASE_URL } from './server';

// Endpoint used for the no-cors health probe (see opencode/server.ts).
export const HEALTH_CHECK_URL = `${BASE_URL}/global/health`;

// Max time to wait for a single health probe before treating it as failed.
export const HEALTH_CHECK_TIMEOUT = 2000;

// Shown in the error UI when no error message was captured.
export const ERROR_FALLBACK_MESSAGE =
  'An unknown error occurred.';

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
