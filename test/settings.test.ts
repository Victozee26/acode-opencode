import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSettingsSchema,
  getIframeScale,
  resetSettingsCache,
  getAutoStart,
  getLogLevel,
  setOnAutoStartChange,
  setOnLogLevelChange,
} from '../src/settings';
import {
  DEFAULT_IFRAME_SCALE,
  IFRAME_SCALE_MIN,
  IFRAME_SCALE_MAX,
  SETTINGS_KEY_IFRAME_SCALE,
  SETTINGS_KEY_AUTO_START,
  DEFAULT_AUTO_START,
  SETTINGS_KEY_LOG_LEVEL,
  DEFAULT_LOG_LEVEL,
} from '../src/config/settings';
import { setLogLevel } from '../src/logger';

vi.mock('../src/logger', async () => {
  const actual = await vi.importActual<typeof import('../src/logger')>('../src/logger');
  return { ...actual, setLogLevel: vi.fn() };
});

const mockSettingsGet = vi.fn();

function setupAcode(): void {
  (globalThis as any).acode = {
    require: vi.fn((name: string) => {
      if (name === 'settings') return { get: mockSettingsGet };
      return {};
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetSettingsCache();
  setupAcode();
  mockSettingsGet.mockReturnValue(null);
});

describe('getSettingsSchema', () => {
  it('returns settings list with iframeScale key', () => {
    const schema = getSettingsSchema();

    expect(schema.list).toHaveLength(3);
    expect(schema.list[0].key).toBe(SETTINGS_KEY_IFRAME_SCALE);
    expect(schema.list[0].text).toBe('Iframe Scale (%)');
  });

  it('uses prompt with numeric type', () => {
    const schema = getSettingsSchema();
    const setting = schema.list[0];

    expect(setting.prompt).toBe('Enter scale percentage');
    expect(setting.promptType).toBe('number');
    expect(setting.select).toBeUndefined();
  });

  it('default value is 75', () => {
    const schema = getSettingsSchema();
    expect(schema.list[0].value).toBe('75');
  });

  it('info mentions range 70–150 and default 75', () => {
    const schema = getSettingsSchema();
    expect(schema.list[0].info).toContain('70');
    expect(schema.list[0].info).toContain('150');
    expect(schema.list[0].info).toContain('75');
  });

  it('has autoStart setting with checkbox', () => {
    const schema = getSettingsSchema();
    const setting = schema.list[1];

    expect(setting.key).toBe(SETTINGS_KEY_AUTO_START);
    expect(setting.checkbox).toBe(true);
    expect(setting.value).toBe(DEFAULT_AUTO_START);
  });

  it('has logLevel setting with select dropdown', () => {
    const schema = getSettingsSchema();
    const setting = schema.list[2];

    expect(setting.key).toBe(SETTINGS_KEY_LOG_LEVEL);
    expect(setting.select).toEqual(['debug', 'info', 'warn', 'error']);
    expect(setting.value).toBe(DEFAULT_LOG_LEVEL);
  });
});

describe('getIframeScale', () => {
  it('returns default when settings module returns null', () => {
    mockSettingsGet.mockReturnValue(null);

    expect(getIframeScale()).toBe(DEFAULT_IFRAME_SCALE);
  });

  it('parses numeric string from settings', () => {
    mockSettingsGet.mockReturnValue('150');

    expect(getIframeScale()).toBe(1.5);
  });

  it('parses number type from settings', () => {
    mockSettingsGet.mockReturnValue('120');

    expect(getIframeScale()).toBe(1.2);
  });

  it('clamps below-min value to minimum', () => {
    mockSettingsGet.mockReturnValue('50');

    expect(getIframeScale()).toBe(IFRAME_SCALE_MIN);
  });

  it('clamps above-max value to maximum', () => {
    mockSettingsGet.mockReturnValue('300');

    expect(getIframeScale()).toBe(IFRAME_SCALE_MAX);
  });

  it('reads from settings module on each call', () => {
    mockSettingsGet.mockReturnValue('100');

    getIframeScale();
    getIframeScale();

    expect(mockSettingsGet).toHaveBeenCalledTimes(2);
  });
});

describe('getAutoStart', () => {
  it('returns default when settings module returns null', () => {
    mockSettingsGet.mockReturnValue(null);

    expect(getAutoStart()).toBe(DEFAULT_AUTO_START);
  });

  it('returns true when stored as true', () => {
    mockSettingsGet.mockReturnValue(true);

    expect(getAutoStart()).toBe(true);
  });

  it('returns false when stored as false', () => {
    mockSettingsGet.mockReturnValue(false);

    expect(getAutoStart()).toBe(false);
  });
});

describe('getLogLevel', () => {
  it('returns default when settings module returns null', () => {
    mockSettingsGet.mockReturnValue(null);

    expect(getLogLevel()).toBe(DEFAULT_LOG_LEVEL);
  });

  it('returns stored string value', () => {
    mockSettingsGet.mockReturnValue('debug');

    expect(getLogLevel()).toBe('debug');
  });
});

describe('setOnAutoStartChange', () => {
  it('registers a callback that fires on autoStart change', () => {
    const handler = vi.fn();
    setOnAutoStartChange(handler);

    const schema = getSettingsSchema();
    schema.cb(SETTINGS_KEY_AUTO_START, true);

    expect(handler).toHaveBeenCalledWith(true);
  });
});

describe('setOnLogLevelChange', () => {
  it('registers a callback that fires on logLevel change', () => {
    const handler = vi.fn();
    setOnLogLevelChange(handler);

    const schema = getSettingsSchema();
    schema.cb(SETTINGS_KEY_LOG_LEVEL, 'debug');

    expect(handler).toHaveBeenCalledWith('debug');
  });
});

describe('settings change callback', () => {
  it('passes through autoStart changes to cachedAutoStart', () => {
    const schema = getSettingsSchema();
    schema.cb(SETTINGS_KEY_AUTO_START, false);
    mockSettingsGet.mockReturnValue(null);

    expect(getAutoStart()).toBe(false);
  });

  it('passes through logLevel changes to cachedLogLevel and calls setLogLevel', () => {
    const schema = getSettingsSchema();
    schema.cb(SETTINGS_KEY_LOG_LEVEL, 'debug');
    mockSettingsGet.mockReturnValue(null);

    expect(getLogLevel()).toBe('debug');
    expect(setLogLevel).toHaveBeenCalledWith('debug');
  });
});

describe('resetSettingsCache', () => {
  it('resets to default and re-reads from settings module', () => {
    mockSettingsGet.mockReturnValue('100');
    getIframeScale();
    expect(getIframeScale()).toBe(1.0);

    resetSettingsCache();
    mockSettingsGet.mockReturnValue('90');

    expect(getIframeScale()).toBe(0.9);
  });

  it('resets auto-start and log-level caches to defaults', () => {
    const schema = getSettingsSchema();
    schema.cb(SETTINGS_KEY_AUTO_START, false);
    schema.cb(SETTINGS_KEY_LOG_LEVEL, 'debug');
    mockSettingsGet.mockReturnValue(null);

    expect(getAutoStart()).toBe(false);
    expect(getLogLevel()).toBe('debug');

    resetSettingsCache();

    expect(getAutoStart()).toBe(DEFAULT_AUTO_START);
    expect(getLogLevel()).toBe(DEFAULT_LOG_LEVEL);
  });
});
