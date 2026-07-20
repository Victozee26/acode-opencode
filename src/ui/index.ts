import { AppState, StateContext, UpdateInfo, UpdateStatus } from '../types';
import { BASE_URL } from '../config/server';
import { HEADER_CONTAINER_ID, CONTENT_CONTAINER_ID } from '../config/ui';
import {
  createSpinner,
  createIframe,
  createCustomHeader,
  createErrorDisplay,
  FabAction,
  UpdateBannerConfig,
} from './components';
import { getIframeScale } from '../settings';
import { createLogger } from '../logger';

export interface RenderActions {
  start: () => void;
  restart: () => void;
  stop: () => void;
  back: () => void;
  updateInfo?: UpdateInfo | null;
  updateStatus?: UpdateStatus | null;
  onUpdateClick?: () => void;
  onCancelUpdate?: () => void;
}

const log = createLogger('ui');

let activeSpinner: (HTMLElement & { stop: () => void }) | null = null;

let pageHeader: HTMLElement | null = null;
let pageContent: HTMLElement | null = null;
let previousState: AppState | null = null;

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

const STATUS_MESSAGES: Record<string, string> = {
  [AppState.CheckingInstall]: 'Checking OpenCode installation\u2026',
  [AppState.Installing]: 'Installing OpenCode\u2026',
  [AppState.CheckingServer]: 'Checking server status\u2026',
  [AppState.StartingServer]: 'Starting OpenCode server\u2026',
};

/**
 * Reactive UI orchestrator. The plugin renders purely from state: the first
 * call creates the persistent header inside `pageHeader` (id=`HEADER_CONTAINER_ID`),
 * and subsequent calls only swap the content area (`pageContent`, id=`CONTENT_CONTAINER_ID`).
 * Same-state transitions short-circuit to only update the header in-place.
 */
export function render(
  state: AppState,
  context: StateContext,
  actions: RenderActions,
): void {
  log.debug(`render: ${state}`);

  if (activeSpinner) {
    activeSpinner.stop();
    activeSpinner = null;
  }

  if (state === previousState) {
    updateHeader(state, actions);
    return;
  }

  const headerEl = pageHeader!.querySelector('.opencode-header');
  if (!headerEl) {
    const fabActions: FabAction[] = [
      { id: 'start', label: 'Start Server', onClick: actions.start },
      { id: 'restart', label: 'Restart Server', onClick: actions.restart },
      { id: 'stop', label: 'Stop Server', onClick: actions.stop },
    ];
    const banner = buildUpdateBanner(actions);
    pageHeader!.appendChild(createCustomHeader(fabActions, state === AppState.Ready, actions.back, banner));
  }

  pageContent!.innerHTML = '';
  pageContent!.style.overflow = '';

  switch (state) {
    case AppState.Idle:
      renderIdle(pageContent!);
      break;

    case AppState.CheckingInstall:
    case AppState.Installing:
    case AppState.CheckingServer:
    case AppState.StartingServer:
      renderLoading(pageContent!, state);
      break;

    case AppState.Ready:
      renderReady(pageContent!);
      break;

    case AppState.Error:
      renderError(pageContent!, context, actions);
      break;
  }

  pageContent!.style.animation = 'none';
  void pageContent!.offsetHeight;
  pageContent!.style.animation = '';
  pageContent!.classList.add('opencode-fade-in');

  updateHeader(state, actions);
  previousState = state;
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

function buildUpdateBanner(actions: RenderActions): UpdateBannerConfig | null {
  const info = actions.updateInfo;
  const status = actions.updateStatus;
  const onClick = actions.onUpdateClick;

  if (status === 'updated' && info) {
    return {
      label: `Updated to ${info.currentVersion}`,
      status: 'updated',
      onClick: () => {},
    };
  }

  if (!info && status !== 'error') return null;

  if (status === 'installing') {
    return {
      label: `Updating: ${info?.currentVersion ?? '?'} \u2192 ${info?.latestVersion ?? '?'}`,
      status: 'installing',
      onClick: onClick ?? (() => {}),
      onCancel: actions.onCancelUpdate,
    };
  }

  if (status === 'error') {
    return { label: 'Update failed \u2014 tap to retry', status: 'error', onClick: onClick ?? (() => {}) };
  }

  return {
    label: `Update: ${info!.currentVersion} \u2192 ${info!.latestVersion}`,
    status: null,
    onClick: onClick ?? (() => {}),
  };
}

function updateHeader(state: AppState, actions: RenderActions): void {
  if (!pageHeader) return;

  const dot = pageHeader.querySelector<HTMLElement>('.opencode-header-dot');
  if (dot) {
    if (state === AppState.Ready) {
      dot.style.background = 'var(--primary-color, #4caf50)';
      dot.style.boxShadow = '0 0 6px var(--primary-color, #4caf50)';
    } else {
      dot.style.background = 'var(--text-color, #888)';
      dot.style.boxShadow = 'none';
    }
  }

  const startItem = pageHeader.querySelector<HTMLElement>('[data-action-id="start"]');
  if (startItem) {
    startItem.style.display = state === AppState.Ready ? 'none' : '';
  }

  const existingBanner = pageHeader.querySelector('.opencode-header-update');
  const bannerConfig = buildUpdateBanner(actions);

  if (!bannerConfig && existingBanner) {
    existingBanner.remove();
  } else if (bannerConfig && !existingBanner) {
    const menu = pageHeader.querySelector('.opencode-header-menu');
    if (menu) {
      const firstItem = menu.querySelector('.opencode-fab-item');
      const newBanner = createUpdateBannerElement(bannerConfig);
      if (firstItem) {
        menu.insertBefore(newBanner, firstItem);
      } else {
        menu.appendChild(newBanner);
      }
    }
  } else if (bannerConfig && existingBanner) {
    const parent = existingBanner.parentNode;
    const ref = existingBanner.nextSibling;
    existingBanner.remove();
    const newBanner = createUpdateBannerElement(bannerConfig);
    if (parent) {
      if (ref) {
        parent.insertBefore(newBanner, ref);
      } else {
        parent.appendChild(newBanner);
      }
    }
  }
}

function createUpdateBannerElement(config: UpdateBannerConfig): HTMLElement {
  if (config.status === 'updated') {
    const banner = document.createElement('div');
    banner.className = 'opencode-header-update opencode-header-update--updated';
    banner.textContent = config.label;
    return banner;
  }

  const banner = document.createElement('button');
  banner.className = 'opencode-header-update';
  banner.textContent = config.label;

  if (config.status === 'installing') {
    banner.classList.add('opencode-header-update--installing');
    const closeBtn = document.createElement('span');
    closeBtn.textContent = '\u2715';
    closeBtn.className = 'opencode-header-update-close';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      config.onCancel?.();
    });
    banner.appendChild(closeBtn);
  } else if (config.status === 'error') {
    banner.classList.add('opencode-header-update--error');
  }

  if (config.status !== 'installing') {
    banner.addEventListener('click', (e) => {
      e.stopPropagation();
      config.onClick();
    });
  }

  return banner;
}
