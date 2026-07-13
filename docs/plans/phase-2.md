# Phase 2 — Alpine Bootstrap (State Machine)

> **Status:** Partially implemented. Core flows exist; error handling and retry UX have gaps.
> **Source:** `../BUILD_PLAN.md` lines 29–37, `../SPEC.md` Section 4 (state machine), Section 5 (module breakdown).

---

## Phase 2-A: Terminal Executor Type Fix & Error Capture

### Goal
Ensure the terminal executor resolves all TypeScript types correctly and captures command output (both stdout and stderr) on failure so error display surfaces actionable information.

### Scope
- **Modify:** `src/terminal/executor.ts`
- **No new files.**
- **No new `AppState` values.**
- **No config constants added.** Reuses existing commands from `config.ts`.
- **DOX update:** `src/terminal/AGENTS.md` — update Local Contracts to document error-capture behavior.

### Inputs Required
- `src/terminal/executor.ts` (existing — 5 lines)
- `acode.require('terminal')` module (Acode runtime API)
- `acode-plugin-types` (global type declarations for `Executor`)

### Outputs Produced
- Updated `executor.ts` with:
  - Explicit return type annotation on `execute()` to avoid reliance on global `Executor` type.
  - Wrapped error that includes stdout on failure (the current `execute` only rejects on non-zero exit; the error object from `Executor.execute` may carry stdout — ensure it's propagated).

### Assumptions
1. **Critical:** `acode-plugin-types` is already installed and provides a `TerminalExecutorResult` or similar shape with `.output` property — the exact rejection shape from `Executor.execute` on non-zero exit must be verified manually on-device before wrapping.
2. **Important:** The `Executor` global type referenced in the current `executor.ts` function signature compiles clean under `tsc --noEmit` — if it doesn't, the fix is a simple `any` cast.
3. **Nice-to-have:** The error object thrown by `Executor.execute` includes stdout — if it doesn't, we fall back to `err.message`.

### Risk / Dependency Flags
- **Risk:** The exact shape of the rejection from Acode's `Executor.execute` is undocumented. May need runtime inspection (log the error object) to know which property carries command output.
- **Dependencies:** None. Can ship independently.
- **Open questions:**
  - Does `Executor.execute` reject with an object that has `.output`, `.stderr`, or just `.message`?
  - Does `tsc --noEmit` pass with the current `Executor` type annotation?

### Verification
1. Run `npm run build` — must pass typecheck.
2. Manually trigger a command failure (e.g., run `which nonexistent-binary` via the executor) and confirm the thrown error includes the actual command output visible in the error display.

---

## Phase 2-B: Install Error Capture in `installOpenCode()`

### Goal
Capture the actual command output (stderr/stdout) when dependency installation or `npm install -g opencode-ai` fails, and throw a descriptive error that the UI can display.

### Scope
- **Modify:** `src/opencode/install.ts`
- **No new files.**
- **No new `AppState` values.**
- **No new config constants.** Reuses `INSTALL_DEPS_COMMAND`, `INSTALL_OPENCODE_COMMAND` from `config.ts`.
- **DOX update:** `src/opencode/AGENTS.md` — update `installOpenCode()` contract to document error-throwing behavior with output capture.

### Inputs Required
- `src/terminal/executor.ts` (updated from Phase 2-A)
- `src/config.ts` (command constants)

### Outputs Produced
- Updated `installOpenCode()` that:
  - Catches errors from each `execute()` call.
  - Wraps them with a user-friendly message prefix (e.g., `"Installation failed (deps): ..."` vs `"Installation failed (opencode): ..."`).
  - Includes captured command output in the error message.

### Assumptions
1. **Critical:** Phase 2-A is complete and `execute()` rejections now carry meaningful output.
2. **Important:** The two-command approach (`apk add` then `npm install`) is intentional — each can fail independently and deserves distinct error messages.

### Risk / Dependency Flags
- **Risk:** `apk add` may prompt for confirmation on some Alpine versions. Current command uses `--no-cache` but not `--no-confirm` — may hang if Alpine asks for input (the executor is blocking, no stdin streaming).
- **Dependencies:** Phase 2-A (error capture in executor).
- **Open questions:**
  - Does the Alpine environment need `--no-confirm` on `apk add`?

### Verification
1. Uninstall `nodejs`/`npm` from Alpine, trigger a fresh install — confirm errors during `apk add` or `npm install` show the actual output in the error UI.
2. Run `npm run build` — must pass typecheck.

---

## Phase 2-C: Retry Button in Error Display Always Visible

### Goal
Fix the retry/restart button so it appears on every error state, not only when `logTail` is non-empty. The current `createErrorDisplay` conditionally renders the button with `if (errorInfo?.logTail)`, which means `setError(message, '')` (as done in `main.ts` catch blocks) never shows a retry.

### Scope
- **Modify:** `src/ui/components.ts`
- **No new files.**
- **No new `AppState` values.**
- **No new config constants.**
- **DOX update:** `src/ui/AGENTS.md` — update `createErrorDisplay` contract to document unconditional retry button rendering.

### Inputs Required
- `src/ui/components.ts` (existing `createErrorDisplay`)
- `src/types.ts` (`StateContext`, `ErrorInfo`)

### Outputs Produced
- Updated `createErrorDisplay()` that:
  - Always renders a retry button when `context.error` exists (removing `if (errorInfo?.logTail)` guard on button rendering).
  - Keeps the log tail display conditional: if `logTail` is empty/falsy, show the error message heading only, no empty `<pre>` block.

### Assumptions
1. **Critical:** The `onRetry` callback wired in `renderError` → `createErrorDisplay` already correctly maps to `handleRestart()` in `main.ts` — this is confirmed in the current code.
2. **Important:** The error display styling remains consistent whether or not a log tail is present. The `<pre>` block should be omitted entirely when `logTail` is empty, not shown with zero content.

### Risk / Dependency Flags
- **Risk:** None. Pure DOM change, no terminal/server interaction.
- **Dependencies:** None. Can ship before 2-A or 2-B.
- **Open questions:** None.

### Verification
1. Trigger any error state (e.g., manually set error without log tail). Confirm retry button is visible and clicking it calls the restart flow.
2. Confirm the UI doesn't show an empty `<pre>` block when no log tail is present.

---

## Phase 2-D: Wire Error Output from `main.ts` Catch Blocks

### Goal
Ensure the `catch` blocks in `main.ts` (`startFlow()` and `handleRestart()`) capture and surface the actual error details (including command output) in the UI, rather than passing an empty `logTail`.

### Scope
- **Modify:** `src/main.ts`
- **No new files.**
- **No new `AppState` values.**
- **No new config constants.**
- **DOX update:** Root `AGENTS.md` — no change needed (orchestration logic change, no contract change).

### Inputs Required
- `src/main.ts` (existing — lines 44–89)
- `src/state.ts` (`setError`)
- `src/opencode/install.ts` (updated error throwing from Phase 2-B)
- `src/opencode/server.ts` (`waitForReady` already throws a descriptive error — "Server did not respond within Ns")

### Outputs Produced
- Updated `startFlow()` and `handleRestart()` catch blocks:
  - Extract the full error message string (which now includes command output per 2-B).
  - Pass it as both `message` (summary) and `logTail` (detail) to `setError()`.
  - If the error is from `installOpenCode()` or `waitForReady()`, the message already contains enough context — just set `logTail` to the full message so the `<pre>` block renders it.
  - If the error is unexpected (generic `Error`), pass a fallback `logTail` like `"No output captured. Check /tmp/opencode.log in Alpine terminal."`.

### Assumptions
1. **Critical:** Phase 2-B is complete — `installOpenCode()` now throws errors with captured command output.
2. **Important:** `waitForReady()` in `server.ts` (Phase 3 artifact, already implemented) throws `new Error("Server did not respond within Ns")` — this is already descriptive enough. No changes needed in `server.ts`.
3. **Nice-to-have:** Future phases could add a "View Log" button that reads `/tmp/opencode.log` via executor — out of scope for Phase 2.

### Risk / Dependency Flags
- **Risk:** The `err.message` string could be very long if a full npm install output is captured. The UI wraps in `<pre>` with `max-height: 200px` and `overflow: auto`, so this is handled.
- **Dependencies:** Phase 2-B (rich error messages from `installOpenCode`).
- **Open questions:** None.

### Verification
1. Trigger an install failure (e.g., offline / no network). Confirm the error display shows the actual error output in the `<pre>` block and the retry button is visible.
2. Trigger a server start timeout. Confirm error says "Server did not respond within 15s" and retry button works.

---

## Phase 2-E: Build Verification & DOX Pass

### Goal
Run the full build pipeline, confirm Phase 2 passes typecheck and bundles cleanly, then update all affected AGENTS.md files with any contract changes.

### Scope
- **No code changes.** Build verification only.
- **Modify:** `src/terminal/AGENTS.md` (if executor contract changed in 2-A)
- **Modify:** `src/opencode/AGENTS.md` (if install contract changed in 2-B)
- **Modify:** `src/ui/AGENTS.md` (if `createErrorDisplay` contract changed in 2-C)
- **Modify:** `../BUILD_PLAN.md` — check off Phase 2 items

### Inputs Required
- All Phase 2-A through 2-D outputs
- `npm run build` command
- DOX hierarchy (root `AGENTS.md`, child `AGENTS.md` files)

### Outputs Produced
- Passing `npm run build` (tsc --noEmit → esbuild bundle + zip)
- Updated AGENTS.md contracts reflecting any behavioral changes
- Updated `../BUILD_PLAN.md` with Phase 2 checkboxes marked complete

### Assumptions
1. **Critical:** `eslint` and `prettier` packages remain uninstalled (configs are inert per root AGENTS.md "Gotchas"). Build success does not depend on them.
2. **Important:** No runtime regressions — the build artifact (`dist.zip`) should be loadable in Acode.

### Risk / Dependency Flags
- **Risk:** Changes to `executor.ts` type annotations may break typecheck for callers — verify all files that import `execute()` still compile.
- **Dependencies:** Phases 2-A through 2-D.
- **Open questions:** None.

### Verification
1. `npm run build` exits clean (0).
2. `dist/main.js` is produced and `dist.zip` is created.
3. Manual import of `dist.zip` into Acode — confirm the plugin loads without errors, tap the icon, and flow through install → server → iframe.

---

## Phase Ordering

| # | Phase | Depends On | Can Ship Alone? |
|---|-------|-----------|-----------------|
| 1 | 2-A: Terminal Executor Type Fix & Error Capture | None | ✅ Yes |
| 2 | 2-B: Install Error Capture in `installOpenCode()` | 2-A | ✅ Yes (with degraded error output if 2-A skipped) |
| 3 | 2-C: Retry Button Always Visible | None | ✅ Yes |
| 4 | 2-D: Wire Error Output from `main.ts` | 2-B | ✅ Yes (with empty log tail if 2-B skipped) |
| 5 | 2-E: Build Verification & DOX Pass | 2-A, 2-B, 2-C, 2-D | ❌ (aggregates all) |

**Recommended execution order:** 2-C → 2-A → 2-B → 2-D → 2-E  
(2-C is lowest risk, fastest win; 2-A unblocks 2-B which unblocks 2-D)

---

## Summary Table

| Phase | Goal | Files Touched | Risk Level |
|-------|------|---------------|------------|
| 2-A | Capture command output on executor failure + type safety | `src/terminal/executor.ts` | Medium |
| 2-B | Surface install errors with actual command output | `src/opencode/install.ts` | Medium |
| 2-C | Always show retry button on error | `src/ui/components.ts` | Low |
| 2-D | Wire caught errors into setError with logTail | `src/main.ts` | Low |
| 2-E | Build verification, DOX pass, mark complete | `../BUILD_PLAN.md`, 3 AGENTS.md files | Low |

---

## What Already Exists (No Changes Needed)

These Phase 2 items from `../BUILD_PLAN.md` are **fully implemented** in the codebase and require no work:

| BUILD_PLAN Item | Where Implemented |
|----------------|-------------------|
| `terminal` module (`acode.require('terminal')`) | `src/terminal/executor.ts` — `execute()` wrapper |
| `checkInstalled()` via `which opencode` | `src/opencode/install.ts:4-11` |
| `installOpenCode()` via `apk add` + `npm install` | `src/opencode/install.ts:13-16` |
| State wire: `idle → checking → installing → checking-server` | `src/main.ts:44-76` (`startFlow()`) |
| Indeterminate spinner during loading states | `src/ui/components.ts:19-42` (`createSpinner`), `src/ui/index.ts:54-57` (`renderLoading`) |
| Status messages per state | `src/config.ts:19-24` (`STATUS_MESSAGES`) |

### Design Divergence Note
BUILD_PLAN says `idle → checking → installing → installed`. The implementation uses `idle → checking-install → installing → checking-server → starting-server → ready`. There is no `Installed` state — after successful install, the flow immediately checks the server. This is intentional (see `../SPEC.md` Section 4 state diagram) and does not need to change.
