import { BASE_URL } from './server';

// Endpoint used for the no-cors health probe (see opencode/server.ts).
export const HEALTH_CHECK_URL = `${BASE_URL}/global/health`;

// Max time to wait for a single health probe before treating it as failed.
export const HEALTH_CHECK_TIMEOUT = 2000;

// How many trailing log lines to surface in the error UI for diagnostics.
export const LOG_TAIL_LINES = 20;

// Shown in the error UI when no log tail could be captured.
export const ERROR_FALLBACK_MESSAGE =
  'No output captured. Check /tmp/opencode.log in Alpine terminal.';
