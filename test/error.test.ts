import { describe, it, expect } from 'vitest';
import { extractErrorInfo } from '../src/error';
import { ERROR_FALLBACK_MESSAGE } from '../src/config';

describe('extractErrorInfo', () => {
  it('uses the first line as summary and the rest as logTail', () => {
    const result = extractErrorInfo(new Error('headline\nline two\nline three'));

    expect(result.summary).toBe('headline');
    expect(result.logTail).toBe('line two\nline three');
  });

  it('returns an empty logTail for a single-line error', () => {
    const result = extractErrorInfo(new Error('just one line'));

    expect(result.summary).toBe('just one line');
    expect(result.logTail).toBe('');
  });

  it('coerces non-Error values to a string summary', () => {
    const result = extractErrorInfo('plain string failure');

    expect(result.summary).toBe('plain string failure');
    expect(result.logTail).toBe('');
  });

  it('falls back to ERROR_FALLBACK_MESSAGE when the error is empty/falsy', () => {
    const result = extractErrorInfo('');

    expect(result.summary).toBe(ERROR_FALLBACK_MESSAGE);
    expect(result.logTail).toBe('');
  });
});
