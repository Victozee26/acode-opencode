import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isServerUp } from './health';
import { HEALTH_CHECK_TIMEOUT } from '../config';

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
  it('returns true on the success callback', async () => {
    setHttp();
    mockSendRequest.mockImplementation((_u: string, _o: unknown, success: () => void) => success());
    await expect(isServerUp()).resolves.toBe(true);
  });

  it('returns true when the failure callback carries a positive status', async () => {
    setHttp();
    mockSendRequest.mockImplementation(
      (_u: string, _o: unknown, _s: unknown, failure: (e: { status: number }) => void) =>
        failure({ status: 200 }),
    );
    await expect(isServerUp()).resolves.toBe(true);
  });

  it('returns false when the failure callback carries a non-positive status', async () => {
    setHttp();
    mockSendRequest.mockImplementation(
      (_u: string, _o: unknown, _s: unknown, failure: (e: { status: number }) => void) =>
        failure({ status: 0 }),
    );
    await expect(isServerUp()).resolves.toBe(false);
  });

  it('returns false immediately when cordova.plugin.http is absent', async () => {
    clearHttp();
    await expect(isServerUp()).resolves.toBe(false);
    expect(mockSendRequest).not.toHaveBeenCalled();
  });

  it('returns false when sendRequest throws synchronously', async () => {
    setHttp();
    mockSendRequest.mockImplementation(() => {
      throw new Error('boom');
    });
    await expect(isServerUp()).resolves.toBe(false);
  });

  it('returns false if neither callback fires before the watchdog expires', async () => {
    setHttp();
    vi.useFakeTimers();
    // Never invokes a callback — the watchdog must bound the wait.
    mockSendRequest.mockImplementation(() => {});
    const promise = isServerUp();
    await vi.advanceTimersByTimeAsync(HEALTH_CHECK_TIMEOUT + 500);
    await expect(promise).resolves.toBe(false);
  });
});
