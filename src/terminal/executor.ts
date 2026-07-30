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
 * Run a shell command through Acode's built-in terminal and resolve with its
 * stdout.
 *
 * @param command - The command string to execute.
 * @param alpine - Whether to run inside Alpine Linux (default true; essentially
 *   all commands in this plugin run in Alpine, so this rarely changes).
 * @returns The captured command output on success.
 * @throws Rejects on non-zero exit. The thrown error embeds the original message
 *   plus any captured command output so callers can surface diagnostics.
 */
export async function execute(command: string, alpine = true): Promise<string> {
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
 * Handle to a persistent background process started via
 * {@link Executor.BackgroundExecutor}.
 */
export interface BackgroundProcess {
  readonly uuid: string;
  stop(): Promise<string>;
  isRunning(): Promise<boolean>;
  write(input: string): Promise<string>;
}

/**
 * Run a command as a persistent background process that survives session
 * teardown. Unlike {@link execute}, the returned promise resolves once the
 * process is launched (returning a UUID handle), not when it exits.
 *
 * @param command - The command string to execute.
 * @param onData - Optional streaming callback receiving typed output chunks
 *   (`stdout`, `stderr`, `exit`, `unknown`).
 * @param alpine - Whether to run inside Alpine Linux (default true).
 * @returns A {@link BackgroundProcess} handle encapsulating the UUID with
 *   convenience methods for stop/isRunning/write.
 */
export async function startBackground(
  command: string,
  onData?: ExecutorOutputCallback,
  alpine = true,
): Promise<BackgroundProcess> {
  log.info(`startBackground: launching "${command}"`);
  const uuid = await Executor.BackgroundExecutor.start(
    command,
    onData ?? (() => {}),
    alpine,
  );
  log.info(`startBackground: started, uuid=${uuid}`);
  return {
    uuid,
    stop: () => stopBackground(uuid),
    isRunning: () => isBackgroundRunning(uuid),
    write: (input: string) => writeBackground(uuid, input),
  };
}

/**
 * Stop a persistent background process by its UUID.
 */
export async function stopBackground(uuid: string): Promise<string> {
  log.info(`stopBackground: uuid=${uuid}`);
  return Executor.BackgroundExecutor.stop(uuid);
}

/**
 * Check whether a persistent background process is still running.
 */
export async function isBackgroundRunning(uuid: string): Promise<boolean> {
  return Executor.BackgroundExecutor.isRunning(uuid);
}

/**
 * Write input to a persistent background process's stdin.
 */
export async function writeBackground(uuid: string, input: string): Promise<string> {
  return Executor.BackgroundExecutor.write(uuid, input);
}

/**
 * Run a shell command as a background process and stream its output in
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

    startBackground(
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
