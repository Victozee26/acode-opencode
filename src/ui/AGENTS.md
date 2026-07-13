# src/ui

## Purpose

DOM rendering layer. Pure functions that build DOM subtrees — no side effects, no state mutation, no network calls.

## Ownership

Owned by the root AGENTS.md. Two export modules:
- `index.ts` — `render()` orchestrator dispatching to one render function per `AppState`
- `components.ts` — DOM factory functions: `createContainer`, `createSpinner`, `createIframe`, `createHeaderBar`, `createErrorDisplay`

## Local Contracts

- `render($page, state, context, onRestart)` clears `$page.body` and `$page.header`, then rebuilds based on state.
- Every state variant has its own render function. Never add inline DOM construction in `render()`.
- All DOM is vanilla `document.createElement` — no framework, no `html-tag-js`.
- `createIframe()` accepts a string URL (hardcoded to `http://127.0.0.1:4096` by caller).
- `escapeHtml()` is a module-private helper in `components.ts` — all user/external strings rendered as HTML must pass through it.
- Styles use CSS custom properties (`var(--primary-color, fallback)`) for Acode theming compatibility.
- `createErrorDisplay()` unconditionally renders a retry button when error exists; the log tail `<pre>` block is conditional on `logTail` being truthy.
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
