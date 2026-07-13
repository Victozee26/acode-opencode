# Acode-OpenCode Plugin

An Acode plugin that runs [OpenCode](https://github.com/anomalyco/opencode) (AI coding agent) as a background HTTP server inside Acode's built-in Alpine Linux terminal, and displays OpenCode's web UI in a full-page iframe.

## How It Works

1. Tap the toolbar icon to open the plugin page
2. Plugin checks if OpenCode is installed in Alpine — installs it if needed (`apk add nodejs npm && npm install -g opencode-ai`)
3. Starts `opencode serve --port 4096 --hostname 127.0.0.1` in the background
4. Embeds the OpenCode web UI at `http://127.0.0.1:4096` in an iframe
5. Open any folder from within the web UI — no server restart needed

## Constraints

- **Fixed port 4096, loopback only.** Server binds `127.0.0.1`, never `0.0.0.0`.
- **Single server instance.** The "Restart" button recovers from crashes, but folder switching is handled entirely within the web UI.

## Build

```
npm run build      # typecheck (tsc --noEmit) → esbuild bundle + zip
npm run dev        # typecheck → esbuild watch + serve on port 3000
```

Output: `dist/main.js` → zipped to `dist.zip` (the plugin artifact).

## Project Structure

```
src/
  main.ts               # plugin init/destroy, flow orchestration
  types.ts              # AppState enum, StateContext, ErrorInfo
  state.ts              # state machine (transition, onStateChange, reset)
  config.ts             # named constants (port, URLs, commands, status messages)
  project.ts            # held for future SAF-bridging support
  terminal/executor.ts  # thin wrapper over acode.require('terminal')
  opencode/install.ts   # checkInstalled, installOpenCode
  opencode/server.ts    # isServerUp, startServer, stopServer, restartServer
  ui/index.ts           # render orchestrator, one render func per state
  ui/components.ts      # DOM factory functions (spinner, iframe, header, error)
```

## State Machine

`Idle → CheckingInstall → Installing → CheckingServer → StartingServer → Ready`. Error can be entered from any state.
