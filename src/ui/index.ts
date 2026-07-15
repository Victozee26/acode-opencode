import { AppState, StateContext } from '../types';
import { BASE_URL } from '../config/server';
import {
  createSpinner,
  createIframe,
  createHeaderBar,
  createErrorDisplay,
} from './components';
import { getIframeScale } from '../settings';
import { createLogger } from '../logger';

export interface RenderActions {
  restart: () => void;
  stop: () => void;
}

const log = createLogger('ui');

let activeSpinner: (HTMLElement & { stop: () => void }) | null = null;

// Human-readable status line per state. Keys are AppState values so the render
// layer can index directly by the current state enum. These are presentation
// strings and live with the UI layer rather than in config.ts.
const STATUS_MESSAGES: Record<string, string> = {
  [AppState.CheckingInstall]: 'Checking OpenCode installation…',
  [AppState.Installing]: 'Installing OpenCode…',
  [AppState.CheckingServer]: 'Checking server status…',
  [AppState.StartingServer]: 'Starting OpenCode server…',
};

let stylesInjected = false;

function injectBaseStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.id = 'opencode-styles';
  style.textContent = `
    @keyframes opencode-fade-in {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .opencode-fade-in {
      animation: opencode-fade-in 0.35s ease-out !important;
    }
    .opencode-btn {
      transition: opacity 0.2s, transform 0.1s !important;
      cursor: pointer !important;
    }
    .opencode-btn:hover {
      opacity: 0.85 !important;
    }
    .opencode-btn:active {
      transform: scale(0.96) !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Reactive UI orchestrator. The plugin renders purely from state: each call
 * wipes `$page.body` and `$page.header` (full re-render, no diffing) and
 * rebuilds the DOM for the given `AppState`. This is invoked by the state
 * machine's `onStateChange` listener whenever the app transitions.
 *
 * @param $page - Acode's web component page (its `body`/`header` are DOM roots).
 * @param state - Current `AppState` driving which view is built.
 * @param context - State context (error info, etc.) needed by some views.
 * @param actions - Callbacks wired into the Error retry path. The floating
 * action button is created once at the plugin level (see `AcodePlugin`), not
 * here, so it persists across every state re-render.
 */
export function render(
  $page: Acode.WCPage,
  state: AppState,
  context: StateContext,
  actions: RenderActions,
): void {
  log.debug(`render: ${state}`);
  if (activeSpinner) {
    activeSpinner.stop();
    activeSpinner = null;
  }
  $page.body.innerHTML = '';
  $page.header.innerHTML = '';

  injectBaseStyles();

  switch (state) {
    case AppState.Idle:
      renderIdle($page);
      break;

    case AppState.CheckingInstall:
    case AppState.Installing:
    case AppState.CheckingServer:
    case AppState.StartingServer:
      renderLoading($page, state);
      break;

    case AppState.Ready:
      renderReady($page, actions);
      break;

    case AppState.Error:
      renderError($page, context, actions);
      break;
  }

  $page.body.style.animation = 'none';
  void $page.body.offsetHeight;
  $page.body.style.animation = '';
  $page.body.classList.add('opencode-fade-in');
}

function renderIdle($page: Acode.WCPage): void {
  const el = document.createElement('div');
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    color: var(--text-color, #ccc);
  `;

  const icon = document.createElement('div');
  icon.textContent = '\u25B8';
  icon.style.cssText = `
    font-size: 40px;
    opacity: 0.35;
    margin-bottom: 4px;
  `;
  el.appendChild(icon);

  const text = document.createElement('span');
  text.textContent = 'Tap the OpenCode icon to start';
  text.style.cssText = `
    font-size: 14px;
    opacity: 0.7;
  `;
  el.appendChild(text);
  $page.body.appendChild(el);
}

function renderLoading($page: Acode.WCPage, state: AppState): void {
  const statusText = STATUS_MESSAGES[state] ?? 'Loading…';
  activeSpinner = createSpinner(statusText);
  $page.body.appendChild(activeSpinner);
}

function renderReady(
  $page: Acode.WCPage,
  _actions: RenderActions,
): void {
  $page.header.appendChild(createHeaderBar());
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position: relative; width: 100%; height: 100%; overflow: hidden;';
  wrapper.appendChild(createIframe(BASE_URL, getIframeScale()));

  $page.body.style.overflow = 'hidden';
  $page.body.appendChild(wrapper);
}

function renderError(
  $page: Acode.WCPage,
  context: StateContext,
  actions: RenderActions,
): void {
  $page.body.appendChild(createErrorDisplay(context, actions.restart));
}
