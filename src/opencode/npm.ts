import { execute } from '../terminal/executor';
import { NPM_ALLOW_SCRIPTS_MIN_VERSION, NPM_VERSION_COMMAND } from '../config/opencode';
import { compareVersions, parseVersion } from './version';
import { createLogger } from '../logger';

const log = createLogger('npm');

/**
 * Picks the npm install command that matches the npm version installed in the
 * Alpine container.
 *
 * Runs `NPM_VERSION_COMMAND` (`npm -v`) and compares it to
 * `NPM_ALLOW_SCRIPTS_MIN_VERSION`. npm at or above the minimum gets
 * `allowScriptsCommand` (which passes `--allow-scripts=opencode-ai`); anything
 * older gets `fallbackCommand`, because older npm rejects the unknown flag.
 *
 * Never rejects: a failed probe, an unparseable version, or an older npm all
 * resolve to `fallbackCommand`, so the install/update flow is never blocked by
 * the version check. The probe runs after the deps step, since npm itself is
 * installed by that step.
 */
export async function selectNpmCommand(
  allowScriptsCommand: string,
  fallbackCommand: string,
): Promise<string> {
  try {
    const output = await execute(NPM_VERSION_COMMAND);
    const version = parseVersion(String(output ?? ''));
    const supportsAllowScripts =
      version !== null && compareVersions(version, NPM_ALLOW_SCRIPTS_MIN_VERSION) >= 0;

    if (supportsAllowScripts) {
      log.info(`selectNpmCommand: npm ${version} supports --allow-scripts`);
      return allowScriptsCommand;
    }
    log.info(`selectNpmCommand: npm ${version ?? 'unknown'} does not support --allow-scripts`);
    return fallbackCommand;
  } catch (err) {
    log.warn('selectNpmCommand: npm version probe failed, using fallback command', err);
    return fallbackCommand;
  }
}
