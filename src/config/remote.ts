// Remote host setting constants.
//
// The plugin normally runs its own OpenCode server inside Acode's terminal
// (loopback, port 4123). When `remoteHost` is set, the plugin instead connects
// to an OpenCode server running somewhere else (another machine on the LAN, a
// VPS, a dev box) and embeds that server's web UI. The host is entered by the
// user, so every accepted shape is parsed and validated before use.

// Settings key holding the remote host the plugin connects to. An empty value
// keeps the plugin in local mode (it starts and manages its own server).
export const SETTINGS_KEY_REMOTE_HOST = 'remoteHost';

// Default port of a remote OpenCode server reached over plain HTTP. Matches
// OpenCode's own default serve port — the plugin's local server uses 4123 to
// avoid clashing with a manually started one.
export const REMOTE_DEFAULT_HTTP_PORT = 4096;

// Default port of a remote OpenCode server reached over HTTPS (the scheme
// implies it when the setting omits a port).
export const REMOTE_DEFAULT_HTTPS_PORT = 443;

// URL schemes accepted in the remote host setting.
export const REMOTE_SCHEME_HTTP = 'http';
export const REMOTE_SCHEME_HTTPS = 'https';

// Separator between a scheme and the rest of the remote host setting.
export const REMOTE_SCHEME_SEPARATOR = '://';

// Separator between a host and its port in the remote host setting.
export const REMOTE_HOST_PORT_SEPARATOR = ':';

// Brackets around an IPv6 literal in the remote host setting.
export const REMOTE_BRACKET_OPEN = '[';
export const REMOTE_BRACKET_CLOSE = ']';

// Lowest and highest TCP port numbers accepted in the remote host setting.
export const REMOTE_PORT_MIN = 1;
export const REMOTE_PORT_MAX = 65535;

// Hostname characters accepted in the remote host setting: letters, digits,
// dots (FQDN and IPv4 literals) and hyphens.
export const REMOTE_HOST_PATTERN = /^[A-Za-z0-9._-]+$/;

// Port field of the remote host setting: digits only.
export const REMOTE_PORT_PATTERN = /^[0-9]+$/;

// User-facing messages for the remote connection flow.
export const REMOTE_INVALID_HOST_MESSAGE =
  'Invalid remote host. Use "host", "host:port", or "scheme://host:port" (e.g. 192.168.1.10:4096).';
export const REMOTE_UNREACHABLE_MESSAGE =
  'Cannot reach the remote OpenCode server. Check the host, port and network.';
export const REMOTE_BAD_PASSWORD_MESSAGE = 'The remote OpenCode server rejected the password.';
export const REMOTE_PROMPT_TITLE = 'Remote OpenCode server';
export const REMOTE_PROMPT_MESSAGE =
  'Enter the remote server password to sign in automatically, or cancel for manual login.';
export const REMOTE_PROMPT_PLACEHOLDER = 'Server password';
