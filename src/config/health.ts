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
