export function createHeaderBar(): HTMLElement {
  const header = document.createElement('div');
  header.className = 'opencode-header';

  const leftGroup = document.createElement('div');
  leftGroup.className = 'opencode-header-left';

  const statusDot = document.createElement('span');
  statusDot.className = 'opencode-header-dot';
  leftGroup.appendChild(statusDot);

  const projectLabel = document.createElement('span');
  projectLabel.textContent = 'OpenCode';
  projectLabel.className = 'opencode-header-label';
  leftGroup.appendChild(projectLabel);
  header.appendChild(leftGroup);

  return header;
}
