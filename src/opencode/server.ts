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

export async function isServerUp(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    await fetch(HEALTH_CHECK_URL, {
      mode: 'no-cors',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return true;
  } catch {
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
  await execute(buildStartCommand());
  await new Promise((resolve) => setTimeout(resolve, STARTUP_CHECK_DELAY));
  const pgrepOutput = String(await execute('pgrep -f "opencode serve" || true')).trim();
  if (!pgrepOutput) {
    const logTail = await readLogTail();
    throw new Error(
      `OpenCode server process exited immediately after start.\nLast log lines:\n${logTail || '(no log output)'}`,
    );
  }
}

export async function waitForReady(): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < READY_TIMEOUT) {
    const up = await isServerUp();
    if (up) return;

    await new Promise((resolve) => setTimeout(resolve, READY_POLL_INTERVAL));
  }

  throw new Error(`Server did not respond within ${READY_TIMEOUT / 1000}s`);
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
  try {
    await execute(KILL_COMMAND);
  } catch {
    // best-effort SIGTERM, check result next
  }

  const softDown = await pollUntilDown(STOP_POLL_TIMEOUT);
  if (softDown) return;

  await execute(HARD_KILL_COMMAND);

  const hardDown = await pollUntilDown(STOP_POLL_TIMEOUT);
  if (hardDown) return;

  throw new Error('Cannot stop server: port 4096 still occupied after SIGKILL');
}

export async function restartServer(): Promise<void> {
  await stopServer();
  await startServer();
}
