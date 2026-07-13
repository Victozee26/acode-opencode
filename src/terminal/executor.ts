import { createLogger } from '../logger';

const log = createLogger('executor');

export async function execute(command: string, alpine = true): Promise<string> {
  log.info(`executing: ${command}`);
  try {
    const result = await Executor.execute(command, alpine);
    log.debug(`executed OK: ${command}`);
    return result;
  } catch (err: unknown) {
    log.error(`executed FAILED: ${command}`, err);
    const originalMessage = err instanceof Error ? err.message : String(err);
    const output = typeof (err as Record<string, unknown>)?.output === 'string'
      ? (err as Record<string, unknown>).output as string
      : '';
    if (output) {
      throw new Error(`Command failed: ${originalMessage}\nOutput: ${output}`);
    }
    throw new Error(`Command failed: ${originalMessage}`);
  }
}
