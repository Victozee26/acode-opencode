import { execute, executeVerbose } from '../terminal/executor';
import { CHECK_COMMAND, INSTALL_DEPS_COMMAND, INSTALL_OPENCODE_COMMAND, UNINSTALL_COMMAND } from '../config/opencode';
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
 * Installs OpenCode by running two sequential commands: OS package dependencies
 * first, then the global npm package.
 *
 * When `onProgress` is provided the commands are launched via
 * {@link executeVerbose} so stdout lines stream to the callback in real-time
 * for live UI display. Without `onProgress` the blocking {@link execute} is
 * used (backward-compatible path for callers that don't need streaming output).
 *
 * Failures are re-thrown with a distinct prefix — `(deps)` for the apk step and
 * `(opencode)` for the npm step — so the UI layer can tell the user exactly
 * which stage failed without needing to parse the underlying shell output.
 */
export async function installOpenCode(onProgress?: (text: string) => void): Promise<void> {
  log.info('installOpenCode: installing deps');
  try {
    if (onProgress) {
      await executeVerbose(INSTALL_DEPS_COMMAND, onProgress);
    } else {
      await execute(INSTALL_DEPS_COMMAND);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Installation failed (deps): ${message}`);
  }
  log.info('installOpenCode: installing opencode-ai');
  try {
    if (onProgress) {
      await executeVerbose(INSTALL_OPENCODE_COMMAND, onProgress);
    } else {
      await execute(INSTALL_OPENCODE_COMMAND);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Installation failed (opencode): ${message}`);
  }
  log.info('installOpenCode: done');
}

/**
 * Uninstalls OpenCode by running `npm uninstall -g opencode-ai`.
 *
 * Failures are re-thrown with a `Uninstallation failed:` prefix so the caller
 * can surface the exact context without parsing shell output.
 */
export async function uninstallOpenCode(): Promise<void> {
  log.info('uninstallOpenCode: uninstalling');
  try {
    await execute(UNINSTALL_COMMAND);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Uninstallation failed: ${message}`);
  }
  log.info('uninstallOpenCode: done');
}
