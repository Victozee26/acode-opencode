# Acode-OpenCode Plugin

An Acode plugin that runs [OpenCode](https://github.com/anomalyco/opencode) (AI coding agent) as a background HTTP server inside Acode's built-in Alpine Linux terminal, and displays OpenCode's web UI in a full-page iframe.

## How It Works

1. Tap the toolbar icon to open the plugin page
2. Plugin checks if OpenCode is installed in Alpine — installs it if needed (`apk add nodejs npm && npm install -g opencode-ai`)
3. Resolves the active project path from `editorManager` (must be Alpine-native — `content://` URIs are rejected)
4. Starts `opencode serve --port 4096 --hostname 127.0.0.1` in the background
5. Embeds the OpenCode web UI at `http://127.0.0.1:4096` in an iframe

## Constraints

- **Alpine-native paths only.** Projects must be cloned/created inside Alpine's home directory. SAF-opened folders (`content://` URIs) are not supported.
- **Fixed port 4096, loopback only.** Server binds `127.0.0.1`, never `0.0.0.0`.
- **Single server, single project.** Switching projects restarts the server pointed at the new directory.

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
  project.ts            # resolveProjectPath()
  terminal/executor.ts  # thin wrapper over acode.require('terminal')
  opencode/install.ts   # checkInstalled, installOpenCode
  opencode/server.ts    # isServerUp, startServer, stopServer, restartForProject
  ui/index.ts           # render orchestrator, one render func per state
  ui/components.ts      # DOM factory functions (spinner, iframe, header, error)
```

## State Machine

`Idle → CheckingInstall → Installing → CheckingServer → ResolvingPath → StartingServer → Ready`. Error can be entered from any state.
