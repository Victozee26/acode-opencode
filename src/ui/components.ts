import { StateContext } from '../types';
import { SPINNER_DEG_PER_SEC, SPINNER_FPS } from '../config';

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

/**
 * Build the loading view: a JS-animated spinner plus a status line.
 *
 * The spinner rotates via `setInterval` at `SPINNER_FPS` and advances by
 * `SPINNER_DEG_PER_SEC * dt` each tick using wall-clock delta time, so the
 * visual speed stays constant even when frames are late or inconsistent.
 * Colors come from Acode CSS custom properties (`var(--x, fallback)`) so it
 * adapts to the active theme. The returned element carries a `.stop()` method
 * that clears the interval; callers MUST invoke it when tearing down the view.
 */
export function createSpinner(statusText: string): HTMLElement & { stop: () => void } {
  const wrapper = createContainer('opencode-loading');

  const spinner = document.createElement('div');
  spinner.style.cssText = `
    width: 40px;
    height: 40px;
    border: 4px solid var(--border-color, #333);
    border-top-color: var(--primary-color, #06f);
    border-radius: 50%;
  `;
  wrapper.appendChild(spinner);

  const label = document.createElement('p');
  label.style.cssText = `margin-top: 16px; color: var(--text-color, #ccc);`;
  label.textContent = statusText;
  wrapper.appendChild(label);

  let angle = 0;
  let lastTime = performance.now();
  const intervalMs = 1000 / SPINNER_FPS;

  const intervalId = setInterval(() => {
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    angle = (angle + SPINNER_DEG_PER_SEC * dt) % 360;
    spinner.style.transform = `rotate(${angle}deg)`;
  }, intervalMs);

  const stop = () => clearInterval(intervalId);
  (wrapper as any).stop = stop;

  return wrapper as HTMLElement & { stop: () => void };
}

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

/**
 * Build the header bar shown in the Ready state, with a "Restart" button wired
 * to `onRestart`. The button handler is attached via `addEventListener` (never
 * an inline `onclick` attribute) so the callback closure is safe from injection.
 */
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

/**
 * Build the error view from the current `StateContext`. Always renders a Retry
 * button (so the user can recover from any error) and conditionally renders a
 * scrollable diagnostics `<pre>` log tail when `context.error.logTail` exists.
 * The `message` heading uses `white-space: pre-wrap` so multi-line summaries
 * stay legible; both dynamic strings pass through `escapeHtml`.
 */
export function createErrorDisplay(context: StateContext, onRetry: () => void): HTMLElement {
  const wrapper = createContainer('opencode-error');
  const errorInfo = context.error;

  wrapper.innerHTML = `
    <h3 style="color: var(--error-color, #f44); margin-bottom: 12px; white-space: pre-wrap;">
      ${escapeHtml(errorInfo?.message ?? 'An unknown error occurred')}
    </h3>
  `;

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
      margin: 0 0 16px 0;
    `;
    pre.textContent = errorInfo.logTail;
    wrapper.appendChild(pre);
  }

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

  return wrapper;
}

/**
 * Escape a string for safe interpolation into `innerHTML`. Prevents HTML
 * injection of external/error strings (which may contain `<`, `&`, quotes,
 * etc.) by replacing them with entity references. Use this before any string
 * is placed inside markup.
 */
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
