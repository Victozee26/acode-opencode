# Acode-OpenCode Plugin — Build Plan

Stack: TypeScript, esbuild, Acode Plugin API, OpenCode HTTP server.
Target: MVP that launches OpenCode's web UI inside Acode via a toolbar icon.

---

## Phase 0 — Preconditions (do this before writing code)

- [ ] Acode's built-in terminal (Alpine) is set up and working on your test device
- [ ] Manually run `apk add --no-cache nodejs npm && npm install -g opencode-ai` once by hand in the terminal, confirm `opencode --version` works — prove the happy path exists before you automate it
- [ ] Manually `git clone` a small test repo *inside Alpine's home directory* (not via Android's file picker/SAF)
- [ ] Manually run `cd <repo> && opencode serve --port 4096 --hostname 127.0.0.1` and confirm you can hit `http://127.0.0.1:4096` in Acode's Live Preview plugin or any iframe test page
- [ ] Only proceed to Phase 1 once this manual path works end-to-end. If it doesn't work by hand, it won't work automated.

---

## Phase 1 — Plugin skeleton

- [ ] Fork `Acode-Foundation/acode-plugin` template
- [ ] Set up TypeScript + esbuild build (`yarn build` / `yarn build --mode production`)
- [ ] `plugin.json`: id, name, version, `main`, icon, `readme`, `files`
- [ ] `src/main.ts`: `acode.setPluginInit(id, (baseUrl, $page) => {...})`
- [ ] `acode.setPluginUnmount(id, () => {...})` — clean up command/icon on uninstall
- [ ] Register a toolbar icon via `acode.addIcon` bound to a command that opens `$page` full-screen
- [ ] Confirm: tapping the icon opens an empty full-page view. Nothing else yet.

---

## Phase 2 — Alpine bootstrap (state machine)

- [ ] `terminal` module: `const { Executor } = acode.require('terminal')`
- [ ] Write `checkInstalled()`: `Executor.execute('which opencode', { alpine: true })`, resolves path or throws
- [ ] Write `installOpenCode()`: `Executor.execute('apk add --no-cache nodejs npm && npm install -g opencode-ai', { alpine: true })`
- [ ] Wire UI state: `idle → checking → installing → installed`
- [ ] Show install progress as an indeterminate spinner (Executor doesn't stream output — don't fake a progress bar)
- [ ] Handle install failure: show stderr/output, offer retry button

---

## Phase 3 — Server lifecycle

- [ ] Write `isServerUp()`: `fetch('http://127.0.0.1:4096/doc', { mode: 'no-cors' })` wrapped in try/catch + timeout (~2s)
- [ ] Write `resolveProjectPath()`: get active project root from `editorManager` / active file's folder — **must** be a plain Alpine filesystem path (see spec, Constraint C1)
- [ ] Write `startServer(projectPath)`:
  ```
  Executor.execute(
    `cd ${projectPath} && nohup opencode serve --port 4096 --hostname 127.0.0.1 > /tmp/opencode.log 2>&1 & disown`,
    { alpine: true }
  )
  ```
- [ ] Write `waitForReady()`: poll `isServerUp()` every 1s, timeout at 15s, surface a clear timeout error (don't hang silently)
- [ ] Write `restartForProject(projectPath)`: kill existing process (`pkill -f "opencode serve"` inside Alpine, best-effort) then `startServer()` again
- [ ] Manually test: force-kill the app, reopen, confirm plugin correctly detects "already running" vs "needs restart"

---

## Phase 4 — UI states

- [ ] `loading` state: spinner + status text ("Checking OpenCode…" / "Installing…" / "Starting server…")
- [ ] `ready` state: `<iframe src="http://127.0.0.1:4096">` filling `$page`
- [ ] `error` state: show last lines of `/tmp/opencode.log`, retry button
- [ ] Header bar inside `$page`: project name + "Restart for this project" button
- [ ] Confirm iframe actually renders OpenCode's chat UI and you can send a message end-to-end

---

## Phase 5 — Test matrix (don't skip this)

- [ ] Fresh install, no opencode in Alpine → full bootstrap flow works
- [ ] Already installed, server not running → starts correctly
- [ ] Server already running → detects and skips straight to iframe
- [ ] Background the app 5+ minutes, reopen → check if server survived
- [ ] Switch to a different project, hit "Restart for this project" → correct folder loads
- [ ] Airplane mode / no model provider configured → confirm error state is legible, not a blank iframe
- [ ] Low-end device or throttled CPU → confirm install step doesn't appear frozen (spinner still animates)

---

## Explicit non-goals for this MVP (write these down so scope doesn't creep)

- No support for SAF/Android-picker-opened projects (Alpine-native only, see spec C1)
- No multi-project / multi-port server management (single server, single active project)
- No custom theming/scaling of the OpenCode web UI itself
- No auth/password on the local server (loopback-only, single local user assumed)
- No auto-update of the `opencode-ai` npm package (manual `npm update -g opencode-ai` for now)
