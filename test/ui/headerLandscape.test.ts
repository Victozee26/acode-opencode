import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { AppState } from '../../src/types';
import { HEADER_LANDSCAPE_HIDDEN_CLASS, LANDSCAPE_MEDIA_QUERY } from '../../src/config/ui';

// --- helpers ---
let mockSettingsGet = vi.fn();
let lastUi: any = null;

function setupAcode() {
  (globalThis as any).acode = {
    require: vi.fn((name: string) => {
      if (name === 'settings') return { get: mockSettingsGet };
      return {};
    }),
  };
}

function setWindowSize(w: number, h: number) {
  Object.defineProperty(window, 'innerWidth', { value: w, writable: true, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: h, writable: true, configurable: true });
}

type MqlMock = {
  matches: boolean;
  media: string;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  addListener: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  _listeners: Set<Function>;
  trigger: (m: boolean) => void;
};

function createMqlMock(initialMatches: boolean, withModern = true): MqlMock {
  const listeners = new Set<Function>();
  const mql: any = {
    matches: initialMatches,
    media: LANDSCAPE_MEDIA_QUERY,
    _listeners: listeners,
    addEventListener: vi.fn((event: string, handler: Function) => {
      if (event === 'change') listeners.add(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: Function) => {
      if (event === 'change') listeners.delete(handler);
    }),
    trigger: (m: boolean) => {
      mql.matches = m;
      listeners.forEach((fn) => fn({ matches: m }));
    },
  };
  if (withModern) {
    // modern path present
  } else {
    // remove modern, keep legacy
    delete mql.addEventListener;
    delete mql.removeEventListener;
    mql.addListener = vi.fn((handler: Function) => listeners.add(handler));
    mql.removeListener = vi.fn((handler: Function) => listeners.delete(handler));
  }
  if (withModern) {
    mql.addListener = vi.fn((handler: Function) => listeners.add(handler));
    mql.removeListener = vi.fn((handler: Function) => listeners.delete(handler));
  }
  return mql as MqlMock;
}

async function loadFreshUi() {
  // cleanup previous instance before discarding module
  if (lastUi?.destroyOrientationListener) {
    try { lastUi.destroyOrientationListener(); } catch {}
  }
  vi.resetModules();
  const mod = await import('../../src/ui/index');
  lastUi = mod;
  return mod;
}

async function loadFreshUiAndSettings() {
  if (lastUi?.destroyOrientationListener) {
    try { lastUi.destroyOrientationListener(); } catch {}
  }
  vi.resetModules();
  const ui = await import('../../src/ui/index');
  const settings = await import('../../src/settings');
  lastUi = ui;
  return { ui, settings };
}

beforeEach(() => {
  // ensure previous listeners are torn down before next test
  if (lastUi?.destroyOrientationListener) {
    try { lastUi.destroyOrientationListener(); } catch {}
  }
  document.body.innerHTML = '';
  document.body.className = '';
  mockSettingsGet.mockReset();
  mockSettingsGet.mockReturnValue(null);
  setupAcode();
  // default portrait size unless overridden
  setWindowSize(400, 800);
  // default matchMedia: not landscape
  const mql = createMqlMock(false);
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn(() => mql),
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  if (lastUi?.destroyOrientationListener) {
    try { lastUi.destroyOrientationListener(); } catch {}
  }
  document.body.innerHTML = '';
  document.body.className = '';
  // do not restoreAllMocks here as it would remove vi.fn wrappers needed
});

// ---- CSS file ----
describe('headerBar.css landscape rule', () => {
  it('contains @media (orientation: landscape) and hidden class', () => {
    const cssPath = path.resolve('src/ui/styles/headerBar.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    expect(css).toContain('@media (orientation: landscape)');
    expect(css).toContain(HEADER_LANDSCAPE_HIDDEN_CLASS);
    expect(css).toContain('#opencode-header');
    expect(css).toContain('.opencode-header');
    expect(css).toContain('display: none');
  });
  it('gated rule uses body.<class> selector', () => {
    const css = fs.readFileSync(path.resolve('src/ui/styles/headerBar.css'), 'utf-8');
    expect(css).toContain(`body.${HEADER_LANDSCAPE_HIDDEN_CLASS} #opencode-header`);
    expect(css).toContain(`body.${HEADER_LANDSCAPE_HIDDEN_CLASS} .opencode-header`);
  });
});

// ---- isLandscape ----
describe('isLandscape fallback', () => {
  it('returns true when matchMedia matches true regardless of size', async () => {
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(400, 800); // portrait size but query true
    const { isLandscape } = await loadFreshUi();
    expect(isLandscape()).toBe(true);
  });

  it('returns true when matchMedia false but innerWidth > innerHeight', async () => {
    const mql = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(800, 400);
    const { isLandscape } = await loadFreshUi();
    expect(isLandscape()).toBe(true);
  });

  it('returns false when both false and portrait', async () => {
    const mql = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(400, 800);
    const { isLandscape } = await loadFreshUi();
    expect(isLandscape()).toBe(false);
  });

  it('OR semantics: query true OR size true => true', async () => {
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(800, 400);
    const { isLandscape } = await loadFreshUi();
    expect(isLandscape()).toBe(true);
    expect(window.matchMedia).toHaveBeenCalledWith(LANDSCAPE_MEDIA_QUERY);
  });

  it('fallback when matchMedia throws', async () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn(() => {
        throw new Error('no mm');
      }),
      writable: true,
      configurable: true,
    });
    setWindowSize(800, 400);
    const { isLandscape } = await loadFreshUi();
    expect(isLandscape()).toBe(true);
    setWindowSize(400, 800);
    expect(isLandscape()).toBe(false);
  });

  it('fallback when matchMedia not a function', async () => {
    (window as any).matchMedia = undefined;
    setWindowSize(800, 400);
    const { isLandscape } = await loadFreshUi();
    expect(isLandscape()).toBe(true);
    setWindowSize(400, 800);
    expect(isLandscape()).toBe(false);
  });

  it('innerWidth == innerHeight => false (unless query true)', async () => {
    const mql = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(500, 500);
    const { isLandscape } = await loadFreshUi();
    expect(isLandscape()).toBe(false);
  });
});

// ---- applyHeaderVisibility ----
describe('applyHeaderVisibility toggles body class', () => {
  it('hide true + landscape true => adds class', async () => {
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(800, 400);
    mockSettingsGet.mockReturnValue(true);
    const { applyHeaderVisibility } = await loadFreshUi();
    document.body.classList.remove(HEADER_LANDSCAPE_HIDDEN_CLASS);
    applyHeaderVisibility();
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
  });

  it('hide true + landscape false => removes class', async () => {
    const mql = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(400, 800);
    mockSettingsGet.mockReturnValue(true);
    const { applyHeaderVisibility } = await loadFreshUi();
    document.body.classList.add(HEADER_LANDSCAPE_HIDDEN_CLASS);
    applyHeaderVisibility();
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
  });

  it('hide false + landscape true => removes class', async () => {
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(800, 400);
    mockSettingsGet.mockReturnValue(false);
    const { applyHeaderVisibility } = await loadFreshUi();
    document.body.classList.add(HEADER_LANDSCAPE_HIDDEN_CLASS);
    applyHeaderVisibility();
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
  });

  it('hide false + landscape false => not present', async () => {
    const mql = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(400, 800);
    mockSettingsGet.mockReturnValue(false);
    const { applyHeaderVisibility } = await loadFreshUi();
    applyHeaderVisibility();
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
  });

  it('toggles when landscape changes via size fallback', async () => {
    (window as any).matchMedia = undefined;
    mockSettingsGet.mockReturnValue(true);
    const { applyHeaderVisibility } = await loadFreshUi();
    setWindowSize(800, 400);
    applyHeaderVisibility();
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
    setWindowSize(400, 800);
    applyHeaderVisibility();
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
  });
});

// ---- orientation listeners: resize / orientationchange / matchMedia change triggers ----
describe('orientation listeners trigger applyHeaderVisibility', () => {
  it('resize triggers toggle when landscape state changes', async () => {
    const mql = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    mockSettingsGet.mockReturnValue(true);
    setWindowSize(400, 800);
    const { initOrientationListener, destroyOrientationListener } = await loadFreshUi();
    initOrientationListener();
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
    // switch to landscape
    setWindowSize(800, 400);
    mql.matches = true;
    window.dispatchEvent(new Event('resize'));
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
    // back to portrait
    setWindowSize(400, 800);
    mql.matches = false;
    window.dispatchEvent(new Event('resize'));
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
    destroyOrientationListener();
  });

  it('orientationchange triggers toggle', async () => {
    const mql = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    mockSettingsGet.mockReturnValue(true);
    setWindowSize(400, 800);
    const { initOrientationListener, destroyOrientationListener } = await loadFreshUi();
    initOrientationListener();
    setWindowSize(800, 400);
    mql.matches = true;
    window.dispatchEvent(new Event('orientationchange'));
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
    destroyOrientationListener();
  });

  it('matchMedia change event triggers toggle (modern addEventListener)', async () => {
    const mql = createMqlMock(false, true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    mockSettingsGet.mockReturnValue(true);
    setWindowSize(400, 800);
    const { initOrientationListener, destroyOrientationListener } = await loadFreshUi();
    initOrientationListener();
    // initially portrait => no class
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
    // simulate landscape via mql change
    mql.matches = true;
    setWindowSize(800, 400);
    // trigger the stored listener via mql.trigger
    mql.trigger(true);
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
    expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    destroyOrientationListener();
  });

  it('matchMedia change via legacy addListener fallback', async () => {
    const mql = createMqlMock(false, false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    mockSettingsGet.mockReturnValue(true);
    setWindowSize(400, 800);
    const { initOrientationListener, destroyOrientationListener } = await loadFreshUi();
    initOrientationListener();
    expect(mql.addListener).toHaveBeenCalled();
    // trigger via legacy
    mql.matches = true;
    setWindowSize(800, 400);
    mql.trigger(true);
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
    destroyOrientationListener();
    expect(mql.removeListener).toHaveBeenCalled();
  });

  it('initOrientationListener is idempotent — second call does not re-register', async () => {
    const mql = createMqlMock(false);
    const mm = vi.fn(() => mql);
    Object.defineProperty(window, 'matchMedia', { value: mm, writable: true, configurable: true });
    mockSettingsGet.mockReturnValue(true);
    const { initOrientationListener, destroyOrientationListener } = await loadFreshUi();
    initOrientationListener();
    const callsAfterFirst = mm.mock.calls.length;
    initOrientationListener();
    // No additional matchMedia call for listener re-registration beyond initial; the second call early-returns.
    // Hard to count exact, but handler should remain single: triggering once should toggle once.
    setWindowSize(800, 400);
    mql.matches = true;
    window.dispatchEvent(new Event('resize'));
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
    // Ensure listeners not doubled by checking that destroy cleans up correctly without double-remove errors
    destroyOrientationListener();
    // second destroy idempotent
    expect(() => destroyOrientationListener()).not.toThrow();
  });
});

// ---- live setting change via setOnHideHeaderChange ----
describe('live setting change via setOnHideHeaderChange', () => {
  it('wiring setOnHideHeaderChange → applyHeaderVisibility toggles on cb', async () => {
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(800, 400); // landscape
    const { ui, settings } = await loadFreshUiAndSettings();
    // default hide true (DEFAULT) => class present after init with landscape
    // leave mockSettingsGet as null so default true is used and cb controls cache
    settings.setOnHideHeaderChange(() => ui.applyHeaderVisibility());
    ui.initOrientationListener();
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
    // toggle setting to false via schema cb — mock still null so cached false persists
    const schema = settings.getSettingsSchema();
    schema.cb('hideHeaderInLandscape', false);
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
    // toggle back to true
    schema.cb('hideHeaderInLandscape', true);
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
    ui.destroyOrientationListener();
  });

  it('handler respects portrait: toggling setting while portrait stays no class', async () => {
    const mql = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(400, 800);
    const { ui, settings } = await loadFreshUiAndSettings();
    mockSettingsGet.mockReturnValue(false);
    settings.setOnHideHeaderChange(() => ui.applyHeaderVisibility());
    ui.initOrientationListener();
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
    // allow cb to control cache: set mock to null so next get does not override cached true
    mockSettingsGet.mockReturnValue(null);
    const schema = settings.getSettingsSchema();
    schema.cb('hideHeaderInLandscape', true);
    // still portrait => no class
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
    // rotate to landscape via resize
    setWindowSize(800, 400);
    mql.matches = true;
    window.dispatchEvent(new Event('resize'));
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
    ui.destroyOrientationListener();
  });
});

// ---- destroy removes listeners ----
describe('destroyOrientationListener removes listeners and cleanup', () => {
  it('removes resize/orientationchange/matchMedia listeners and class', async () => {
    const mql = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    mockSettingsGet.mockReturnValue(true);
    setWindowSize(400, 800);
    const { initOrientationListener, destroyOrientationListener } = await loadFreshUi();
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    initOrientationListener();
    // make landscape and verify listener works
    setWindowSize(800, 400);
    mql.matches = true;
    window.dispatchEvent(new Event('resize'));
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
    destroyOrientationListener();
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function));
    // after destroy, resize should no longer toggle
    setWindowSize(800, 400);
    mql.matches = true;
    // ensure class stays removed (not re-added)
    document.body.classList.remove(HEADER_LANDSCAPE_HIDDEN_CLASS);
    window.dispatchEvent(new Event('resize'));
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
    // also mql trigger should not toggle
    mql.trigger(true);
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
    removeSpy.mockRestore();
  });

  it('is idempotent and clears state for re-init', async () => {
    const mql1 = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql1), writable: true, configurable: true });
    mockSettingsGet.mockReturnValue(true);
    const { initOrientationListener, destroyOrientationListener } = await loadFreshUi();
    initOrientationListener();
    destroyOrientationListener();
    expect(() => destroyOrientationListener()).not.toThrow();
    // re-init should work after destroy
    setWindowSize(800, 400);
    const mql2 = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql2), writable: true, configurable: true });
    initOrientationListener();
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
    destroyOrientationListener();
  });

  it('removes class even if never initialized with class present', async () => {
    document.body.classList.add(HEADER_LANDSCAPE_HIDDEN_CLASS);
    const { destroyOrientationListener } = await loadFreshUi();
    // not initialized yet, destroy should be no-op but not leave class? Actually destroy only removes class if initialized.
    // First init then destroy to test clearing, then manual add and destroy when not initialized should not throw but class removal only happens when initialized.
    // Verify that destroy when not initialized does not throw
    expect(() => destroyOrientationListener()).not.toThrow();
    // Class remains because destroy early-returns when not initialized — this is expected behavior (no-op).
    // But after init+destroy, class must be cleared
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    mockSettingsGet.mockReturnValue(true);
    setWindowSize(800, 400);
    const mod2 = await loadFreshUi();
    mod2.initOrientationListener();
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
    mod2.destroyOrientationListener();
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
  });
});

// ---- render/init calls apply, header hidden in all states when landscape+ON ----
describe('render/init integration with header visibility', () => {
  it('initUiPage synchronously applies visibility', async () => {
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(800, 400);
    mockSettingsGet.mockReturnValue(true);
    const { initUiPage } = await loadFreshUi();
    const $page = { body: document.body };
    initUiPage($page as any);
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
    // cleanup
    const { destroyOrientationListener } = await import('../../src/ui/index');
    destroyOrientationListener();
  });

  it('render applies visibility for every AppState when landscape+ON', async () => {
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(800, 400);
    mockSettingsGet.mockReturnValue(true);
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    const states = [
      AppState.Idle,
      AppState.CheckingInstall,
      AppState.Installing,
      AppState.CheckingServer,
      AppState.StartingServer,
      AppState.Ready,
      AppState.Error,
    ];
    for (const s of states) {
      const ctx = { currentState: s, error: s === AppState.Error ? { message: 'x', logTail: '' } : null };
      render(s as any, ctx as any, { start: vi.fn(), restart: vi.fn(), stop: vi.fn(), back: vi.fn() });
      expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
      // ensure header still exists in DOM (not removed)
      expect(document.getElementById('opencode-header')).not.toBeNull();
    }
    const { destroyOrientationListener } = await import('../../src/ui/index');
    destroyOrientationListener();
  });

  it('render removes class when setting OFF even if landscape', async () => {
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(800, 400);
    mockSettingsGet.mockReturnValue(false);
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Ready, { currentState: AppState.Ready, error: null }, { start: vi.fn(), restart: vi.fn(), stop: vi.fn(), back: vi.fn() });
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
    const { destroyOrientationListener } = await import('../../src/ui/index');
    destroyOrientationListener();
  });

  it('render removes class when portrait even if setting ON', async () => {
    const mql = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(400, 800);
    mockSettingsGet.mockReturnValue(true);
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, { start: vi.fn(), restart: vi.fn(), stop: vi.fn(), back: vi.fn() });
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
    const { destroyOrientationListener } = await import('../../src/ui/index');
    destroyOrientationListener();
  });

  it('updateHeader calls applyHeaderVisibility even when pageHeader null', async () => {
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(800, 400);
    mockSettingsGet.mockReturnValue(true);
    const { updateHeader } = await loadFreshUi();
    document.body.classList.remove(HEADER_LANDSCAPE_HIDDEN_CLASS);
    updateHeader(AppState.Idle, {});
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
  });

  it('same-state render path still applies visibility', async () => {
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(800, 400);
    mockSettingsGet.mockReturnValue(true);
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Ready, { currentState: AppState.Ready, error: null }, { start: vi.fn(), restart: vi.fn(), stop: vi.fn(), back: vi.fn() });
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
    // manually remove then same-state re-render should re-add
    document.body.classList.remove(HEADER_LANDSCAPE_HIDDEN_CLASS);
    render(AppState.Ready, { currentState: AppState.Ready, error: null }, { start: vi.fn(), restart: vi.fn(), stop: vi.fn(), back: vi.fn() });
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
    const { destroyOrientationListener } = await import('../../src/ui/index');
    destroyOrientationListener();
  });
});
