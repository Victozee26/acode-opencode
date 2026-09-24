import { StateContext, RuntimeVersions } from '../../types';
import { VERSION_PENDING } from '../../config/opencode';
import { formatDiagnostics } from '../../error';
import { createContainer } from './container';

// Shown for both version lines until the background probe (main.ts →
// setErrorVersions) reports the real values or `?`.
const PENDING_VERSIONS: RuntimeVersions = { node: VERSION_PENDING, npm: VERSION_PENDING };

/**
 * Build the error view from the current `StateContext`. Always renders a
 * warning icon, a diagnostics `<pre>` and a Retry button (so the user can
 * recover from any error). The diagnostics block holds `context.error.logTail`
 * plus the node/npm version lines — initially the pending placeholders, which
 * `setErrorVersions()` in `ui/index.ts` replaces in place once the probe
 * answers. The `message` heading uses `white-space: pre-wrap` so multi-line
 * summaries stay legible; dynamic strings use `textContent` (safe from
 * injection).
 */
export function createErrorDisplay(context: StateContext, onRetry: () => void): HTMLElement {
  const wrapper = createContainer('opencode-error');
  const errorInfo = context.error;
  const logTail = errorInfo?.logTail ?? '';

  const heading = document.createElement('h3');
  heading.className = 'opencode-error-heading';
  heading.textContent = errorInfo?.message ?? 'An unknown error occurred';
  wrapper.appendChild(heading);

  const pre = document.createElement('pre');
  pre.className = 'opencode-error-log';
  pre.textContent = formatDiagnostics(logTail, PENDING_VERSIONS);
  wrapper.appendChild(pre);

  const buttonRow = document.createElement('div');
  buttonRow.className = 'opencode-error-actions';

  const retryBtn = document.createElement('button');
  retryBtn.textContent = 'Retry';
  retryBtn.className = 'opencode-btn opencode-error-retry';
  retryBtn.addEventListener('click', onRetry);
  buttonRow.appendChild(retryBtn);

  // Read the diagnostics live at click time so the copied text carries the
  // probed versions once they have filled in, not the pending placeholder.
  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy';
  copyBtn.className = 'opencode-btn opencode-error-copy';
  copyBtn.addEventListener('click', () => {
    const fullText = [errorInfo?.message, pre.textContent].filter(Boolean).join('\n');
    navigator.clipboard.writeText(fullText);
  });
  buttonRow.appendChild(copyBtn);

  wrapper.appendChild(buttonRow);

  return wrapper;
}
