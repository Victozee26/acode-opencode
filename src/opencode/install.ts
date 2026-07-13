import { execute } from '../terminal/executor';
import { CHECK_COMMAND, INSTALL_DEPS_COMMAND, INSTALL_OPENCODE_COMMAND } from '../config';

export async function checkInstalled(): Promise<boolean> {
  try {
    await execute(CHECK_COMMAND);
    return true;
  } catch {
    return false;
  }
}

export async function installOpenCode(): Promise<void> {
  try {
    await execute(INSTALL_DEPS_COMMAND);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Installation failed (deps): ${message}`);
  }
  try {
    await execute(INSTALL_OPENCODE_COMMAND);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Installation failed (opencode): ${message}`);
  }
}
