import { describe, it, expect } from 'vitest';
import {
  SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE,
  DEFAULT_HIDE_HEADER_IN_LANDSCAPE,
  SETTINGS_KEY_IFRAME_SCALE,
  SETTINGS_KEY_ENABLE_CONSOLE_LOGS,
  SETTINGS_KEY_LOG_LEVEL,
} from '../../src/config/settings';
import * as barrel from '../../src/config';

describe('settings config constants', () => {
  it('SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE is hideHeaderInLandscape', () => {
    expect(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE).toBe('hideHeaderInLandscape');
  });

  it('DEFAULT_HIDE_HEADER_IN_LANDSCAPE is true', () => {
    expect(DEFAULT_HIDE_HEADER_IN_LANDSCAPE).toBe(true);
  });

  it('key is distinct from other settings keys', () => {
    expect(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE).not.toBe(SETTINGS_KEY_IFRAME_SCALE);
    expect(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE).not.toBe(SETTINGS_KEY_ENABLE_CONSOLE_LOGS);
    expect(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE).not.toBe(SETTINGS_KEY_LOG_LEVEL);
  });

  it('barrel re-exports hideHeader constants', () => {
    expect((barrel as any).SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE).toBe('hideHeaderInLandscape');
    expect((barrel as any).DEFAULT_HIDE_HEADER_IN_LANDSCAPE).toBe(true);
  });

  it('DEFAULT is boolean true (not truthy string)', () => {
    expect(typeof DEFAULT_HIDE_HEADER_IN_LANDSCAPE).toBe('boolean');
  });
});
