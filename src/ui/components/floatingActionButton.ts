import {
  FLOATING_BUTTON_IDLE_OPACITY_TIMEOUT,
  FAB_SCRIM_BACKGROUND,
  FAB_SCRIM_BLUR,
  FAB_SCRIM_Z_INDEX,
  FAB_Z_INDEX,
} from '../../config/ui';

export interface FabAction {
  id: string;
  label: string;
  onClick: () => void;
}

const FAB_SIZE = 44;
const FAB_MARGIN = 16;
const DRAG_THRESHOLD = 5;
const FAB_IDLE_OPACITY = 0.3;
const FAB_ACTIVE_OPACITY = 1;

export function createFloatingActionButton(
  actions: FabAction[],
  idleTimeout: number = FLOATING_BUTTON_IDLE_OPACITY_TIMEOUT,
): HTMLElement & { destroy: () => void; setActionVisible: (id: string, visible: boolean) => void } {
  const fab = document.createElement('div');
  let posX = window.innerWidth - FAB_SIZE - FAB_MARGIN;
  let posY = window.innerHeight - FAB_SIZE - FAB_MARGIN;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let originX = 0;
  let originY = 0;
  let menuOpen = false;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const menu = document.createElement('div');
  menu.style.cssText = `
    position: absolute;
    bottom: ${FAB_SIZE + 12}px;
    right: 0;
    background: var(--menu-bg, #1e1e2e);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    padding: 6px 0;
    min-width: 180px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    display: none;
    pointer-events: auto;
    z-index: 1;
  `;

  const actionItems = new Map<string, HTMLElement>();

  for (const action of actions) {
    const item = document.createElement('button');
    item.textContent = action.label;
    item.style.cssText = `
      display: block;
      width: 100%;
      padding: 10px 16px;
      background: transparent;
      color: var(--text-color, #ccc);
      border: none;
      font-size: 13px;
      text-align: left;
      cursor: pointer;
      white-space: nowrap;
    `;
    item.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
    });
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
      action.onClick();
    });
    item.addEventListener('pointerenter', () => {
      item.style.background = 'var(--hover-bg, rgba(255,255,255,0.08))';
    });
    item.addEventListener('pointerleave', () => {
      item.style.background = 'transparent';
    });
    menu.appendChild(item);
    actionItems.set(action.id, item);
  }

  fab.style.cssText = `
    position: fixed;
    left: ${posX}px;
    top: ${posY}px;
    width: ${FAB_SIZE}px;
    height: ${FAB_SIZE}px;
    border-radius: 50%;
    background: var(--primary-color, #06f);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
    cursor: grab;
    z-index: ${FAB_Z_INDEX};
    box-shadow: 0 2px 12px rgba(0,0,0,0.5);
    transition: opacity 0.4s ease;
    opacity: ${FAB_ACTIVE_OPACITY};
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
    pointer-events: auto;
  `;
  fab.textContent = '⚙';
  fab.setAttribute('aria-label', 'OpenCode actions');

  const scrim = document.createElement('div');
  scrim.style.cssText = `
    position: fixed;
    inset: 0;
    background: ${FAB_SCRIM_BACKGROUND};
    backdrop-filter: blur(${FAB_SCRIM_BLUR});
    -webkit-backdrop-filter: blur(${FAB_SCRIM_BLUR});
    z-index: ${FAB_SCRIM_Z_INDEX};
    display: none;
    pointer-events: auto;
  `;
  scrim.setAttribute('aria-hidden', 'true');

  fab.appendChild(scrim);
  fab.appendChild(menu);

  function clampX(x: number): number {
    return Math.max(0, Math.min(x, window.innerWidth - FAB_SIZE));
  }

  function clampY(y: number): number {
    return Math.max(0, Math.min(y, window.innerHeight - FAB_SIZE));
  }

  function setPosition(x: number, y: number): void {
    posX = x;
    posY = y;
    fab.style.left = `${posX}px`;
    fab.style.top = `${posY}px`;
  }

  function positionMenu(): void {
    const margin = 8;
    const fabRect = fab.getBoundingClientRect();
    const menuW = menu.offsetWidth;
    const menuH = menu.offsetHeight;

    if (fabRect.right - menuW < margin) {
      menu.style.right = 'auto';
      menu.style.left = '0px';
    } else {
      menu.style.left = 'auto';
      menu.style.right = '0px';
    }

    if (fabRect.top - menuH - margin < 0) {
      menu.style.bottom = 'auto';
      menu.style.top = `${FAB_SIZE + 12}px`;
    } else {
      menu.style.top = 'auto';
      menu.style.bottom = `${FAB_SIZE + 12}px`;
    }
  }

  function openMenu(): void {
    menuOpen = true;
    menu.style.display = 'block';
    scrim.style.display = 'block';
    positionMenu();
    setActiveOpacity();
    cancelIdleTimer();
  }

  function closeMenu(): void {
    menuOpen = false;
    menu.style.display = 'none';
    scrim.style.display = 'none';
    resetIdleTimer();
  }

  function toggleMenu(): void {
    if (menuOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  function setActiveOpacity(): void {
    fab.style.opacity = String(FAB_ACTIVE_OPACITY);
  }

  function resetIdleTimer(): void {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    if (menuOpen) return;
    setActiveOpacity();
    idleTimer = setTimeout(() => {
      fab.style.opacity = String(FAB_IDLE_OPACITY);
    }, idleTimeout);
  }

  function cancelIdleTimer(): void {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  fab.addEventListener('pointerdown', (e: PointerEvent) => {
    resetIdleTimer();
    fab.setPointerCapture(e.pointerId);
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    originX = posX;
    originY = posY;
    fab.style.cursor = 'grabbing';
    e.preventDefault();
  });

  fab.addEventListener('pointermove', (e: PointerEvent) => {
    if (!isDragging) return;
    resetIdleTimer();
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    setPosition(clampX(originX + dx), clampY(originY + dy));
  });

  fab.addEventListener('pointerup', (e: PointerEvent) => {
    if (!isDragging) return;
    fab.releasePointerCapture(e.pointerId);
    isDragging = false;
    fab.style.cursor = 'grab';
    const dx = Math.abs(e.clientX - dragStartX);
    const dy = Math.abs(e.clientY - dragStartY);
    if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) {
      toggleMenu();
    }
    resetIdleTimer();
  });

  fab.addEventListener('pointercancel', (e: PointerEvent) => {
    if (isDragging) {
      isDragging = false;
      fab.style.cursor = 'grab';
    }
    if (fab.hasPointerCapture(e.pointerId)) {
      fab.releasePointerCapture(e.pointerId);
    }
  });

  function onDocumentClick(e: MouseEvent): void {
    if (!menuOpen) return;
    if (!menu.contains(e.target as Node) && e.target !== fab) {
      closeMenu();
    }
  }

  document.addEventListener('click', onDocumentClick);

  // Pointer events inside the embedded iframe (a separate document) never reach
  // the parent document, so the menu must also close when the iframe steals focus.
  function onWindowBlur(): void {
    if (menuOpen) closeMenu();
  }

  window.addEventListener('blur', onWindowBlur);

  function handleResize(): void {
    setPosition(clampX(posX), clampY(posY));
  }

  window.addEventListener('resize', handleResize);

  resetIdleTimer();

  const destroy = (): void => {
    cancelIdleTimer();
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('blur', onWindowBlur);
    document.removeEventListener('click', onDocumentClick);
    scrim.remove();
  };

  function setActionVisible(id: string, visible: boolean): void {
    const item = actionItems.get(id);
    if (item) {
      item.style.display = visible ? 'block' : 'none';
    }
  }

  return Object.assign(fab, { destroy, setActionVisible });
}
