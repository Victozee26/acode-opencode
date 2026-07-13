export const PORT = 4096;
export const HOSTNAME = '127.0.0.1';
export const BASE_URL = `http://${HOSTNAME}:${PORT}`;
export const LOG_PATH = '/tmp/opencode.log';
export const HEALTH_CHECK_URL = `${BASE_URL}/doc`;
export const HEALTH_CHECK_TIMEOUT = 2000;
export const READY_POLL_INTERVAL = 1000;
export const READY_TIMEOUT = 15000;

export const INSTALL_DEPS_COMMAND = 'apk add --no-cache nodejs npm';
export const INSTALL_OPENCODE_COMMAND = 'npm install -g opencode-ai';
export const CHECK_COMMAND = 'which opencode';
export const KILL_COMMAND = 'pkill -f "opencode serve"';

export function buildStartCommand(projectPath: string): string {
  return `cd ${projectPath} && nohup opencode serve --port ${PORT} --hostname ${HOSTNAME} > ${LOG_PATH} 2>&1 & disown`;
}

export const STATUS_MESSAGES: Record<string, string> = {
  [AppState.CheckingInstall]: 'Checking OpenCode installation…',
  [AppState.Installing]: 'Installing OpenCode…',
  [AppState.CheckingServer]: 'Checking server status…',
  [AppState.ResolvingPath]: 'Resolving project path…',
  [AppState.StartingServer]: 'Starting OpenCode server…',
};

import { AppState } from './types';
