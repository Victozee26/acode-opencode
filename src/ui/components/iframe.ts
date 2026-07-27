function applyScale(iframe: HTMLIFrameElement, scale: number): void {
  const needsScale = scale !== 1;
  iframe.style.width = needsScale ? `${100 / scale}%` : '100%';
  iframe.style.height = needsScale ? `${100 / scale}%` : '100%';
  if (needsScale) {
    iframe.style.transform = `scale(${scale})`;
    iframe.style.transformOrigin = '0 0';
  } else {
    iframe.style.transform = '';
    iframe.style.transformOrigin = '';
  }
}

export function createIframe(src: string, scale = 1): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.className = 'opencode-iframe';

  applyScale(iframe, scale);

  return iframe;
}

export function setIframeScale(iframe: HTMLIFrameElement, scale: number): void {
  applyScale(iframe, scale);
}
