import { createLogger } from '../logger';

const log = createLogger('executor');

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
    log.info(`executed OK: ${command} — ${result}`);
    return result;
  } catch (err: unknown) {
    log.error(`executed FAILED: ${command}`, err);
    const originalMessage = err instanceof Error ? err.message : String(err);
    // Acode attaches the command's captured stdout/stderr to the thrown error
    // object under an `output` property. Reach into that non-standard shape so
    // the failure message can include what the command actually printed.
    const output = typeof (err as Record<string, unknown>)?.output === 'string'
      ? (err as Record<string, unknown>).output as string
      : '';
    if (output) {
      throw new Error(`Command failed: ${originalMessage}\nOutput: ${output}`);
    }
    throw new Error(`Command failed: ${originalMessage}`);
  }
}
