/**
 * Build the header bar shown in the Ready state. Status display only — it must
 * NOT carry interactive controls. Acode owns/re-paints the `$page.header`
 * region and drops dynamically-appended event listeners, so the Restart action
 * lives in the body as a floating action button (see `createFloatingActionButton`) where our
 * DOM is fully under our control and reliably receives clicks.
 */
export function createHeaderBar(): HTMLElement {
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 8px 16px;
    background: var(--header-bg, #1a1a2e);
    border-bottom: 1px solid var(--border-color, #333);
    flex-shrink: 0;
  `;

  const leftGroup = document.createElement('div');
  leftGroup.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
  `;

  const statusDot = document.createElement('span');
  statusDot.style.cssText = `
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--success-color, #4caf50);
    box-shadow: 0 0 6px var(--success-color, #4caf50);
  `;
  leftGroup.appendChild(statusDot);

  const projectLabel = document.createElement('span');
  projectLabel.textContent = 'OpenCode';
  projectLabel.style.cssText = `
    font-size: 14px;
    font-weight: 600;
    color: var(--text-color, #ccc);
    letter-spacing: 0.3px;
  `;
  leftGroup.appendChild(projectLabel);
  header.appendChild(leftGroup);

  return header;
}
