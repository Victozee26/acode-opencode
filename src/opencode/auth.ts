import { execute } from '../terminal/executor';
import { BASE_URL, SERVER_USERNAME, AUTH_TOKEN_PARAM } from '../config/server';
import { PASSWORD_BYTE_LENGTH, V2_MAJOR_VERSION, BASIC_AUTH_SCHEME } from '../config/auth';
import { VERSION_CHECK_COMMAND } from '../config/update';
import { parseVersion } from './version';

/**
 * Generates a random per-launch server password as lowercase hex.
 *
 * Kept in memory only (see server.ts) and never persisted: each server start
 * mints a fresh password, and rotation invalidates old sessions by design.
 * Hex keeps the value shell-safe for the `env(1)`-prefixed serve command.
 */
export function generatePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(PASSWORD_BYTE_LENGTH));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Builds the iframe URL that signs the web UI in without typing: the SPA
 * reads `?auth_token=<base64url(user:password)>`, scrubs it from the address
 * bar, and holds the password in memory for its API calls (Basic auth). No
 * session cookie is involved and no network round-trip is needed to build it
 * — but the password itself must be known, so this only works for servers the
 * plugin started or whose password the user provided.
 */
export function buildAuthTokenUrl(password: string): string {
  return buildAuthTokenUrlFor(BASE_URL, password);
}

/**
 * Builds the sign-in URL for a specific server base URL.
 *
 * Same token format as `buildAuthTokenUrl`, but pointed at an arbitrary base
 * URL — used for remote servers, which the plugin does not start itself.
 */
export function buildAuthTokenUrlFor(baseUrl: string, password: string): string {
  const token = base64UrlEncode(`${SERVER_USERNAME}:${password}`);
  return `${baseUrl}/?${AUTH_TOKEN_PARAM}=${token}`;
}

/**
 * Builds the HTTP basic-auth `Authorization` header value for the server's
 * fixed username and the per-launch password.
 *
 * The server answers `/api/*` with 401 until a request carries a valid
 * pair, so this header is what turns an auth-walled probe into a readable one.
 */
export function buildBasicAuthHeader(password: string): string {
  return `${BASIC_AUTH_SCHEME}${btoa(`${SERVER_USERNAME}:${password}`)}`;
}

/**
 * Probes the installed CLI and returns its major version, or null when the
 * probe fails or the output is unparseable. Never rejects.
 */
export async function getInstalledMajor(): Promise<number | null> {
  try {
    const output = await execute(VERSION_CHECK_COMMAND);
    const version = parseVersion(output);
    if (!version) {
      return null;
    }
    const major = Number(version.split('.')[0]);
    return Number.isInteger(major) ? major : null;
  } catch {
    return null;
  }
}

/**
 * Returns true when the running server needs V2 auth handling: major version
 * at/above V2_MAJOR_VERSION, or unknown (secure default — an unrecognized
 * binary is treated as password-protected rather than open).
 */
export function needsPairing(major: number | null): boolean {
  return major === null || major >= V2_MAJOR_VERSION;
}
