import { FabAction } from './floatingActionButton';

const BACK_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';

export function createCustomHeader(
  actions: FabAction[],
  isReady: boolean,
  onBack?: () => void,
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

  const statusDot = document.createElement('span');
  statusDot.className = 'opencode-header-dot';
  if (!isReady) {
    statusDot.style.background = 'var(--text-color, #888)';
    statusDot.style.boxShadow = 'none';
  }
  leftGroup.appendChild(statusDot);

  const projectLabel = document.createElement('span');
  projectLabel.textContent = 'OpenCode';
  projectLabel.className = 'opencode-header-label';
  leftGroup.appendChild(projectLabel);
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

  for (const action of actions) {
    const item = document.createElement('button');
    item.textContent = action.label;
    item.className = 'opencode-fab-item';
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
