# src/opencode

## Purpose

OpenCode lifecycle management: install detection, installation, server start/stop/restart, and health polling. All terminal interaction is delegated through `../terminal/executor.ts`.

## Ownership

Owned by the root AGENTS.md. Two export modules:
- `install.ts` — `checkInstalled()`, `installOpenCode()`
- `health.ts` — `isServerUp()` (Cordova Advanced HTTP probe)
- `server.ts` — `buildStartCommand()`, `startServer()`, `waitForReady()`, `stopServer()`, `restartServer()`

## Local Contracts

- `checkInstalled()` runs `which opencode` and returns boolean — errors mean not installed.
- `installOpenCode()` runs two sequential commands: install deps (`apk add nodejs npm`), then `npm install -g opencode-ai`. Both are blocking. On failure, throws `Error` with distinct prefixes — `"Installation failed (deps): "` or `"Installation failed (opencode): "` — followed by the captured error message and command output from `execute()`.
- `isServerUp()` (in `health.ts`) probes the `/global/health` endpoint (the standard OpenCode server health endpoint) using `cordova.plugin.http` (Cordova Advanced HTTP). `cordova.plugin.http` runs on the native network stack, so WebView CORS does NOT apply and the loopback probe actually resolves (a plain `fetch` to `127.0.0.1` hangs forever in this WebView). Any response — success callback OR a failure callback carrying a *positive* status — means something answered on the port → up; a negative status (connection refused) → down. The promise never rejects (bounded by an independent watchdog). Returns `false` immediately when `cordova.plugin.http` is absent. There is no `fetch` fallback.
- `startServer()` fires a `nohup opencode serve ... 2>&1 | tee LOG_PATH &` command via `execute()`, then waits `STARTUP_CHECK_DELAY` (500ms) and validates the process is alive via `PROCESS_CHECK_COMMAND`. The `| tee` is mandatory: `Executor.execute()` reaps the backgrounded server the instant its stdout pipe hits EOF, so a plain `> LOG 2>&1` file redirect (which closes the pipe) gets the server killed — it vanishes from the inspector and the health probe misses it. `tee` keeps the executor's stdout pipe open (so the session survives) while still writing the log file. If the process exited immediately (missing binary, config error, port conflict), it reads the last `LOG_TAIL_LINES` (20) from the log and throws a descriptive `Error` before the caller ever hits `waitForReady()`. The caller must not call `execute()` directly for server start.
- **Why `--print-logs`:** `opencode serve` writes its logs to `~/.local/share/opencode/log/<ts>.log` by default — stdout receives only 1–2 `console.log` lines that are block-buffered by Node when piped to a file, so they almost never flush. The result is a misleading `(no log output)` in the error UI when the server is actually alive. `--print-logs` mirrors the real Effect-Log output to stderr (line-buffered, flushes immediately), so `/tmp/opencode.log` actually contains the startup sequence for diagnostics.
- `waitForReady()` polls `isServerUp()` every `READY_POLL_INTERVAL` ms until `READY_TIMEOUT`. On timeout, reads the last `LOG_TAIL_LINES` from `LOG_PATH` via `readLogTail()`, checks process state via `PROCESS_CHECK_COMMAND`, and throws an `Error` that includes process state (alive/dead/unknown), log tail (or `(no log output)` if empty/unreadable).
- `stopServer()` runs SIGTERM via `pkill -f "opencode serve"`, polls `isServerUp()` for up to `STOP_POLL_TIMEOUT`, escalates to SIGKILL (`pkill -9`) if needed, and polls again. Throws `Error` if port is still occupied after SIGKILL.
- `restartServer()` is stop → start sequential, no concurrent semantics.
- All command **string constants** are defined in `src/config.ts`. The `buildStartCommand()` builder (server-launch assembly) lives in `server.ts` because it is server-start logic and the sole consumer; `startServer()` calls it rather than inlining the raw shell command. Never inline raw shell strings in `server.ts`.

## Work Guidance

- Add new lifecycle stages by exporting a function, not by inlining logic in `main.ts`.
- The health probe lives in `health.ts` and uses `cordova.plugin.http` (bypasses WebView CORS and resolves on loopback). There is no `fetch` fallback — do not reintroduce one; a plain `fetch` to loopback hangs in this WebView.

## Verification

`npm test` runs Vitest with jsdom. Test files:
- `install.test.ts` — `checkInstalled()` (true on success, false on rejection) and `installOpenCode()` (success, deps failure, opencode failure, non-Error rejections).
- `health.test.ts` — `isServerUp()` success→up, failure-with-positive-status→up, failure-with-zero-status→down, plugin-absent→false, synchronous throw→false, and watchdog-timeout→false when no callback fires.
- `server.test.ts` — `stopServer()` SIGTERM success, SIGTERM→SIGKILL escalation, both-fail throw, execute-throwing resilience, and `pollUntilDown` timeout/instant-down scenarios. `startServer()` pgrep-alive resolve, process-dead throw with log output, process-dead throw with "(no log output)", `readLogTail` trimming, and `readLogTail` failure fallback to empty string. `waitForReady()` resolve-immediate on first poll, timeout-with-log-and-process-state, timeout-with-"(no log output)"-and-process-dead.

## Child DOX Index

None. This directory is a leaf in the DOX hierarchy.
