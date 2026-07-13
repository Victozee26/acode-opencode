# Phase 3 — Server Lifecycle Hardening

> **Status:** Core functions exist in `server.ts` but lack resilience against real-world failure modes.
> **Source:** `BUILD_PLAN.md` lines 40–50, `SPEC.md` Section 4 (state machine), Section 6 (key commands).

---

## What Already Exists (No Changes Needed)

| BUILD_PLAN Item | Where Implemented |
|---|---|
| `isServerUp()` — `fetch` with no-cors + AbortController timeout (2s) | `src/opencode/server.ts:11-26` |
| `startServer()` — `nohup opencode serve ... & disown` | `src/opencode/server.ts:28-30`, `src/config.ts:15-17` (`buildStartCommand`) |
| `waitForReady()` — poll `isServerUp()` every 1s, timeout 15s | `src/opencode/server.ts:32-43` |
| `stopServer()` — `pkill -f "opencode serve"` (best-effort) | `src/opencode/server.ts:45-51` |
| `restartServer()` — stop → start sequential | `src/opencode/server.ts:53-56` |
| Server detection in `startFlow()` — skips to Ready if already up | `src/main.ts:60-64` |
| Restart via `handleRestart()` — calls restartServer → waitForReady | `src/main.ts:78-89` |
| All config constants: `PORT`, `HOSTNAME`, `HEALTH_CHECK_URL`, `HEALTH_CHECK_TIMEOUT`, `READY_POLL_INTERVAL`, `READY_TIMEOUT`, `KILL_COMMAND`, `LOG_PATH` | `src/config.ts` |
| Error propagation from server functions through `main.ts` catch blocks to `setError()` | `src/main.ts:72-75`, `src/main.ts:85-88` |
| Tests for `startFlow` and `handleRestart` covering timeout, restart failure, and fallback messages | `src/main.test.ts` |

### Design Divergence Note
`BUILD_PLAN.md` Phase 3 says `isServerUp()` should target `/doc`. The config uses `HEALTH_CHECK_URL = ${BASE_URL}/doc`, matching the plan. The `no-cors` limitation (can't distinguish 200 from 500) is a known WebView constraint documented in the root `AGENTS.md` — not a bug to fix.

---

## Phase 3-A: `stopServer()` Hardening + Restart Integrity

### Goal
Make `stopServer()` reliably kill the server process and verify port 4096 is free before returning, so `restartServer()` never silently fails when `pkill` doesn't work (wrong process name, zombie process, or non-opencode process on the same port).

### Scope
- **Modify:** `src/opencode/server.ts` — `stopServer()` function
- **Modify:** `src/config.ts` — add new constants
- **No new files.**
- **No new `AppState` values.**
- **DOX update:** `src/opencode/AGENTS.md` — update `stopServer()` contract: it now validates the stop, can throw on failure.

### Inputs Required
- `src/opencode/server.ts` (existing `stopServer`, `isServerUp`, `KILL_COMMAND`)
- `src/config.ts` (`PORT`, `HOSTNAME`, `BASE_URL`, `HEALTH_CHECK_TIMEOUT`)
- `src/terminal/executor.ts` (`execute`)

### Outputs Produced
- Updated `stopServer()` that:
  1. Runs `pkill -f "opencode serve"` (SIGTERM)
  2. Polls `isServerUp()` at `STOP_POLL_INTERVAL` (500ms) for up to `STOP_POLL_TIMEOUT` (3s)
  3. If server is down → resolves successfully
  4. If still up → runs `pkill -9 -f "opencode serve"` (SIGKILL)
  5. Polls `isServerUp()` again for up to `STOP_POLL_TIMEOUT`
  6. If still up → **throws** `Error("Cannot stop server: port 4096 still occupied after SIGKILL")`
- New config constants:
  - `STOP_POLL_TIMEOUT = 3000`
  - `STOP_POLL_INTERVAL = 500`
  - `HARD_KILL_COMMAND = 'pkill -9 -f "opencode serve"'`

### Assumptions
1. **Critical:** `pkill` is available in Acode's Alpine terminal (BusyBox provides it — confirmed by existing `KILL_COMMAND` usage).
2. **Critical:** `isServerUp()` can distinguish "server down" from "server up" at the granularity needed for polling. The `no-cors` fetch will throw on connection refused (server down) and resolve on any TCP connection (server up). This is sufficient.
3. **Important:** `pkill -9` (SIGKILL) will kill any process matching `"opencode serve"` — no process can ignore SIGKILL. If port is still occupied after SIGKILL, something other than `opencode serve` is on port 4096, and throwing is the correct behavior.
4. **Nice-to-have:** The 3s total wait (two 3s windows if escalation needed = up to 6s) is acceptable for a restart operation. If user perception is too slow, intervals can be tightened later.

### Risk / Dependency Flags
- **Risk:** If a non-opencode process is on port 4096, `pkill -f "opencode serve"` won't match it, and the escalation to SIGKILL won't either. `stopServer()` throws with a clear message, but `handleRestart()` shows it as an error — the user can't recover without manually freeing port 4096. This is correct behavior but could confuse users.
- **Risk:** `execute()` for `HARD_KILL_COMMAND` may throw if `pkill` itself fails (e.g., `pkill` not found, though extremely unlikely in Alpine). Current `stopServer()` swallows errors from the initial `pkill`; the new version should still try the polling loop even if `pkill` itself threw — just treat it as "kill command executed, now verify."
- **Dependencies:** None. Can ship independently — `restartServer()` already calls `stopServer()` and will naturally benefit from the hardening.
- **Open questions:**
  - Should `stopServer()` return a boolean (true = stopped, false = couldn't stop) instead of throwing? Throwing is more idiomatic for the existing codebase (see `waitForReady`, `installOpenCode`) and forces callers to handle the failure. The implementer should decide based on consistency with the rest of `server.ts` — currently all other functions either resolve or throw, never return status booleans.
  - If SIGTERM fails and we escalate to SIGKILL, should we also wait a brief cooldown (e.g., 500ms) between kill signals to let the OS reap the process? The current plan polls immediately, which may be too aggressive on slow devices.

### Verification
1. Start server normally → tap Restart → confirm restart succeeds as before (no regression).
2. Manually start a dummy process on port 4096 (e.g., `nc -l 127.0.0.1 4096` in Alpine) → tap Restart → confirm error display shows "Cannot stop server: port 4096 still occupied after SIGKILL" with retry button.
3. Kill the opencode process manually (`pkill -9 -f "opencode serve"`) but leave port occupied by something else → confirm the plugin correctly detects this and shows the error (not a silent restart with old server).
4. `npm run build` — passes typecheck.
5. `npm test` — all existing tests pass. `stopServer` mock in `main.test.ts` is already mocked, so no test changes needed.

---

## Phase 3-B: `startServer()` Early Crash Detection

### Goal
Detect when `opencode serve` exits immediately after being backgrounded (missing binary, config error, port conflict) and surface a descriptive error within ~1s instead of waiting the full `waitForReady()` 15s timeout.

### Scope
- **Modify:** `src/opencode/server.ts` — `startServer()` function
- **Modify:** `src/config.ts` — add new constants
- **No new files.**
- **No new `AppState` values.**
- **DOX update:** `src/opencode/AGENTS.md` — update `startServer()` contract: it now validates the process launched successfully and throws if it exited immediately.

### Inputs Required
- `src/opencode/server.ts` (existing `startServer`, `buildStartCommand`)
- `src/config.ts` (`LOG_PATH`, `buildStartCommand`)
- `src/terminal/executor.ts` (`execute`)

### Outputs Produced
- Updated `startServer()` that:
  1. Calls `execute(buildStartCommand())` as before
  2. Waits `STARTUP_CHECK_DELAY` (500ms) for the process to initialize
  3. Checks if `opencode serve` process is alive via `pgrep -f "opencode serve" || true`
  4. If process **not** found → reads last `LOG_TAIL_LINES` of `/tmp/opencode.log` and throws:
     ```
     OpenCode server process exited immediately after start.
     Last log lines:
     <log output or '(no log output)'>
     ```
  5. If process found → resolves normally (existing behavior)
- New config constants:
  - `STARTUP_CHECK_DELAY = 500`
  - `LOG_TAIL_LINES = 20`
- New private helper in `server.ts`: `readLogTail()`:
  - Executes `tail -n ${LOG_TAIL_LINES} ${LOG_PATH} || true`
  - Returns trimmed output or empty string on any failure
  - Never throws (defensive wrapper over `execute`)

### Assumptions
1. **Critical:** `pgrep` is available in Alpine (BusyBox provides it). The `|| true` suffix ensures `execute()` never throws on "no process found" (pgrep exits 1 when no match).
2. **Critical:** 500ms delay after backgrounding is enough for `opencode serve` to either start listening or crash. If opencode takes longer to fail (e.g., DNS timeout in config loading), this check would pass (process exists) and `waitForReady()` handles the longer timeout. This is acceptable — the early check catches only immediate failures.
3. **Important:** `/tmp/opencode.log` may not exist if opencode never wrote anything. `tail ... || true` handles this gracefully (returns empty string). The error message includes `(no log output)` as fallback.
4. **Nice-to-have:** The `readLogTail()` helper will also be used by Phase 3-C. If this phase ships first, it introduces the helper; Phase 3-C reuses it. If Phase 3-C ships first, it introduces the helper; this phase reuses it.

### Risk / Dependency Flags
- **Risk:** If `opencode serve` takes exactly 500ms + epsilon to crash, the process check finds it alive, then it crashes between the check and `waitForReady()`. `waitForReady()` will still timeout after 15s. This is a narrow window and acceptable — the early check is a fast path for obvious failures, not a replacement for the full polling loop.
- **Risk:** `pgrep -f "opencode serve"` could match other processes (e.g., a text editor viewing `opencode serve` docs). Unlikely on a headless Alpine terminal, but if it happens, `startServer()` succeeds and `waitForReady()` times out. Rare edge case.
- **Dependencies:** None. Can ship independently. The `readLogTail()` helper may be duplicated by Phase 3-C if that phase ships first — deduplication is trivial during merge.
- **Open questions:**
  - Should `STARTUP_CHECK_DELAY` be 500ms or 1000ms? 500ms might be too short on slow devices (open code may take longer to load its config, resolve imports, or crash on a slow I/O path). Start conservative with 500ms and adjust based on QA feedback. The implementer should test on a low-end device if possible.
  - Should `startServer()` also do an early `isServerUp()` check (e.g., 2s timeout) after confirming the process exists? This would catch cases where the process is alive but already failing to bind (port conflict). Currently this is left to `waitForReady()`. Adding an early check could reduce the 15s wait for port-conflict scenarios but adds complexity to `startServer()`.

### Verification
1. Temporarily break the opencode binary (e.g., `mv /usr/bin/opencode /usr/bin/opencode.bak` in Alpine) → trigger start → confirm error "OpenCode server process exited immediately after start" appears within ~1s, not after 15s.
2. Start server normally → confirm it still works (no regression — process check finds running process, resolves normally).
3. Cause a port conflict (start something on 4096 before triggering the plugin) → confirm error appears quickly with log output showing the bind failure.
4. `npm run build` — passes typecheck.
5. `npm test` — all existing tests pass. `startServer` is mocked in `main.test.ts`, so `startFlow` tests are unaffected.

---

## Phase 3-C: `waitForReady()` Timeout Log Enrichment

### Goal
When the server fails to respond within the 15s timeout, include the last lines of `/tmp/opencode.log` in the error message so users can diagnose the cause without manually opening the Alpine terminal.

### Scope
- **Modify:** `src/opencode/server.ts` — `waitForReady()` function
- **No new config constants** (reuses `LOG_TAIL_LINES` from 3-B if already shipped, or defines it if this phase ships first)
- **No new files.**
- **No new `AppState` values.**
- **DOX update:** `src/opencode/AGENTS.md` — update `waitForReady()` contract: error now includes log tail.

### Inputs Required
- `src/opencode/server.ts` (existing `waitForReady`, `isServerUp`)
- `src/config.ts` (`READY_TIMEOUT`, `LOG_PATH`, `LOG_TAIL_LINES`)
- `src/terminal/executor.ts` (`execute`)

### Outputs Produced
- Updated `waitForReady()` that, on timeout:
  1. Reads last `LOG_TAIL_LINES` lines from `/tmp/opencode.log` (via `readLogTail()` helper)
  2. Throws:
     ```
     Server did not respond within 15s.
     Last log lines:
     <log output or '(no log output)'>
     ```
  3. If `readLogTail()` returns empty, still includes the fallback "(no log output)" in the message
- `readLogTail()` private helper (same as Phase 3-B — first phase to ship introduces it)
- `LOG_TAIL_LINES` config constant (same as Phase 3-B — first phase to ship introduces it)

### Assumptions
1. **Critical:** `/tmp/opencode.log` exists and contains useful output if the server started but failed to bind/listen. If the log file doesn't exist (server never started), `tail ... || true` returns empty string and "(no log output)" is shown.
2. **Important:** The 15s timeout is sufficient for opencode to start under normal conditions. If it takes longer (e.g., first-run model download), the timeout fires prematurely. This is a tuning concern, not a code bug — the timeout value is in config and can be adjusted.
3. **Important:** Reading the log file adds a small delay (~200-500ms for `execute('tail ...')`) to the timeout error path. This is acceptable since the user has already waited 15s.
4. **Nice-to-have:** If the log file is very large, `tail -n 20` is fast regardless of file size.

### Risk / Dependency Flags
- **Risk:** If `opencode serve` crashes before writing anything to the log file, the error will say "(no log output)". The user must manually inspect Alpine terminal. Could be improved later with a `tail -n 50` or by reading stderr separately, but 20 lines is a good starting point.
- **Risk:** The error message string can be long (20 lines of log output). The existing error display passes the full message to both the `<h3>` heading and the `<pre>` block. The heading will show newlines collapsed (HTML whitespace behavior). The `<pre>` block preserves formatting. This is functional but the heading will look cluttered — a future Phase 4 improvement could add `white-space: pre-wrap` to the heading or split summary from detail.
- **Dependencies:** Phase 3-B for `readLogTail()` and `LOG_TAIL_LINES` if that ships first. If this phase ships first, it introduces both and Phase 3-B reuses them.
- **Open questions:**
  - Should the number of log lines (20) be configurable by the user? No — it's a diagnostic aid, not a user-facing feature.

### Verification
1. Block port 4096 with another process (`nc -l 127.0.0.1 4096` in Alpine) → trigger server start → wait 15s → confirm error includes "Last log lines:" followed by the bind error from opencode's log.
2. Start server normally, let it start within a few seconds → confirm no regression (waitForReady resolves, no error thrown).
3. Delete `/tmp/opencode.log` before starting → trigger a scenario where server fails → confirm error says "(no log output)" instead of crashing on missing file.
4. `npm run build` — passes typecheck.
5. `npm test` — all existing tests pass. `waitForReady` is mocked in `main.test.ts`, so `startFlow` timeout test still passes with the old-style mock rejection.

---

## Phase 3-D: Build Verification, DOX Pass & Manual Test Scenarios

### Goal
Run the full build pipeline, confirm Phase 3 passes typecheck and bundles cleanly, update all affected AGENTS.md contracts, and define the manual test scenarios that validate server lifecycle behavior on a real device.

### Scope
- **No code changes.** Build verification and documentation only.
- **Modify:** `src/opencode/AGENTS.md` — update server.ts contracts to reflect new behavior:
  - `stopServer()`: best-effort → validated kill with escalation; can throw.
  - `startServer()`: fire-and-forget → validates process launched; can throw with log output.
  - `waitForReady()`: timeout throws generic error → timeout throws error with log tail.
  - `restartServer()`: unchanged signature, but now propagates `stopServer()` errors.
  - Fix existing doc bug: `restartForProject()` → `restartServer()`.
- **Modify:** `src/config.ts` — verify all new constants are present, no duplicates from phased rollout.
- **Modify:** `BUILD_PLAN.md` — check off Phase 3 items.
- **Create:** (optional) `src/opencode/server.test.ts` if time permits (manual testing is the primary verification per `BUILD_PLAN.md` Phase 5).
- **DOX update:** `src/opencode/AGENTS.md` — update server.ts contracts; fix `restartForProject()` → `restartServer()` doc bug.

### Inputs Required
- All Phase 3-A through 3-C outputs
- `npm run build` command
- `npm test` command
- DOX hierarchy (root `AGENTS.md`, `src/opencode/AGENTS.md`)

### Outputs Produced
- Passing `npm run build` (tsc --noEmit → esbuild bundle + zip)
- Passing `npm test` (all existing tests; optional new server tests)
- Updated `src/opencode/AGENTS.md` with corrected server contracts
- Updated `BUILD_PLAN.md` Phase 3 checkboxes marked complete

### Assumptions
1. **Critical:** All three sub-phases are merged. If one phase shipped out of order, the config constants may need deduplication (e.g., `LOG_TAIL_LINES` defined in both 3-B and 3-C).
2. **Important:** No runtime regressions — `dist.zip` should load in Acode and the full flow (install → server start → iframe) still works.
3. **Nice-to-have:** A `server.test.ts` file covering the new behavior would improve reliability, but the `BUILD_PLAN.md` Phase 5 QA matrix is the primary verification mechanism.

### Risk / Dependency Flags
- **Risk:** If Phase 3-B and 3-C both introduce `readLogTail()` and `LOG_TAIL_LINES` independently, there may be a merge conflict or duplicate definition. Resolve by keeping one copy.
- **Dependencies:** Phases 3-A, 3-B, 3-C.
- **Open questions:**
  - Should a `server.test.ts` be written as part of this phase? The existing modules (`install.ts`, `executor.ts`, `components.ts`) all have test coverage. A `server.test.ts` would cover `isServerUp()` (AbortController behavior), `waitForReady()` polling/timeout, `stopServer()` escalation, and `startServer()` crash detection. However, `BUILD_PLAN.md` Phase 5 specifies manual testing as the primary verification. The implementer should weigh the value of automated regression tests against the time investment — at minimum, the hard-to-manually-trigger edge cases (SIGTERM fails, process disappears between check and bind) deserve test coverage.

### Verification

#### Build Check
1. `npm run build` exits clean (0).
2. `dist/main.js` and `dist.zip` are produced.
3. `npm test` — all existing tests pass.

#### Manual Test Matrix (on-device, per `BUILD_PLAN.md` Phase 5 style)

| # | Scenario | Steps | Expected Result |
|---|----------|-------|-----------------|
| 1 | **Fresh start, server not running** | Uninstall opencode from Alpine. Tap plugin icon. | Full bootstrap → server starts → iframe appears. |
| 2 | **Server already running** | Start opencode manually in Alpine. Tap plugin icon. | Detects server up, skips to iframe immediately. |
| 3 | **Restart from header bar** | While iframe is showing, tap "Restart". | Old server killed (verified), new server starts, iframe reloads. |
| 4 | **Port conflict (non-opencode)** | In Alpine: `nc -l 127.0.0.1 4096`. Tap Restart. | Error: "Cannot stop server: port 4096 still occupied after SIGKILL". Retry button visible. |
| 5 | **Binary missing (crash on start)** | In Alpine: `mv /usr/bin/opencode /usr/bin/opencode.bak`. Tap Restart. | Error within ~1s: "process exited immediately after start" with log output. |
| 6 | **Server fails to bind (timeout)** | In Alpine: start something on port 4096. Trigger fresh start. | After 15s: error "Server did not respond within 15s" with last log lines showing bind failure. |
| 7 | **Background / reopen** | While iframe is showing, background Acode for 5+ minutes. Reopen. | Plugin page shows (may need to tap icon again). If server survived, iframe loads. If not, restart flow triggers. |
| 8 | **Force-kill server, reopen** | In Alpine: `pkill -9 -f "opencode serve"`. Tap Restart in plugin. | Server starts fresh, iframe appears. |

---

## Phase Ordering

| # | Phase | Depends On | Can Ship Alone? |
|---|-------|-----------|-----------------|
| 1 | 3-A: `stopServer()` Hardening + Restart Integrity | None | ✅ Yes |
| 2 | 3-B: `startServer()` Early Crash Detection | None* | ✅ Yes |
| 3 | 3-C: `waitForReady()` Timeout Log Enrichment | None* | ✅ Yes |
| 4 | 3-D: Build Verification, DOX Pass & Manual Tests | 3-A, 3-B, 3-C | ❌ (aggregates all) |

\* 3-B and 3-C both need `readLogTail()` and `LOG_TAIL_LINES`. The first one shipped introduces them; the second reuses. If both ship independently, merge deduplication is minimal (one function, one constant).

**Recommended execution order:** 3-A → 3-B → 3-C → 3-D
(3-A is highest-impact gap fix; 3-B improves UX; 3-C adds diagnostic value; 3-D finalizes)

---

## Summary Table

| Phase | Goal | Files Touched | Risk Level |
|-------|------|---------------|------------|
| 3-A | Reliable server kill with escalation + restart integrity | `server.ts`, `config.ts` | Medium |
| 3-B | Detect immediate opencode crash within 1s instead of 15s | `server.ts`, `config.ts` | Medium |
| 3-C | Include log tail in timeout error for diagnostics | `server.ts`, `config.ts` | Low |
| 3-D | Build verification, DOX pass, manual test matrix | `AGENTS.md`, `BUILD_PLAN.md` | Low |

---

## Cross-Cutting Notes

### Error Message Formatting
Phases 3-B and 3-C produce multi-line error messages (summary line + log output). The `<h3>` heading in `createErrorDisplay` collapses newlines to spaces in HTML. The `<pre>` block correctly preserves formatting. This is functional but creates a slightly cluttered heading. **Phase 4 (UI states)** should address this with `white-space: pre-wrap` on the heading or by splitting `message` / `logTail` in `setError()`.

### Config Constant Overlap
If 3-B ships before 3-C:
- 3-B introduces `LOG_TAIL_LINES`, `STARTUP_CHECK_DELAY`, `readLogTail()`
- 3-C adds no new constants (reuses `LOG_TAIL_LINES`) and reuses `readLogTail()`

If 3-C ships before 3-B:
- 3-C introduces `LOG_TAIL_LINES`, `readLogTail()`
- 3-B introduces `STARTUP_CHECK_DELAY`, reuses `LOG_TAIL_LINES` and `readLogTail()`

If both ship simultaneously: no duplication — constants and helper are defined once.
