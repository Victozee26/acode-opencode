type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

// Global on/off gate for all logging. Everything funnels through `enabled`
// so a single toggle (setLogEnabled) controls the whole plugin.
let enabled = false;

// Minimum level that actually reaches the console. Calls below this threshold
// are dropped by shouldLog(). Defaults to 'debug' so every level is emitted
// whenever logging is enabled, matching the historical behaviour.
let minLevel: LogLevel = 'debug';

export function setLogEnabled(value: boolean): void {
  enabled = value;
}

export function isLogEnabled(): boolean {
  return enabled;
}

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

export function getLogLevel(): LogLevel {
  return minLevel;
}

// Central log gate in one place: honour both the global enable flag and the
// configured minimum level, so level filtering can be tuned without touching
// every call site.
function shouldLog(level: LogLevel): boolean {
  return enabled && LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
}

export function createLogger(tag: string): Logger {
  return {
    debug(message: string, ...args: unknown[]) {
      if (shouldLog('debug')) console.debug(`[${tag}]`, message, ...args);
    },
    info(message: string, ...args: unknown[]) {
      if (shouldLog('info')) console.info(`[${tag}]`, message, ...args);
    },
    warn(message: string, ...args: unknown[]) {
      if (shouldLog('warn')) console.warn(`[${tag}]`, message, ...args);
    },
    error(message: string, ...args: unknown[]) {
      if (shouldLog('error')) console.error(`[${tag}]`, message, ...args);
    },
  };
}
