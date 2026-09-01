import plugin from '../plugin.json';
import {
  DEFAULT_IFRAME_SCALE,
  IFRAME_SCALE_MIN,
  IFRAME_SCALE_MAX,
  SETTINGS_KEY_IFRAME_SCALE,
  SETTINGS_KEY_ENABLE_CONSOLE_LOGS,
  DEFAULT_ENABLE_CONSOLE_LOGS,
  SETTINGS_KEY_LOG_LEVEL,
  DEFAULT_LOG_LEVEL,
  SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE,
  DEFAULT_HIDE_HEADER_IN_LANDSCAPE,
} from './config/settings';
import { createLogger, setLogEnabled, setLogLevel } from './logger';

const PLUGIN_ID = plugin.id;

const log = createLogger('settings');

let cachedScale = DEFAULT_IFRAME_SCALE;

let onScaleChange: ((scale: number) => void) | null = null;

let cachedEnableConsoleLogs = DEFAULT_ENABLE_CONSOLE_LOGS;
let cachedLogLevel: string = DEFAULT_LOG_LEVEL;
let cachedHideHeaderInLandscape = DEFAULT_HIDE_HEADER_IN_LANDSCAPE;

let onEnableConsoleLogsChange: ((value: boolean) => void) | null = null;
let onLogLevelChange: ((level: string) => void) | null = null;
let onHideHeaderChange: ((value: boolean) => void) | null = null;

function clampScale(value: number): number {
  return Math.min(IFRAME_SCALE_MAX, Math.max(IFRAME_SCALE_MIN, value));
}

function getPluginRecord(): Record<string, unknown> {
  try {
    const s = acode.require('settings') as any;
    return s.value?.[PLUGIN_ID] ?? {};
  } catch {
    return {};
  }
}

function persist(key: string, value: unknown): void {
  try {
    const s = acode.require('settings') as any;
    if (!s.value) s.value = {};
    if (!s.value[PLUGIN_ID]) s.value[PLUGIN_ID] = {};
    s.value[PLUGIN_ID][key] = value;
    if (typeof s.update === 'function') {
      const p = s.update(false);
      if (p?.catch) p.catch((e: unknown) => log.error('persist failed', e));
    }
  } catch (e) {
    log.error('persist failed', e);
  }
}

/**
 * Returns the settings schema object to pass as the third arg of
 * `acode.setPluginInit()`. Acode renders these in the plugin page.
 */
export function getSettingsSchema(): Acode.PluginSettings {
  const rec = getPluginRecord();
  return {
    list: [
      {
        key: SETTINGS_KEY_IFRAME_SCALE,
        text: 'Iframe Scale (%)',
        info: `Scale factor for the OpenCode web UI iframe (${IFRAME_SCALE_MIN * 100}–${IFRAME_SCALE_MAX * 100}, default ${DEFAULT_IFRAME_SCALE * 100})`,
        prompt: 'Enter scale percentage',
        promptType: 'number',
        value: (rec[SETTINGS_KEY_IFRAME_SCALE] as string) ?? `${Math.round(DEFAULT_IFRAME_SCALE * 100)}`,
      },
      {
        key: SETTINGS_KEY_LOG_LEVEL,
        text: 'Log Level',
        info: 'Verbosity of plugin log output (debug < info < warn < error)',
        select: ['debug', 'info', 'warn', 'error'] as const,
        value: (rec[SETTINGS_KEY_LOG_LEVEL] as string) ?? DEFAULT_LOG_LEVEL,
      },
      {
        key: SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE,
        text: 'Hide header in landscape',
        info: 'Automatically hide header in landscape orientation to maximize content area',
        checkbox: (rec[SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE] as boolean) ?? DEFAULT_HIDE_HEADER_IN_LANDSCAPE,
        value: (rec[SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE] as boolean) ?? DEFAULT_HIDE_HEADER_IN_LANDSCAPE,
      },
      {
        key: SETTINGS_KEY_ENABLE_CONSOLE_LOGS,
        text: 'Enable console logs',
        info: 'Enable plugin console output (when off, no logs are printed regardless of log level)',
        checkbox: (rec[SETTINGS_KEY_ENABLE_CONSOLE_LOGS] as boolean) ?? DEFAULT_ENABLE_CONSOLE_LOGS,
        value: (rec[SETTINGS_KEY_ENABLE_CONSOLE_LOGS] as boolean) ?? DEFAULT_ENABLE_CONSOLE_LOGS,
      },
    ],
    cb(_key: string, value: unknown) {
      if (_key === SETTINGS_KEY_IFRAME_SCALE) {
        const num = typeof value === 'number' ? value : parseInt(String(value), 10);
        if (!Number.isNaN(num)) {
          cachedScale = clampScale(num / 100);
          persist(_key, `${Math.round(cachedScale * 100)}`);
          log.info(`iframe scale changed to ${cachedScale}`);
          onScaleChange?.(cachedScale);
        }
      } else if (_key === SETTINGS_KEY_ENABLE_CONSOLE_LOGS) {
        const boolVal = value === true || value === 'true';
        cachedEnableConsoleLogs = boolVal;
        persist(_key, boolVal);
        setLogEnabled(boolVal);
        // Note: when disabling, this info line is suppressed because
        // logging is now off — which is the desired quiet behaviour.
        log.info(`console logs ${boolVal ? 'enabled' : 'disabled'}`);
        onEnableConsoleLogsChange?.(boolVal);
      } else if (_key === SETTINGS_KEY_LOG_LEVEL) {
        const strVal = String(value);
        if (['debug', 'info', 'warn', 'error'].includes(strVal)) {
          cachedLogLevel = strVal;
          persist(_key, strVal);
          setLogLevel(strVal as 'debug' | 'info' | 'warn' | 'error');
          log.info(`log level set to ${strVal}`);
          onLogLevelChange?.(strVal);
        }
      } else if (_key === SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE) {
        const boolVal = value === true || value === 'true';
        cachedHideHeaderInLandscape = boolVal;
        persist(_key, boolVal);
        log.info(`hideHeaderInLandscape set to ${boolVal}`);
        onHideHeaderChange?.(boolVal);
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
    let raw: unknown = getPluginRecord()[SETTINGS_KEY_IFRAME_SCALE];
    if (raw == null) {
      try {
        const s = acode.require('settings') as any;
        if (typeof s.get === 'function') raw = s.get(SETTINGS_KEY_IFRAME_SCALE);
      } catch {}
    }
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
 * Read the log level from Acode's settings module.
 * Falls back to the default if unset.
 */
export function getLogLevel(): string {
  try {
    let raw: unknown = getPluginRecord()[SETTINGS_KEY_LOG_LEVEL];
    if (raw == null) {
      try {
        const s = acode.require('settings') as any;
        if (typeof s.get === 'function') raw = s.get(SETTINGS_KEY_LOG_LEVEL);
      } catch {}
    }
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

export function setOnEnableConsoleLogsChange(
  handler: (value: boolean) => void,
): void {
  onEnableConsoleLogsChange = handler;
}

export function setOnLogLevelChange(handler: (level: string) => void): void {
  onLogLevelChange = handler;
}

export function setOnHideHeaderChange(handler: (value: boolean) => void): void {
  onHideHeaderChange = handler;
}

/**
 * Read the console-logs enable preference from Acode's settings module.
 * Falls back to the default if unset.
 */
export function getEnableConsoleLogs(): boolean {
  try {
    let raw: unknown = getPluginRecord()[SETTINGS_KEY_ENABLE_CONSOLE_LOGS];
    if (raw == null) {
      try {
        const s = acode.require('settings') as any;
        if (typeof s.get === 'function') raw = s.get(SETTINGS_KEY_ENABLE_CONSOLE_LOGS);
      } catch {}
    }
    if (raw != null) {
      cachedEnableConsoleLogs = raw === true || raw === 'true';
    }
  } catch {
    // settings module not available — use cached default
  }
  return cachedEnableConsoleLogs;
}

/**
 * Read the hide-header-in-landscape preference from Acode's settings module.
 * Falls back to the default if unset.
 */
export function getHideHeaderInLandscape(): boolean {
  try {
    let raw: unknown = getPluginRecord()[SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE];
    if (raw == null) {
      try {
        const s = acode.require('settings') as any;
        if (typeof s.get === 'function') raw = s.get(SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE);
      } catch {}
    }
    if (raw != null) {
      cachedHideHeaderInLandscape = raw === true || raw === 'true';
    }
  } catch {
    // settings module not available — use cached default
  }
  return cachedHideHeaderInLandscape;
}

export function resetSettingsCache(): void {
  cachedScale = DEFAULT_IFRAME_SCALE;
  cachedEnableConsoleLogs = DEFAULT_ENABLE_CONSOLE_LOGS;
  cachedLogLevel = DEFAULT_LOG_LEVEL;
  cachedHideHeaderInLandscape = DEFAULT_HIDE_HEADER_IN_LANDSCAPE;
}
