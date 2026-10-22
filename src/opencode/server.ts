import { execute, startProcess, stopProcess } from '../terminal/executor';
import {
  READY_POLL_INTERVAL,
  READY_TIMEOUT,
  SERVER_LOG_LINES,
  SERVER_LOG_NOISE_PREFIXES,
  KILL_COMMAND,
  HARD_KILL_COMMAND,
  PROCESS_CHECK_COMMAND,
  STOP_POLL_TIMEOUT,
  STOP_POLL_INTERVAL,
} from '../config/opencode';
import { PORT, HOSTNAME, SERVER_PASSWORD_ENV } from '../config/server';
import { createLogger } from '../logger';
import { isServerUp } from './health';
import { generatePassword, getInstalledMajor, needsPairing } from './auth';

const log = createLogger('server');

let serverUuid: string | null = null;

// Per-launch V2 serve password (null on V1 servers, which run without auth).
// Generated fresh on every start, kept in memory only, cleared on stop.
let serverPassword: string | null = null;

// Major version of the CLI that launched the current server (null when the
// probe failed or no server is running). Drives the V1/V2 behavior branch.
let serverMajor: number | null = null;

const ringBuffer: string[] = [];

function feedLog(line: string): void {
  ringBuffer.push(line);
  if (ringBuffer.length > SERVER_LOG_LINES) {
    ringBuffer.shift();
  }
}

function isNoiseLine(line: string): boolean {
  return SERVER_LOG_NOISE_PREFIXES.some((prefix) => line.startsWith(prefix));
}

export function getServerLog(): string {
  return ringBuffer.join('\n');
}

/**
 * Returns the current server password, or null when the server runs without
 * auth (V1) or no server was started by this plugin.
 */
export function getServerPassword(): string | null {
  return serverPassword;
}

/**
 * Returns true when the plugin-managed server is V2: a stored password (only
 * ever set for V2 launches) or a known V2+ major. False when no server is
 * running or the server is V1.
 */
export function isV2Server(): boolean {
  return serverPassword !== null || (serverMajor !== null && needsPairing(serverMajor));
}

function clearServerAuth(): void {
  serverPassword = null;
  serverMajor = null;
}

export function buildStartCommand(password: string | null): string {
  const serve = `opencode serve --port ${PORT} --hostname ${HOSTNAME}`;
  // NOTE: `env(1)`, not a shell `VAR=x` prefix — the Executor hands the command
  // to the Alpine launcher without shell assignment parsing (a `VAR=x` prefix
  // fails with "not found" / exit 127). `env` works either way.
  return password ? `env ${SERVER_PASSWORD_ENV}=${password} ${serve}` : serve;
}

export async function startServer(): Promise<void> {
  log.info('startServer: launching via the foreground Executor');
  const major = await getInstalledMajor();
  serverMajor = major;
  serverPassword = needsPairing(major) ? generatePassword() : null;
  log.info(
    serverPassword
      ? `startServer: V2 auth enabled (major=${major ?? 'unknown'})`
      : `startServer: no auth (major=${major ?? 'unknown'})`,
  );
  const command = buildStartCommand(serverPassword);
  ringBuffer.length = 0;

  try {
    const process = await startProcess(
      command,
      (type, data) => {
        const trimmed = data.trim();
        if (type === 'stdout') {
          log.info(`server[stdout]: ${trimmed}`);
        } else if (type === 'stderr') {
          log.warn(`server[stderr]: ${trimmed}`);
        }
        const lines = data.split('\n');
        for (const line of lines) {
          const t = line.trim();
          if (t && !isNoiseLine(t)) feedLog(t);
        }
      },
      true,
    );

    serverUuid = process.uuid;
    log.info(`startServer: foreground Executor started, uuid=${serverUuid}`);
  } catch (err) {
    clearServerAuth();
    throw err;
  }
}

export async function waitForReady(): Promise<void> {
  const startedAt = Date.now();
  log.info('waitForReady: polling started');

  while (Date.now() - startedAt < READY_TIMEOUT) {
    const up = await isServerUp({ password: serverPassword });
    log.info(`waitForReady: poll attempt -> isServerUp=${up} (${Date.now() - startedAt}ms)`);
    if (up) {
      log.info('waitForReady: server ready');
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, READY_POLL_INTERVAL));
  }

  let processState = 'unknown';
  try {
    const pgrepOutput = String(await execute(PROCESS_CHECK_COMMAND)).trim();
    processState = pgrepOutput ? `alive (pid ${pgrepOutput})` : 'dead';
  } catch {
    processState = 'unknown (pgrep failed)';
  }

  const logTail = ringBuffer.join('\n');
  throw new Error(
    `Server did not respond within ${READY_TIMEOUT / 1000}s.\n` +
    `Process state: ${processState}\n` +
    (logTail ? `Last ${Math.min(SERVER_LOG_LINES, ringBuffer.length)} lines:\n${logTail}` : ''),
  );
}

async function pollUntilDown(timeout: number): Promise<boolean> {
  const startedAt = Date.now();
  log.info(`pollUntilDown: polling for ${timeout}ms`);

  while (Date.now() - startedAt < timeout) {
    const up = await isServerUp({ password: serverPassword });
    log.info(`pollUntilDown: isServerUp=${up}`);
    if (!up) {
      log.info(`pollUntilDown: server down after ${Date.now() - startedAt}ms`);
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, STOP_POLL_INTERVAL));
  }

  log.warn(`pollUntilDown: still up after ${timeout}ms`);
  return false;
}

export async function stopServer(): Promise<void> {
  if (!serverUuid) {
    log.info('stopServer: no running server, nothing to stop');
    return;
  }

  try {
    log.info(`stopServer: stopping via the foreground Executor (uuid=${serverUuid})`);
    await stopProcess(serverUuid);
  } catch (err) {
    log.warn('stopServer: stopProcess() failed, falling back to pkill', err);
    try {
      await execute(KILL_COMMAND);
    } catch {
      // pkill may return non-zero — ignore
    }
  }

  const softDown = await pollUntilDown(STOP_POLL_TIMEOUT);
  if (softDown) {
    log.info('stopServer: server stopped');
    serverUuid = null;
    clearServerAuth();
    ringBuffer.length = 0;
    return;
  }

  log.warn('stopServer: SIGTERM failed, escalating to SIGKILL');
  try {
    await execute(HARD_KILL_COMMAND);
  } catch {
    // pkill -9 may return non-zero — ignore
  }

  const hardDown = await pollUntilDown(STOP_POLL_TIMEOUT);
  serverUuid = null;
  clearServerAuth();
  ringBuffer.length = 0;

  if (hardDown) {
    log.info('stopServer: stopped via SIGKILL');
    return;
  }

  throw new Error(`Cannot stop server: port ${PORT} still occupied after SIGKILL`);
}

export async function restartServer(): Promise<void> {
  log.info('restartServer: beginning');
  await stopServer();
  await startServer();
  log.info('restartServer: done');
}
