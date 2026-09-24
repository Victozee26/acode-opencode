import { ERROR_FALLBACK_MESSAGE } from './config/health';
import type { RuntimeVersions } from './types';

// Normalized error shape produced by extractErrorInfo: a short headline plus
// the remaining diagnostic lines.
export interface ExtractedError {
  summary: string;
  logTail: string;
}

/**
 * Normalizes an unknown error into a short headline plus a diagnostic tail.
 *
 * The error text is split on newlines because server.ts formats multi-line
 * error messages (details on subsequent lines). The first line becomes the
 * concise `summary` shown prominently; the remainder becomes `logTail`, the
 * collapsible diagnostic detail. A null/empty error falls back to
 * ERROR_FALLBACK_MESSAGE so the UI always has something to show.
 */
export function extractErrorInfo(err: unknown): ExtractedError {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const text = rawMessage || ERROR_FALLBACK_MESSAGE;
  const lines = text.split('\n');
  return {
    summary: lines[0],
    logTail: lines.slice(1).join('\n'),
  };
}

/**
 * Builds the text of the error view's diagnostics block: the server/install
 * log tail (when present) followed by the probed node and npm versions.
 *
 * Trailing newlines are trimmed from `logTail` so the version block never
 * starts with a blank gap. Used both for the initial render (with pending
 * placeholders) and when the async probe fills the real versions in.
 */
export function formatDiagnostics(logTail: string, versions: RuntimeVersions): string {
  const versionBlock = `node: ${versions.node}\nnpm: ${versions.npm}`;
  const tail = logTail.replace(/\n+$/, '');
  return tail ? `${tail}\n\n${versionBlock}` : versionBlock;
}
