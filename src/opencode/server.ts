import { execute } from '../terminal/executor';
import {
  READY_POLL_INTERVAL,
  READY_TIMEOUT,
  STARTUP_CHECK_DELAY,
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

export function buildStartCommand(): string {
  return `nohup opencode serve --port ${PORT} --hostname ${HOSTNAME} &`;
}

export async function startServer(): Promise<void> {
  log.info('startServer: launching');
  await execute(buildStartCommand());
  await new Promise((resolve) => setTimeout(resolve, STARTUP_CHECK_DELAY));
  const pgrepOutput = String(await execute(PROCESS_CHECK_COMMAND)).trim();
  if (!pgrepOutput) {
    throw new Error('OpenCode server process exited immediately after start.');
  }
  log.info(`startServer: process alive (pid ${pgrepOutput})`);
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

  throw new Error(
    `Server did not respond within ${READY_TIMEOUT / 1000}s.\n` +
    `Process state: ${processState}`,
  );
}

/**
 * Polls `isServerUp()` until the server stops responding or `timeout` elapses.
 *
 * Returns true once the server is confirmed down, false if it is still up after
 * the timeout. Reused for both the SIGTERM and SIGKILL grace periods in
 * `stopServer()`, so the same wait logic isn't duplicated per signal.
 */
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

/**
 * Stops the OpenCode server with graceful-then-forceful signal escalation.
 *
 * Sends SIGTERM (`KILL_COMMAND`), then polls up to `STOP_POLL_TIMEOUT` for the
 * server to stop responding. If it's still up, escalates to SIGKILL
 * (`HARD_KILL_COMMAND`) and polls again. This two-stage approach lets a healthy
 * process shut down cleanly while guaranteeing termination of a stuck one. If
 * the port is still occupied even after SIGKILL, we throw — the process is
 * unkillable (e.g. zombie/permission issue) and the caller must surface it.
 */
export async function stopServer(): Promise<void> {
  log.info('stopServer: sending SIGTERM');
  try {
    await execute(KILL_COMMAND);
  } catch {
    // pkill returns non-zero when no match; don't fail here — poll decides.
  }

  const softDown = await pollUntilDown(STOP_POLL_TIMEOUT);
  if (softDown) {
    log.info('stopServer: stopped via SIGTERM');
    return;
  }

  log.warn('stopServer: SIGTERM failed, escalating to SIGKILL');
  log.warn('stopServer: executing pkill -9');
  await execute(HARD_KILL_COMMAND);
  log.info('stopServer: hard kill command done');

  const hardDown = await pollUntilDown(STOP_POLL_TIMEOUT);
  if (hardDown) {
    log.info('stopServer: stopped via SIGKILL');
    return;
  }

  throw new Error('Cannot stop server: port 4096 still occupied after SIGKILL');
}

/**
 * Restarts the OpenCode server by fully stopping it, then starting it again.
 *
 * The two phases are strictly sequential with no overlap: we must confirm the
 * old process is gone (freeing port 4096) before launching the new one, so a
 * concurrent start would collide on the fixed port. No concurrency semantics.
 */
export async function restartServer(): Promise<void> {
  log.info('restartServer: beginning');
  await stopServer();
  await startServer();
  log.info('restartServer: done');
}
