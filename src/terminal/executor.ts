import { createLogger } from '../logger';

const log = createLogger('executor');

interface ExecutorError extends Error {
  output?: string;
}

function extractErrorOutput(err: unknown): string {
  if (
    typeof err === 'object' &&
    err !== null &&
    'output' in err &&
    typeof (err as ExecutorError).output === 'string'
  ) {
    return (err as ExecutorError).output!;
  }
  return '';
}

function buildCommandError(originalMessage: string, output: string): Error {
  if (output) {
    return new Error(`Command failed: ${originalMessage}\nOutput: ${output}`);
  }
  return new Error(`Command failed: ${originalMessage}`);
}

/**
 * Acode's terminal plugin exposes two executors: the global `Executor` (the
 * foreground executor) and `Executor.BackgroundExecutor`. The background one
 * starts processes without a foreground service, so Android is free to kill
 * them once Acode leaves the foreground — fine for commands that finish in
 * seconds, but the OpenCode server has to survive the user switching away
 * from Acode. Every process this plugin starts therefore goes through the
 * foreground executor, which Acode runs under a foreground service.
 */

/**
 * Terminal globals as Acode exposes them. `Terminal.isInstalled()` reports
 * whether the Alpine runtime has been downloaded; `Executor` is the global
 * executor instance.
 */
interface TerminalGlobal {
  isInstalled?: () => Promise<boolean>;
}

/**
 * Fails fast with an actionable message when Acode's terminal runtime is not
 * installed yet, instead of letting `apk`/`npm` fail with an opaque shell
 * error.
 *
 * Skips the check on builds that do not expose `Terminal.isInstalled()` — the
 * command then runs and Acode reports the real failure.
 */
export async function ensureAlpineAvailable(): Promise<void> {
  const terminal = (globalThis as { Terminal?: TerminalGlobal }).Terminal;
  if (!terminal || typeof terminal.isInstalled !== 'function') return;

  let installed = false;
  try {
    installed = await terminal.isInstalled();
  } catch (err: unknown) {
    log.warn('ensureAlpineAvailable: isInstalled() failed, continuing', err);
    return;
  }

  if (!installed) {
    throw new Error(
      "Acode's terminal environment is not installed yet. Open Acode's Terminal, install it, then try again.",
    );
  }
}

/**
 * Run a shell command through Acode's built-in terminal and resolve with its
 * stdout.
 *
 * @param command - The command string to execute.
 * @param alpine - Whether to run inside Alpine Linux (default true; essentially
 *   all commands in this plugin run in Alpine, so this rarely changes).
 * @returns The captured command output on success.
 * @throws Rejects when the terminal runtime is missing or the command exits
 *   non-zero. The thrown error embeds the original message plus any captured
 *   command output so callers can surface diagnostics.
 */
export async function execute(command: string, alpine = true): Promise<string> {
  await ensureAlpineAvailable();
  log.info(`executing: ${command}`);
  try {
    const result = await Executor.execute(command, alpine);
    log.info(`executed OK: ${command} -- ${result}`);
    return result;
  } catch (err: unknown) {
    log.error(`executed FAILED: ${command}`, err);
    const originalMessage = err instanceof Error ? err.message : String(err);
    const output = extractErrorOutput(err);
    throw buildCommandError(originalMessage, output);
  }
}

/**
 * Handle to a persistent process started via {@link startProcess}.
 */
export interface ProcessHandle {
  readonly uuid: string;
  stop(): Promise<string>;
  isRunning(): Promise<boolean>;
  write(input: string): Promise<string>;
}

/**
 * Run a command as a persistent process that survives session teardown and
 * stays alive while Acode is in the background. Unlike {@link execute}, the
 * returned promise resolves once the process is launched (returning a UUID
 * handle), not when it exits.
 *
 * The process runs on Acode's foreground executor, so Android keeps it alive
 * when the user leaves Acode — that is what the OpenCode server needs.
 *
 * @param command - The command string to execute.
 * @param onData - Optional streaming callback receiving typed output chunks
 *   (`stdout`, `stderr`, `exit`, `unknown`).
 * @param alpine - Whether to run inside Alpine Linux (default true).
 * @returns A {@link ProcessHandle} encapsulating the UUID with convenience
 *   methods for stop/isRunning/write.
 */
export async function startProcess(
  command: string,
  onData?: ExecutorOutputCallback,
  alpine = true,
): Promise<ProcessHandle> {
  await ensureAlpineAvailable();
  log.info(`startProcess: launching "${command}"`);
  const uuid = await Executor.start(command, onData ?? (() => {}), alpine);
  log.info(`startProcess: started, uuid=${uuid}`);
  return {
    uuid,
    stop: () => stopProcess(uuid),
    isRunning: () => isProcessRunning(uuid),
    write: (input: string) => writeProcess(uuid, input),
  };
}

/**
 * Stop a persistent process by its UUID.
 */
export async function stopProcess(uuid: string): Promise<string> {
  log.info(`stopProcess: uuid=${uuid}`);
  return Executor.stop(uuid);
}

/**
 * Check whether a persistent process is still running.
 */
export async function isProcessRunning(uuid: string): Promise<boolean> {
  return Executor.isRunning(uuid);
}

/**
 * Write input to a persistent process's stdin.
 */
export async function writeProcess(uuid: string, input: string): Promise<string> {
  return Executor.write(uuid, input);
}

/**
 * Run a shell command as a persistent process and stream its output in
 * real-time via the optional `onProgress` callback, then resolve when the
 * process exits.
 *
 * Unlike {@link execute}, this does NOT block until the process exits — it
 * fires `onProgress` with each stdout/stderr chunk, forwarding the latest
 * trimmed line for live UI display. The returned promise resolves with the
 * full accumulated stdout on success, or rejects with the exit code and
 * captured output on failure.
 *
 * @param command - The command string to execute.
 * @param onProgress - Optional callback receiving the latest output line on
 *   each stdout/stderr chunk (trimmed, single line).
 * @param alpine - Whether to run inside Alpine Linux (default true).
 * @returns The full accumulated stdout on success.
 * @throws Rejects with exit code and captured output on non-zero exit.
 */
export async function executeVerbose(
  command: string,
  onProgress?: (text: string) => void,
  alpine = true,
): Promise<string> {
  log.info(`executeVerbose: launching "${command}"`);

  return new Promise((resolve, reject) => {
    let stdout = '';
    let settled = false;

    startProcess(
      command,
      (type, data) => {
        if (settled) return;

        if (type === 'stdout' || type === 'stderr') {
          stdout += data;
          if (onProgress) {
            const lines = data
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l);
            if (lines.length > 0) {
              onProgress(lines[lines.length - 1]);
            }
          }
        } else if (type === 'exit') {
          settled = true;
          const exitCode = parseInt(data, 10);
          if (exitCode === 0) {
            log.info(`executeVerbose: exited OK: ${command}`);
            resolve(stdout);
          } else {
            log.error(`executeVerbose: exited with code ${exitCode}: ${command}`);
            reject(
              new Error(`Command failed: exit ${exitCode}\nOutput: ${stdout}`),
            );
          }
        }
      },
      alpine,
    ).catch((err: unknown) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
  });
}
