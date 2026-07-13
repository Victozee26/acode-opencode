type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

// Global on/off gate for all logging. Everything funnels through `enabled`
// so a single toggle (setLogEnabled) controls the whole plugin.
let enabled = false;

// Reserved — future per-level filtering hook. Not yet wired into shouldLog;
// the `void` statements silence the unused-variable check until it is used.
let _minLevel: LogLevel = 'debug';
void _minLevel;

export function setLogEnabled(value: boolean): void {
  enabled = value;
}

export function isLogEnabled(): boolean {
  return enabled;
}

// Central log gate. Kept as a function (rather than inlining `enabled`) so the
// reserved per-level filter can later be added in exactly one place without
// touching every call site. The `_level` param is currently ignored because
// the only active rule is the global enable flag.
function shouldLog(_level: LogLevel): boolean {
  return enabled;
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

void _minLevel;
