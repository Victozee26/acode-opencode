# Acode-OpenCode Plugin — Build Plan

Stack: TypeScript, esbuild, Acode Plugin API, OpenCode HTTP server.
Target: MVP that launches OpenCode's web UI inside Acode via a toolbar icon.

---

## Phase 0 — Preconditions (do this before writing code)

- [x] Acode's built-in terminal (Alpine) is set up and working on your test device
- [x] Manually run `apk add --no-cache nodejs npm && npm install -g opencode-ai` once by hand in the terminal, confirm `opencode --version` works — prove the happy path exists before you automate it
- [x] Manually `git clone` a small test repo *inside Alpine's home directory* (not via Android's file picker/SAF)
- [x] Manually run `opencode serve --port 4096 --hostname 127.0.0.1` and confirm you can hit `http://127.0.0.1:4096` in Acode's Live Preview plugin or any iframe test page
- [x] Only proceed to Phase 1 once this manual path works end-to-end. If it doesn't work by hand, it won't work automated.

---

## Phase 1 — Plugin skeleton

- [x] Set up TypeScript + esbuild build (`npm run build` → tsc --noEmit → esbuild bundle + zip)
- [x] `plugin.json`: id, name, version, `main`, icon, `readme`, `files`
- [x] `src/main.ts`: `acode.setPluginInit(id, (baseUrl, $page, options) => {...})` — options provides `cacheFile` and `cacheFileUrl`
- [x] `acode.setPluginUnmount(id, () => {...})` — clean up command/icon on uninstall
- [x] Register a toolbar icon via `acode.addIcon` bound to a command that opens `$page` full-screen
- [x] Confirm: tapping the icon opens an empty full-page view. Nothing else yet.

---

## Phase 2 — Alpine bootstrap (state machine)

- [x] `terminal` module: `const { Executor } = acode.require('terminal')` (executor.ts with error capture)
- [x] Write `checkInstalled()`: `execute('which opencode')` → resolves or throws
- [x] Write `installOpenCode()`: `execute('apk add --no-cache nodejs npm')` then `npm install -g opencode-ai` (with per-step error capture)
- [x] Wire UI state: `idle → checking → installing → checking-server → starting-server → ready` (state machine, see SPEC.md Section 4)
- [x] Show install progress as an indeterminate spinner (Executor doesn't stream output — don't fake a progress bar)
- [x] Handle install failure: show stderr/output in `<pre>` block, retry button always visible

---

## Phase 3 — Server lifecycle

- [x] Write `isServerUp()`: `fetch('http://127.0.0.1:4096/doc', { mode: 'no-cors' })` wrapped in try/catch + timeout (~2s)
- [x] Write `startServer()`:
  ```
  execute(`nohup opencode serve --port 4096 --hostname 127.0.0.1 > /tmp/opencode.log 2>&1 & disown`)
  ```
- [x] Write `waitForReady()`: poll `isServerUp()` every 1s, timeout at 15s, surface a clear timeout error (don't hang silently)
- [x] Write `restartServer()`: kill existing process (`pkill -f "opencode serve"` inside Alpine, best-effort) then `startServer()` again
- [x] Manually test: force-kill the app, reopen, confirm plugin correctly detects "already running" vs "needs restart"

---

## Phase 4 — UI states

- [x] `loading` state: spinner + status text ("Checking OpenCode…" / "Installing…" / "Starting server…")
- [x] `ready` state: `<iframe src="http://127.0.0.1:4096">` filling `$page`
- [x] `error` state: show last lines of `/tmp/opencode.log`, retry button
- [x] Header bar inside `$page`: "OpenCode" label + "Restart" button
- [x] Confirm iframe actually renders OpenCode's chat UI and you can send a message end-to-end

---

## Phase 5 — Test matrix (don't skip this)

- [ ] Fresh install, no opencode in Alpine → full bootstrap flow works
- [ ] Already installed, server not running → starts correctly
- [ ] Server already running → detects and skips straight to iframe
- [ ] Background the app 5+ minutes, reopen → check if server survived
- [ ] Test "Restart" button → server restarts and iframe reloads
- [ ] Airplane mode / no model provider configured → confirm error state is legible, not a blank iframe
- [ ] Low-end device or throttled CPU → confirm install step doesn't appear frozen (spinner still animates)

---

## Explicit non-goals for this MVP (write these down so scope doesn't creep)

- No support for SAF/Android-picker-opened projects (Alpine-native only, see spec C1)
- No multi-server / multi-port concurrency
- No custom theming/scaling of the OpenCode web UI itself
- No auth/password on the local server (loopback-only, single local user assumed)
- No auto-update of the `opencode-ai` npm package (manual `npm update -g opencode-ai` for now)
