import { execute } from '../terminal/executor';
import {
  INSTALL_UPDATE_COMMAND,
  INSTALL_UPDATE_COMMAND_ALLOW_SCRIPTS,
  LATEST_VERSION_COMMAND,
  VERSION_CHECK_COMMAND,
} from '../config/update';
import { selectNpmCommand } from './npm';
import { compareVersions, parseVersion } from './version';
import type { UpdateInfo } from '../types';
import { createLogger } from '../logger';

const log = createLogger('update');

/**
 * Checks whether a newer version of opencode-ai is available on npm.
 *
 * Runs `opencode --version` and `npm view opencode-ai version` in parallel,
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
 * Installs the latest opencode-ai version from npm.
 *
 * Runs the command chosen by {@link selectNpmCommand} via the Alpine terminal:
 * `npm install -g --allow-scripts=opencode-ai opencode-ai` on npm >= 11.16.0,
 * plain `npm install -g opencode-ai` otherwise. Throws on failure so the
 * caller can transition to an error state in the UI.
 */
export async function installUpdate(): Promise<void> {
  log.info('installUpdate: installing');
  const command = await selectNpmCommand(
    INSTALL_UPDATE_COMMAND_ALLOW_SCRIPTS,
    INSTALL_UPDATE_COMMAND,
  );
  log.info(`installUpdate: running "${command}"`);
  await execute(command);
  log.info('installUpdate: done');
}
