// Server-auth values for the V2 password + auth_token flow. These V2 builds
// gate the web UI behind basic auth (auto-generating a password when none is
// set), so the plugin always sets a known per-launch password and signs the
// iframe in via `?auth_token=` (see auth.ts).
export const PASSWORD_BYTE_LENGTH = 24;

// Major version at which the installed CLI switched to mandatory serve auth.
// Below this the plugin keeps the legacy behavior (no password, iframe loads
// the base URL directly); at/above it the pairing flow is used.
export const V2_MAJOR_VERSION = 2;
