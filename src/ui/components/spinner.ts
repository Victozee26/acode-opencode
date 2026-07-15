import { SPINNER_DEG_PER_SEC } from '../../config/ui';
import { createContainer } from './container';

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
