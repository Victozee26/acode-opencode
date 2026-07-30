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
