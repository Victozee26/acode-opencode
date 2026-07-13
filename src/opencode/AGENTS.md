# src/opencode

## Purpose

OpenCode lifecycle management: install detection, installation, server start/stop/restart, and health polling. All terminal interaction is delegated through `../terminal/executor.ts`.

## Ownership

Owned by the root AGENTS.md. Two export modules:
- `install.ts` — `checkInstalled()`, `installOpenCode()`
- `server.ts` — `isServerUp()`, `startServer()`, `waitForReady()`, `stopServer()`, `restartServer()`

## Local Contracts

- `checkInstalled()` runs `which opencode` and returns boolean — errors mean not installed.
- `installOpenCode()` runs two sequential commands: install deps (`apk add nodejs npm`), then `npm install -g opencode-ai`. Both are blocking. On failure, throws `Error` with distinct prefixes — `"Installation failed (deps): "` or `"Installation failed (opencode): "` — followed by the captured error message and command output from `execute()`.
- `isServerUp()` uses `fetch` with `no-cors` mode and `AbortController` timeout — NOT a standard HTTP health check. Addresses WebView CORS constraints.
- `startServer()` fires `nohup ... & disown` via `execute()`, then waits `STARTUP_CHECK_DELAY` (500ms) and validates the process is alive via `pgrep`. If the process exited immediately (missing binary, config error, port conflict), it reads the last `LOG_TAIL_LINES` (20) from the log and throws a descriptive `Error` before the caller ever hits `waitForReady()`. The caller must not call `execute()` directly for server start.
- `waitForReady()` polls `isServerUp()` every `READY_POLL_INTERVAL` ms until `READY_TIMEOUT`.
- `stopServer()` runs SIGTERM via `pkill -f "opencode serve"`, polls `isServerUp()` for up to `STOP_POLL_TIMEOUT`, escalates to SIGKILL (`pkill -9`) if needed, and polls again. Throws `Error` if port is still occupied after SIGKILL.
- `restartServer()` is stop → start sequential, no concurrent semantics.
- All commands are defined in `src/config.ts` — never inline shell commands here.

## Work Guidance

- Add new lifecycle stages by exporting a function, not by inlining logic in `main.ts`.
- Health check changes must preserve `no-cors` mode — the WebView blocks normal CORS requests to `127.0.0.1`.

## Verification

`npm test` runs Vitest with jsdom. Test files:
- `install.test.ts` — `checkInstalled()` (true on success, false on rejection) and `installOpenCode()` (success, deps failure, opencode failure, non-Error rejections).
- `server.test.ts` — `stopServer()` SIGTERM success, SIGTERM→SIGKILL escalation, both-fail throw, execute-throwing resilience, and `pollUntilDown` timeout/instant-down scenarios.

## Child DOX Index

None. This directory is a leaf in the DOX hierarchy.
