# src/ui

## Purpose

DOM rendering layer. Pure functions that build DOM subtrees — no side effects, no state mutation, no network calls.

## Ownership

Owned by the root AGENTS.md. Two export modules:
- `index.ts` — `render()` orchestrator dispatching to one render function per `AppState`
- `components.ts` — DOM factory functions: `createContainer`, `createSpinner`, `createIframe`, `createHeaderBar`, `createFloatingActionButton`, `createErrorDisplay`; plus `FabAction` interface

## Local Contracts

- `render($page, state, context, actions)` clears `$page.body` and `$page.header`, then rebuilds based on state. `actions` is `RenderActions` with `restart` and `stop` callbacks.
- Every state variant has its own render function. Never add inline DOM construction in `render()`.
- All DOM is vanilla `document.createElement` — no framework, no `html-tag-js`.
- `createIframe()` accepts a string URL; `renderReady` passes `BASE_URL` from `config.ts`.
- Styles use CSS custom properties (`var(--primary-color, fallback)`) for Acode theming compatibility.
- Global keyframe/utility styles are injected once via `injectBaseStyles()` (`index.ts`) as a `<style#opencode-styles>` element. Provides `.opencode-fade-in` (state transition), `.opencode-btn` (hover/active button effects).
- State transitions fade in: `$page.body` gets `.opencode-fade-in` after every render, triggered with a forced reflow for reliable animation restart.
- `createSpinner()` uses `requestAnimationFrame` (not `setInterval`) for GPU-friendly rotation. The spinner is a conic-gradient arc ring cut with a CSS `mask`.
- `createHeaderBar()` is status-only: a green status dot (`.opencode-btn` glow) indicating the server is running. It must NOT carry interactive controls. Acode owns/re-paints `$page.header` and strips dynamically-appended listeners, so any action wired there is silently lost.
- `createFloatingActionButton(actions, idleTimeout?)` builds a `position: fixed` circular button with drag-to-move and a dropdown menu. Returns `HTMLElement & { destroy: () => void }`. The menu lists actions defined by `FabAction[]` (`{ id, label, onClick }`). Drag is handled via pointer capture on the button itself — no document-level listeners leak. An idle timer (default `FLOATING_BUTTON_IDLE_OPACITY_TIMEOUT` from config) reduces opacity after inactivity; any pointer interaction resets it. Call `destroy()` to clean up timers and resize listener.
- `createErrorDisplay()` unconditionally renders a warning icon and retry button; the log tail `<pre>` block is conditional on `logTail` being truthy. All dynamic strings use `textContent` (safe from injection, no `escapeHtml` needed).
- The error heading `<h3>` has `white-space: pre-wrap` for legible multi-line summaries. `message` is a short summary (first line of the error); `logTail` is the diagnostic detail (remaining lines).
- Event handlers (`onRestart`, `onRetry`) are attached via `addEventListener`, never inline `onclick` attributes.

## Work Guidance

- New UI states: add a case to the switch in `render()` and a corresponding render function.
- New reusable components: export from `components.ts`.
- Keep components pure — no side effects, no state access beyond props.

## Verification

`npm test` runs Vitest with jsdom. Test file: `src/ui/components.test.ts`. Covers `createErrorDisplay` retry button and log tail rendering.

## Child DOX Index

None. This directory is a leaf in the DOX hierarchy.
