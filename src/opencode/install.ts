import { execute } from '../terminal/executor';
import { CHECK_COMMAND, INSTALL_DEPS_COMMAND, INSTALL_OPENCODE_COMMAND } from '../config';
import { createLogger } from '../logger';

const log = createLogger('install');

export async function checkInstalled(): Promise<boolean> {
  try {
    await execute(CHECK_COMMAND);
    log.info('checkInstalled: true');
    return true;
  } catch {
    log.info('checkInstalled: false');
    return false;
  }
}

export async function installOpenCode(): Promise<void> {
  log.info('installOpenCode: installing deps');
  try {
    await execute(INSTALL_DEPS_COMMAND);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Installation failed (deps): ${message}`);
  }
  log.info('installOpenCode: installing opencode-ai');
  try {
    await execute(INSTALL_OPENCODE_COMMAND);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Installation failed (opencode): ${message}`);
  }
  log.info('installOpenCode: done');
}
