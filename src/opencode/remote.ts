import {
  REMOTE_BRACKET_CLOSE,
  REMOTE_BRACKET_OPEN,
  REMOTE_DEFAULT_HTTP_PORT,
  REMOTE_DEFAULT_HTTPS_PORT,
  REMOTE_HOST_PATTERN,
  REMOTE_HOST_PORT_SEPARATOR,
  REMOTE_PORT_MAX,
  REMOTE_PORT_MIN,
  REMOTE_PORT_PATTERN,
  REMOTE_SCHEME_HTTP,
  REMOTE_SCHEME_HTTPS,
  REMOTE_SCHEME_SEPARATOR,
} from '../config/remote';
import { buildAuthTokenUrlFor } from './auth';

/**
 * A remote OpenCode server the user pointed the plugin at.
 *
 * The host string comes from a plugin setting, so it is parsed and validated
 * before anything is derived from it.
 */
export interface RemoteHost {
  // Base URL of the remote server, without a trailing slash.
  baseUrl: string;
  // Hostname or IP literal of the remote server.
  host: string;
  // TCP port of the remote server.
  port: number;
  // True when the remote server is reached over HTTPS.
  secure: boolean;
}

// A scheme split off the front of the host setting.
interface SchemeSplit {
  scheme: string;
  rest: string;
}

// A host with its optional port split off.
interface HostPortSplit {
  host: string;
  portText: string | null;
}

/**
 * Splits the scheme off the host setting. A setting without a scheme is
 * treated as plain HTTP; any scheme other than http/https is rejected.
 */
function splitScheme(raw: string): SchemeSplit | null {
  const index = raw.indexOf(REMOTE_SCHEME_SEPARATOR);
  if (index === -1) {
    return { scheme: REMOTE_SCHEME_HTTP, rest: raw };
  }
  const scheme = raw.slice(0, index).toLowerCase();
  if (scheme !== REMOTE_SCHEME_HTTP && scheme !== REMOTE_SCHEME_HTTPS) {
    return null;
  }
  return { scheme, rest: raw.slice(index + REMOTE_SCHEME_SEPARATOR.length) };
}

/**
 * Splits the port off the host part. The last colon wins, so a bare IPv6
 * literal stays intact; an IPv6 literal in brackets may carry a port after
 * the closing bracket.
 */
function splitHostPort(rest: string): HostPortSplit | null {
  if (!rest) return null;
  if (rest.startsWith(REMOTE_BRACKET_OPEN)) {
    return splitBracketedHost(rest);
  }
  const separator = rest.lastIndexOf(REMOTE_HOST_PORT_SEPARATOR);
  if (separator === -1) {
    return { host: rest, portText: null };
  }
  return { host: rest.slice(0, separator), portText: rest.slice(separator + 1) };
}

/**
 * Splits a bracketed host (`[::1]` or `[::1]:4096`) into host and port.
 */
function splitBracketedHost(rest: string): HostPortSplit | null {
  const close = rest.indexOf(REMOTE_BRACKET_CLOSE);
  if (close === -1) return null;
  const host = rest.slice(0, close + 1);
  const tail = rest.slice(close + 1);
  if (!tail) return { host, portText: null };
  if (!tail.startsWith(REMOTE_HOST_PORT_SEPARATOR)) return null;
  return { host, portText: tail.slice(1) };
}

/**
 * Validates a host: a bracketed IPv6 literal, or a hostname / IPv4 literal
 * made of letters, digits, dots and hyphens.
 */
function isValidHost(host: string): boolean {
  if (!host) return false;
  if (host.startsWith(REMOTE_BRACKET_OPEN)) {
    return host.endsWith(REMOTE_BRACKET_CLOSE) && host.length > REMOTE_BRACKET_CLOSE.length;
  }
  return REMOTE_HOST_PATTERN.test(host);
}

/**
 * Resolves the port of the remote server: the explicit one from the setting,
 * or the scheme's default.
 */
function resolvePort(portText: string | null, secure: boolean): number | null {
  if (portText === null) {
    return secure ? REMOTE_DEFAULT_HTTPS_PORT : REMOTE_DEFAULT_HTTP_PORT;
  }
  if (!REMOTE_PORT_PATTERN.test(portText)) return null;
  const port = Number(portText);
  if (port < REMOTE_PORT_MIN || port > REMOTE_PORT_MAX) return null;
  return port;
}

/**
 * Parses the remote host setting into a validated remote server.
 *
 * Accepted shapes: `host`, `host:port`, `scheme://host`, `scheme://host:port`
 * and bracketed IPv6 literals (`[::1]:4096`). Returns null for anything
 * empty, malformed or out of range — the caller then reports the invalid-host
 * error instead of connecting to a bogus URL.
 */
export function parseRemoteHost(value: string | null | undefined): RemoteHost | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;

  const schemeSplit = splitScheme(raw);
  if (!schemeSplit) return null;

  const hostPort = splitHostPort(schemeSplit.rest);
  if (!hostPort) return null;
  if (!isValidHost(hostPort.host)) return null;

  const secure = schemeSplit.scheme === REMOTE_SCHEME_HTTPS;
  const port = resolvePort(hostPort.portText, secure);
  if (port === null) return null;

  return {
    baseUrl: `${schemeSplit.scheme}${REMOTE_SCHEME_SEPARATOR}${hostPort.host}:${port}`,
    host: hostPort.host,
    port,
    secure,
  };
}

/**
 * Builds the iframe URL for a remote server: the sign-in URL when the
 * password is known, the plain base URL otherwise (manual login in the web UI).
 */
export function buildRemoteIframeUrl(baseUrl: string, password: string | null): string {
  return password ? buildAuthTokenUrlFor(baseUrl, password) : baseUrl;
}
