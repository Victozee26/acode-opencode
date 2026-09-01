import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSettingsSchema,
  getHideHeaderInLandscape,
  setOnHideHeaderChange,
  resetSettingsCache,
  getLogLevel,
} from '../src/settings';
import {
  SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE,
  DEFAULT_HIDE_HEADER_IN_LANDSCAPE,
  SETTINGS_KEY_LOG_LEVEL,
  DEFAULT_LOG_LEVEL,
} from '../src/config/settings';

vi.mock('../src/logger', async () => {
  const actual = await vi.importActual<typeof import('../src/logger')>('../src/logger');
  return { ...actual, setLogLevel: vi.fn() };
});

const mockSettingsGet = vi.fn();

function setupAcode(): void {
  (globalThis as any).acode = {
    require: vi.fn((name: string) => {
      if (name === 'settings') return { get: mockSettingsGet, value: {}, update: vi.fn(() => Promise.resolve()) };
      return {};
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetSettingsCache();
  setupAcode();
  mockSettingsGet.mockReturnValue(null);
  setOnHideHeaderChange(null as any);
});

describe('getHideHeaderInLandscape', () => {
  it('returns default true when settings returns null', () => {
    mockSettingsGet.mockReturnValue(null);
    expect(getHideHeaderInLandscape()).toBe(DEFAULT_HIDE_HEADER_IN_LANDSCAPE);
    expect(getHideHeaderInLandscape()).toBe(true);
  });

  it('returns true when stored as true', () => {
    mockSettingsGet.mockReturnValue(true);
    expect(getHideHeaderInLandscape()).toBe(true);
  });

  it('returns false when stored as false', () => {
    mockSettingsGet.mockReturnValue(false);
    expect(getHideHeaderInLandscape()).toBe(false);
  });

  it('returns true when stored as string "true"', () => {
    mockSettingsGet.mockReturnValue('true');
    expect(getHideHeaderInLandscape()).toBe(true);
  });

  it('returns false when stored as string "false"', () => {
    mockSettingsGet.mockReturnValue('false');
    expect(getHideHeaderInLandscape()).toBe(false);
  });

  it('returns cached default when settings throws', () => {
    (globalThis as any).acode.require = vi.fn(() => {
      throw new Error('no settings');
    });
    expect(getHideHeaderInLandscape()).toBe(DEFAULT_HIDE_HEADER_IN_LANDSCAPE);
  });

  it('reads from settings module on each call', () => {
    mockSettingsGet.mockReturnValue(true);
    getHideHeaderInLandscape();
    getHideHeaderInLandscape();
    expect(mockSettingsGet).toHaveBeenCalledTimes(2);
  });

  it('caches false and returns false without re-reading if settings returns null after', () => {
    mockSettingsGet.mockReturnValue(false);
    expect(getHideHeaderInLandscape()).toBe(false);
    mockSettingsGet.mockReturnValue(null);
    expect(getHideHeaderInLandscape()).toBe(false);
  });
});

describe('setOnHideHeaderChange', () => {
  it('fires callback on cb with true', () => {
    const handler = vi.fn();
    setOnHideHeaderChange(handler);
    const schema = getSettingsSchema();
    schema.cb(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE, true);
    expect(handler).toHaveBeenCalledWith(true);
  });

  it('fires callback on cb with string "true"', () => {
    const handler = vi.fn();
    setOnHideHeaderChange(handler);
    const schema = getSettingsSchema();
    schema.cb(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE, 'true');
    expect(handler).toHaveBeenCalledWith(true);
  });

  it('fires callback with false on cb false', () => {
    const handler = vi.fn();
    setOnHideHeaderChange(handler);
    const schema = getSettingsSchema();
    schema.cb(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE, false);
    expect(handler).toHaveBeenCalledWith(false);
  });

  it('fires callback with false on cb string "false"', () => {
    const handler = vi.fn();
    setOnHideHeaderChange(handler);
    const schema = getSettingsSchema();
    schema.cb(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE, 'false');
    expect(handler).toHaveBeenCalledWith(false);
  });

  it('does not fire hideHeader handler on other keys', () => {
    const handler = vi.fn();
    setOnHideHeaderChange(handler);
    const schema = getSettingsSchema();
    schema.cb(SETTINGS_KEY_LOG_LEVEL, 'debug');
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('cb branch updates cachedHideHeaderInLandscape', () => {
  it('cb true updates cache so get returns true even if settings null', () => {
    const schema = getSettingsSchema();
    schema.cb(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE, true);
    mockSettingsGet.mockReturnValue(null);
    expect(getHideHeaderInLandscape()).toBe(true);
  });

  it('cb false updates cache so get returns false even if settings null', () => {
    const schema = getSettingsSchema();
    schema.cb(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE, false);
    mockSettingsGet.mockReturnValue(null);
    expect(getHideHeaderInLandscape()).toBe(false);
  });

  it('cb toggles from true to false and back', () => {
    const schema = getSettingsSchema();
    schema.cb(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE, false);
    expect(getHideHeaderInLandscape()).toBe(false);
    schema.cb(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE, true);
    mockSettingsGet.mockReturnValue(null);
    expect(getHideHeaderInLandscape()).toBe(true);
  });
});

describe('resetSettingsCache extension', () => {
  it('resets hideHeader cache to default true', () => {
    const schema = getSettingsSchema();
    schema.cb(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE, false);
    mockSettingsGet.mockReturnValue(null);
    expect(getHideHeaderInLandscape()).toBe(false);
    resetSettingsCache();
    expect(getHideHeaderInLandscape()).toBe(DEFAULT_HIDE_HEADER_IN_LANDSCAPE);
    expect(getHideHeaderInLandscape()).toBe(true);
  });

  it('resets hideHeader and re-reads from settings', () => {
    mockSettingsGet.mockReturnValue(false);
    expect(getHideHeaderInLandscape()).toBe(false);
    resetSettingsCache();
    mockSettingsGet.mockReturnValue(true);
    expect(getHideHeaderInLandscape()).toBe(true);
  });

  it('reset restores all caches including hideHeader alongside logLevel', () => {
    const schema = getSettingsSchema();
    schema.cb(SETTINGS_KEY_LOG_LEVEL, 'debug');
    schema.cb(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE, false);
    mockSettingsGet.mockReturnValue(null);
    expect(getLogLevel()).toBe('debug');
    expect(getHideHeaderInLandscape()).toBe(false);
    resetSettingsCache();
    expect(getLogLevel()).toBe(DEFAULT_LOG_LEVEL);
    expect(getHideHeaderInLandscape()).toBe(true);
  });
});
