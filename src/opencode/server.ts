import { execute, startBackground, stopBackground } from '../terminal/executor';
import {
  READY_POLL_INTERVAL,
  READY_TIMEOUT,
  SERVER_LOG_LINES,
  KILL_COMMAND,
  HARD_KILL_COMMAND,
  PROCESS_CHECK_COMMAND,
  STOP_POLL_TIMEOUT,
  STOP_POLL_INTERVAL,
} from '../config/opencode';
import { PORT, HOSTNAME } from '../config/server';
import { createLogger } from '../logger';
import { isServerUp } from './health';

const log = createLogger('server');

let serverUuid: string | null = null;

const ringBuffer: string[] = [];

function feedLog(line: string): void {
  ringBuffer.push(line);
  if (ringBuffer.length > SERVER_LOG_LINES) {
    ringBuffer.shift();
  }
}

export function getServerLog(): string {
  return ringBuffer.join('\n');
}

export function buildStartCommand(): string {
  return `opencode serve --port ${PORT} --hostname ${HOSTNAME}`;
}

export async function startServer(): Promise<void> {
  log.info('startServer: launching via BackgroundExecutor');
  const command = buildStartCommand();
  ringBuffer.length = 0;

  const bg = await startBackground(
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
        if (t) feedLog(t);
      }
    },
    true,
  );

  serverUuid = bg.uuid;
  log.info(`startServer: BackgroundExecutor started, uuid=${serverUuid}`);
}

export async function waitForReady(): Promise<void> {
  const startedAt = Date.now();
  log.info('waitForReady: polling started');

  while (Date.now() - startedAt < READY_TIMEOUT) {
    const up = await isServerUp();
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
    const up = await isServerUp();
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
    log.info(`stopServer: stopping via BackgroundExecutor (uuid=${serverUuid})`);
    await stopBackground(serverUuid);
  } catch (err) {
    log.warn('stopServer: stopBackground() failed, falling back to pkill', err);
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
  ringBuffer.length = 0;

  if (hardDown) {
    log.info('stopServer: stopped via SIGKILL');
    return;
  }

  throw new Error('Cannot stop server: port 4096 still occupied after SIGKILL');
}

export async function restartServer(): Promise<void> {
  log.info('restartServer: beginning');
  await stopServer();
  await startServer();
  log.info('restartServer: done');
}
