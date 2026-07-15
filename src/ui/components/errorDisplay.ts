import { StateContext } from '../../types';
import { createContainer } from './container';

/**
 * Build the error view from the current `StateContext`. Always renders a
 * warning icon and Retry button (so the user can recover from any error) and
 * conditionally renders a scrollable diagnostics `<pre>` log tail when
 * `context.error.logTail` exists. The `message` heading uses `white-space:
 * pre-wrap` so multi-line summaries stay legible; dynamic strings use
 * `textContent` (safe from injection).
 */
export function createErrorDisplay(context: StateContext, onRetry: () => void): HTMLElement {
  const wrapper = createContainer('opencode-error');
  const errorInfo = context.error;

  const icon = document.createElement('div');
  icon.textContent = '⚠️';
  icon.style.cssText = `
    font-size: 32px;
    margin-bottom: 8px;
    opacity: 0.8;
  `;
  wrapper.appendChild(icon);

  const heading = document.createElement('h3');
  heading.style.cssText = `
    color: var(--error-color, #f44);
    margin: 0 0 12px 0;
    font-size: 15px;
    font-weight: 600;
    white-space: pre-wrap;
    text-align: center;
  `;
  heading.textContent = errorInfo?.message ?? 'An unknown error occurred';
  wrapper.appendChild(heading);

  if (errorInfo?.logTail) {
    const pre = document.createElement('pre');
    pre.style.cssText = `
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
      margin: 0 0 20px 0;
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--border-color, #333);
    `;
    pre.textContent = errorInfo.logTail;
    wrapper.appendChild(pre);
  }

  const retryBtn = document.createElement('button');
  retryBtn.textContent = 'Retry';
  retryBtn.className = 'opencode-btn';
  retryBtn.style.cssText = `
    margin-top: 8px;
    padding: 10px 32px;
    background: var(--primary-color, #06f);
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
  `;
  retryBtn.addEventListener('click', onRetry);
  wrapper.appendChild(retryBtn);

  return wrapper;
}
