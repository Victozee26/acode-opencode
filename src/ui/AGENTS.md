# src/ui

## Purpose

DOM rendering layer. Pure functions that build DOM subtrees — no side effects, no state mutation, no network calls.

## Ownership

Owned by the root AGENTS.md. Three subdirectories:
- `index.ts` — `render(state, context, actions)` orchestrator dispatching to one render function per `AppState`; `initUiStyles(baseUrl)` loads CSS via `<link>` elements; `initUiPage($page)` sets up persistent header and content containers; `updateHeader(state, actions)` updates header in-place on every render
- `components/` — one file per DOM factory function, re-exported through `components/index.ts` (barrel)
- `styles/` — one CSS file per component/domain, loaded via `<link>` in `initUiStyles()`

  Components:
  - `container.ts` — `createContainer` (shared root wrapper used by `spinner` and `errorDisplay`)
  - `spinner.ts` — `createSpinner`
  - `iframe.ts` — `createIframe`
  - `headerBar.ts` — `createHeaderBar` (legacy — unused)
  - `customHeader.ts` — `createCustomHeader` (replaces FAB, hamburger menu with Start/Restart/Stop)
  - `floatingActionButton.ts` — `createFloatingActionButton` plus the `FabAction` interface (legacy — unused)
  - `errorDisplay.ts` — `createErrorDisplay`

  Styles:
  - `base.css` — keyframes (fade-in), `.opencode-fade-in`, `.opencode-btn` utility class
  - `container.css` — `.opencode-container` shared flex wrapper
  - `idle.css` — `.opencode-idle`, `.opencode-idle-icon`, `.opencode-idle-text`
  - `ready.css` — `.opencode-ready-wrapper`
  - `headerBar.css` — `.opencode-header`, `.opencode-header-left`, `.opencode-header-dot`, `.opencode-header-label`, `.opencode-header-hamburger`, `.opencode-header-menu`, `.opencode-header-scrim`, `.opencode-fab-item`, `.opencode-header-update`, `.opencode-header-update--installing`, `.opencode-header-update--error`, `.opencode-header-update--updated`, `.opencode-header-update-close`, `@keyframes opencode-update-pulse`
  - `spinner.css` — `.opencode-spinner-ring` (conic arc), `.opencode-spinner-label`
  - `errorDisplay.css` — `.opencode-error-icon`, `.opencode-error-heading`, `.opencode-error-log`, `.opencode-error-retry`
  - `iframe.css` — `.opencode-iframe`
  - `floatingActionButton.css` — legacy, not loaded

  Consumers (e.g. `main.ts`, `ui/index.ts`) import from `./ui/components` (resolves to the barrel), never from an individual component file. Tests live in `test/ui/components.test.ts`.

## Local Contracts

- `initUiPage($page)` is called once during `AcodePlugin.init()` to set up persistent DOM: it clears `$page.body`, sets it to a flex column, then appends two containers — `#opencode-header` (stored in `pageHeader`) and `#opencode-content` (stored in `pageContent`). These containers persist across all subsequent renders.
- `render(state, context, actions)` no longer takes `$page`. On first call, it creates the custom header inside `pageHeader`; on subsequent calls it only swaps the content area (`pageContent.innerHTML`). Same-state transitions short-circuit — only `updateHeader()` runs, no content swap. `actions` is `RenderActions` with `start`, `restart`, `stop`, `back`, optional `updateInfo`, optional `updateStatus`, optional `onUpdateClick`, and optional `onCancelUpdate` fields.
- `updateHeader(state, actions)` updates the header in-place: sets the status dot color based on Ready state, shows/hides the Start Server menu item, and creates/replaces/removes the update banner. It calls `buildUpdateBanner(actions)` to get the banner config and uses `createUpdateBannerElement()` to build the DOM.
- The custom header (via `createCustomHeader`) is created once and persists across state transitions. It includes a status dot (green when `Ready`, gray otherwise), "OpenCode" label, and a hamburger button on the right. Clicking the hamburger opens a dropdown menu with Start/Restart/Stop Server actions, with a scrim backdrop to close on outside tap. The "Start Server" item is hidden when the server is already `Ready`. An optional update banner (`.opencode-header-update`) is prepended to the menu, built from `actions` via `buildUpdateBanner()`.
- Every state variant has its own render function. Never add inline DOM construction in `render()`.
- All DOM is vanilla `document.createElement` — no framework, no `html-tag-js`.
- All static CSS is in external `.css` files under `styles/`, loaded once by `initUiStyles(baseUrl)` via `<link>` elements (called from `AcodePlugin.init()`). Dynamic styles (position, opacity toggles, transform, config-dependent values) remain as inline `element.style.*` assignments.
- Components use `className` or `classList` instead of `cssText` for static layout. Never add static CSS as inline styles.
- `createIframe(src, scale?)` accepts a string URL and optional numeric scale factor (1 = 100%); `renderReady` passes `BASE_URL` from `../config/server` and `getIframeScale()` from `../settings`.
- The content container (not `$page.body`) uses `overflow: hidden` in Ready state. The iframe is CSS-scaled (layout box `100/scale%`, then `transform: scale()`), which overflows the wrapper box; clipping prevents the parent body from becoming scrollable. The embedded web UI scrolls internally. Do NOT remove this clipping.
- Styles use CSS custom properties (`var(--primary-color, fallback)`) for Acode theming compatibility.
- Global keyframe/utility styles are in `styles/base.css`, loaded via `<link>` by `initUiStyles()`. Provides `.opencode-fade-in` (state transition), `.opencode-btn` (hover/active button effects).
- State transitions fade in: the content container gets `.opencode-fade-in` after every render, triggered with a forced reflow for reliable animation restart.
- `createSpinner()` uses `requestAnimationFrame` (not `setInterval`) for GPU-friendly rotation. The spinner is a conic-gradient arc ring cut with a CSS `mask`.
- `createCustomHeader(actions, isReady, onBack?, updateBanner?)` builds a flex header bar with an optional back button, status dot, label, and hamburger toggle. The hamburger opens a dropdown of `FabAction[]`, preceded by an optional `.opencode-header-update` banner. The `UpdateBannerConfig` carries a `label`, `status` (`'installing'` | `'error'` | `'updated'` | `null`), `onClick`, and optional `onCancel` callbacks. When `status === 'installing'` — pulsing amber banner with a × close button (`.opencode-header-update-close`) that calls `onCancel` to revert to the pre-update state; the main label is non-clickable. When `status === 'updated'` — green banner, non-interactive `<div>` (not a button), shows "Updated to X.X". When `status === 'error'` — red text, clickable to retry. When `status === null` — amber text, clickable to start the update. A scrim overlay (dimmed + blurred) appears behind the menu to catch outside taps and close it. The scrim is a child of the header with `z-index: -1` so it paints behind the header but above page content. The menu is positioned below the header (`top: 100%`, right-aligned). The Start Server action is hidden when `isReady` is true. No document-level event listeners are used; the scrim `click` handler closes the menu directly. Each `FabAction` item gets a `data-action-id` attribute matching its `id` so `updateHeader()` can query by action id (e.g. `[data-action-id="start"]`).
- `createHeaderBar()` and `createFloatingActionButton()` are legacy components kept for reference but no longer used. The FAB's functionality (Start/Restart/Stop actions) is now served by the hamburger menu in `createCustomHeader()`. The custom header is created once inside `pageHeader` and persists across state transitions; `updateHeader()` modifies it in-place.
- `createErrorDisplay()` unconditionally renders a warning icon and retry button; the log tail `<pre>` block is conditional on `logTail` being truthy. All dynamic strings use `textContent` (safe from injection, no `escapeHtml` needed).
- The error heading `<h3>` uses class `opencode-error-heading` (`white-space: pre-wrap` from CSS) for legible multi-line summaries. `message` is a short summary (first line of the error); `logTail` is the diagnostic detail (remaining lines).
- Event handlers (`onRestart`, `onRetry`) are attached via `addEventListener`, never inline `onclick` attributes.

## Work Guidance

- New UI states: add a case to the switch in `render()` and a corresponding render function.
- New reusable components: each lives in its own file under `components/` and is re-exported from `components/index.ts`. Keep the file scoped to a single component.
- Keep components pure — no side effects, no state access beyond props.

## Verification

`npm test` runs Vitest with jsdom. Test file: `test/ui/components.test.ts`. Covers `createErrorDisplay` retry button and log tail rendering.

## Child DOX Index

None. This directory is a leaf in the DOX hierarchy.
