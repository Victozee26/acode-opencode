import { StateContext } from '../types';

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

export function createSpinner(statusText: string): HTMLElement {
  const wrapper = createContainer('opencode-loading');
  wrapper.innerHTML = `
    <div style="
      width: 40px;
      height: 40px;
      border: 4px solid var(--border-color, #333);
      border-top-color: var(--primary-color, #06f);
      border-radius: 50%;
      animation: opencode-spin 0.8s linear infinite;
    "></div>
    <p style="margin-top: 16px; color: var(--text-color, #ccc);">${escapeHtml(statusText)}</p>
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes opencode-spin {
      to { transform: rotate(360deg); }
    }
  `;
  wrapper.appendChild(style);

  return wrapper;
}

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

export function createHeaderBar(onRestart: () => void): HTMLElement {
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: var(--header-bg, #1a1a2e);
    border-bottom: 1px solid var(--border-color, #333);
    flex-shrink: 0;
  `;

  const projectLabel = document.createElement('span');
  projectLabel.textContent = 'OpenCode';
  projectLabel.style.cssText = `
    font-size: 14px;
    color: var(--text-color, #ccc);
  `;
  header.appendChild(projectLabel);

  const restartBtn = document.createElement('button');
  restartBtn.textContent = 'Restart';
  restartBtn.style.cssText = `
    padding: 4px 12px;
    background: var(--primary-color, #06f);
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  `;
  restartBtn.addEventListener('click', onRestart);
  header.appendChild(restartBtn);

  return header;
}

export function createErrorDisplay(context: StateContext, onRetry: () => void): HTMLElement {
  const wrapper = createContainer('opencode-error');
  const errorInfo = context.error;

  wrapper.innerHTML = `
    <h3 style="color: var(--error-color, #f44); margin-bottom: 12px;">
      ${escapeHtml(errorInfo?.message ?? 'An unknown error occurred')}
    </h3>
    <pre style="
      max-width: 100%;
      max-height: 200px;
      overflow: auto;
      padding: 12px;
      background: var(--code-bg, #111);
      color: var(--code-text, #f88);
      border-radius: 6px;
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-all;
    ">${escapeHtml(errorInfo?.logTail ?? '')}</pre>
  `;

  if (errorInfo?.logTail) {
    const retryBtn = document.createElement('button');
    retryBtn.textContent = 'Retry';
    retryBtn.style.cssText = `
      margin-top: 16px;
      padding: 8px 24px;
      background: var(--primary-color, #06f);
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    `;
    retryBtn.addEventListener('click', onRetry);
    wrapper.appendChild(retryBtn);
  }

  return wrapper;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (ch) => map[ch] ?? ch);
}
