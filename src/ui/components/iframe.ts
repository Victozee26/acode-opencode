/**
 * Build the iframe that embeds the OpenCode web UI. `src` is the loopback
 * server URL (see `BASE_URL` in config). `scale` applies a CSS transform
 * to zoom the iframe content (1.0 = 100%).
 */
export function createIframe(src: string, scale = 1): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.src = src;

  const needsScale = scale !== 1;
  const width = needsScale ? `${100 / scale}%` : '100%';
  const height = needsScale ? `${100 / scale}%` : '100%';
  const transform = needsScale ? `transform: scale(${scale}); transform-origin: 0 0;` : '';

  iframe.style.cssText = `
    width: ${width};
    height: ${height};
    border: none;
    ${transform}
  `;

  return iframe;
}
