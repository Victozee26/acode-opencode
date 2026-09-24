/**
 * Shared semver-ish helpers for CLI output.
 *
 * Used by the npm version probe (`npm.ts`) and the opencode update check
 * (`update.ts`) so both compare versions with the same rules.
 */

/**
 * Extracts a semver version string from CLI output.
 *
 * Handles formats like '1.8.0', 'v1.8.0', 'opencode/1.8.0 (linux arm64)'.
 * Returns null when no semver-like pattern is found.
 */
export function parseVersion(output: string): string | null {
  const match = output.trim().match(/(\d+\.\d+(?:\.\d+)?)/);
  return match ? match[1] : null;
}

/**
 * Compares two version strings — returns a negative number when `left` is
 * older than `right`, `0` when they are equal, and a positive number when
 * `left` is newer.
 *
 * Compares each numeric part left-to-right. Missing parts are treated as 0, so
 * '11.16' and '11.16.0' compare equal.
 */
export function compareVersions(left: string, right: string): number {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  const maxLen = Math.max(leftParts.length, rightParts.length);

  for (let i = 0; i < maxLen; i++) {
    const l = leftParts[i] ?? 0;
    const r = rightParts[i] ?? 0;
    if (l !== r) return l - r;
  }
  return 0;
}
