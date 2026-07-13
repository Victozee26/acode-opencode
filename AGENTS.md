# AGENTS.md

## Build commands

```
npm run build      # typecheck (tsc --noEmit) → esbuild bundle + zip
npm run dev        # typecheck → esbuild watch + serve on port 3000
```

Build order matters: typecheck must pass before esbuild runs. Output is `dist/main.js` → automatically zipped to `dist.zip` (the plugin artifact).

## Architecture

Acode plugin (Android WebView) that launches OpenCode as a background HTTP server inside Acode's built-in Alpine Linux terminal, then embeds its web UI in an iframe.

**Entrypoint:** `src/main.ts` → `AcodePlugin` class.

**Directory layout** (feature-based):
```
src/
  main.ts               # plugin init/destroy, flow orchestration
  types.ts              # AppState enum, StateContext, ErrorInfo
  state.ts              # state machine (transition, onStateChange, reset)
  config.ts             # all named constants (port, URLs, commands, status messages)
  project.ts            # resolveProjectPath()
  terminal/executor.ts  # thin wrapper over acode.require('terminal')
  opencode/install.ts   # checkInstalled, installOpenCode
  opencode/server.ts    # isServerUp, startServer, stopServer, restartForProject
  ui/index.ts           # render() orchestrator, one render func per state
  ui/components.ts      # DOM factory functions (spinner, iframe, header, error)
```

**State machine** (`src/types.ts` — `AppState` enum): `Idle → CheckingInstall → Installing → CheckingServer → ResolvingPath → StartingServer → Ready`. Error can be entered from any state. UI is purely reactive via `onStateChange` listener.

## Hard constraints (non-negotiable)

- **Alpine-native paths only.** `content://` URIs (SAF) are rejected in `resolveProjectPath()`. Projects must be cloned/created inside Alpine's filesystem.
- **Fixed port 4096, loopback only.** `opencode serve --port 4096 --hostname 127.0.0.1`. Never bind to `0.0.0.0` without adding auth.
- **Executor.execute is blocking.** The terminal module resolves only after the command exits. All long-running commands (server start) MUST use `nohup ... & disown` — never call `execute()` without this pattern for persistent processes.
- **Single server, single project.** Switching projects means restarting the one server, not spawning a second instance.

## Code conventions

- **No magic numbers/strings.** All constants live in `src/config.ts`. Import them — never inline literals.
- **ESLint rules** (enforced when eslint is installed): `max-depth: 3`, `max-lines-per-function: 40` (warn), `no-magic-numbers` (warn, except 0,1,-1), `prefer-const`, `no-var`.
- **Prettier** (when installed): single quotes, trailing commas, 100 char width, 2-space tabs.
- **Untyped Acode modules** use `acode.require('...') as any` — this is the established pattern (acode-plugin-types doesn't cover all runtime modules).
- **State handling** uses the `AppState` enum and `transition()` instead of nested conditionals. Never add a state check without adding it to the enum.
- **Imports:** `config.ts` imports `AppState` from `types.ts` at the bottom of the file — be mindful of import order; keep this pattern to avoid issues.

## Gotchas

- `eslint` and `prettier` packages are **not installed** (configs exist but are inert). Install them before running lint/format.
- No test framework exists. Testing is manual (see `BUILD_PLAN.md` Phase 5 for the QA matrix).
- `plugin.json` has placeholder values (`id`, `name`, `author`) that need real values before publishing.
- `html-tag-js` is listed as a dependency but currently unused — all DOM is vanilla `document.createElement`.
- Health-check uses `fetch(..., { mode: 'no-cors' })` with `AbortController` timeout — not a standard HTTP check. Do not change this to a normal fetch without understanding the CORS implications in the WebView context.
