import { execute } from '../terminal/executor';
import { CHECK_COMMAND, INSTALL_DEPS_COMMAND, INSTALL_OPENCODE_COMMAND } from '../config/opencode';
import { createLogger } from '../logger';

const log = createLogger('install');

/**
 * Returns true if the `opencode` binary is resolvable on PATH.
 *
 * Any rejection (missing binary, sandbox/permission error, non-zero exit from
 * `which`) is treated as "not installed". We cannot distinguish failure modes
 * here, so the safe contract is: failure === absent.
 */
export async function checkInstalled(): Promise<boolean> {
  try {
    await execute(CHECK_COMMAND);
    log.info('checkInstalled: true');
    return true;
  } catch {
    // Any failure means the binary could not be confirmed present.
    log.info('checkInstalled: false');
    return false;
  }
}

/**
 * Installs OpenCode by running two sequential blocking commands: OS package
 * dependencies first, then the global npm package.
 *
 * Failures are re-thrown with a distinct prefix — `(deps)` for the apk step and
 * `(opencode)` for the npm step — so the UI layer can tell the user exactly
 * which stage failed without needing to parse the underlying shell output.
 */
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
