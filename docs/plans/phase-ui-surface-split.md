# Phase: UI Surface Split — Persistent Header, Swappable Content

> **Status:** Planning phase. Current `render()` does `$page.body.innerHTML = ''` on every state transition, destroying and rebuilding the entire DOM (header + content) even when only a small part changed (e.g., update check completes).
> **Source:** Discussion with maintainer about the "whole UI re-rendering because of a little state" problem. Decision to solve it with a targeted vanilla DOM split rather than migrating to React.

---

## Problem Statement

The current `render()` function in `src/ui/index.ts` (line 77) clears the entire `$page.body` and rebuilds everything — header, menu, content area — on every state transition. This causes three concrete problems:

1. **The iframe is destroyed and recreated** when a trivial state transition occurs (e.g., update check completes → `transition(AppState.Ready)` while already in Ready state). This loses any in-progress user interaction in the OpenCode web UI.

2. **The update banner cannot update independently.** When `updateInfo` changes (update check finds a new version), `main.ts` calls `transition(getState().currentState)` which triggers a full re-render just to show "v1.0 → v1.5" in the header menu.

3. **Menu open/close state is lost** on every re-render because the header (including its hamburger menu with scrim) is rebuilt from scratch each time.

4. **Future UI additions** (settings panel, confirmation dialogs, terminal output viewer) would each trigger full-page re-renders, making the problem progressively worse.

---

## Solution Architecture

Split `$page.body` into two permanent child containers:

```
$page.body (flex column, never cleared)
├── #opencode-header     ← Persists across all state transitions
│   └── (customHeader)   ← Created once, elements updated in-place
└── #opencode-content    ← Only this is swapped on state change
    └── (idle | spinner | iframe | error)
```

**What changes:**
- `render()` no longer touches `$page.body` directly. It operates on the content container only.
- The header is created once during `initUiPage()` and its mutable parts (status dot, update banner, menu item visibility) are updated in-place via a new `updateHeader()` function.
- The `RenderActions` interface is split — `updateInfo`/`updateStatus`/`onUpdateClick`/`onCancelUpdate` move to a separate `HeaderActions` type for header-only updates, avoiding unnecessary content swaps.

---

## Phase 1: Structural Split — Persistent Containers

### Goal
Stop wiping `$page.body`. Separate header and content into persistent containers so a state transition only swaps the content area.

### Scope

**Files to create:**
- None

**Files to modify:**
- **`src/ui/index.ts`** — major refactor of `render()` + new `initUiPage()` + new `updateHeader()`
- **`src/main.ts`** — add `initUiPage()` call, update `onStateChange` callback
- **`src/ui/AGENTS.md`** — update render contract, add `initUiPage` and `updateHeader` contracts
- **`src/main.test.ts`** — update test assertions if they mock `render()` signature
- **`test/ui/components.test.ts`** — add tests for header update functions

**`AppState` values affected:** None. The state machine is unchanged.

**Config constants added:** `HEADER_CONTAINER_ID`, `CONTENT_CONTAINER_ID` in `src/config/ui.ts`.

### Inputs Required

- `src/ui/index.ts` — current `render()`, `initUiStyles()`, `STATUS_MESSAGES`, `buildUpdateBanner()`
- `src/ui/components/customHeader.ts` — `createCustomHeader()`, `UpdateBannerConfig`, `FabAction`
- `src/ui/components/spinner.ts` — `createSpinner()`
- `src/main.ts` — `onStateChange` registration, `updateInfo`/`updateStatus` fields, `handleUpdateClick()`/`handleCancelUpdate()`
- `src/types.ts` — `AppState`, `StateContext`, `RenderActions`
- `src/config/ui.ts` — for new container ID constants

### Outputs Produced

#### 1. `initUiPage($page)` — new export in `src/ui/index.ts`

Sets up the persistent DOM structure once. Called from `AcodePlugin.init()` before the `onStateChange` registration.

```typescript
export function initUiPage($page: Acode.WCPage): void {
  $page.body.innerHTML = '';
  $page.body.style.display = 'flex';
  $page.body.style.flexDirection = 'column';
  $page.body.style.height = '100%';
  $page.body.style.overflow = '';

  const header = document.createElement('div');
  header.id = HEADER_CONTAINER_ID;
  pageHeader = header;
  $page.body.appendChild(header);

  const content = document.createElement('div');
  content.id = CONTENT_CONTAINER_ID;
  content.style.flex = '1';
  content.style.display = 'flex';
  content.style.flexDirection = 'column';
  pageContent = content;
  $page.body.appendChild(content);
}
```

Module-level variables `let pageHeader: HTMLElement | null`, `let pageContent: HTMLElement | null`, `let previousState: AppState | null` track the persistent containers and last-rendered state.

#### 2. `render()` — simplified signature, content-only

```typescript
// Before:
export function render($page, state, context, actions): void
// After:
export function render(state: AppState, context: StateContext, actions: RenderActions): void
```

New behavior:
- Stops active spinner (same as before)
- **If state === previousState:** short-circuits content swap entirely. Only calls `updateHeader(state, actions)`. The iframe (if rendered) is untouched.
- **If state !== previousState:** clears `pageContent.innerHTML = ''`, then builds the content for the new state (Idle/Loading/Ready/Error via existing render functions). Applies fade-in animation to `pageContent`. Then calls `updateHeader(state, actions)`.
- No longer touches `$page.body`, `$page.body.innerHTML`, `$page.body.style` at all.

The `previousState` variable is updated after each render.

#### 3. `updateHeader(state, actions)` — new internal function

Updates the header in-place without rebuilding it:

```typescript
function updateHeader(state: AppState, actions: RenderActions): void
```

What it does:
- **Status dot:** Find `.opencode-header-dot` inside `pageHeader`. Set its background to the Ready color (green) when `state === AppState.Ready`, or the default gray otherwise.
- **Start Server menu item:** Find item with `action.id === 'start'` in the menu. Show/hide based on `state === AppState.Ready`.
- **Update banner:** Call `buildUpdateBanner(actions)` to get the current config. Then:
  - If no banner config and no banner exists in DOM: do nothing.
  - If no banner config but a banner exists: remove it.
  - If banner config exists but no banner in DOM: create banner element, prepend to menu before the first `.opencode-fab-item`.
  - If both exist: replace banner element text/class/event listeners atomically.

This requires that `pageHeader` contains the header and that the menu structure is queryable. The `createCustomHeader()` call already uses consistent class names, so `querySelector` lookups are reliable.

#### 4. Header creation — moved to first render call

The header is NOT created in `initUiPage()`. Instead, it's created during the **first** `render()` call when `pageHeader` is empty (or has no `.opencode-header` child). Subsequent renders skip header creation and only call `updateHeader()`.

Alternative: create the header in `initUiPage()` with placeholder values, then `updateHeader()` fills in real values on first render. Either approach works. The plan should recommend the explicit "create on first render" approach to avoid duplicating the header-building logic.

**First-render logic inside `render()`:**

```typescript
const headerEl = pageHeader!.querySelector('.opencode-header');
if (!headerEl) {
  // First render: build the header
  const fabActions: FabAction[] = [
    { id: 'start', label: 'Start Server', onClick: actions.start },
    { id: 'restart', label: 'Restart Server', onClick: actions.restart },
    { id: 'stop', label: 'Stop Server', onClick: actions.stop },
  ];
  const banner = buildUpdateBanner(actions);
  pageHeader!.appendChild(createCustomHeader(fabActions, state === AppState.Ready, actions.back, banner));
} else {
  // Subsequent renders: just update in-place
  updateHeader(state, actions);
}
```

#### 5. `src/main.ts` changes

In `init()`:
- After `initUiStyles(baseUrl)` and before `onStateChange`, add:
  ```typescript
  initUiPage($page);
  ```
- Remove the `$page.body.style.display = '';` line (now handled by `initUiPage`).
- The `onStateChange` callback changes:
  ```typescript
  onStateChange((state, context) => {
    const actions: RenderActions = { /* same as before */ };
    render(state, context, actions);  // no more `this.$page` arg
  });
  ```

#### 6. `src/config/ui.ts` addition

```typescript
export const HEADER_CONTAINER_ID = 'opencode-header';
export const CONTENT_CONTAINER_ID = 'opencode-content';
```

### Assumptions

1. **Critical:** The `createCustomHeader` function produces elements with consistent, queryable class names (`.opencode-header-dot`, `.opencode-header-update`, `.opencode-fab-item` with `[action-id]` or similar selector). Verified: yes, the class names are stable and the menu items' `textContent` maps to their `action.id`. However, the menu items currently lack a `data-action-id` attribute — the `updateHeader` function will need a reliable way to find the "Start Server" item. **Recommendation:** Add `data-action-id="${action.id}"` attribute to each menu item in `createCustomHeader()` (or do it in `updateHeader()` by iterating `.opencode-fab-item` children and matching `action.id` by position/index).

2. **Critical:** The `RenderActions` interface continues to carry `updateInfo`, `updateStatus`, `onUpdateClick`, `onCancelUpdate` fields. These are needed by `updateHeader()`/`buildUpdateBanner()` and are not removed in this phase.

3. **Important:** The iframe (Ready state) does not need to be recreated on every Ready→Ready transition. The short-circuit (`state === previousState`) prevents this. Verified: update check completion triggers `transition(AppState.Ready)` → `previousState === Ready` → short-circuit → no iframe recreation.

4. **Important:** Multiple `onStateChange` listeners could exist. The `initUiPage()` call is a one-time setup that must happen before any listener fires. Since `initUiPage()` is called before `onStateChange()` is registered, this is guaranteed.

5. **Nice-to-have:** The `back` action (for a future back button) is passed through `actions.back` but not currently used in the main flow. The header creation code handles it conditionally (`if (onBack) create back button`), so it will work correctly when a back action is provided.

### Risk / Dependency Flags

- **Risk: First-render race.** The `onStateChange` listener could fire before `initUiPage()` completes, but since `initUiPage()` is synchronous and called before the listener is registered, this cannot happen. **Mitigation:** None needed — the order is explicit in `init()`.

- **Risk: `createCustomHeader` creates menu items without `data-action-id`.** Currently the items are distinguished by index (0=start, 1=restart, 2=stop) and visibility by id. `updateHeader()` finding the "Start Server" item by `textContent` would be brittle (future i18n). **Mitigation:** Either (a) update `createCustomHeader()` to set a `data-action-id` attribute, or (b) have `updateHeader()` find items by index position matching the `FabAction[]` order. **Recommendation:** Option (a) — minimal change, robust for future.

- **Risk: The `buildUpdateBanner()` function currently returns a `UpdateBannerConfig` with `onClick`, `onCancel` callbacks. These callbacks are captured from the `actions` object at the time of render. If `updateHeader()` is called with stale `actions`, the callbacks could be wrong. **Mitigation:** `updateHeader()` always receives the latest `actions` from the `onStateChange` callback, which is re-created fresh on every state change with updated `updateInfo`/`updateStatus`. No stale capture.

- **Dependencies:** None on other phases. This is a self-contained refactoring of the UI rendering layer. The state machine, terminal layer, OpenCode lifecycle, and health checks are untouched.

- **Open questions:**
  1. Should `pageHeader` be cleared before rebuilding the header on first render, or should we assert it's empty? **Answer:** It's guaranteed empty on first call — `initUiPage()` sets `$page.body.innerHTML = ''` and only appends empty containers. Use `assert(!headerEl)` or just set `pageHeader!.innerHTML = ''` defensively before creating the header.
  2. Where does the fade-in animation apply? Currently it's on the content container. After the split, it should apply to `pageContent` only (not the header). This is correct — the header shouldn't fade in on every state transition.
  3. Should `STATUS_MESSAGES` remain in `src/ui/index.ts` or move to `src/config/ui.ts`? **Recommendation:** Leave it — it's a UI concern, not a config constant. The no-magic-numbers rule is about literals in business logic, not mapping enums to display strings in the UI layer.

### Verification

1. `npm run build` passes (tsc + esbuild).
2. `npm test` — all existing tests pass. New tests for `updateHeader()` and `initUiPage()` added to `test/ui/components.test.ts`.
3. Manual QA (on-device):
   - **Start flow:** Plugin icon → spinner sequence → iframe loads. All transitions show correct content.
   - **Header persistence:** Open hamburger menu. While menu is open, wait for update check to complete (or trigger `transition()` manually). Menu stays open (no flash/close).
   - **Iframe preservation:** While in Ready state, a Ready→Ready transition (e.g., from update check) does NOT reload the iframe. Verify by typing in the OpenCode chat, then triggering `transition(AppState.Ready)` — the typed text is preserved.
   - **Update banner:** If an update is available, the banner appears in the menu. Tapping "Update" shows the installing state. Tapping cancel reverts the banner. All without disrupting the content area.
   - **Error recovery:** Error state renders correctly in the content area. Retry button works. Header status dot is gray (not green) during error.
   - **Idle to start:** From Idle, tap "Start Server" menu item → spinner appears in content area. Header status dot remains gray until Ready.

---

## Phase 2: Decouple Header Actions from the Render Cycle

### Goal
Stop calling `transition(getState().currentState)` for header-only changes. Update the header (status dot, update banner) without touching the state machine at all.

### Scope

**Files to modify:**
- **`src/main.ts`** — replace `transition(getState().currentState)` calls for update check and update progress with direct header updates
- **`src/ui/index.ts`** — export `updateHeader()` so `main.ts` can call it directly
- **`src/types.ts`** — add `HeaderActions` interface containing only the header-relevant fields from `RenderActions`
- **`src/ui/AGENTS.md`** — update contracts

**Files to create:**
- None

**`AppState` values affected:** None. The state machine is no longer called for header-only updates.

**Config constants added:** None.

### Inputs Required
- Phase 1 outputs (persistent containers, `updateHeader()` function, `pageHeader` reference)
- `src/main.ts` — `handleUpdateClick()`, `handleCancelUpdate()`, `runUpdateCheck()` callback

### Outputs Produced

#### 1. `HeaderActions` type in `src/types.ts`

```typescript
export interface HeaderActions {
  updateInfo?: UpdateInfo | null;
  updateStatus?: UpdateStatus | null;
  onUpdateClick?: () => void;
  onCancelUpdate?: () => void;
}
```

`RenderActions` is unchanged but now represents "everything the content area needs plus header actions bundled for convenience." Over time, `RenderActions` could be slimmed down, but not in this phase.

#### 2. `updateHeader()` becomes public export

```typescript
export function updateHeader(state: AppState, actions: HeaderActions): void
```

Its internal logic is identical to Phase 1's `updateHeader()`. The only difference is the type of `actions` — it now takes `HeaderActions` instead of the full `RenderActions`.

#### 3. `src/main.ts` changes

In `AcodePlugin`:
- Track `headerActions: HeaderActions` as an instance field (or compute from existing `updateInfo`, `updateStatus`).
- Replace `transition(getState().currentState)` in three places:
  1. **`runUpdateCheck()` callback** (line 120): Instead of `transition(getState().currentState)`, call `updateHeader(getState().currentState, headerActions)`.
  2. **`handleUpdateClick()` success/failure** (lines 274, 285, 289): Instead of `transition(getState().currentState)`, update `updateInfo`/`updateStatus`, then call `updateHeader(getState().currentState, headerActions)`.
  3. **`handleCancelUpdate()`** (line 300): Same — clear `updateStatus`, call `updateHeader()`.

This means the `onStateChange` listener still fires for **actual** state changes (CheckingInstall → Installing → CheckingServer → Ready → Error), but NOT for header-only visual updates. The content area is never touched for update banner changes.

The `render()` call inside `onStateChange` still calls `updateHeader()` as before — the function is idempotent, so calling it both from `render()` (during state transitions) and directly (during header-only updates) is safe.

#### 4. `onStateChange` simplification (optional)

Since `updateInfo`/`updateStatus` are no longer needed for content rendering, the `RenderActions` passed to `render()` can drop them. This simplifies the content render functions — they only care about `start`, `restart`, `stop`, `back`. The `updateInfo`/`updateStatus`/`onUpdateClick`/`onCancelUpdate` fields are still carried on `RenderActions` for backward compatibility but no longer read by `render()`.

**Recommendation:** Keep them on the interface for now. Remove them in a follow-up cleanup phase once everything is verified stable.

### Assumptions

1. **Critical:** `updateHeader()` is safe to call outside the `onStateChange` listener. The function only touches DOM elements in `pageHeader` and does not interact with the state machine, executor, or any async process. Verified: `updateHeader()` is a pure DOM manipulation function.
2. **Important:** Calling `updateHeader()` from both `render()` (during state transitions) and directly (during header-only updates) creates no race conditions. The function is synchronous and idempotent — calling it twice in quick succession with the same arguments produces the same result.
3. **Nice-to-have:** The `previousState` short-circuit in `render()` (from Phase 1) continues to work correctly. When `updateHeader()` is called directly from `main.ts`, the state doesn't change, so `render()` wouldn't be called anyway.

### Risk / Dependency Flags

- **Risk:** If a header-only update (e.g., `updateStatus = 'installing'`) happens concurrently with a real state transition (e.g., `transition(AppState.Ready)`), the `updateHeader()` calls could interleave. **Mitigation:** JavaScript is single-threaded on the main thread. State transitions are async (`await`) but the `transition()` call itself is synchronous. The `onStateChange` listener runs synchronously during `transition()`. So the sequence is:
  1. User taps "Update" → `handleUpdateClick()` called
  2. Sets `updateStatus = 'installing'` → calls `updateHeader()` → DOM updated
  3. `await installUpdate()` — yields to event loop
  4. State transition happens during await → `onStateChange` fires → `render()` → calls `updateHeader()` again → idempotent
  This is safe.

- **Dependencies:** Phase 1 must ship first. Phase 2 is purely additive — it adds the `updateHeader()` export and changes `main.ts` to use it. If Phase 1 hasn't shipped, `updateHeader()` doesn't exist.

- **Open questions:**
  1. Should `headerActions` be an instance field on `AcodePlugin` or computed fresh each time? **Recommendation:** Computed fresh each time using the existing `updateInfo`, `updateStatus`, `handleUpdateClick`, `handleCancelUpdate` — these are already on the instance. No new fields needed.
  2. Should the `HeaderActions` type live in `src/types.ts` or `src/ui/headerTypes.ts`? **Recommendation:** `src/types.ts` — it's a small type used by both `main.ts` and `ui/index.ts`, and `types.ts` is the existing home for shared interfaces.

### Verification

1. `npm run build` passes.
2. `npm test` — all tests pass, including new tests from Phase 1.
3. Manual QA (on-device):
   - **Update check completes without content disruption:** While in Ready state, trigger an update check (real or simulated). The update banner appears in the header menu. The iframe content (e.g., typed chat message) is untouched.
   - **Update install progress without iframe reload:** Start an update. The "Installing" banner shows without disrupting the content area. Cancel the update — banner reverts to pre-update state. The iframe is untouched throughout.
   - **State transition still updates header:** Transition from CheckingServer → Ready. The status dot changes from gray to green. The "Start Server" menu item hides. These changes happen as part of `render()` calling `updateHeader()`, even without a direct `updateHeader()` call.
   - **No duplicate updateHeader calls cause issues:** The banner is not duplicated, the status dot is not double-set. DOM updates are idempotent.

---

## Phase Ordering

| # | Phase | Depends On | Can Ship Alone? |
|---|-------|-----------|-----------------|
| 1 | Structural Split — Persistent Containers | None | ✅ Yes |
| 2 | Decouple Header Actions from Render Cycle | Phase 1 | ❌ (needs Phase 1's `updateHeader()`) |

**Recommended execution order:** 1 → 2
(Phase 1 is the foundational refactor; Phase 2 is the optimization on top)

---

## Summary Table

| Phase | Goal | Files Touched | Risk Level |
|-------|------|---------------|------------|
| 1 | Split `$page.body` into persistent header + content containers. `render()` only swaps content. Header is created once, updated in-place. | `src/ui/index.ts`, `src/main.ts`, `src/types.ts`, `src/config/ui.ts`, `src/ui/AGENTS.md`, `test/ui/components.test.ts`, `src/main.test.ts` | Medium |
| 2 | Decouple header-only updates (update banner, status dot) from the state machine. Update header without calling `transition()`. | `src/main.ts`, `src/ui/index.ts`, `src/types.ts`, `src/ui/AGENTS.md` | Low |

---

## Cross-Cutting Notes

### Relationship to Existing Architecture

- **State machine (`src/state.ts`):** Untouched by both phases. It still owns the app lifecycle state. Phase 2 reduces the number of spurious `transition()` calls but does not change the machine itself.
- **Components (`src/ui/components/`):** `createCustomHeader()` is unchanged. It still produces the same DOM tree with the same class names. The only addition is `data-action-id` attributes on menu items (for robust `updateHeader()` querying).
- **Main.ts flow orchestration:** The `startFlow()` method is unchanged. Error handling is unchanged. Only the update-related code paths change (fewer `transition()` calls, more `updateHeader()` calls).
- **CSS:** No changes. Classes used by the header remain the same. The `#opencode-header` and `#opencode-content` containers may need minimal additional CSS (e.g., `#opencode-content { flex: 1; display: flex; }`), but the `initUiPage()` function sets these as inline styles.

### What These Phases Do NOT Change

- **State machine enum:** No new `AppState` values.
- **Config constants:** Only `HEADER_CONTAINER_ID` and `CONTENT_CONTAINER_ID` added (Phase 1).
- **OpenCode lifecycle:** `install.ts`, `server.ts`, `health.ts`, `update.ts` — all untouched.
- **Terminal layer:** `executor.ts` — untouched.
- **Build pipeline:** `package.json`, `esbuild.config.mjs`, `tsconfig.json` — untouched.

### Future-Proofing

After these phases, adding a **settings panel** or **terminal output viewer** would follow the same pattern:
1. Add the panel as content inside `#opencode-content` (swap on state transition).
2. The header (with its menu, status dot, update banner) is never touched.
3. If the panel needs its own internal state (e.g., collapse/expand, scroll position), it manages that locally via event listeners — unaffected by state transitions.

This is the same benefit React would provide (granular re-rendering by component), achieved with ~50 lines of vanilla DOM code and zero new dependencies.
