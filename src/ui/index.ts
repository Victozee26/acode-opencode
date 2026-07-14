import { AppState, StateContext } from '../types';
import { BASE_URL } from '../config';
import {
  createSpinner,
  createIframe,
  createHeaderBar,
  createErrorDisplay,
} from './components';
import { createLogger } from '../logger';

const log = createLogger('ui');

// Human-readable status line per state. Keys are AppState values so the render
// layer can index directly by the current state enum. These are presentation
// strings and live with the UI layer rather than in config.ts.
const STATUS_MESSAGES: Record<string, string> = {
  [AppState.CheckingInstall]: 'Checking OpenCode installation…',
  [AppState.Installing]: 'Installing OpenCode…',
  [AppState.CheckingServer]: 'Checking server status…',
  [AppState.StartingServer]: 'Starting OpenCode server…',
};

/**
 * Reactive UI orchestrator. The plugin renders purely from state: each call
 * wipes `$page.body` and `$page.header` (full re-render, no diffing) and
 * rebuilds the DOM for the given `AppState`. This is invoked by the state
 * machine's `onStateChange` listener whenever the app transitions.
 *
 * @param $page - Acode's web component page (its `body`/`header` are DOM roots).
 * @param state - Current `AppState` driving which view is built.
 * @param context - State context (error info, etc.) needed by some views.
 * @param onRestart - Callback wired into the Ready header's Restart button.
 */
export function render(
  $page: Acode.WCPage,
  state: AppState,
  context: StateContext,
  onRestart: () => void,
): void {
  log.debug(`render: ${state}`);
  // Clear both regions first so every render starts from a clean slate.
  $page.body.innerHTML = '';
  $page.header.innerHTML = '';

  switch (state) {
    case AppState.Idle:
      renderIdle($page);
      break;

    case AppState.CheckingInstall:
    case AppState.Installing:
    case AppState.CheckingServer:
    case AppState.StartingServer:
      // Multiple intermediate states all share the same loading view; only the
      // status message differs (looked up from STATUS_MESSAGES by state).
      renderLoading($page, state);
      break;

    case AppState.Ready:
      renderReady($page, onRestart);
      break;

    case AppState.Error:
      renderError($page, context, onRestart);
      break;
  }
}

function renderIdle($page: Acode.WCPage): void {
  const el = document.createElement('div');
  el.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-color, #ccc);
  `;
  el.textContent = 'Tap the OpenCode icon to start';
  $page.body.appendChild(el);
}

function renderLoading($page: Acode.WCPage, state: AppState): void {
  const statusText = STATUS_MESSAGES[state] ?? 'Loading…';
  $page.body.appendChild(createSpinner(statusText));
}

function renderReady(
  $page: Acode.WCPage,
  onRestart: () => void,
): void {
  // Wires the header (Restart button -> onRestart) and embeds the OpenCode web
  // UI via an iframe pointing at the loopback server (BASE_URL from config).
  $page.header.appendChild(createHeaderBar(onRestart));
  $page.body.appendChild(createIframe(BASE_URL));
}

function renderError(
  $page: Acode.WCPage,
  context: StateContext,
  onRestart: () => void,
): void {
  $page.body.appendChild(createErrorDisplay(context, onRestart));
}
