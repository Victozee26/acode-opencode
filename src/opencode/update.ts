import { execute } from '../terminal/executor';
import {
  INSTALL_UPDATE_COMMAND,
  INSTALL_UPDATE_COMMAND_ALLOW_SCRIPTS,
  LATEST_VERSION_COMMAND,
  UNINSTALL_V1_COMMAND,
  VERSION_CHECK_COMMAND,
} from '../config/update';
import { selectNpmCommand } from './npm';
import { compareVersions, parseVersion } from './version';
import type { UpdateInfo } from '../types';
import { createLogger } from '../logger';

const log = createLogger('update');

/**
 * Checks whether a newer version of OpenCode is available on npm.
 *
 * Runs `opencode --version` and `npm view @opencode/cli version` in parallel,
 * then compares versions. The promise never rejects — all errors are logged
 * and swallowed so the caller can fire-and-forget without crash risk.
 *
 * Returns null when:
 *   - The opencode binary is not installed (version check fails)
 *   - npm is unreachable or the package lookup fails
 *   - Version strings cannot be parsed
 *   - Both versions are identical or current is newer
 */
export async function checkForUpdates(): Promise<UpdateInfo | null> {
  try {
    const [currentOutput, latestOutput] = await Promise.all([
      execute(VERSION_CHECK_COMMAND),
      execute(LATEST_VERSION_COMMAND),
    ]);

    const currentVersion = parseVersion(currentOutput);
    const latestVersion = parseVersion(latestOutput);

    if (!currentVersion || !latestVersion) {
      log.warn('checkForUpdates: could not parse version strings', {
        current: currentOutput.trim(),
        latest: latestOutput.trim(),
      });
      return null;
    }

    log.info(`checkForUpdates: current=${currentVersion}, latest=${latestVersion}`);

    if (compareVersions(latestVersion, currentVersion) > 0) {
      return { currentVersion, latestVersion };
    }

    return null;
  } catch (err) {
    log.warn('checkForUpdates: failed', err);
    return null;
  }
}

/**
 * Installs the latest OpenCode version from npm.
 *
 * Best-effort removes the legacy V1 package first so the update migrates
 * instead of leaving both packages behind, then runs the command chosen by
 * {@link selectNpmCommand} via the Alpine terminal:
 * `npm install -g --allow-scripts=@opencode/cli @opencode/cli` on npm >= 11.16.0,
 * plain `npm install -g @opencode/cli` otherwise. Throws on failure so the
 * caller can transition to an error state in the UI.
 */
export async function installUpdate(): Promise<void> {
  log.info('installUpdate: installing');
  try {
    await execute(UNINSTALL_V1_COMMAND);
  } catch (err) {
    log.info('installUpdate: V1 uninstall skipped', err);
  }
  const command = await selectNpmCommand(
    INSTALL_UPDATE_COMMAND_ALLOW_SCRIPTS,
    INSTALL_UPDATE_COMMAND,
  );
  log.info(`installUpdate: running "${command}"`);
  await execute(command);
  log.info('installUpdate: done');
}

/**
 * Probes the currently installed CLI version. Returns the parsed version or
 * null when the probe fails or the output is unparseable. Never rejects —
 * used to refresh the update banner after an install.
 */
export async function getInstalledVersion(): Promise<string | null> {
  try {
    return parseVersion(await execute(VERSION_CHECK_COMMAND));
  } catch {
    return null;
  }
}
