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
  await execute(INSTALL_DEPS_COMMAND);
  await execute(INSTALL_OPENCODE_COMMAND);
}
