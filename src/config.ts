export const DEBUG = true;
export const PORT = 4096;
export const HOSTNAME = '127.0.0.1';
export const BASE_URL = `http://${HOSTNAME}:${PORT}`;
export const LOG_PATH = '/tmp/opencode.log';
export const STARTUP_CHECK_DELAY = 500;
export const LOG_TAIL_LINES = 20;
export const HEALTH_CHECK_URL = `${BASE_URL}/global/health`;
export const HEALTH_CHECK_TIMEOUT = 2000;
export const ERROR_FALLBACK_MESSAGE = 'No output captured. Check /tmp/opencode.log in Alpine terminal.';
export const READY_POLL_INTERVAL = 1000;
export const READY_TIMEOUT = 60000;

export const INSTALL_DEPS_COMMAND = 'apk add --no-cache nodejs npm';
export const INSTALL_OPENCODE_COMMAND = 'npm install -g opencode-ai';
export const CHECK_COMMAND = 'which opencode';
export const KILL_COMMAND = 'pkill -f "opencode serve"';
export const HARD_KILL_COMMAND = 'pkill -9 -f "opencode serve"';
export const PROCESS_CHECK_COMMAND = 'pgrep -f "opencode serve" || true';
export const STOP_POLL_TIMEOUT = 3000;
export const STOP_POLL_INTERVAL = 500;

export function buildStartCommand(): string {
  return `nohup opencode serve --port ${PORT} --hostname ${HOSTNAME} > ${LOG_PATH} 2>&1 < /dev/null &`;
}

export const STATUS_MESSAGES: Record<string, string> = {
  [AppState.CheckingInstall]: 'Checking OpenCode installation…',
  [AppState.Installing]: 'Installing OpenCode…',
  [AppState.CheckingServer]: 'Checking server status…',
  [AppState.StartingServer]: 'Starting OpenCode server…',
};

import { AppState } from './types';
