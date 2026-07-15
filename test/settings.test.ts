import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSettingsSchema, getIframeScale, resetSettingsCache } from '../src/settings';
import { DEFAULT_IFRAME_SCALE, IFRAME_SCALE_MIN, IFRAME_SCALE_MAX, SETTINGS_KEY_IFRAME_SCALE } from '../src/config/settings';

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

    expect(schema.list).toHaveLength(1);
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

describe('resetSettingsCache', () => {
  it('resets to default and re-reads from settings module', () => {
    mockSettingsGet.mockReturnValue('100');
    getIframeScale();
    expect(getIframeScale()).toBe(1.0);

    resetSettingsCache();
    mockSettingsGet.mockReturnValue('90');

    expect(getIframeScale()).toBe(0.9);
  });
});
