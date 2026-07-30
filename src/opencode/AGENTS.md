# src/opencode

## Purpose

OpenCode lifecycle management: install detection, installation, server start/stop/restart, and health polling. All terminal interaction is delegated through `../terminal/executor.ts`.

## Ownership

Owned by the root AGENTS.md. Four export modules:
- `install.ts` — `checkInstalled()`, `installOpenCode()`, `uninstallOpenCode()`
- `health.ts` — `isServerUp()` (Cordova Advanced HTTP probe)
- `server.ts` — `buildStartCommand()`, `startServer()`, `waitForReady()`, `stopServer()`, `restartServer()`
- `update.ts` — `checkForUpdates()`, `installUpdate()` (npm version check + install)

## Local Contracts

- `checkInstalled()` runs `which opencode` and returns boolean — errors mean not installed.
- `installOpenCode()` runs two sequential commands: install deps (`apk add nodejs npm`), then `npm install -g opencode-ai`. Both are blocking. On failure, throws `Error` with distinct prefixes — `"Installation failed (deps): "` or `"Installation failed (opencode): "` — followed by the captured error message and command output from `execute()`.
- `uninstallOpenCode()` runs `npm uninstall -g opencode-ai`. On failure, throws `Error` with prefix `"Uninstallation failed: "` followed by the captured error message.
- `isServerUp()` (in `health.ts`) probes the `/global/health` endpoint (the standard OpenCode server health endpoint) using `cordova.plugin.http` (Cordova Advanced HTTP). `cordova.plugin.http` runs on the native network stack, so WebView CORS does NOT apply and the loopback probe actually resolves (a plain `fetch` to `127.0.0.1` hangs forever in this WebView). Any response — success callback OR a failure callback carrying a *positive* status — means something answered on the port → up; a negative status (connection refused) → down. The promise never rejects (bounded by an independent watchdog). Returns `false` immediately when `cordova.plugin.http` is absent. There is no `fetch` fallback.
- `startServer()` launches `opencode serve ...` via `startBackground()` from the terminal executor module, which wraps `Executor.BackgroundExecutor.start()` and returns a `BackgroundProcess` with a UUID. The UUID is stored in a module-level `serverUuid` variable. After `STARTUP_CHECK_DELAY` (500ms), it verifies the process is alive via both `isBackgroundRunning(uuid)` and `PROCESS_CHECK_COMMAND`. If the process exited immediately (missing binary, config error, port conflict), it throws an `Error` before the caller ever hits `waitForReady()`.
- `waitForReady()` polls `isServerUp()` every `READY_POLL_INTERVAL` ms until `READY_TIMEOUT`. On timeout, checks process state via `PROCESS_CHECK_COMMAND` and throws an `Error` that includes process state (alive/dead/unknown).
- `stopServer()` calls `stopBackground(serverUuid)` (the terminal executor wrapper) to gracefully stop the server process. Polls `isServerUp()` for up to `STOP_POLL_TIMEOUT`; if still up, falls back to `pkill -9` (SIGKILL) and polls again. Throws `Error` if port is still occupied after SIGKILL. Resets `serverUuid = null` on successful shutdown.
- `restartServer()` is stop → start sequential, no concurrent semantics.
- `checkForUpdates()` (in `update.ts`) runs `opencode --version` and `npm view opencode-ai version` in parallel, parses both outputs for semver-like patterns, and returns `{ currentVersion, latestVersion }` when latest > current. The promise never rejects: all errors (binary not found, npm unreachable, parse failure) are caught, logged, and return null. Designed as fire-and-forget from `AcodePlugin.init()`.
- `installUpdate()` (in `update.ts`) runs `npm install -g opencode-ai` via the Alpine terminal. Unlike `checkForUpdates()`, this function **throws** on failure so the caller (`AcodePlugin.handleUpdateClick()`) can transition to an error state in the UI.
- All command **string constants** are defined in `src/config/` (e.g. `opencode.ts`, `server.ts`, `health.ts`, `update.ts`). The `buildStartCommand()` builder (server-launch assembly) lives in `server.ts` because it is server-start logic and the sole consumer; `startServer()` calls it rather than inlining the raw shell command. Never inline raw shell strings in `server.ts`.

## Work Guidance

- Add new lifecycle stages by exporting a function, not by inlining logic in `main.ts`.
- The health probe lives in `health.ts` and uses `cordova.plugin.http` (bypasses WebView CORS and resolves on loopback). There is no `fetch` fallback — do not reintroduce one; a plain `fetch` to loopback hangs in this WebView.

## Verification

`npm test` runs Vitest with jsdom. Test files (under `test/opencode/`):
- `install.test.ts` — `checkInstalled()` (true on success, false on rejection) and `installOpenCode()` (success, deps failure, opencode failure, non-Error rejections).
- `health.test.ts` — `isServerUp()` success→up, failure-with-positive-status→up, failure-with-zero-status→down, plugin-absent→false, synchronous throw→false, and watchdog-timeout→false when no callback fires.
- `server.test.ts` — `stopServer()` SIGTERM success, SIGTERM→SIGKILL escalation, both-fail throw, execute-throwing resilience, and `pollUntilDown` timeout/instant-down scenarios. `startServer()` pgrep-alive resolve, process-dead throw. `waitForReady()` resolve-immediate on first poll, timeout-with-process-state.

## Child DOX Index

None. This directory is a leaf in the DOX hierarchy.
