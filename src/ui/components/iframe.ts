/**
 * Build the iframe that embeds the OpenCode web UI. `src` is the loopback
 * server URL (see `BASE_URL` in config).
 */
export function createIframe(src: string): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
  `;
  return iframe;
}
