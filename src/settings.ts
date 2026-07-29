import {
  DEFAULT_IFRAME_SCALE,
  IFRAME_SCALE_MIN,
  IFRAME_SCALE_MAX,
  SETTINGS_KEY_IFRAME_SCALE,
  SETTINGS_KEY_AUTO_START,
  DEFAULT_AUTO_START,
  SETTINGS_KEY_LOG_LEVEL,
  DEFAULT_LOG_LEVEL,
} from './config/settings';
import { createLogger, setLogLevel } from './logger';

const log = createLogger('settings');

let cachedScale = DEFAULT_IFRAME_SCALE;

let onScaleChange: ((scale: number) => void) | null = null;

let cachedAutoStart = DEFAULT_AUTO_START;
let cachedLogLevel: string = DEFAULT_LOG_LEVEL;

let onAutoStartChange: ((value: boolean) => void) | null = null;
let onLogLevelChange: ((level: string) => void) | null = null;

function clampScale(value: number): number {
  return Math.min(IFRAME_SCALE_MAX, Math.max(IFRAME_SCALE_MIN, value));
}

/**
 * Returns the settings schema object to pass as the third arg of
 * `acode.setPluginInit()`. Acode renders these in the plugin page.
 */
export function getSettingsSchema(): Acode.PluginSettings {
  return {
    list: [
      {
        key: SETTINGS_KEY_IFRAME_SCALE,
        text: 'Iframe Scale (%)',
        info: `Scale factor for the OpenCode web UI iframe (${IFRAME_SCALE_MIN * 100}–${IFRAME_SCALE_MAX * 100}, default ${DEFAULT_IFRAME_SCALE * 100})`,
        prompt: 'Enter scale percentage',
        promptType: 'number',
        value: `${Math.round(DEFAULT_IFRAME_SCALE * 100)}`,
      },
      {
        key: SETTINGS_KEY_AUTO_START,
        text: 'Auto-start server',
        info: 'Automatically start the OpenCode server when the plugin page opens',
        checkbox: true,
        value: DEFAULT_AUTO_START,
      },
      {
        key: SETTINGS_KEY_LOG_LEVEL,
        text: 'Log Level',
        info: 'Verbosity of plugin log output (debug < info < warn < error)',
        select: ['debug', 'info', 'warn', 'error'] as const,
        value: DEFAULT_LOG_LEVEL,
      },
    ],
    cb(_key: string, value: unknown) {
      if (_key === SETTINGS_KEY_IFRAME_SCALE) {
        const num = typeof value === 'number' ? value : parseInt(String(value), 10);
        if (!Number.isNaN(num)) {
          cachedScale = clampScale(num / 100);
          log.info(`iframe scale changed to ${cachedScale}`);
          onScaleChange?.(cachedScale);
        }
      } else if (_key === SETTINGS_KEY_AUTO_START) {
        const boolVal = value === true || value === 'true';
        cachedAutoStart = boolVal;
        log.info(`auto-start set to ${boolVal}`);
        onAutoStartChange?.(boolVal);
      } else if (_key === SETTINGS_KEY_LOG_LEVEL) {
        const strVal = String(value);
        if (['debug', 'info', 'warn', 'error'].includes(strVal)) {
          cachedLogLevel = strVal;
          setLogLevel(strVal as 'debug' | 'info' | 'warn' | 'error');
          log.info(`log level set to ${strVal}`);
          onLogLevelChange?.(strVal);
        }
      }
    },
  };
}

/**
 * Read the iframe scale from Acode's settings module. Falls back to the
 * default if the setting hasn't been stored yet.
 */
export function setOnScaleChange(handler: (scale: number) => void): void {
  onScaleChange = handler;
}

export function getIframeScale(): number {
  try {
    const settings = acode.require('settings') as any;
    const raw = settings.get(SETTINGS_KEY_IFRAME_SCALE);
    if (raw != null) {
      const num = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
      if (!Number.isNaN(num)) {
        cachedScale = clampScale(num / 100);
      }
    }
  } catch {
    // settings module not available (e.g. during tests) — use cached default
  }
  return cachedScale;
}

/**
 * Read the auto-start preference from Acode's settings module.
 * Falls back to the default if unset.
 */
export function getAutoStart(): boolean {
  try {
    const settings = acode.require('settings') as any;
    const raw = settings.get(SETTINGS_KEY_AUTO_START);
    if (raw != null) {
      cachedAutoStart = raw === true || raw === 'true';
    }
  } catch {
    // settings module not available — use cached default
  }
  return cachedAutoStart;
}

/**
 * Read the log level from Acode's settings module.
 * Falls back to the default if unset.
 */
export function getLogLevel(): string {
  try {
    const settings = acode.require('settings') as any;
    const raw = settings.get(SETTINGS_KEY_LOG_LEVEL);
    if (raw != null) {
      const strVal = String(raw);
      if (['debug', 'info', 'warn', 'error'].includes(strVal)) {
        cachedLogLevel = strVal;
      }
    }
  } catch {
    // settings module not available — use cached default
  }
  return cachedLogLevel;
}

export function setOnAutoStartChange(handler: (value: boolean) => void): void {
  onAutoStartChange = handler;
}

export function setOnLogLevelChange(handler: (level: string) => void): void {
  onLogLevelChange = handler;
}

export function resetSettingsCache(): void {
  cachedScale = DEFAULT_IFRAME_SCALE;
  cachedAutoStart = DEFAULT_AUTO_START;
  cachedLogLevel = DEFAULT_LOG_LEVEL;
}
