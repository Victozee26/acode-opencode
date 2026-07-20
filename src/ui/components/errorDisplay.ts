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
  icon.className = 'opencode-error-icon';
  wrapper.appendChild(icon);

  const heading = document.createElement('h3');
  heading.className = 'opencode-error-heading';
  heading.textContent = errorInfo?.message ?? 'An unknown error occurred';
  wrapper.appendChild(heading);

  if (errorInfo?.logTail) {
    const pre = document.createElement('pre');
    pre.className = 'opencode-error-log';
    pre.textContent = errorInfo.logTail;
    wrapper.appendChild(pre);
  }

  const retryBtn = document.createElement('button');
  retryBtn.textContent = 'Retry';
  retryBtn.className = 'opencode-btn opencode-error-retry';
  retryBtn.addEventListener('click', onRetry);
  wrapper.appendChild(retryBtn);

  return wrapper;
}
