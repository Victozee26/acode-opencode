import { HEALTH_CHECK_URL, HEALTH_CHECK_TIMEOUT } from '../config';
import { createLogger } from '../logger';

const log = createLogger('health');

// Minimal shape of the Cordova Advanced HTTP plugin we depend on.
interface CordovaHttp {
  sendRequest: (
    url: string,
    options: { method: string; timeout: number },
    success: () => void,
    failure: (err: { status?: number }) => void,
  ) => void;
}

// Resolve the Cordova Advanced HTTP plugin from the global window, if present.
// It runs on the native network stack, so WebView CORS does NOT apply and a
// loopback probe to 127.0.0.1:4096 actually resolves (a plain `fetch` hangs
// forever in this WebView). Returns undefined when the plugin is absent — e.g. a
// browser test environment — in which case we cannot probe at all.
function getCordovaHttp(): CordovaHttp | undefined {
  return (window as unknown as { cordova?: { plugin?: { http?: CordovaHttp } } }).cordova?.plugin?.http;
}

/**
 * Probes the OpenCode `/global/health` endpoint via Cordova Advanced HTTP and
 * reports whether the server is up.
 *
 * Any response — the success callback OR a failure callback carrying a *positive*
 * status — means something answered on the port → up. A negative status (native/
 * connection error, e.g. connection refused) means nothing is listening → down.
 *
 * The promise never rejects: a slow request is bounded by an independent watchdog
 * (HEALTH_CHECK_TIMEOUT + 500ms) so a missing/failed native callback can never
 * hang the caller (which only checks its own timeout between poll iterations).
 * Returns `false` immediately when the plugin is absent. There is no `fetch`
 * fallback: a plain `fetch` to loopback hangs in this WebView.
 */
export async function isServerUp(): Promise<boolean> {
  const http = getCordovaHttp();
  if (!http) {
    log.warn('isServerUp: cordova.plugin.http unavailable — cannot probe');
    return false;
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const watchdog = setTimeout(() => settle(false), HEALTH_CHECK_TIMEOUT + 500);

    try {
      http.sendRequest(
        HEALTH_CHECK_URL,
        { method: 'GET', timeout: HEALTH_CHECK_TIMEOUT / 1000 },
        () => {
          log.debug('isServerUp: up');
          clearTimeout(watchdog);
          settle(true);
        },
        (err: { status?: number }) => {
          const status = typeof err?.status === 'number' ? err.status : 0;
          const up = status > 0;
          log.debug(`isServerUp: ${up ? 'up' : 'down'} (status ${status})`);
          clearTimeout(watchdog);
          settle(up);
        },
      );
    } catch {
      // A synchronous throw from sendRequest must not break the "never rejects"
      // contract — treat it as down rather than propagating an exception.
      log.debug('isServerUp: sendRequest threw — down');
      clearTimeout(watchdog);
      settle(false);
    }
  });
}
