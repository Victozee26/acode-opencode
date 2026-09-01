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
  SETTINGS_KEY_ENABLE_CONSOLE_LOGS,
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

describe('getSettingsSchema hideHeader entry', () => {
  it('list has 4 entries and hideHeader is third', () => {
    const schema = getSettingsSchema();
    expect(schema.list).toHaveLength(4);
    expect(schema.list[2].key).toBe(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE);
  });

  it('hideHeader entry is checkbox with default true', () => {
    const schema = getSettingsSchema();
    const entry = schema.list[2];
    expect(entry.checkbox).toBe(true);
    expect(entry.value).toBe(DEFAULT_HIDE_HEADER_IN_LANDSCAPE);
    expect(entry.value).toBe(true);
  });

  it('hideHeader entry has correct text and info', () => {
    const schema = getSettingsSchema();
    const entry = schema.list[2];
    expect(entry.text).toBe('Hide header in landscape');
    expect(entry.info).toContain('landscape');
    expect(entry.info.toLowerCase()).toContain('header');
  });

  it('hideHeader entry has no select/promptType', () => {
    const schema = getSettingsSchema();
    const entry = schema.list[2] as any;
    expect(entry.select).toBeUndefined();
    expect(entry.promptType).toBeUndefined();
  });
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
    schema.cb(SETTINGS_KEY_ENABLE_CONSOLE_LOGS, true);
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
    expect(getLogLevel()).toBe('info');
    expect(getHideHeaderInLandscape()).toBe(true);
  });
});
