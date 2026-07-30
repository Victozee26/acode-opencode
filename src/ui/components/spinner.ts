import { SPINNER_DEG_PER_SEC } from '../../config/ui';
import { createContainer } from './container';

/**
 * Spinner element type: the container plus lifecycle methods.
 * `stop()` cancels the animation frame; `setProgressText()` shows/hides a
 * monospace progress line below the status label for real-time command output.
 */
export type SpinnerElement = HTMLElement & {
  stop: () => void;
  setProgressText: (text: string) => void;
};

/**
 * Build the loading view: a JS-animated spinner plus a status line.
 *
 * The spinner rotates via `requestAnimationFrame` and advances by
 * `SPINNER_DEG_PER_SEC * dt` each tick using wall-clock delta time, so the
 * visual speed stays constant and animation is GPU-friendly. Uses a
 * conic-gradient arc ring cut with a CSS mask for a modern borderless look.
 * Colors come from Acode CSS custom properties (`var(--x, fallback)`) so it
 * adapts to the active theme.
 *
 * A hidden progress label sits below the status text — call `setProgressText()`
 * to display live command output (e.g. npm install progress). Passing an empty
 * string hides the label again.
 */
export function createSpinner(statusText: string): SpinnerElement {
  const wrapper = createContainer('opencode-loading');

  const ring = document.createElement('div');
  ring.className = 'opencode-spinner-ring';
  wrapper.appendChild(ring);

  const label = document.createElement('p');
  label.className = 'opencode-spinner-label';
  label.textContent = statusText;
  wrapper.appendChild(label);

  const progressLabel = document.createElement('p');
  progressLabel.className = 'opencode-spinner-progress';
  progressLabel.style.visibility = 'hidden';
  wrapper.appendChild(progressLabel);

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
  const setProgressText = (text: string) => {
    progressLabel.textContent = text;
    progressLabel.style.visibility = text ? 'visible' : 'hidden';
  };

  (wrapper as any).stop = stop;
  (wrapper as any).setProgressText = setProgressText;

  return wrapper as SpinnerElement;
}
