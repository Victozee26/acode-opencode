import {
  DEFAULT_IFRAME_SCALE,
  IFRAME_SCALE_MIN,
  IFRAME_SCALE_MAX,
  SETTINGS_KEY_IFRAME_SCALE,
} from './config/settings';
import { createLogger } from './logger';

const log = createLogger('settings');

let cachedScale = DEFAULT_IFRAME_SCALE;

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
    ],
    cb(_key: string, value: unknown) {
      if (_key === SETTINGS_KEY_IFRAME_SCALE) {
        const num = typeof value === 'number' ? value : parseInt(String(value), 10);
        if (!Number.isNaN(num)) {
          cachedScale = clampScale(num / 100);
          log.info(`iframe scale changed to ${cachedScale}`);
        }
      }
    },
  };
}

/**
 * Read the iframe scale from Acode's settings module. Falls back to the
 * default if the setting hasn't been stored yet.
 */
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

export function resetSettingsCache(): void {
  cachedScale = DEFAULT_IFRAME_SCALE;
}
