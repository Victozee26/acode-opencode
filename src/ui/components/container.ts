/**
 * Build a centered, full-size flex container used as the root wrapper for the
 * loading and error states. Inlines layout styles so callers don't depend on a
 * shared stylesheet.
 */
export function createContainer(id: string): HTMLElement {
  const el = document.createElement('div');
  el.id = id;
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    padding: 24px;
    box-sizing: border-box;
  `;
  return el;
}
