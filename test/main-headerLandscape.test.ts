import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HEADER_LANDSCAPE_HIDDEN_CLASS, LANDSCAPE_MEDIA_QUERY } from '../src/config/ui';

function setWindowSize(w: number, h: number) {
  Object.defineProperty(window, 'innerWidth', { value: w, writable: true, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: h, writable: true, configurable: true });
}

type MqlMock = {
  matches: boolean;
  media: string;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  _listeners: Set<Function>;
  trigger: (m: boolean) => void;
};

function createMqlMock(initialMatches: boolean): MqlMock {
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
    addListener: vi.fn((handler: Function) => listeners.add(handler)),
    removeListener: vi.fn((handler: Function) => listeners.delete(handler)),
    trigger: (m: boolean) => {
      mql.matches = m;
      listeners.forEach((fn) => fn({ matches: m }));
    },
  };
  return mql as MqlMock;
}

describe('AcodePlugin landscape wiring', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.className = '';
    setWindowSize(400, 800);
    const mql = createMqlMock(false);
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn(() => mql),
      writable: true,
      configurable: true,
    });
    (globalThis as any).acode = {
      addIcon: vi.fn(),
      setPluginInit: vi.fn(),
      setPluginUnmount: vi.fn(),
      require: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ show: vi.fn(), hide: vi.fn() })),
    };
    (window as any).acode = (globalThis as any).acode;
  });

  it('should_hide_header_when_landscape_and_setting_on_after_init', async () => {
    // Arrange
    const acodeMock = {
      addIcon: vi.fn(),
      setPluginInit: vi.fn(),
      setPluginUnmount: vi.fn(),
      require: vi.fn(),
    };
    (globalThis as any).acode = acodeMock;
    (window as any).acode = acodeMock;
    vi.resetModules();
    const mockSettingsGet = vi.fn().mockReturnValue(true);
    acodeMock.require = vi.fn((name: string) => {
      if (name === 'settings') return { get: mockSettingsGet, value: {}, update: vi.fn(() => Promise.resolve()) };
      return vi.fn().mockReturnValue({ show: vi.fn(), hide: vi.fn() });
    });
    (globalThis as any).acode = acodeMock;
    (window as any).acode = acodeMock;
    const { AcodePlugin } = await import('../src/main');
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(800, 400);
    const plugin = new AcodePlugin();
    const page: any = {
      on: vi.fn(),
      off: vi.fn(),
      hide: vi.fn(),
      show: vi.fn(),
      settitle: vi.fn(),
      appendChild: vi.fn(),
      body: document.body,
      header: { innerHTML: '', style: {} as any },
      style: {} as any,
    };

    // Act
    await plugin.init('https://base/', page, {} as any, '', null as any);
    const hasClass = document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS);

    // Assert
    expect(hasClass).toBe(true);
    await plugin.destroy();
  });

  it('should_remove_class_when_destroy_called_after_landscape', async () => {
    // Arrange
    const acodeMock = {
      addIcon: vi.fn(),
      setPluginInit: vi.fn(),
      setPluginUnmount: vi.fn(),
      require: vi.fn(),
    };
    (globalThis as any).acode = acodeMock;
    (window as any).acode = acodeMock;
    vi.resetModules();
    const mockSettingsGet = vi.fn().mockReturnValue(true);
    acodeMock.require = vi.fn((name: string) => {
      if (name === 'settings') return { get: mockSettingsGet, value: {}, update: vi.fn(() => Promise.resolve()) };
      return vi.fn().mockReturnValue({ show: vi.fn(), hide: vi.fn() });
    });
    (globalThis as any).acode = acodeMock;
    (window as any).acode = acodeMock;
    const { AcodePlugin } = await import('../src/main');
    const mql = createMqlMock(true);
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => mql), writable: true, configurable: true });
    setWindowSize(800, 400);
    const plugin = new AcodePlugin();
    const page: any = {
      on: vi.fn(),
      off: vi.fn(),
      hide: vi.fn(),
      show: vi.fn(),
      settitle: vi.fn(),
      appendChild: vi.fn(),
      body: document.body,
      header: { innerHTML: '', style: {} as any },
      style: {} as any,
    };
    await plugin.init('https://base/', page, {} as any, '', null as any);

    // Act
    await plugin.destroy();
    const hasClass = document.body.classList.contains(HEADER_LANDSCAPE_HIDDEN_CLASS);

    // Assert
    expect(hasClass).toBe(false);
  });

  it('should_not_throw_when_destroy_called_twice', async () => {
    // Arrange
    const acodeMock = {
      addIcon: vi.fn(),
      setPluginInit: vi.fn(),
      setPluginUnmount: vi.fn(),
      require: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ show: vi.fn(), hide: vi.fn() })),
    };
    (globalThis as any).acode = acodeMock;
    (window as any).acode = acodeMock;
    vi.resetModules();
    const { AcodePlugin } = await import('../src/main');
    const plugin = new AcodePlugin();
    const page: any = {
      on: vi.fn(),
      off: vi.fn(),
      hide: vi.fn(),
      show: vi.fn(),
      settitle: vi.fn(),
      appendChild: vi.fn(),
      body: document.body,
      header: { innerHTML: '', style: {} as any },
      style: {} as any,
    };
    await plugin.init('https://base/', page, {} as any, '', null as any);
    await plugin.destroy();

    // Act
    const act = async (): Promise<void> => {
      await plugin.destroy();
    };

    // Assert
    await expect(act()).resolves.toBeUndefined();
  });
});
