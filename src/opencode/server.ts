import { execute } from '../terminal/executor';
import {
  HEALTH_CHECK_URL,
  HEALTH_CHECK_TIMEOUT,
  READY_POLL_INTERVAL,
  READY_TIMEOUT,
  KILL_COMMAND,
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

export async function startServer(projectPath: string): Promise<void> {
  await execute(buildStartCommand(projectPath));
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

export async function stopServer(): Promise<void> {
  try {
    await execute(KILL_COMMAND);
  } catch {
    // best-effort kill, ignore errors
  }
}

export async function restartForProject(projectPath: string): Promise<void> {
  await stopServer();
  await startServer(projectPath);
}
