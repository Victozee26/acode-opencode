# Acode-OpenCode Plugin

An Acode plugin that runs [OpenCode](https://github.com/anomalyco/opencode) (AI coding agent) as a background HTTP server inside Acode's built-in Alpine Linux terminal, and displays OpenCode's web UI in a full-page iframe.

## How It Works

1. Tap the toolbar icon to open the plugin page.
2. The plugin checks if OpenCode is installed in Alpine — installs it if needed (`apk add --no-cache nodejs npm && npm install -g opencode-ai`).
3. Starts `opencode serve --port 4096 --hostname 127.0.0.1 --print-logs` in the background (wrapped in `nohup ... | tee /tmp/opencode.log &` so the server survives the terminal session).
4. Embeds the OpenCode web UI at `http://127.0.0.1:4096` in an iframe.
5. Open any folder from within the web UI — no server restart needed.

## State Machine

`Idle → CheckingInstall → Installing → CheckingServer → StartingServer → Ready`. `Error` can be entered from any state. The UI is purely reactive: a single `onStateChange` listener re-renders the page for the current state.

## Constraints

- **Fixed port 4096, loopback only.** Server binds `127.0.0.1`, never `0.0.0.0` (hard constraint — no external exposure without auth).
- **Single server instance.** The "Restart" button recovers from crashes, but folder switching is handled entirely within the web UI.
- **Terminal session reaping.** Acode's `Executor` reaps the shell session at stdout EOF, which would kill a plain backgrounded server. The start command keeps the stdout pipe open via `tee`, holding the session alive while still writing a log file.
- **Health probe uses `cordova.plugin.http`.** A plain `fetch` to loopback hangs in this WebView; the native HTTP plugin resolves it. There is no `fetch` fallback.

## Build

```
npm run build      # typecheck (tsc --noEmit) → esbuild bundle + zip
npm run dev        # typecheck → esbuild watch + serve on port 3000
```

Output: `dist/main.js` → zipped to `dist.zip` (the plugin artifact).

## Tests

```
npm test            # vitest run (jsdom environment)
```

Test files live under `test/`, mirroring the `src/` tree (e.g. `test/opencode/server.test.ts`). Tests import from `../src/...` / `../../src/...`. Health probe tests stub `window.cordova.plugin.http` — there is no `fetch` fallback.

## Project Structure

```
src/
  main.ts               # plugin init/destroy, flow orchestration
  types.ts              # AppState enum, StateContext, ErrorInfo
  state.ts              # state machine (transition, onStateChange, reset)
  logger.ts             # leveled logging (createLogger, setLogEnabled, setLogLevel)
  error.ts              # extractErrorInfo() — normalizes unknown errors
  config/               # named constants, split by domain (see below)
  terminal/executor.ts  # thin wrapper over global Executor
  opencode/
    install.ts          # checkInstalled, installOpenCode
    server.ts           # isServerUp, startServer, stopServer, restartServer
    health.ts           # loopback health probe via cordova.plugin.http
  ui/
    index.ts            # render orchestrator, one render func per state
    components/         # DOM factory functions, one file per component
      container.ts
      headerBar.ts
      spinner.ts
      iframe.ts
      errorDisplay.ts
      floatingActionButton.ts
      index.ts
```

### `config/` layout

All named constants live here (no magic numbers/strings anywhere else):

- `server.ts` — `PORT`, `HOSTNAME`, `BASE_URL`, `LOG_PATH`
- `opencode.ts` — install/start/stop/readiness commands and timeouts
- `health.ts` — `HEALTH_CHECK_URL`, `HEALTH_CHECK_TIMEOUT`, `LOG_TAIL_LINES`, `ERROR_FALLBACK_MESSAGE`
- `ui.ts` — spinner + FAB rendering constants
- `app.ts` — `DEBUG` master switch
- `index.ts` — barrel (for tests; source imports the specific sub-module)

## Publish

`plugin.json` is configured for publishing (`id` `com.victozee26.opencode`, `name` `OpenCode`, `version` `0.1.0`, `main` `dist/main.js`). Bump `version` and `changelogs.md` for each release, then run `npm run build` to regenerate `dist.zip`.
