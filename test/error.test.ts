import { describe, it, expect } from 'vitest';
import { extractErrorInfo } from '../src/error';
import { ERROR_FALLBACK_MESSAGE } from '../src/config/health';

describe('extractErrorInfo', () => {
  it('should_extract_summary_and_logTail_when_error_has_multiline_message', () => {
    // Arrange
    const error = new Error('headline\nline two\nline three');

    // Act
    const result = extractErrorInfo(error);

    // Assert
    expect(result.summary).toBe('headline');
  });

  it('should_extract_logTail_when_error_has_multiline_message', () => {
    // Arrange
    const error = new Error('headline\nline two\nline three');

    // Act
    const result = extractErrorInfo(error);

    // Assert
    expect(result.logTail).toBe('line two\nline three');
  });

  it('should_return_empty_logTail_when_error_is_single_line', () => {
    // Arrange
    const error = new Error('just one line');

    // Act
    const result = extractErrorInfo(error);

    // Assert
    expect(result.logTail).toBe('');
  });

  it('should_return_summary_when_error_is_single_line', () => {
    // Arrange
    const error = new Error('just one line');

    // Act
    const result = extractErrorInfo(error);

    // Assert
    expect(result.summary).toBe('just one line');
  });

  it('should_coerce_to_string_when_error_is_plain_string', () => {
    // Arrange
    const error = 'plain string failure';

    // Act
    const result = extractErrorInfo(error);

    // Assert
    expect(result.summary).toBe('plain string failure');
  });

  it('should_return_fallback_when_error_is_empty_string', () => {
    // Arrange
    const error = '';

    // Act
    const result = extractErrorInfo(error);

    // Assert
    expect(result.summary).toBe(ERROR_FALLBACK_MESSAGE);
  });

  it('should_return_empty_logTail_when_error_is_non_Error_string', () => {
    // Arrange
    const error = 'plain string failure';

    // Act
    const result = extractErrorInfo(error);

    // Assert
    expect(result.logTail).toBe('');
  });

  it('should_return_fallback_with_empty_logTail_when_error_is_empty', () => {
    // Arrange
    const error = '';

    // Act
    const result = extractErrorInfo(error);

    // Assert
    expect(result.logTail).toBe('');
  });

  it('should_coerce_null_when_error_is_null', () => {
    // Arrange
    const error = null;

    // Act
    const result = extractErrorInfo(error);

    // Assert
    expect(result.summary).toBe('null');
  });

  it('should_coerce_undefined_when_error_is_undefined', () => {
    // Arrange
    const error = undefined;

    // Act
    const result = extractErrorInfo(error);

    // Assert
    expect(result.summary).toBe('undefined');
  });
});
