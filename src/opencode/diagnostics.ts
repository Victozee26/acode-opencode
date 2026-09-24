import { execute } from '../terminal/executor';
import {
  NODE_VERSION_COMMAND,
  NPM_VERSION_COMMAND,
  RUNTIME_VERSION_PROBE_TIMEOUT,
  VERSION_UNKNOWN,
} from '../config/opencode';
import type { RuntimeVersions } from '../types';
import { createLogger } from '../logger';

const log = createLogger('diagnostics');

/**
 * Runs one version command and returns its first trimmed output line, or
 * VERSION_UNKNOWN on any failure (binary missing, non-zero exit, empty output).
 */
async function probeVersion(command: string): Promise<string> {
  try {
    const output = await execute(command);
    const value = output.trim().split('\n')[0].trim();
    return value || VERSION_UNKNOWN;
  } catch {
    return VERSION_UNKNOWN;
  }
}

/**
 * Resolves with `work`'s value, or with `fallback` once RUNTIME_VERSION_PROBE_TIMEOUT
 * elapses. The timer is cleared when `work` settles so the probe never leaves a
 * dangling timeout behind. `work` is expected never to reject.
 */
function withTimeout<T>(work: Promise<T>, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(fallback);
    }, RUNTIME_VERSION_PROBE_TIMEOUT);

    work.then((value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    });
  });
}

/**
 * Probes the Alpine container for its node and npm versions, in parallel, for
 * display in the error view's diagnostics block.
 *
 * Never rejects and always bounded by RUNTIME_VERSION_PROBE_TIMEOUT: a failing
 * or hanging probe yields VERSION_UNKNOWN for that field, so the error screen
 * (rendered before this resolves) can safely fill itself in afterwards.
 */
export async function getRuntimeVersions(): Promise<RuntimeVersions> {
  const unknownVersions: RuntimeVersions = { node: VERSION_UNKNOWN, npm: VERSION_UNKNOWN };
  const versions = await withTimeout(
    Promise.all([probeVersion(NODE_VERSION_COMMAND), probeVersion(NPM_VERSION_COMMAND)]).then(
      ([node, npm]) => ({ node, npm }),
    ),
    unknownVersions,
  );
  log.info(`getRuntimeVersions: node=${versions.node}, npm=${versions.npm}`);
  return versions;
}
