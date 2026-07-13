# src/opencode

## Purpose

OpenCode lifecycle management: install detection, installation, server start/stop/restart, and health polling. All terminal interaction is delegated through `../terminal/executor.ts`.

## Ownership

Owned by the root AGENTS.md. Two export modules:
- `install.ts` — `checkInstalled()`, `installOpenCode()`
- `server.ts` — `isServerUp()`, `startServer()`, `waitForReady()`, `stopServer()`, `restartForProject()`

## Local Contracts

- `checkInstalled()` runs `which opencode` and returns boolean — errors mean not installed.
- `installOpenCode()` runs two sequential commands: install deps (`apk add nodejs npm`), then `npm install -g opencode-ai`. Both are blocking.
- `isServerUp()` uses `fetch` with `no-cors` mode and `AbortController` timeout — NOT a standard HTTP health check. Addresses WebView CORS constraints.
- `startServer()` fires `nohup ... & disown` via `execute()`. The caller must not call `execute()` directly for server start.
- `waitForReady()` polls `isServerUp()` every `READY_POLL_INTERVAL` ms until `READY_TIMEOUT`.
- `stopServer()` runs `pkill -f "opencode serve"` — best-effort, errors are swallowed.
- `restartForProject()` is stop → start sequential, no concurrent semantics.
- All commands are defined in `src/config.ts` — never inline shell commands here.

## Work Guidance

- Add new lifecycle stages by exporting a function, not by inlining logic in `main.ts`.
- Health check changes must preserve `no-cors` mode — the WebView blocks normal CORS requests to `127.0.0.1`.

## Verification

No automated tests. Manual QA per BUILD_PLAN.md Phase 5.

## Child DOX Index

None. This directory is a leaf in the DOX hierarchy.
