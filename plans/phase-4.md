# Phase 4 — UI States: Polish & Verification

> **Status:** Core rendering infrastructure exists (`render()`, `createSpinner`, `createIframe`, `createHeaderBar`, `createErrorDisplay`), but has two bugs and no manual QA has been performed.
> **Source:** `BUILD_PLAN.md` lines 53–60, `SPEC.md` Section 4 (state machine diagram), `plans/phase-3.md` lines 285–287 (cross-cutting note).

---

## What Already Exists (No Structural Changes Needed)

| BUILD_PLAN Item | Where Implemented | Issues |
|---|---|---|
| `loading` state: spinner + status text | `src/ui/index.ts:34-43` (`renderLoading`), `src/ui/components.ts:23-42` (`createSpinner`), `src/config.ts (STATUS_MESSAGES)`(`STATUS_MESSAGES`) | None — works correctly |
| `ready` state: iframe filling `$page` | `src/ui/index.ts:45-50` (`renderReady`), `src/ui/components.ts:44-51` (`createIframe`) | Minor: hardcodes `'http://127.0.0.1:4096'` instead of using `BASE_URL` from config |
| `error` state: log display + retry button | `src/ui/index.ts:52-59` (`renderError`), `src/ui/components.ts:53-107` (`createErrorDisplay`) | **Two bugs:** (1) `<h3>` collapses newlines — multi-line error messages are unreadable; (2) `main.ts` passes identical strings for `message` and `logTail`, causing redundant display |
| Header bar: "OpenCode" + "Restart" | `src/ui/components.ts:53-81` (`createHeaderBar`) | None — works correctly |
| Confirm iframe renders chat UI | Not yet tested | Manual QA needed |

### Root Cause of Error Display Bugs

**Bug 1 — Newlines collapsed:** The `<h3>` in `createErrorDisplay` lacks `white-space: pre-wrap`. Error messages from `server.ts` contain embedded `\n` characters (e.g., `"OpenCode server process exited immediately after start.\nLast log lines:\n..."`). HTML rendering collapses these to spaces.

**Bug 2 — Redundant display:** In `main.ts`, both catch blocks (`startFlow` line 75, `handleRestart` line 90) call `setError(message, message || fallback)`. The same multi-line string ends up as both the `<h3>` heading text AND the `<pre>` log tail, wasting vertical space with duplicated content. The `ErrorInfo` type (`message` = short summary, `logTail` = diagnostic detail) was designed for separation — it's just not being used as intended.

### Error Message Formats (Reference)

All error messages thrown by server.ts / install.ts follow one of two patterns:

| Pattern | Examples | Lines |
|---------|----------|-------|
| Multi-line (summary + `\nLast log lines:\n` + detail) | `startServer()` crash, `waitForReady()` timeout | 3+ |
| Single-line (concise) | `stopServer()` port occupied, `installOpenCode()` deps/opencode failure | 1 |

This consistency means a simple `split('\n')` — first line = summary, rest = logTail — works for ALL error paths.

---

## Phase 4-A: Error Display Fix — Heading Whitespace + Message/LogTail Separation

### Goal
Fix the error display so (a) multi-line error messages render legibly in the heading, and (b) the heading shows only a concise summary while the `<pre>` block shows the diagnostic detail — eliminating the redundant duplication.

### Scope
- **Modify:** `src/ui/components.ts` — `createErrorDisplay()`: add `white-space: pre-wrap` to `<h3>` inline style
- **Modify:** `src/main.ts` — both `startFlow()` and `handleRestart()` catch blocks: split error message into summary + logTail before calling `setError()`
- **No new files.**
- **No new `AppState` values.**
- **No new config constants** (splitting logic is trivial — no magic numbers beyond what `String.split()` already does).
- **DOX update:** `src/ui/AGENTS.md` — update `createErrorDisplay()` contract: it now expects `message` to be a short summary and `logTail` to be the detail; heading preserves whitespace.

### Inputs Required
- `src/ui/components.ts` (existing `createErrorDisplay`, `escapeHtml`)
- `src/main.ts` (existing `startFlow` lines 72–75, `handleRestart` lines 87–91)
- `src/types.ts` (`ErrorInfo`: `message` + `logTail`)

### Outputs Produced
- Updated `createErrorDisplay()`:
  - `<h3>` gains `white-space: pre-wrap` in its inline style (after `margin-bottom: 12px`)
  - No other logic changes — the component already conditionally renders `<pre>` only when `logTail` is truthy
- Updated `main.ts` catch blocks (`startFlow` and `handleRestart`):
  - Extract raw message from error
  - Split on `'\n'`: first line → `summary`, rest joined → `logTail`
  - Handle edge cases: empty message falls back to `'No output captured. Check /tmp/opencode.log in Alpine terminal.'` for summary only (no logTail)
  - Call `setError(summary, logTail)` instead of `setError(message, message || fallback)`
- Both catch blocks use identical logic → extract into a private helper or inline consistently

#### Before (current `main.ts` catch block)
```ts
const message = err instanceof Error ? err.message : String(err);
setError(message, message || 'No output captured. Check /tmp/opencode.log in Alpine terminal.');
```

#### After (conceptual — not implementation code)
```
rawMessage = err.message or String(err)
fallback = 'No output captured. Check /tmp/opencode.log in Alpine terminal.'
text = rawMessage || fallback
lines = text.split('\n')
summary = lines[0]
logTail = lines.slice(1).join('\n')
setError(summary, logTail)
```

### Assumptions
1. **Critical:** All error messages thrown by `server.ts` and `install.ts` follow the `summary\n...` pattern where the first line is human-readable and self-contained. Verified above — all 5 error sites follow this pattern.
2. **Important:** `split('\n')` handles all error messages correctly. Single-line errors produce `logTail = ''`, which is falsy, so `<pre>` is not rendered — correct behavior.
3. **Nice-to-have:** The `'\n'` split is robust enough for this MVP. If future error messages use `\r\n` (Windows line endings in Alpine — extremely unlikely), the split would fail. Not worth handling now.

### Risk / Dependency Flags
- **Risk:** The `stopServer()` error message (`"Cannot stop server: port 4096 still occupied after SIGKILL"`) is a single line. After the split, `logTail` will be `''` and the `<pre>` block won't render. This is correct behavior — there's no diagnostic detail beyond the message itself — but users can't see raw log output. **Mitigation:** None needed; the error message is self-explanatory. Users can check `/tmp/opencode.log` manually if they need more.
- **Risk:** If an error message has `'\n'` in the middle of the first line (e.g., due to a bug), the split would cut the summary mid-sentence. **Mitigation:** The first line is always a hand-written prefix (see Error Message Formats table above) — newlines only appear between the prefix and the diagnostic output.
- **Dependencies:** None. This is a pure UI + error-handling change. No server-side, terminal, or install changes needed.
- **Open questions:**
  - Should the split logic be extracted into a private helper function (DRY) or kept inline in both catch blocks (simpler, no indirection)? The two catch blocks are 6 lines apart and have identical logic — a private helper is warranted. Decide during implementation.
  - Should the `logTail` fallback (`'No output captured. Check /tmp/opencode.log in Alpine terminal.'`) be a config constant? Currently it's a string literal in `main.ts`. Moving to `config.ts` would be consistent with the no-magic-strings convention. **Recommendation:** Move it to `config.ts` as `ERROR_FALLBACK_MESSAGE`.

### Verification
1. Trigger `startServer()` early crash (move `/usr/bin/opencode` away) → confirm error display shows:
   - Heading (single line): `OpenCode server process exited immediately after start.` with proper text wrapping
   - `<pre>` block: contains the `Last log lines:` section with diagnostic output
   - No duplicated content between heading and `<pre>`
2. Trigger `waitForReady()` timeout (occupy port 4096 with `nc`) → confirm error shows summary in heading, log tail in `<pre>`.
3. Trigger `stopServer()` failure (occupy port 4096, then restart) → confirm single-line error shows only heading (no `<pre>` since `logTail` is empty).
4. Trigger install failure (e.g., network down) → confirm single-line error shows only heading.
5. Pass empty-string error (`new Error('')`) → confirm fallback message shows in heading, no `<pre>`.
6. Trigger non-Error rejection (`Promise.reject('plain string')`) → confirm string is split correctly (first line = heading, rest in `<pre>`).
7. `npm run build` — passes typecheck.
8. `npm test` — existing `components.test.ts` and `main.test.ts` pass. The `main.test.ts` tests will need updating since they assert `setError(message, message)` — see Phase 4-C for test updates.

---

## Phase 4-B: URL Consistency — Use `BASE_URL` Config Constant

### Goal
Replace the hardcoded `'http://127.0.0.1:4096'` URL in `renderReady()` with the `BASE_URL` constant from `src/config.ts`, ensuring all URLs in the codebase derive from a single source of truth.

### Scope
- **Modify:** `src/ui/index.ts` — `renderReady()`: import `BASE_URL` and use it in the `createIframe()` call
- **No new files.**
- **No new config constants.** `BASE_URL` already exists: `export const BASE_URL = 'http://127.0.0.1:4096';`
- **No `AppState` changes.**
- **DOX update:** `src/ui/AGENTS.md` — note that `renderReady` now uses `BASE_URL` from config.

### Inputs Required
- `src/ui/index.ts` (existing `renderReady` function, line 49)
- `src/config.ts` (existing `BASE_URL` export, line 3)

### Outputs Produced
- Updated `renderReady()`:
  - Import `BASE_URL` from `config.ts`
  - `createIframe('http://127.0.0.1:4096')` → `createIframe(BASE_URL)`

### Assumptions
1. **Critical:** `BASE_URL` is `http://127.0.0.1:4096` and will remain so. No other iframe src values are needed for MVP.
2. **Important:** The iframe loads the full OpenCode web UI, not a specific path like `/doc`. Using `BASE_URL` (the root) is intentional.

### Risk / Dependency Flags
- **Risk:** If `BASE_URL` is ever changed to include a path (e.g., `http://127.0.0.1:4096/app`), the iframe would load a sub-path instead of the root. This is not a concern for MVP — the constant represents the server root. **Mitigation:** If paths diverge in the future, add a separate `IFRAME_URL` constant.
- **Dependencies:** None. Pure config-import change.
- **Open questions:** None.

### Verification
1. Start server normally → confirm iframe loads at `http://127.0.0.1:4096` (OpenCode web UI visible).
2. Temporarily change `BASE_URL` in config to `http://127.0.0.1:4096/doc` → confirm iframe points to the new URL (then revert).
3. `npm run build` — passes typecheck.
4. `npm test` — all tests pass (no test currently asserts the iframe URL string — no test changes needed).

---

## Phase 4-C: Tests, DOX Pass, & Manual QA Matrix

### Goal
Update automated tests to cover the new error-splitting behavior, run the full build pipeline, update all affected AGENTS.md contracts, check off BUILD_PLAN.md Phase 4 items, and define/execute the manual QA matrix for end-to-end verification (including the "$page iframe renders OpenCode chat UI" requirement).

### Scope
- **Modify:** `src/ui/components.test.ts` — add test for `white-space: pre-wrap` on `<h3>`, add test for empty-`logTail` heading-only display
- **Modify:** `src/main.test.ts` — update tests that assert `setError(message, message)` to assert the new split behavior (`setError(summary, logTail)`)
- **Modify:** `src/ui/AGENTS.md` — update `createErrorDisplay` contract (whitespace, message/logTail expectations), note `BASE_URL` usage in `renderReady`
- **Modify:** `BUILD_PLAN.md` — check off all Phase 4 items
- **No new files** (unless a test helper is needed for `main.test.ts` split assertions).
- **No `AppState` changes.**
- **DOX update:** `src/ui/AGENTS.md` (see above), root `AGENTS.md` Phase 4 progress note.

### Inputs Required
- Phase 4-A outputs (split error messages, pre-wrap heading)
- Phase 4-B outputs (BASE_URL import)
- `npm run build` + `npm test` commands
- DOX hierarchy (root `AGENTS.md`, `src/ui/AGENTS.md`)

### Outputs Produced

#### Test Updates

**`src/ui/components.test.ts`** — Add 2 test cases:
1. **`<h3> has white-space: pre-wrap`**: Renders error display, queries the `<h3>`, asserts `style.whiteSpace === 'pre-wrap'` (or `contains('pre-wrap')` in `cssText`).
2. **Empty logTail shows heading only (no `<pre>`)**: Render with `logTail: ''`, assert `<pre>` is null, assert heading text is present. (Existing test already covers this indirectly — make it explicit.)

**`src/main.test.ts`** — Update 5 test cases that assert `setError(message, message)`:
1. `installOpenCode throws` (currently line ~39): `setError('Installation failed (deps): EACCES', 'Installation failed (deps): EACCES')` → `setError('Installation failed (deps): EACCES', '')`
2. `waitForReady throws "Server did not respond"` (currently line ~46): multi-line error → assert first line as message, rest as logTail
3. `uses fallback log message when error message is empty` (currently line ~55): `setError('', fallback)` → `setError(fallback, '')`
4. `handles non-Error rejection (string)` (currently line ~64): asserts both args are the string → assert split behavior
5. `restartServer throws` (currently line ~94): `setError('port busy', 'port busy')` → single-line, so `setError('port busy', '')`

#### DOX Updates

**`src/ui/AGENTS.md`** — Update contracts:
- `createErrorDisplay()`: heading now uses `white-space: pre-wrap`. `message` is expected to be a short summary (typically the first line of the error), `logTail` is the diagnostic detail. The `<pre>` block renders only when `logTail` is non-empty (was already true, but reasoning is now explicit).
- `renderReady()`: uses `BASE_URL` from config instead of a hardcoded string literal.

**`BUILD_PLAN.md`** — Check off all 5 Phase 4 items:
```
- [x] `loading` state: spinner + status text
- [x] `ready` state: `<iframe src="http://127.0.0.1:4096">` filling `$page`
- [x] `error` state: show last lines of `/tmp/opencode.log`, retry button
- [x] Header bar inside `$page`: "OpenCode" label + "Restart" button
- [x] Confirm iframe actually renders OpenCode's chat UI and you can send a message end-to-end
```

### Assumptions
1. **Critical:** `npm test` runs successfully after test updates. The split behavior is deterministic for known error message formats.
2. **Important:** The manual QA matrix (below) can be executed on a real device with Alpine and the `opencode-ai` package installed (per Phase 0 preconditions).
3. **Nice-to-have:** A mock `$page` with `body`/`header` that supports `innerHTML` and `appendChild` already exists in jsdom — no additional setup needed for render function tests.

### Risk / Dependency Flags
- **Risk:** The `main.test.ts` tests mock `setError` from `state.ts`. After Phase 4-A changes, the test assertions for `setError` call arguments must match the new split logic. If the split logic is implemented inline in the catch blocks (not extracted to a helper), the tests cannot verify the split itself — they only verify the final `setError` call. **Mitigation:** Tests assert the resulting `setError(summary, logTail)` call. The split logic correctness is verified manually (scenario matrix in Phase 4-C verification). If desired, extract the split into an exported helper and test it directly — but this adds indirection for 2 lines of code. **Recommendation:** Keep tests at the `setError` assertion level; manual QA covers split correctness.
- **Risk:** If Phase 4-A and 4-B are implemented as a single PR, the test updates can be done as part of that PR. If they ship separately, Phase 4-C must handle both — this plan assumes they're done before 4-C.
- **Dependencies:** Phase 4-A (error split), Phase 4-B (BASE_URL import). Both ship before this phase.
- **Open questions:**
  - Should `render()` function be unit-tested? Currently only `createErrorDisplay` has tests (in `components.test.ts`). A `ui/index.test.ts` could cover the dispatch logic (e.g., `AppState.Idle` → `renderIdle` called, `AppState.Ready` → header + iframe rendered). This would add value but is not strictly needed for Phase 4. **Recommendation:** Skip for now; add in a future phase if regressions appear.

### Verification

#### Build Check
1. `npm run build` exits clean (0).
2. `npm test` — all tests pass, including new/modified tests.

#### Manual QA Matrix (on-device, per BUILD_PLAN.md Phase 5 style)

| # | Scenario | Steps | Expected Result |
|---|----------|-------|-----------------|
| 1 | **Loading states show spinner** | Fresh install (no opencode). Tap plugin icon. | Spinner + "Checking OpenCode installation…" → "Installing OpenCode…" → "Checking server status…" → "Starting OpenCode server…" → iframe appears. Spinner animates throughout (doesn't freeze). |
| 2 | **Ready state shows iframe** | Server running. Tap plugin icon. | Header bar ("OpenCode" + "Restart" button) at top. Iframe fills remaining space showing OpenCode chat UI. |
| 3 | **Chat UI is functional** | While in ready state. | Can see OpenCode chat interface. Can type a message and send it. Interface is responsive to touch. |
| 4 | **Restart button works** | While in ready state. Tap "Restart" button. | Loading spinner ("Starting OpenCode server…") → iframe reloads with fresh chat UI. |
| 5 | **Error display — multi-line (startup crash)** | Move `/usr/bin/opencode` away. Tap plugin icon (or Restart). | Error display shows: heading (short summary like "process exited immediately") with proper wrapping. Below: `<pre>` block with log tail. "Retry" button present. |
| 6 | **Error display — multi-line (timeout)** | Occupy port 4096 with `nc`. Trigger fresh start. | After 15s: error with summary heading + log tail in `<pre>`. No duplicated content. |
| 7 | **Error display — single-line (port occupied after SIGKILL)** | Occupy port 4096 with non-opencode process. Tap Restart. | Error with single-line heading. No `<pre>` block (no log tail). Retry button present. |
| 8 | **Error display — install failure** | Break network or remove npm. Tap plugin icon. | Error with single-line heading (e.g., "Installation failed (deps): ..."). No `<pre>` block. Retry button. |
| 9 | **Retry button triggers recovery** | From error state, tap "Retry". | Full start flow re-executes. If the underlying issue is fixed (e.g., restore opencode binary), flow succeeds → iframe appears. |
| 10 | **Background / reopen** | While in ready state, background Acode for 5+ min. Reopen, tap plugin icon. | If server survived: iframe loads immediately. If server died: restart flow triggers (spinner → iframe). |
| 11 | **Idle state** | Fresh plugin load, before tapping icon. | Text "Tap the OpenCode icon to start" centered on page. No spinner, no iframe. |

Scenarios 1–4 cover the 4 structural BUILD_PLAN Phase 4 checklist items. Scenarios 5–8 cover error display hardening (Phase 4-A). Scenario 9 covers the error→recovery path. Scenarios 10–11 cover edge cases.

---

## Phase Ordering

| # | Phase | Depends On | Can Ship Alone? |
|---|-------|-----------|-----------------|
| 1 | 4-A: Error Display Fix | None | ✅ Yes |
| 2 | 4-B: URL Consistency | None | ✅ Yes |
| 3 | 4-C: Tests, DOX, & Manual QA | 4-A, 4-B | ❌ (aggregates all) |

**Recommended execution order:** 4-A → 4-B → 4-C
(4-A is the highest-impact fix; 4-B is trivial; 4-C finalizes)

---

## Summary Table

| Phase | Goal | Files Touched | Risk Level |
|-------|------|---------------|------------|
| 4-A | Fix error heading whitespace + separate message from logTail | `components.ts`, `main.ts` | Low |
| 4-B | Replace hardcoded URL with `BASE_URL` config constant | `index.ts` (1 line) | Very Low |
| 4-C | Test updates, DOX pass, manual QA matrix execution | `components.test.ts`, `main.test.ts`, `AGENTS.md`, `BUILD_PLAN.md` | Low |

---

## Cross-Cutting Notes

### Relationship to Phase 3
Phase 3 introduced multi-line error messages from `startServer()` and `waitForReady()`. The Phase 3 plan explicitly flagged the newline-collapse issue for Phase 4 (see `plans/phase-3.md` lines 285–287). Phase 4-A directly resolves this.

### What Phase 4 Does NOT Change
- **State machine:** No new states, no transition logic changes. The error path already works; Phase 4 only changes how error content is displayed.
- **Server lifecycle:** No changes to `server.ts` or `install.ts`. Error message formats remain as-is.
- **Terminal layer:** No changes to `executor.ts`.
- **Config constants:** No new constants added (except possibly `ERROR_FALLBACK_MESSAGE` if the fallback string in `main.ts` is extracted to config).
- **Build pipeline:** No changes to `tsc`/`esbuild`/`jszip` configuration.
