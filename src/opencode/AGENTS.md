# src/opencode

## Purpose

OpenCode lifecycle management: install detection, installation, server start/stop/restart, and health polling. All terminal interaction is delegated through `../terminal/executor.ts`.

## Ownership

Owned by the root AGENTS.md. Seven export modules:
- `install.ts` — `checkInstalled()`, `installOpenCode()`, `uninstallOpenCode()`
- `health.ts` — `isServerUp()` (Cordova Advanced HTTP probe)
- `server.ts` — `buildStartCommand()`, `startServer()`, `waitForReady()`, `stopServer()`, `restartServer()`
- `update.ts` — `checkForUpdates()`, `installUpdate()` (npm version check + install)
- `npm.ts` — `selectNpmCommand()` (probes `npm -v`, picks the install command)
- `version.ts` — `parseVersion()`, `compareVersions()` (shared semver-ish helpers)
- `diagnostics.ts` — `getRuntimeVersions()` (node/npm versions for the error view)

## Local Contracts

- `checkInstalled()` runs `which opencode` and returns boolean — errors mean not installed.
- `installOpenCode()` runs three sequential commands: install deps (`apk add nodejs npm`), probe npm (`npm -v`), then the npm install command chosen by `selectNpmCommand()`. Accepts an optional `onProgress` callback — when provided the deps and install steps execute via `executeVerbose()` (real-time stdout streaming) while the silent version probe always uses the blocking `execute()`; callers that don't need live feedback (tests) call without args and use the backward-compatible `execute()` path. On failure, throws `Error` with distinct prefixes — `"Installation failed (deps): "` or `"Installation failed (opencode): "` — followed by the captured error message and command output. The version probe cannot fail the install (see `selectNpmCommand()`).
- `uninstallOpenCode()` runs `npm uninstall -g opencode-ai`. On failure, throws `Error` with prefix `"Uninstallation failed: "` followed by the captured error message.
- `selectNpmCommand(allowScriptsCommand, fallbackCommand)` (in `npm.ts`) runs `NPM_VERSION_COMMAND` (`npm -v`) and returns `allowScriptsCommand` when the parsed version is `>= NPM_ALLOW_SCRIPTS_MIN_VERSION` (currently `11.16.0`), else `fallbackCommand`. Never rejects: a failed probe, unparseable output, or an older npm all fall back, so install/update is never blocked by the check. Used by both `installOpenCode()` and `installUpdate()`; the probe runs after the deps step because that step is what installs npm.
- `parseVersion()` / `compareVersions()` (in `version.ts`) are the shared semver-ish helpers used by `npm.ts` and `update.ts`. `compareVersions(left, right)` returns negative/zero/positive and treats missing parts as 0 ('11.16' === '11.16.0').
- `getRuntimeVersions()` (in `diagnostics.ts`) runs `NODE_VERSION_COMMAND` and `NPM_VERSION_COMMAND` in parallel and returns `{ node, npm }` — raw output (`'v26.8.2'`, `'11.19.1'`) or `VERSION_UNKNOWN` (`'?'`) per field. Never rejects and is bounded by `RUNTIME_VERSION_PROBE_TIMEOUT`, so a hung terminal resolves to `?` instead of stalling. Called fire-and-forget by `main.ts` after an error renders; `setErrorVersions()` in `ui/index.ts` fills the error view with the result.
- `isServerUp()` (in `health.ts`) probes the `/global/health` endpoint (the standard OpenCode server health endpoint) using `cordova.plugin.http` (Cordova Advanced HTTP). `cordova.plugin.http` runs on the native network stack, so WebView CORS does NOT apply and the loopback probe actually resolves (a plain `fetch` to `127.0.0.1` hangs forever in this WebView). Any response — success callback OR a failure callback carrying a *positive* status — means something answered on the port → up; a negative status (connection refused) → down. The promise never rejects (bounded by an independent watchdog). Returns `false` immediately when `cordova.plugin.http` is absent. There is no `fetch` fallback.
- `startServer()` launches `opencode serve ...` via `startBackground()` from the terminal executor module, which wraps `Executor.BackgroundExecutor.start()` and returns a `BackgroundProcess` with a UUID. The UUID is stored in a module-level `serverUuid` variable. No immediate crash check — if the process exits prematurely, it will be detected naturally by `waitForReady()` timing out. Server stdout/stderr lines are accumulated in a configurable ring buffer (`SERVER_LOG_LINES`, default 20) for diagnostics.
- `getServerLog()` returns the current ring buffer contents as a string — used for error diagnostics (e.g. when `waitForReady()` times out, the last N lines are included in the error message so the user can see what the server was doing).
- `waitForReady()` polls `isServerUp()` every `READY_POLL_INTERVAL` ms until `READY_TIMEOUT`. On timeout, checks process state via `PROCESS_CHECK_COMMAND` and throws an `Error` that includes process state (alive/dead/unknown).
- `stopServer()` calls `stopBackground(serverUuid)` (the terminal executor wrapper) to gracefully stop the server process. Polls `isServerUp()` for up to `STOP_POLL_TIMEOUT`; if still up, falls back to `pkill -9` (SIGKILL) and polls again. Throws `Error` if port is still occupied after SIGKILL. Resets `serverUuid = null` on successful shutdown.
- `restartServer()` is stop → start sequential, no concurrent semantics.
- `checkForUpdates()` (in `update.ts`) runs `opencode --version` and `npm view opencode-ai version` in parallel, parses both outputs for semver-like patterns, and returns `{ currentVersion, latestVersion }` when latest > current. The promise never rejects: all errors (binary not found, npm unreachable, parse failure) are caught, logged, and return null. Designed as fire-and-forget from `AcodePlugin.init()`.
- `installUpdate()` (in `update.ts`) runs the command chosen by `selectNpmCommand()` — `INSTALL_UPDATE_COMMAND_ALLOW_SCRIPTS` on npm >= the minimum, `INSTALL_UPDATE_COMMAND` otherwise — via the Alpine terminal. Unlike `checkForUpdates()`, this function **throws** on failure so the caller (`AcodePlugin.handleUpdateClick()`) can transition to an error state in the UI.
- All command **string constants** are defined in `src/config/` (e.g. `opencode.ts`, `server.ts`, `health.ts`, `update.ts`). The `buildStartCommand()` builder (server-launch assembly) lives in `server.ts` because it is server-start logic and the sole consumer; `startServer()` calls it rather than inlining the raw shell command. Never inline raw shell strings in `server.ts`.

## Work Guidance

- Add new lifecycle stages by exporting a function, not by inlining logic in `main.ts`.
- The health probe lives in `health.ts` and uses `cordova.plugin.http` (bypasses WebView CORS and resolves on loopback). There is no `fetch` fallback — do not reintroduce one; a plain `fetch` to loopback hangs in this WebView.

## Verification

`npm test` runs Vitest with jsdom. Test files (under `test/opencode/`):
- `install.test.ts` — `checkInstalled()` (true on success, false on rejection) and `installOpenCode()` (success, npm-version command selection incl. probe failure, deps failure, install failure, non-Error rejections, and the `onProgress` streaming path).
- `npm.test.ts` — `selectNpmCommand()` at/above/below `NPM_ALLOW_SCRIPTS_MIN_VERSION`, probe rejection, unparseable/undefined output, and probe command used.
- `version.test.ts` — `parseVersion()` (bare, `v`-prefixed, decorated, absent) and `compareVersions()` (equal, missing patch, older/newer).
- `diagnostics.test.ts` — `getRuntimeVersions()` both-probes-ok, first-line extraction, one failing probe → `?`, empty output → `?`, and fake-timer timeout → `?`.
- `update.test.ts` — `installUpdate()` allow-scripts vs plain command selection, probe failure fallback, and failure propagation.
- `health.test.ts` — `isServerUp()` success→up, failure-with-positive-status→up, failure-with-zero-status→down, plugin-absent→false, synchronous throw→false, and watchdog-timeout→false when no callback fires.
- `server.test.ts` — `stopServer()` SIGTERM success, SIGTERM→SIGKILL escalation, both-fail throw, execute-throwing resilience, and `pollUntilDown` timeout/instant-down scenarios. `startServer()` pgrep-alive resolve, process-dead throw. `waitForReady()` resolve-immediate on first poll, timeout-with-process-state.

## Child DOX Index

None. This directory is a leaf in the DOX hierarchy.
