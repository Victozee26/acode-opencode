type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

let enabled = false;
// reserved — per-level filtering hook for future use
let _minLevel: LogLevel = 'debug';
void _minLevel;

export function setLogEnabled(value: boolean): void {
  enabled = value;
}

export function isLogEnabled(): boolean {
  return enabled;
}

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
