import { execute } from '../terminal/executor';
import { VERSION_CHECK_COMMAND, LATEST_VERSION_COMMAND, INSTALL_UPDATE_COMMAND } from '../config/update';
import type { UpdateInfo } from '../types';
import { createLogger } from '../logger';

const log = createLogger('update');

/**
 * Extracts a semver version string from CLI output.
 *
 * Handles formats like '1.8.0', 'v1.8.0', 'opencode/1.8.0 (linux arm64)'.
 * Returns null when no semver-like pattern is found.
 */
function parseVersion(output: string): string | null {
  const match = output.trim().match(/(\d+\.\d+(?:\.\d+)?)/);
  return match ? match[1] : null;
}

/**
 * Simple semver comparison — returns true when `latest` > `current`.
 *
 * Compares each numeric part left-to-right. Missing parts are treated as 0.
 */
function isNewerVersion(current: string, latest: string): boolean {
  const curParts = current.split('.').map(Number);
  const latParts = latest.split('.').map(Number);
  const maxLen = Math.max(curParts.length, latParts.length);

  for (let i = 0; i < maxLen; i++) {
    const cur = curParts[i] ?? 0;
    const lat = latParts[i] ?? 0;
    if (lat > cur) return true;
    if (lat < cur) return false;
  }
  return false;
}

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

    if (isNewerVersion(currentVersion, latestVersion)) {
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
 * Runs `npm install -g opencode-ai` via the Alpine terminal. Throws on failure
 * so the caller can transition to an error state in the UI.
 */
export async function installUpdate(): Promise<void> {
  log.info('installUpdate: installing');
  await execute(INSTALL_UPDATE_COMMAND);
  log.info('installUpdate: done');
}
