# Acode-OpenCode Plugin — Technical Spec

## 1. Summary

An Acode plugin that runs OpenCode (AI coding agent) as a background HTTP server
inside Acode's built-in Alpine Linux terminal, and displays OpenCode's web UI
in a full-page iframe, launched from a dedicated toolbar icon.

No TUI, no xterm rendering of OpenCode. One local server, one active project
at a time.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Acode (Android app, WebView-based)                       │
│                                                           │
│  ┌───────────────┐        ┌─────────────────────────┐    │
│  │ Toolbar icon   │──tap──▶│ Plugin $page (full page) │   │
│  └───────────────┘        │                          │    │
│                            │  state machine (TS)      │    │
│                            │  ──▶ iframe               │    │
│                            └──────────┬────────────────┘    │
│                                       │ http://127.0.0.1:4096
│  ┌────────────────────────────────────▼─────────────────┐  │
│  │ Alpine Linux (proot sandbox, via Acode's terminal)    │  │
│  │                                                       │  │
│  │   opencode serve --port 4096 --hostname 127.0.0.1     │  │
│  │   (installed via: npm install -g opencode-ai)         │  │
│  │   cwd = active project (must be Alpine-native path)   │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

Communication with Alpine happens only through Acode's `terminal` module
(`Executor.execute`), never a custom bridge. The iframe talks to the server
directly over loopback HTTP — same-origin-style embedding, no CORS needed
since we're loading the full page, not fetching cross-origin data into JS
(except the lightweight `no-cors` health-check ping).

---

## 3. Constraints (things that are true regardless of preference)

**C1 — Project path must be Alpine-native.**
OpenCode's server and Alpine's shell share one filesystem. Projects opened
via Android's Storage Access Framework (SAF) picker often don't resolve to
a plain path Alpine can `cd` into. MVP requires the project to have been
cloned/created inside Alpine's home directory. Out of scope: bridging
SAF-opened folders (would need a copy-in/sync-out layer — a v2 feature).

**C2 — Fixed port, not dynamic.**
`opencode serve`/`opencode web` auto-assign a random port unless told
otherwise. The plugin always launches with `--port 4096 --hostname 127.0.0.1`
so the iframe `src` never has to be discovered at runtime.

**C3 — `Executor.execute` is blocking, not streaming.**
It resolves only after the invoked command exits. Long-running processes
(the server itself) must be explicitly backgrounded and detached
(`nohup … & disown`), or the call never returns and the plugin hangs.

**C4 — No install-time bun dependency.**
`npm install -g opencode-ai` distributes a prebuilt platform binary via
npm (similar to how `esbuild` ships), so Alpine only needs `nodejs` + `npm`.
Bun is not required on-device.

**C5 — Loopback only.**
Server binds `127.0.0.1`, never `0.0.0.0`. No `OPENCODE_SERVER_PASSWORD` is
set for MVP — acceptable only because the server is unreachable outside the
device itself. Do not change the hostname binding without adding auth.

**C6 — Single server, single active project.**
Switching projects means restarting the one server pointed at a new `cwd`,
not spinning up a second instance on another port. Concurrent projects are
out of scope for MVP.

---

## 4. State machine

```
idle
  │ (user taps toolbar icon)
  ▼
checking-install ──not found──▶ installing ──success──▶ checking-server
  │ found                                    │ fail
  ▼                                          ▼
checking-server                          error (install)
  │ up                  │ down
  ▼                     ▼
ready              resolving-path
                        │
                        ▼
                   starting-server
                        │
              ┌─────────┼─────────┐
           timeout     up        crash
              │         │          │
              ▼         ▼          ▼
       error (start)  ready   error (start)
```

`ready` renders the iframe. Any `error` state shows the relevant log tail
and a retry action. `restart` (user-triggered) re-enters at
`resolving-path`.

---

## 5. Module breakdown (`src/`)

| Module | Responsibility |
|---|---|
| `main.ts` | Plugin entrypoint, registers icon/command, mounts `$page` |
| `terminal.ts` | Thin wrapper around `acode.require('terminal').Executor` |
| `opencode.ts` | `checkInstalled`, `installOpenCode`, `isServerUp`, `startServer`, `restartForProject` |
| `project.ts` | `resolveProjectPath()` — reads active project root from `editorManager`, validates it's Alpine-native (C1) |
| `ui.ts` | Renders the 4 UI states (loading/ready/error/idle) into `$page` |
| `state.ts` | The state machine above, single source of truth for what `ui.ts` renders |

---

## 6. Key commands reference

```bash
# one-time bootstrap (Phase 2)
apk add --no-cache nodejs npm && npm install -g opencode-ai

# check installed
which opencode

# start server, backgrounded and detached (Phase 3)
cd <project> && nohup opencode serve --port 4096 --hostname 127.0.0.1 \
  > /tmp/opencode.log 2>&1 & disown

# health check (JS side, not shell)
fetch('http://127.0.0.1:4096/doc', { mode: 'no-cors' })

# best-effort stop before restart
pkill -f "opencode serve"
```

---

## 7. Explicit non-goals (MVP)

- SAF-opened project support
- Multi-project / multi-port concurrency
- Custom theming or CSS scaling of the OpenCode web UI
- Server auth / password protection
- Auto-updating the `opencode-ai` package
- Streaming install progress (Executor doesn't support it — spinner only)

---

## 8. Open items to validate on-device (not yet confirmed)

- Exact API `editorManager` exposes for "active project root path" vs
  "active file path" — needs checking against current Acode API docs
- Whether Alpine's proot survives Acode being backgrounded for extended
  periods on the specific test device (affects whether Phase 3's restart
  path gets exercised often in practice)
- ARM64 binary availability/stability for `opencode-ai`'s optional
  platform dependency inside a proot Alpine environment specifically
  (verified for native ARM64 Linux, not yet verified inside proot)
