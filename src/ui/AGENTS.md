# src/ui

## Purpose

DOM rendering layer. Pure functions that build DOM subtrees — no side effects, no state mutation, no network calls.

## Ownership

Owned by the root AGENTS.md. Two export modules:
- `index.ts` — `render()` orchestrator dispatching to one render function per `AppState`
- `components/` — one file per DOM factory function, re-exported through `components/index.ts` (barrel)

  - `container.ts` — `createContainer` (shared root wrapper used by `spinner` and `errorDisplay`)
  - `spinner.ts` — `createSpinner`
  - `iframe.ts` — `createIframe`
  - `headerBar.ts` — `createHeaderBar`
  - `floatingActionButton.ts` — `createFloatingActionButton` plus the `FabAction` interface
  - `errorDisplay.ts` — `createErrorDisplay`

  Consumers (e.g. `main.ts`, `ui/index.ts`) import from `./ui/components` (resolves to the barrel), never from an individual component file. Tests live in `test/ui/components.test.ts`.

## Local Contracts

- `render($page, state, context, actions)` clears `$page.body` and `$page.header`, then rebuilds based on state. `actions` is `RenderActions` with `restart` and `stop` callbacks.
- Every state variant has its own render function. Never add inline DOM construction in `render()`.
- All DOM is vanilla `document.createElement` — no framework, no `html-tag-js`.
- `createIframe(src, scale?)` accepts a string URL and optional numeric scale factor (1 = 100%); `renderReady` passes `BASE_URL` from `../config/server` and `getIframeScale()` from `../settings`.
- The Ready wrapper and `$page.body` both use `overflow: hidden`. The iframe is CSS-scaled (layout box `100/scale%`, then `transform: scale()`), which overflows the wrapper box; clipping prevents the parent body from becoming scrollable (the ~50% scroll-offset bug). The embedded web UI scrolls internally. Do NOT remove this clipping.
- Styles use CSS custom properties (`var(--primary-color, fallback)`) for Acode theming compatibility.
- Global keyframe/utility styles are injected once via `injectBaseStyles()` (`index.ts`) as a `<style#opencode-styles>` element. Provides `.opencode-fade-in` (state transition), `.opencode-btn` (hover/active button effects).
- State transitions fade in: `$page.body` gets `.opencode-fade-in` after every render, triggered with a forced reflow for reliable animation restart.
- `createSpinner()` uses `requestAnimationFrame` (not `setInterval`) for GPU-friendly rotation. The spinner is a conic-gradient arc ring cut with a CSS `mask`.
- `createHeaderBar()` is status-only: a green status dot (`.opencode-btn` glow) indicating the server is running. It must NOT carry interactive controls. Acode owns/re-paints `$page.header` and strips dynamically-appended listeners, so any action wired there is silently lost.
- `createFloatingActionButton(actions, idleTimeout?)` builds a `position: fixed` circular button with drag-to-move and a dropdown menu. Returns `HTMLElement & { destroy: () => void }`. The menu lists actions defined by `FabAction[]` (`{ id, label, onClick }`). Drag is handled via pointer capture on the button itself — no document-level listeners leak. An idle timer (default `FLOATING_BUTTON_IDLE_OPACITY_TIMEOUT` from config) reduces opacity after inactivity; any pointer interaction resets it, and the idle fade is suppressed while the menu is open. Call `destroy()` to clean up timers, resize, and blur listeners. The returned handle also exposes `setActionVisible(id, visible)` to show/hide a menu item by its `FabAction.id` (used to hide the Start Server action while the server is already `Ready`). When the menu opens, a full-viewport dimmed + blurred scrim (`FAB_SCRIM_*` from config: `background`, `blur`, `z-index`) is shown behind the FAB; tapping the scrim (or any outside click) closes the menu and hides the scrim. Outside-close is handled by a single `document` `click` listener (`onDocumentClick`), NOT a `pointerdown` listener and NOT a separate scrim `click` listener — having both was causing a double close (press closed it, the redundant click closed it again). The menu closes on release, not on press, for a smooth feel. Clicks inside the embedded iframe (a separate document) don't bubble to the parent, so the menu also closes via the `window` `blur` listener when the iframe steals focus. The scrim is a CHILD of the FAB with a NEGATIVE z-index (`FAB_SCRIM_Z_INDEX`), so it shares the FAB's stacking context and always paints BEHIND the button and its menu yet above `$page` content — a root-level scrim would paint above the whole FAB subtree (because `$page` forms a stacking context), stealing the open click and closing the menu instantly. `FAB_Z_INDEX` is the FAB's own z-index. The FAB is created ONCE at the plugin level (`AcodePlugin.mountFab` in `src/main.ts`) and appended to `$page` so it persists across every state re-render — it is NOT created in `renderReady` (the render layer only wipes `$page.body`/`$page.header`). Its actions are Start/Restart/Stop Server wired to the plugin's flow drivers; `AcodePlugin` hides Start when `state === AppState.Ready`.
- `createErrorDisplay()` unconditionally renders a warning icon and retry button; the log tail `<pre>` block is conditional on `logTail` being truthy. All dynamic strings use `textContent` (safe from injection, no `escapeHtml` needed).
- The error heading `<h3>` has `white-space: pre-wrap` for legible multi-line summaries. `message` is a short summary (first line of the error); `logTail` is the diagnostic detail (remaining lines).
- Event handlers (`onRestart`, `onRetry`) are attached via `addEventListener`, never inline `onclick` attributes.

## Work Guidance

- New UI states: add a case to the switch in `render()` and a corresponding render function.
- New reusable components: each lives in its own file under `components/` and is re-exported from `components/index.ts`. Keep the file scoped to a single component.
- Keep components pure — no side effects, no state access beyond props.

## Verification

`npm test` runs Vitest with jsdom. Test file: `test/ui/components.test.ts`. Covers `createErrorDisplay` retry button and log tail rendering.

## Child DOX Index

None. This directory is a leaf in the DOX hierarchy.
