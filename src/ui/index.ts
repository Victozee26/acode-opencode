import { AppState, StateContext } from '../types';
import { BASE_URL } from '../config/server';
import {
  createSpinner,
  createIframe,
  createCustomHeader,
  createErrorDisplay,
  FabAction,
} from './components';
import { getIframeScale } from '../settings';
import { createLogger } from '../logger';

export interface RenderActions {
  start: () => void;
  restart: () => void;
  stop: () => void;
  back: () => void;
}

const log = createLogger('ui');

let activeSpinner: (HTMLElement & { stop: () => void }) | null = null;

let stylesInitialized = false;

const STYLESHEETS = [
  'styles/base.css',
  'styles/container.css',
  'styles/idle.css',
  'styles/headerBar.css',
  'styles/spinner.css',
  'styles/errorDisplay.css',
  'styles/iframe.css',
  'styles/ready.css',
];

export function initUiStyles(baseUrl: string): void {
  if (stylesInitialized) return;
  stylesInitialized = true;
  for (const href of STYLESHEETS) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = baseUrl + href;
    document.head.appendChild(link);
  }
}

const STATUS_MESSAGES: Record<string, string> = {
  [AppState.CheckingInstall]: 'Checking OpenCode installation\u2026',
  [AppState.Installing]: 'Installing OpenCode\u2026',
  [AppState.CheckingServer]: 'Checking server status\u2026',
  [AppState.StartingServer]: 'Starting OpenCode server\u2026',
};

/**
 * Reactive UI orchestrator. The plugin renders purely from state: each call
 * wipes `$page.body` (full re-render, no diffing) and rebuilds the DOM for the
 * given `AppState`. A custom header with hamburger menu (anchored to `$page.body`
 * top) replaces the FAB and appears in every state.
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
  $page.body.style.display = 'flex';
  $page.body.style.flexDirection = 'column';
  $page.body.style.height = '100%';
  $page.body.style.overflow = '';

  const isReady = state === AppState.Ready;
  const fabActions: FabAction[] = [
    { id: 'start', label: 'Start Server', onClick: actions.start },
    { id: 'restart', label: 'Restart Server', onClick: actions.restart },
    { id: 'stop', label: 'Stop Server', onClick: actions.stop },
  ];
  $page.body.appendChild(createCustomHeader(fabActions, isReady, actions.back));

  const container = document.createElement('div');
  container.style.flex = '1';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  $page.body.appendChild(container);

  switch (state) {
    case AppState.Idle:
      renderIdle(container);
      break;

    case AppState.CheckingInstall:
    case AppState.Installing:
    case AppState.CheckingServer:
    case AppState.StartingServer:
      renderLoading(container, state);
      break;

    case AppState.Ready:
      renderReady(container);
      break;

    case AppState.Error:
      renderError(container, context, actions);
      break;
  }

  container.style.animation = 'none';
  void container.offsetHeight;
  container.style.animation = '';
  container.classList.add('opencode-fade-in');
}

function renderIdle(container: HTMLElement): void {
  const el = document.createElement('div');
  el.style.flex = '1';
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';

  const icon = document.createElement('div');
  icon.textContent = '\u25B8';
  icon.className = 'opencode-idle-icon';
  el.appendChild(icon);

  const text = document.createElement('span');
  text.textContent = 'Tap the OpenCode icon to start';
  text.className = 'opencode-idle-text';
  el.appendChild(text);
  container.appendChild(el);
}

function renderLoading(container: HTMLElement, state: AppState): void {
  const statusText = STATUS_MESSAGES[state] ?? 'Loading\u2026';
  activeSpinner = createSpinner(statusText);
  container.appendChild(activeSpinner);
}

function renderReady(container: HTMLElement): void {
  container.style.overflow = 'hidden';
  const wrapper = document.createElement('div');
  wrapper.className = 'opencode-ready-wrapper';
  wrapper.appendChild(createIframe(BASE_URL, getIframeScale()));
  container.appendChild(wrapper);
}

function renderError(
  container: HTMLElement,
  context: StateContext,
  actions: RenderActions,
): void {
  container.appendChild(createErrorDisplay(context, actions.restart));
}
