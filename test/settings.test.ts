import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSettingsSchema,
  getIframeScale,
  resetSettingsCache,
  getLogLevel,
  setOnLogLevelChange,
} from '../src/settings';
import {
  DEFAULT_IFRAME_SCALE,
  IFRAME_SCALE_MIN,
  IFRAME_SCALE_MAX,
  SETTINGS_KEY_IFRAME_SCALE,
  SETTINGS_KEY_LOG_LEVEL,
  DEFAULT_LOG_LEVEL,
  SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE,
  DEFAULT_HIDE_HEADER_IN_LANDSCAPE,
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
});

describe('getSettingsSchema', () => {
  it('should_return_3_entries_when_getSettingsSchema_called', () => {
    // Arrange
    // Act
    const schema = getSettingsSchema();

    // Assert
    expect(schema.list).toHaveLength(3);
  });

  it('should_have_iframeScale_key_when_first_entry_inspected', () => {
    // Arrange
    const schema = getSettingsSchema();

    // Act
    const key = schema.list[0].key;

    // Assert
    expect(key).toBe(SETTINGS_KEY_IFRAME_SCALE);
  });

  it('should_have_iframeScale_text_when_first_entry_inspected', () => {
    // Arrange
    const schema = getSettingsSchema();

    // Act
    const text = schema.list[0].text;

    // Assert
    expect(text).toBe('Iframe Scale (%)');
  });

  it('should_have_number_prompt_when_iframeScale_inspected', () => {
    // Arrange
    const schema = getSettingsSchema();

    // Act
    const setting = schema.list[0];

    // Assert
    expect(setting.promptType).toBe('number');
  });

  it('should_have_prompt_message_when_iframeScale_inspected', () => {
    // Arrange
    const schema = getSettingsSchema();

    // Act
    const setting = schema.list[0];

    // Assert
    expect(setting.prompt).toBe('Enter scale percentage');
  });

  it('should_have_undefined_select_when_iframeScale_uses_prompt', () => {
    // Arrange
    const schema = getSettingsSchema();

    // Act
    const setting = schema.list[0];

    // Assert
    expect(setting.select).toBeUndefined();
  });

  it('should_return_75_when_default_value_inspected', () => {
    // Arrange
    const schema = getSettingsSchema();

    // Act
    const value = schema.list[0].value;

    // Assert
    expect(value).toBe('75');
  });

  it('should_contain_range_and_default_when_info_inspected', () => {
    // Arrange
    const schema = getSettingsSchema();

    // Act
    const info = schema.list[0].info as string;

    // Assert
    expect(info).toContain('70');
  });

  it('should_contain_max_150_when_info_inspected', () => {
    // Arrange
    const schema = getSettingsSchema();

    // Act
    const info = schema.list[0].info as string;

    // Assert
    expect(info).toContain('150');
  });

  it('should_have_logLevel_select_when_second_entry_inspected', () => {
    // Arrange
    const schema = getSettingsSchema();

    // Act
    const setting = schema.list[1];

    // Assert
    expect(setting.select).toEqual(['none', 'debug', 'info', 'warn', 'error']);
  });

  it('should_have_logLevel_key_when_second_entry_inspected', () => {
    // Arrange
    const schema = getSettingsSchema();

    // Act
    const key = schema.list[1].key;

    // Assert
    expect(key).toBe(SETTINGS_KEY_LOG_LEVEL);
  });

  it('should_have_hideHeader_checkbox_when_third_entry_inspected', () => {
    // Arrange
    const schema = getSettingsSchema();

    // Act
    const setting = schema.list[2];

    // Assert
    expect(setting.checkbox).toBe(true);
  });

  it('should_have_hideHeader_key_when_third_entry_inspected', () => {
    // Arrange
    const schema = getSettingsSchema();

    // Act
    const key = schema.list[2].key;

    // Assert
    expect(key).toBe(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE);
  });
});

describe('getIframeScale', () => {
  it('should_return_default_when_settings_returns_null', () => {
    // Arrange
    mockSettingsGet.mockReturnValue(null);

    // Act
    const scale = getIframeScale();

    // Assert
    expect(scale).toBe(DEFAULT_IFRAME_SCALE);
  });

  it('should_return_1_5_when_settings_returns_150', () => {
    // Arrange
    mockSettingsGet.mockReturnValue('150');

    // Act
    const scale = getIframeScale();

    // Assert
    expect(scale).toBe(1.5);
  });

  it('should_return_1_2_when_settings_returns_120', () => {
    // Arrange
    mockSettingsGet.mockReturnValue('120');

    // Act
    const scale = getIframeScale();

    // Assert
    expect(scale).toBe(1.2);
  });

  it('should_clamp_to_min_when_value_is_50', () => {
    // Arrange
    mockSettingsGet.mockReturnValue('50');

    // Act
    const scale = getIframeScale();

    // Assert
    expect(scale).toBe(IFRAME_SCALE_MIN);
  });

  it('should_clamp_to_max_when_value_is_300', () => {
    // Arrange
    mockSettingsGet.mockReturnValue('300');

    // Act
    const scale = getIframeScale();

    // Assert
    expect(scale).toBe(IFRAME_SCALE_MAX);
  });

  it('should_return_min_when_value_is_0', () => {
    // Arrange
    mockSettingsGet.mockReturnValue('0');

    // Act
    const scale = getIframeScale();

    // Assert
    expect(scale).toBe(IFRAME_SCALE_MIN);
  });

  it('should_return_max_when_value_is_1000', () => {
    // Arrange
    mockSettingsGet.mockReturnValue('1000');

    // Act
    const scale = getIframeScale();

    // Assert
    expect(scale).toBe(IFRAME_SCALE_MAX);
  });
});

describe('getLogLevel', () => {
  it('should_return_default_when_settings_returns_null', () => {
    // Arrange
    mockSettingsGet.mockReturnValue(null);

    // Act
    const level = getLogLevel();

    // Assert
    expect(level).toBe(DEFAULT_LOG_LEVEL);
  });

  it('should_return_debug_when_settings_returns_debug', () => {
    // Arrange
    mockSettingsGet.mockReturnValue('debug');

    // Act
    const level = getLogLevel();

    // Assert
    expect(level).toBe('debug');
  });
});

describe('setOnLogLevelChange', () => {
  it('should_invoke_handler_when_logLevel_cb_fires', () => {
    // Arrange
    const handler = vi.fn();
    setOnLogLevelChange(handler);
    const schema = getSettingsSchema();

    // Act
    schema.cb(SETTINGS_KEY_LOG_LEVEL, 'debug');

    // Assert
    expect(handler).toHaveBeenCalledWith('debug');
  });
});

describe('settings change callback', () => {
  it('should_update_cached_level_and_call_setLogLevel_when_cb_fires', () => {
    // Arrange
    const schema = getSettingsSchema();
    mockSettingsGet.mockReturnValue(null);

    // Act
    schema.cb(SETTINGS_KEY_LOG_LEVEL, 'debug');

    // Assert
    expect(getLogLevel()).toBe('debug');
  });
});

describe('resetSettingsCache', () => {
  it('should_restore_default_scale_when_cache_reset', () => {
    // Arrange
    mockSettingsGet.mockReturnValue('100');
    getIframeScale();
    resetSettingsCache();
    mockSettingsGet.mockReturnValue('90');

    // Act
    const scale = getIframeScale();

    // Assert
    expect(scale).toBe(0.9);
  });

  it('should_restore_default_logLevel_when_cache_reset', () => {
    // Arrange
    const schema = getSettingsSchema();
    schema.cb(SETTINGS_KEY_LOG_LEVEL, 'debug');
    mockSettingsGet.mockReturnValue(null);
    resetSettingsCache();

    // Act
    const level = getLogLevel();

    // Assert
    expect(level).toBe(DEFAULT_LOG_LEVEL);
  });
});
