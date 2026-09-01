import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isServerUp } from '../../src/opencode/health';
import { HEALTH_CHECK_TIMEOUT } from '../../src/config/health';

const mockSendRequest = vi.fn();

type HttpWindow = { cordova: { plugin: { http: { sendRequest: typeof mockSendRequest } } } };

const setHttp = (): void => {
  (window as unknown as HttpWindow).cordova = {
    plugin: { http: { sendRequest: mockSendRequest } },
  };
};

const clearHttp = (): void => {
  delete (window as unknown as { cordova?: unknown }).cordova;
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  clearHttp();
});

describe('isServerUp', () => {
  it('should_return_true_when_success_callback_fires', async () => {
    // Arrange
    setHttp();
    mockSendRequest.mockImplementation((_u: string, _o: unknown, success: () => void) => success());

    // Act
    const result = await isServerUp();

    // Assert
    expect(result).toBe(true);
  });

  it('should_return_true_when_failure_has_positive_status', async () => {
    // Arrange
    setHttp();
    mockSendRequest.mockImplementation(
      (_u: string, _o: unknown, _s: unknown, failure: (e: { status: number }) => void) =>
        failure({ status: 200 }),
    );

    // Act
    const result = await isServerUp();

    // Assert
    expect(result).toBe(true);
  });

  it('should_return_false_when_failure_has_zero_status', async () => {
    // Arrange
    setHttp();
    mockSendRequest.mockImplementation(
      (_u: string, _o: unknown, _s: unknown, failure: (e: { status: number }) => void) =>
        failure({ status: 0 }),
    );

    // Act
    const result = await isServerUp();

    // Assert
    expect(result).toBe(false);
  });

  it('should_return_false_when_cordova_http_absent', async () => {
    // Arrange
    clearHttp();

    // Act
    const result = await isServerUp();

    // Assert
    expect(result).toBe(false);
  });

  it('should_return_false_when_sendRequest_throws', async () => {
    // Arrange
    setHttp();
    mockSendRequest.mockImplementation(() => {
      throw new Error('boom');
    });

    // Act
    const result = await isServerUp();

    // Assert
    expect(result).toBe(false);
  });

  it('should_return_false_when_no_callback_before_timeout', async () => {
    // Arrange
    setHttp();
    vi.useFakeTimers();
    mockSendRequest.mockImplementation(() => {});
    const promise = isServerUp();

    // Act
    await vi.advanceTimersByTimeAsync(HEALTH_CHECK_TIMEOUT + 500);
    const result = await promise;

    // Assert
    expect(result).toBe(false);
  });
});
