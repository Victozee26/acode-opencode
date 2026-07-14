import { StateContext } from '../types';
import { SPINNER_DEG_PER_SEC } from '../config';

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
 * The spinner rotates via `requestAnimationFrame` and advances by
 * `SPINNER_DEG_PER_SEC * dt` each tick using wall-clock delta time, so the
 * visual speed stays constant and animation is GPU-friendly. Uses a
 * conic-gradient arc ring cut with a CSS mask for a modern borderless look.
 * Colors come from Acode CSS custom properties (`var(--x, fallback)`) so it
 * adapts to the active theme. The returned element carries a `.stop()` method
 * that cancels the animation frame; callers MUST invoke it when tearing down.
 */
export function createSpinner(statusText: string): HTMLElement & { stop: () => void } {
  const wrapper = createContainer('opencode-loading');

  const ring = document.createElement('div');
  ring.style.cssText = `
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: conic-gradient(from 0deg, #fff 0% 75%, transparent 75% 100%);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #fff calc(100% - 5px));
    mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #fff calc(100% - 5px));
  `;
  wrapper.appendChild(ring);

  const label = document.createElement('p');
  label.style.cssText = `
    margin-top: 20px;
    color: var(--text-color, #ccc);
    font-size: 14px;
    opacity: 0.9;
  `;
  label.textContent = statusText;
  wrapper.appendChild(label);

  let angle = 0;
  let lastTime = performance.now();
  let rafId: number;

  function tick(now: number) {
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    angle = (angle + SPINNER_DEG_PER_SEC * dt) % 360;
    ring.style.transform = `rotate(${angle}deg)`;
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  const stop = () => cancelAnimationFrame(rafId);
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
 * Build the header bar shown in the Ready state. Status display only — it must
 * NOT carry interactive controls. Acode owns/re-paints the `$page.header`
 * region and drops dynamically-appended event listeners, so the Restart action
 * lives in the body as a floating button (see `createRestartButton`) where our
 * DOM is fully under our control and reliably receives clicks.
 */
export function createHeaderBar(): HTMLElement {
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 8px 16px;
    background: var(--header-bg, #1a1a2e);
    border-bottom: 1px solid var(--border-color, #333);
    flex-shrink: 0;
  `;

  const leftGroup = document.createElement('div');
  leftGroup.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
  `;

  const statusDot = document.createElement('span');
  statusDot.style.cssText = `
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--success-color, #4caf50);
    box-shadow: 0 0 6px var(--success-color, #4caf50);
  `;
  leftGroup.appendChild(statusDot);

  const projectLabel = document.createElement('span');
  projectLabel.textContent = 'OpenCode';
  projectLabel.style.cssText = `
    font-size: 14px;
    font-weight: 600;
    color: var(--text-color, #ccc);
    letter-spacing: 0.3px;
  `;
  leftGroup.appendChild(projectLabel);
  header.appendChild(leftGroup);

  return header;
}

/**
 * Build the floating "Restart" button rendered in the body, overlaid on top of
 * the embedded OpenCode iframe. The body region is fully under our control (the
 * iframe there receives pointer events normally), so this button reliably
 * receives clicks — unlike `$page.header`, which Acode re-paints and strips of
 * our listeners. The overlay wrapper uses `pointer-events: none` so the iframe
 * underneath stays interactive everywhere except the button itself.
 */
export function createRestartButton(onRestart: () => void): HTMLElement {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 10;
    pointer-events: none;
  `;

  const restartBtn = document.createElement('button');
  restartBtn.textContent = 'Restart';
  restartBtn.className = 'opencode-btn';
  restartBtn.style.cssText = `
    pointer-events: auto;
    padding: 6px 16px;
    background: var(--primary-color, #06f);
    color: #fff;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  `;
  restartBtn.addEventListener('click', onRestart);
  overlay.appendChild(restartBtn);

  return overlay;
}

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
  icon.textContent = '\u26A0\uFE0F';
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


