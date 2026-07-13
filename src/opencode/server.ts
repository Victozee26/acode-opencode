import { execute } from '../terminal/executor';
import {
  HEALTH_CHECK_URL,
  HEALTH_CHECK_TIMEOUT,
  LOG_PATH,
  LOG_TAIL_LINES,
  READY_POLL_INTERVAL,
  READY_TIMEOUT,
  STARTUP_CHECK_DELAY,
  KILL_COMMAND,
  HARD_KILL_COMMAND,
  STOP_POLL_TIMEOUT,
  STOP_POLL_INTERVAL,
  buildStartCommand,
} from '../config';
import { createLogger } from '../logger';

const log = createLogger('server');

export async function isServerUp(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    await fetch(HEALTH_CHECK_URL, {
      mode: 'no-cors',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    log.debug('isServerUp: true');
    return true;
  } catch {
    log.debug('isServerUp: false');
    return false;
  }
}

async function readLogTail(): Promise<string> {
  try {
    const output = await execute(`tail -n ${LOG_TAIL_LINES} ${LOG_PATH} || true`);
    return String(output).trim();
  } catch {
    return '';
  }
}

export async function startServer(): Promise<void> {
  log.info('startServer: launching');
  await execute(buildStartCommand());
  await new Promise((resolve) => setTimeout(resolve, STARTUP_CHECK_DELAY));
  const pgrepOutput = String(await execute('pgrep -f "opencode serve" || true')).trim();
  if (!pgrepOutput) {
    const logTail = await readLogTail();
    throw new Error(
      `OpenCode server process exited immediately after start.\nLast log lines:\n${logTail || '(no log output)'}`,
    );
  }
  log.info(`startServer: process alive (pid ${pgrepOutput})`);
}

export async function waitForReady(): Promise<void> {
  const startedAt = Date.now();
  log.info('waitForReady: polling started');

  while (Date.now() - startedAt < READY_TIMEOUT) {
    const up = await isServerUp();
    if (up) {
      log.info('waitForReady: server ready');
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, READY_POLL_INTERVAL));
  }

  const logTail = await readLogTail();
  throw new Error(
    `Server did not respond within ${READY_TIMEOUT / 1000}s.\nLast log lines:\n${logTail || '(no log output)'}`,
  );
}

async function pollUntilDown(timeout: number): Promise<boolean> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const up = await isServerUp();
    if (!up) return true;

    await new Promise((resolve) => setTimeout(resolve, STOP_POLL_INTERVAL));
  }

  return false;
}

export async function stopServer(): Promise<void> {
  log.info('stopServer: sending SIGTERM');
  try {
    await execute(KILL_COMMAND);
  } catch {
    // best-effort SIGTERM, check result next
  }

  const softDown = await pollUntilDown(STOP_POLL_TIMEOUT);
  if (softDown) {
    log.info('stopServer: stopped via SIGTERM');
    return;
  }

  log.warn('stopServer: SIGTERM failed, escalating to SIGKILL');
  await execute(HARD_KILL_COMMAND);

  const hardDown = await pollUntilDown(STOP_POLL_TIMEOUT);
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
