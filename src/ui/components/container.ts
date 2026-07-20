export function createContainer(id: string): HTMLElement {
  const el = document.createElement('div');
  el.id = id;
  el.className = 'opencode-container';
  return el;
}
