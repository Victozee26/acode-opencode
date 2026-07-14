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
  PROCESS_CHECK_COMMAND,
  STOP_POLL_TIMEOUT,
  STOP_POLL_INTERVAL,
  buildStartCommand,
} from '../config';
import { createLogger } from '../logger';

const log = createLogger('server');

/**
 * Best-effort liveness probe for the OpenCode server.
 *
 * This is NOT a conventional HTTP health check. The plugin runs inside an
 * Android WebView, where a normal `fetch` to `127.0.0.1:<port>` is blocked by
 * the browser's CORS policy (cross-origin to a non-registered origin). Using
 * `mode: 'no-cors'` lets the request proceed, but the response is "opaque": we
 * cannot read status or body. We can only observe whether the request *resolved*
 * (the server accepted the connection) or *rejected/aborted* (nothing listening
 * or it timed out). So resolution === "up", anything else === "down".
 *
 * The `AbortController` enforces `HEALTH_CHECK_TIMEOUT` independently of fetch's
 * own behaviour, so a hung connection still reports "down" instead of hanging.
 */
export async function isServerUp(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

  try {
    const res = await fetch(HEALTH_CHECK_URL, { signal: controller.signal });
    log.debug(`isServerUp: ${res.ok}`);
    return res.ok; // res.ok = true only for status 200-299
  } catch {
    log.debug('isServerUp: false');
    return false;
  } finally {
    clearTimeout(timeoutId); // ALWAYS clears, success or fail — no leaks
  }
}

/**
 * Returns the last `LOG_TAIL_LINES` lines of the server log, best-effort.
 *
 * Used to enrich timeout/crash errors with diagnostics. The `|| true` ensures
 * the shell command never fails even when the log file is missing or empty, so
 * `execute()` (which fails on non-zero exit) always resolves. If reading still
 * fails for any reason, we return an empty string rather than throwing.
 */
async function readLogTail(): Promise<string> {
  try {
    const output = await execute(`tail -n ${LOG_TAIL_LINES} ${LOG_PATH} || true`);
    return String(output).trim();
  } catch {
    // Defensive: never let log-reading break the surrounding error path.
    return '';
  }
}

/**
 * Launches the OpenCode server in the background and verifies it survived
 * startup.
 *
 * `buildStartCommand()` uses `nohup ... &` so the process outlives the blocking
 * `execute()` call (the terminal wrapper only resolves once the command exits,
 * which for a detached `&` process is immediate). It also passes `--print-logs`
 * because `opencode serve` otherwise writes to `~/.local/share/opencode/log/`
 * and only emits 1–2 stdout lines that Node *block-buffers* when piped to a
 * file — they rarely flush, yielding a misleading "(no log output)". With
 * `--print-logs`, the Effect-Log output is mirrored to stderr (line-buffered,
 * flushes immediately) so `/tmp/opencode.log` holds the real startup sequence.
 *
 * After a short `STARTUP_CHECK_DELAY` (lets a crashed process actually exit), we
 * run `PROCESS_CHECK_COMMAND` (pgrep). If nothing is matched, the process died
 * during startup — typically a missing binary, config error, or port conflict —
 * and we throw *here*, before the caller's `waitForReady()` poll loop, so the
 * error surfaces fast with the log tail attached.
 */
export async function startServer(): Promise<void> {
  log.info('startServer: launching');
  await execute(buildStartCommand());
  // Give a just-spawned (or instantly-dying) process a moment to settle before
  // checking liveness — avoids a race where we check before a crash completes.
  await new Promise((resolve) => setTimeout(resolve, STARTUP_CHECK_DELAY));
  const pgrepOutput = String(await execute(PROCESS_CHECK_COMMAND)).trim();
  if (!pgrepOutput) {
    // Process already gone — surface the failure now, not after a 15s poll loop.
    const logTail = await readLogTail();
    throw new Error(
      `OpenCode server process exited immediately after start.\nLast log lines:\n${logTail || '(no log output)'}`,
    );
  }
  log.info(`startServer: process alive (pid ${pgrepOutput})`);
}

/**
 * Polls `isServerUp()` until the server responds or `READY_TIMEOUT` elapses.
 *
 * The loop guards on `Date.now() - startedAt < READY_TIMEOUT` so the measured
 * window includes the time spent inside each `isServerUp()` call plus the
 * `READY_POLL_INTERVAL` sleep, giving a bounded total wait. On timeout we report
 * the process state (alive/dead/unknown via pgrep) together with the log tail so
 * the UI can distinguish "process crashed" from "process alive but not serving".
 */
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

  let processState = 'unknown';
  try {
    const pgrepOutput = String(await execute(PROCESS_CHECK_COMMAND)).trim();
    processState = pgrepOutput ? `alive (pid ${pgrepOutput})` : 'dead';
  } catch {
    processState = 'unknown (pgrep failed)';
  }

  throw new Error(
    `Server did not respond within ${READY_TIMEOUT / 1000}s.\n` +
    `Process state: ${processState}\n` +
    `Last log lines:\n${logTail || '(no log output)'}`,
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

  while (Date.now() - startedAt < timeout) {
    const up = await isServerUp();
    if (!up) return true;

    await new Promise((resolve) => setTimeout(resolve, STOP_POLL_INTERVAL));
  }

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
  await execute(HARD_KILL_COMMAND);

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
