import { AppState, StateContext } from '../types';
import { STATUS_MESSAGES } from '../config';
import {
  createSpinner,
  createIframe,
  createHeaderBar,
  createErrorDisplay,
} from './components';

export function render(
  $page: Acode.WCPage,
  state: AppState,
  context: StateContext,
  onRestart: () => void,
): void {
  $page.body.innerHTML = '';
  $page.header.innerHTML = '';

  switch (state) {
    case AppState.Idle:
      renderIdle($page);
      break;

    case AppState.CheckingInstall:
    case AppState.Installing:
    case AppState.CheckingServer:
    case AppState.ResolvingPath:
    case AppState.StartingServer:
      renderLoading($page, state);
      break;

    case AppState.Ready:
      renderReady($page, context, onRestart);
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
  context: StateContext,
  onRestart: () => void,
): void {
  $page.header.appendChild(createHeaderBar(context.projectPath, onRestart));
  $page.body.appendChild(createIframe('http://127.0.0.1:4096'));
}

function renderError(
  $page: Acode.WCPage,
  context: StateContext,
  onRestart: () => void,
): void {
  $page.body.appendChild(createErrorDisplay(context, onRestart));
}
