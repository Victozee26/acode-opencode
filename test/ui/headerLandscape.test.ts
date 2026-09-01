import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppState } from '../../src/types';
import { HEADER_LANDSCAPE_HIDDEN_CLASS, LANDSCAPE_MEDIA_QUERY } from '../../src/config/ui';

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
  if (!withModern) {
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
  if (lastUi?.destroyOrientationListener) {
    try { lastUi.destroyOrientationListener(); } catch {}
  }
  document.body.innerHTML = '';
  document.body.className = '';
  mockSettingsGet.mockReset();
  mockSettingsGet.mockReturnValue(null);
  setupAcode();
  setWindowSize(400, 800);
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
});

describe('isLandscape fallback', () => {
  it('should_return_true_when_matchMedia_matches', async () => {
    // Arrange
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(400, 800);
    const { isLandscape } = await loadFreshUi();

    // Act
    const result = isLandscape();

    // Assert
    expect(result).toBe(true);
  });

  it('should_return_true_when_width_greater_than_height', async () => {
    // Arrange
    const mql = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(800, 400);
    const { isLandscape } = await loadFreshUi();

    // Act
    const result = isLandscape();

    // Assert
    expect(result).toBe(true);
  });

  it('should_return_false_when_portrait_and_query_false', async () => {
    // Arrange
    const mql = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(400, 800);
    const { isLandscape } = await loadFreshUi();

    // Act
    const result = isLandscape();

    // Assert
    expect(result).toBe(false);
  });

  it('should_return_true_when_query_true_even_with_portrait_size', async () => {
    // Arrange
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(400, 800);
    const { isLandscape } = await loadFreshUi();

    // Act
    const result = isLandscape();

    // Assert
    expect(result).toBe(true);
  });

  it('should_fallback_to_size_when_matchMedia_throws', async () => {
    // Arrange
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn(() => {
        throw new Error('no mm');
      }),
      writable: true,
      configurable: true,
    });
    setWindowSize(800, 400);
    const { isLandscape } = await loadFreshUi();

    // Act
    const result = isLandscape();

    // Assert
    expect(result).toBe(true);
  });

  it('should_return_false_when_matchMedia_throws_and_portrait', async () => {
    // Arrange
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn(() => {
        throw new Error('no mm');
      }),
      writable: true,
      configurable: true,
    });
    setWindowSize(400, 800);
    const { isLandscape } = await loadFreshUi();

    // Act
    const result = isLandscape();

    // Assert
    expect(result).toBe(false);
  });

  it('should_fallback_when_matchMedia_undefined_and_landscape', async () => {
    // Arrange
    (window as any).matchMedia = undefined;
    setWindowSize(800, 400);
    const { isLandscape } = await loadFreshUi();

    // Act
    const result = isLandscape();

    // Assert
    expect(result).toBe(true);
  });

  it('should_return_false_when_square_and_query_false', async () => {
    // Arrange
    const mql = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(500, 500);
    const { isLandscape } = await loadFreshUi();

    // Act
    const result = isLandscape();

    // Assert
    expect(result).toBe(false);
  });
});

describe('applyHeaderVisibility toggles body class', () => {
  it('should_add_class_when_hide_true_and_landscape', async () => {
    // Arrange
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(800, 400);
    mockSettingsGet.mockReturnValue(true);
    const { applyHeaderVisibility } = await loadFreshUi();
    document.body.classList.remove(HEADER_LANDSCAPE_HIDDEN_CLASS);

    // Act
    applyHeaderVisibility();

    // Assert
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
  });

  it('should_remove_class_when_hide_true_and_portrait', async () => {
    // Arrange
    const mql = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(400, 800);
    mockSettingsGet.mockReturnValue(true);
    const { applyHeaderVisibility } = await loadFreshUi();
    document.body.classList.add(HEADER_LANDSCAPE_HIDDEN_CLASS);

    // Act
    applyHeaderVisibility();

    // Assert
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
  });

  it('should_remove_class_when_hide_false_and_landscape', async () => {
    // Arrange
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(800, 400);
    mockSettingsGet.mockReturnValue(false);
    const { applyHeaderVisibility } = await loadFreshUi();
    document.body.classList.add(HEADER_LANDSCAPE_HIDDEN_CLASS);

    // Act
    applyHeaderVisibility();

    // Assert
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
  });

  it('should_not_have_class_when_hide_false_and_portrait', async () => {
    // Arrange
    const mql = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(400, 800);
    mockSettingsGet.mockReturnValue(false);
    const { applyHeaderVisibility } = await loadFreshUi();

    // Act
    applyHeaderVisibility();

    // Assert
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
  });

  it('should_toggle_with_size_fallback_when_matchMedia_undefined', async () => {
    // Arrange
    (window as any).matchMedia = undefined;
    mockSettingsGet.mockReturnValue(true);
    const { applyHeaderVisibility } = await loadFreshUi();
    setWindowSize(800, 400);

    // Act
    applyHeaderVisibility();

    // Assert
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
  });
});

describe('orientation listeners trigger applyHeaderVisibility', () => {
  it('should_add_class_when_resize_to_landscape', async () => {
    // Arrange
    const mql = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    mockSettingsGet.mockReturnValue(true);
    setWindowSize(400, 800);
    const { initOrientationListener, destroyOrientationListener } = await loadFreshUi();
    initOrientationListener();
    setWindowSize(800, 400);
    mql.matches = true;

    // Act
    window.dispatchEvent(new Event('resize'));
    const hasClass = document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS);

    // Assert
    expect(hasClass).toBe(true);
    destroyOrientationListener();
  });

  it('should_remove_class_when_resize_to_portrait', async () => {
    // Arrange
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    mockSettingsGet.mockReturnValue(true);
    setWindowSize(800, 400);
    const { initOrientationListener, destroyOrientationListener } = await loadFreshUi();
    initOrientationListener();
    setWindowSize(400, 800);
    mql.matches = false;

    // Act
    window.dispatchEvent(new Event('resize'));
    const hasClass = document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS);

    // Assert
    expect(hasClass).toBe(false);
    destroyOrientationListener();
  });

  it('should_toggle_when_orientationchange_fires', async () => {
    // Arrange
    const mql = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    mockSettingsGet.mockReturnValue(true);
    setWindowSize(400, 800);
    const { initOrientationListener, destroyOrientationListener } = await loadFreshUi();
    initOrientationListener();
    setWindowSize(800, 400);
    mql.matches = true;

    // Act
    window.dispatchEvent(new Event('orientationchange'));

    // Assert
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
    destroyOrientationListener();
  });

  it('should_toggle_when_matchMedia_change_fires_modern', async () => {
    // Arrange
    const mql = createMqlMock(false, true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    mockSettingsGet.mockReturnValue(true);
    setWindowSize(400, 800);
    const { initOrientationListener, destroyOrientationListener } = await loadFreshUi();
    initOrientationListener();

    // Act
    mql.matches = true;
    setWindowSize(800, 400);
    mql.trigger(true);

    // Assert
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
    destroyOrientationListener();
  });

  it('should_toggle_when_matchMedia_change_fires_legacy', async () => {
    // Arrange
    const mql = createMqlMock(false, false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    mockSettingsGet.mockReturnValue(true);
    setWindowSize(400, 800);
    const { initOrientationListener, destroyOrientationListener } = await loadFreshUi();
    initOrientationListener();

    // Act
    mql.matches = true;
    setWindowSize(800, 400);
    mql.trigger(true);

    // Assert
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
    destroyOrientationListener();
  });

  it('should_stay_idempotent_when_init_called_twice', async () => {
    // Arrange
    const mql = createMqlMock(false);
    const mm = vi.fn(() => mql);
    Object.defineProperty(window, 'matchMedia', { value: mm, writable: true, configurable: true });
    mockSettingsGet.mockReturnValue(true);
    const { initOrientationListener, destroyOrientationListener } = await loadFreshUi();
    initOrientationListener();
    initOrientationListener();
    setWindowSize(800, 400);
    mql.matches = true;

    // Act
    window.dispatchEvent(new Event('resize'));

    // Assert
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
    destroyOrientationListener();
  });
});

describe('live setting change via setOnHideHeaderChange', () => {
  it('should_show_header_when_setting_toggled_false_in_landscape', async () => {
    // Arrange
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(800, 400);
    const { ui, settings } = await loadFreshUiAndSettings();
    settings.setOnHideHeaderChange(() => ui.applyHeaderVisibility());
    ui.initOrientationListener();

    // Act
    const schema = settings.getSettingsSchema();
    schema.cb('hideHeaderInLandscape', false);
    const hasClass = document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS);

    // Assert
    expect(hasClass).toBe(false);
    ui.destroyOrientationListener();
  });

  it('should_hide_header_when_setting_toggled_true_in_landscape', async () => {
    // Arrange
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(800, 400);
    const { ui, settings } = await loadFreshUiAndSettings();
    mockSettingsGet.mockReturnValue(null);
    settings.setOnHideHeaderChange(() => ui.applyHeaderVisibility());
    ui.initOrientationListener();
    document.body.classList.remove(HEADER_LANDSCAPE_HIDDEN_CLASS);
    const schema = settings.getSettingsSchema();
    // ensure cache starts false
    schema.cb('hideHeaderInLandscape', false);
    document.body.classList.remove(HEADER_LANDSCAPE_HIDDEN_CLASS);
    mockSettingsGet.mockReturnValue(null);

    // Act
    schema.cb('hideHeaderInLandscape', true);
    const hasClass = document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS);

    // Assert
    expect(hasClass).toBe(true);
    ui.destroyOrientationListener();
  });

  it('should_not_hide_when_setting_true_but_portrait', async () => {
    // Arrange
    const mql = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(400, 800);
    const { ui, settings } = await loadFreshUiAndSettings();
    mockSettingsGet.mockReturnValue(false);
    settings.setOnHideHeaderChange(() => ui.applyHeaderVisibility());
    ui.initOrientationListener();
    mockSettingsGet.mockReturnValue(null);
    const schema = settings.getSettingsSchema();

    // Act
    schema.cb('hideHeaderInLandscape', true);
    const hasClass = document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS);

    // Assert
    expect(hasClass).toBe(false);
    ui.destroyOrientationListener();
  });
});

describe('destroyOrientationListener removes listeners and cleanup', () => {
  it('should_remove_class_when_destroy_called_after_landscape', async () => {
    // Arrange
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    mockSettingsGet.mockReturnValue(true);
    setWindowSize(800, 400);
    const { initOrientationListener, destroyOrientationListener } = await loadFreshUi();
    initOrientationListener();

    // Act
    destroyOrientationListener();

    // Assert
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
  });

  it('should_not_toggle_when_resize_after_destroy', async () => {
    // Arrange
    const mql = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    mockSettingsGet.mockReturnValue(true);
    setWindowSize(400, 800);
    const { initOrientationListener, destroyOrientationListener } = await loadFreshUi();
    initOrientationListener();
    destroyOrientationListener();
    setWindowSize(800, 400);
    mql.matches = true;
    document.body.classList.remove(HEADER_LANDSCAPE_HIDDEN_CLASS);

    // Act
    window.dispatchEvent(new Event('resize'));

    // Assert
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
  });

  it('should_not_toggle_when_mql_change_after_destroy', async () => {
    // Arrange
    const mql = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    mockSettingsGet.mockReturnValue(true);
    setWindowSize(400, 800);
    const { initOrientationListener, destroyOrientationListener } = await loadFreshUi();
    initOrientationListener();
    destroyOrientationListener();
    document.body.classList.remove(HEADER_LANDSCAPE_HIDDEN_CLASS);

    // Act
    mql.trigger(true);

    // Assert
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
  });

  it('should_be_idempotent_when_destroy_called_twice', async () => {
    // Arrange
    const mql1 = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql1), writable: true, configurable: true });
    mockSettingsGet.mockReturnValue(true);
    const { initOrientationListener, destroyOrientationListener } = await loadFreshUi();
    initOrientationListener();
    destroyOrientationListener();

    // Act
    const act = (): void => destroyOrientationListener();

    // Assert
    expect(act).not.toThrow();
  });

  it('should_allow_reinit_after_destroy', async () => {
    // Arrange
    const mql1 = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql1), writable: true, configurable: true });
    mockSettingsGet.mockReturnValue(true);
    const { initOrientationListener, destroyOrientationListener } = await loadFreshUi();
    initOrientationListener();
    destroyOrientationListener();
    setWindowSize(800, 400);
    const mql2 = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql2), writable: true, configurable: true });

    // Act
    initOrientationListener();
    const hasClass = document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS);

    // Assert
    expect(hasClass).toBe(true);
    destroyOrientationListener();
  });
});

describe('render/init integration with header visibility', () => {
  it('should_apply_visibility_when_initUiPage_called', async () => {
    // Arrange
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(800, 400);
    mockSettingsGet.mockReturnValue(true);
    const { initUiPage } = await loadFreshUi();
    const $page = { body: document.body };

    // Act
    initUiPage($page as any);

    // Assert
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
    const { destroyOrientationListener } = await import('../../src/ui/index');
    destroyOrientationListener();
  });

  it('should_keep_header_hidden_when_render_Idle_in_landscape', async () => {
    // Arrange
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(800, 400);
    mockSettingsGet.mockReturnValue(true);
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);

    // Act
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, { start: vi.fn(), restart: vi.fn(), stop: vi.fn(), back: vi.fn() });

    // Assert
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
    const { destroyOrientationListener } = await import('../../src/ui/index');
    destroyOrientationListener();
  });

  it('should_keep_header_hidden_when_render_Ready_in_landscape', async () => {
    // Arrange
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(800, 400);
    mockSettingsGet.mockReturnValue(true);
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);

    // Act
    render(AppState.Ready, { currentState: AppState.Ready, error: null }, { start: vi.fn(), restart: vi.fn(), stop: vi.fn(), back: vi.fn() });

    // Assert
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
    const { destroyOrientationListener } = await import('../../src/ui/index');
    destroyOrientationListener();
  });

  it('should_remove_class_when_render_landscape_but_setting_off', async () => {
    // Arrange
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(800, 400);
    mockSettingsGet.mockReturnValue(false);
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);

    // Act
    render(AppState.Ready, { currentState: AppState.Ready, error: null }, { start: vi.fn(), restart: vi.fn(), stop: vi.fn(), back: vi.fn() });

    // Assert
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
    const { destroyOrientationListener } = await import('../../src/ui/index');
    destroyOrientationListener();
  });

  it('should_remove_class_when_render_portrait_even_if_setting_on', async () => {
    // Arrange
    const mql = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(400, 800);
    mockSettingsGet.mockReturnValue(true);
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);

    // Act
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, { start: vi.fn(), restart: vi.fn(), stop: vi.fn(), back: vi.fn() });

    // Assert
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(false);
    const { destroyOrientationListener } = await import('../../src/ui/index');
    destroyOrientationListener();
  });

  it('should_apply_visibility_even_when_updateHeader_pageHeader_null', async () => {
    // Arrange
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(800, 400);
    mockSettingsGet.mockReturnValue(true);
    const { updateHeader } = await loadFreshUi();
    document.body.classList.remove(HEADER_LANDSCAPE_HIDDEN_CLASS);

    // Act
    updateHeader(AppState.Idle, {});

    // Assert
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
  });

  it('should_reapply_after_manual_remove_and_same_state_render', async () => {
    // Arrange
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(800, 400);
    mockSettingsGet.mockReturnValue(true);
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Ready, { currentState: AppState.Ready, error: null }, { start: vi.fn(), restart: vi.fn(), stop: vi.fn(), back: vi.fn() });
    document.body.classList.remove(HEADER_LANDSCAPE_HIDDEN_CLASS);

    // Act
    render(AppState.Ready, { currentState: AppState.Ready, error: null }, { start: vi.fn(), restart: vi.fn(), stop: vi.fn(), back: vi.fn() });

    // Assert
    expect(document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS)).toBe(true);
    const { destroyOrientationListener } = await import('../../src/ui/index');
    destroyOrientationListener();
  });
});
