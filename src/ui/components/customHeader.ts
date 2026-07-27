import { FabAction } from './floatingActionButton';

export interface UpdateBannerConfig {
  label: string;
  status: 'installing' | 'error' | 'updated' | null;
  onClick: () => void;
  onCancel?: () => void;
}

const BACK_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';

export function createCustomHeader(
  actions: FabAction[],
  isReady: boolean,
  baseUrl: string,
  onBack?: () => void,
  updateBanner?: UpdateBannerConfig | null,
): HTMLElement {
  const header = document.createElement('div');
  header.className = 'opencode-header';

  const leftGroup = document.createElement('div');
  leftGroup.className = 'opencode-header-left';

  if (onBack) {
    const backBtn = document.createElement('button');
    backBtn.className = 'opencode-header-back opencode-btn';
    backBtn.innerHTML = BACK_SVG;
    backBtn.setAttribute('aria-label', 'Back');
    backBtn.addEventListener('click', onBack);
    leftGroup.appendChild(backBtn);
  }

  const wordmark = document.createElement('img');
  wordmark.className = 'opencode-header-wordmark';
  wordmark.src = baseUrl + 'asset/opencode-wordmark-dark.png';
  wordmark.alt = 'OpenCode';
  wordmark.setAttribute('aria-label', 'OpenCode');
  leftGroup.appendChild(wordmark);

  header.appendChild(leftGroup);

  const hamburger = document.createElement('button');
  hamburger.className = 'opencode-header-hamburger opencode-btn';
  hamburger.textContent = '\u2630';
  hamburger.setAttribute('aria-label', 'OpenCode actions');
  header.appendChild(hamburger);

  const menu = document.createElement('div');
  menu.className = 'opencode-header-menu';
  menu.style.display = 'none';

  const scrim = document.createElement('div');
  scrim.className = 'opencode-header-scrim';
  scrim.style.display = 'none';
  scrim.setAttribute('aria-hidden', 'true');

  if (updateBanner) {
    if (updateBanner.status === 'updated') {
      const banner = document.createElement('div');
      banner.className = 'opencode-header-update opencode-header-update--updated';
      banner.textContent = updateBanner.label;
      menu.appendChild(banner);
    } else {
      const banner = document.createElement('button');
      banner.className = 'opencode-header-update';
      banner.textContent = updateBanner.label;

      if (updateBanner.status === 'installing') {
        banner.classList.add('opencode-header-update--installing');

        const closeBtn = document.createElement('span');
        closeBtn.textContent = '\u2715';
        closeBtn.className = 'opencode-header-update-close';
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          closeMenu();
          updateBanner.onCancel?.();
        });
        banner.appendChild(closeBtn);
      } else if (updateBanner.status === 'error') {
        banner.classList.add('opencode-header-update--error');
      }

      if (updateBanner.status !== 'installing') {
        banner.addEventListener('click', (e) => {
          e.stopPropagation();
          closeMenu();
          updateBanner.onClick();
        });
      }

      menu.appendChild(banner);
    }
  }

  for (const action of actions) {
    const item = document.createElement('button');
    item.textContent = action.label;
    item.className = 'opencode-fab-item';
    item.setAttribute('data-action-id', action.id);
    if (action.id === 'start' && isReady) {
      item.style.display = 'none';
    }
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
      action.onClick();
    });
    menu.appendChild(item);
  }

  header.appendChild(scrim);
  header.appendChild(menu);

  function closeMenu(): void {
    menu.style.display = 'none';
    scrim.style.display = 'none';
  }

  function toggleMenu(): void {
    const isOpen = menu.style.display === 'block';
    if (isOpen) {
      closeMenu();
    } else {
      menu.style.display = 'block';
      scrim.style.display = 'block';
    }
  }

  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  scrim.addEventListener('click', closeMenu);

  return header;
}
