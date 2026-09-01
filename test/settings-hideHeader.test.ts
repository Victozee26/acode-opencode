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
  it('should_return_true_when_settings_returns_null', () => {
    // Arrange
    mockSettingsGet.mockReturnValue(null);

    // Act
    const result = getHideHeaderInLandscape();

    // Assert
    expect(result).toBe(DEFAULT_HIDE_HEADER_IN_LANDSCAPE);
  });

  it('should_return_true_when_stored_as_true', () => {
    // Arrange
    mockSettingsGet.mockReturnValue(true);

    // Act
    const result = getHideHeaderInLandscape();

    // Assert
    expect(result).toBe(true);
  });

  it('should_return_false_when_stored_as_false', () => {
    // Arrange
    mockSettingsGet.mockReturnValue(false);

    // Act
    const result = getHideHeaderInLandscape();

    // Assert
    expect(result).toBe(false);
  });

  it('should_return_true_when_stored_as_string_true', () => {
    // Arrange
    mockSettingsGet.mockReturnValue('true');

    // Act
    const result = getHideHeaderInLandscape();

    // Assert
    expect(result).toBe(true);
  });

  it('should_return_false_when_stored_as_string_false', () => {
    // Arrange
    mockSettingsGet.mockReturnValue('false');

    // Act
    const result = getHideHeaderInLandscape();

    // Assert
    expect(result).toBe(false);
  });

  it('should_return_default_when_settings_throws', () => {
    // Arrange
    (globalThis as any).acode.require = vi.fn(() => {
      throw new Error('no settings');
    });

    // Act
    const result = getHideHeaderInLandscape();

    // Assert
    expect(result).toBe(DEFAULT_HIDE_HEADER_IN_LANDSCAPE);
  });

  it('should_return_cached_false_when_settings_null_after_false', () => {
    // Arrange
    mockSettingsGet.mockReturnValue(false);
    getHideHeaderInLandscape();
    mockSettingsGet.mockReturnValue(null);

    // Act
    const result = getHideHeaderInLandscape();

    // Assert
    expect(result).toBe(false);
  });
});

describe('setOnHideHeaderChange', () => {
  it('should_invoke_handler_with_true_when_cb_true', () => {
    // Arrange
    const handler = vi.fn();
    setOnHideHeaderChange(handler);
    const schema = getSettingsSchema();

    // Act
    schema.cb(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE, true);

    // Assert
    expect(handler).toHaveBeenCalledWith(true);
  });

  it('should_invoke_handler_with_true_when_cb_string_true', () => {
    // Arrange
    const handler = vi.fn();
    setOnHideHeaderChange(handler);
    const schema = getSettingsSchema();

    // Act
    schema.cb(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE, 'true');

    // Assert
    expect(handler).toHaveBeenCalledWith(true);
  });

  it('should_invoke_handler_with_false_when_cb_false', () => {
    // Arrange
    const handler = vi.fn();
    setOnHideHeaderChange(handler);
    const schema = getSettingsSchema();

    // Act
    schema.cb(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE, false);

    // Assert
    expect(handler).toHaveBeenCalledWith(false);
  });

  it('should_invoke_handler_with_false_when_cb_string_false', () => {
    // Arrange
    const handler = vi.fn();
    setOnHideHeaderChange(handler);
    const schema = getSettingsSchema();

    // Act
    schema.cb(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE, 'false');

    // Assert
    expect(handler).toHaveBeenCalledWith(false);
  });

  it('should_not_invoke_hide_handler_when_other_key_changes', () => {
    // Arrange
    const handler = vi.fn();
    setOnHideHeaderChange(handler);
    const schema = getSettingsSchema();

    // Act
    schema.cb(SETTINGS_KEY_LOG_LEVEL, 'debug');

    // Assert
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('cb branch updates cachedHideHeaderInLandscape', () => {
  it('should_return_true_when_cb_true_even_if_settings_null', () => {
    // Arrange
    const schema = getSettingsSchema();
    schema.cb(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE, true);
    mockSettingsGet.mockReturnValue(null);

    // Act
    const result = getHideHeaderInLandscape();

    // Assert
    expect(result).toBe(true);
  });

  it('should_return_false_when_cb_false_even_if_settings_null', () => {
    // Arrange
    const schema = getSettingsSchema();
    schema.cb(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE, false);
    mockSettingsGet.mockReturnValue(null);

    // Act
    const result = getHideHeaderInLandscape();

    // Assert
    expect(result).toBe(false);
  });

  it('should_toggle_false_then_true_when_cb_fires_twice', () => {
    // Arrange
    const schema = getSettingsSchema();
    schema.cb(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE, false);

    // Act
    const afterFalse = getHideHeaderInLandscape();
    schema.cb(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE, true);
    mockSettingsGet.mockReturnValue(null);
    const afterTrue = getHideHeaderInLandscape();

    // Assert
    expect(afterFalse).toBe(false);
    expect(afterTrue).toBe(true);
  });
});

describe('resetSettingsCache extension', () => {
  it('should_reset_to_true_when_cache_reset_after_false', () => {
    // Arrange
    const schema = getSettingsSchema();
    schema.cb(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE, false);
    mockSettingsGet.mockReturnValue(null);
    resetSettingsCache();

    // Act
    const result = getHideHeaderInLandscape();

    // Assert
    expect(result).toBe(DEFAULT_HIDE_HEADER_IN_LANDSCAPE);
  });

  it('should_re_read_true_when_cache_reset_and_settings_true', () => {
    // Arrange
    mockSettingsGet.mockReturnValue(false);
    getHideHeaderInLandscape();
    resetSettingsCache();
    mockSettingsGet.mockReturnValue(true);

    // Act
    const result = getHideHeaderInLandscape();

    // Assert
    expect(result).toBe(true);
  });

  it('should_reset_both_caches_when_reset_called', () => {
    // Arrange
    const schema = getSettingsSchema();
    schema.cb(SETTINGS_KEY_LOG_LEVEL, 'debug');
    schema.cb(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE, false);
    mockSettingsGet.mockReturnValue(null);
    resetSettingsCache();

    // Act
    const level = getLogLevel();
    const hide = getHideHeaderInLandscape();

    // Assert
    expect(level).toBe(DEFAULT_LOG_LEVEL);
    expect(hide).toBe(true);
  });
});
