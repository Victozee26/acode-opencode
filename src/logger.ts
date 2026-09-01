type LogLevel = 'none' | 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Exclude<LogLevel, 'none'>, number> = {
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

// Minimum level that actually reaches the console. Calls below this threshold
// are dropped by shouldLog(). When set to 'none', no logs are emitted.
let minLevel: LogLevel = 'none';

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

export function getLogLevel(): LogLevel {
  return minLevel;
}

// Central log gate in one place: honour the configured minimum level, so level
// filtering can be tuned without touching every call site. 'none' disables all
// output.
function shouldLog(level: LogLevel): boolean {
  if (minLevel === 'none') return false;
  return LEVEL_ORDER[level as Exclude<LogLevel, 'none'>] >= LEVEL_ORDER[minLevel as Exclude<LogLevel, 'none'>];
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
