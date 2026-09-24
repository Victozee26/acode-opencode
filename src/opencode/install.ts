import { execute, executeVerbose } from '../terminal/executor';
import {
  CHECK_COMMAND,
  INSTALL_DEPS_COMMAND,
  INSTALL_OPENCODE_COMMAND,
  INSTALL_OPENCODE_COMMAND_ALLOW_SCRIPTS,
  UNINSTALL_COMMAND,
} from '../config/opencode';
import { selectNpmCommand } from './npm';
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
 * Installs OpenCode by running three sequential commands: OS package
 * dependencies first (`apk add nodejs npm`), then an `npm -v` probe to pick the
 * matching install command, then the global npm package itself.
 *
 * The probe selects `INSTALL_OPENCODE_COMMAND_ALLOW_SCRIPTS` on npm >= 11.16.0
 * (which gates dependency scripts behind `--allow-scripts`) and the plain
 * `INSTALL_OPENCODE_COMMAND` otherwise. It never fails the install — see
 * {@link selectNpmCommand}.
 *
 * When `onProgress` is provided the two real steps are launched via
 * {@link executeVerbose} so stdout lines stream to the callback in real-time
 * for live UI display (the silent `npm -v` probe always uses the blocking
 * {@link execute}). Without `onProgress` the blocking `execute` is used
 * throughout (backward-compatible path for callers that don't need streaming
 * output).
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
  const installCommand = await selectNpmCommand(
    INSTALL_OPENCODE_COMMAND_ALLOW_SCRIPTS,
    INSTALL_OPENCODE_COMMAND,
  );
  log.info(`installOpenCode: installing opencode-ai via "${installCommand}"`);
  try {
    if (onProgress) {
      await executeVerbose(installCommand, onProgress);
    } else {
      await execute(installCommand);
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
