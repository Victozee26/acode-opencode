import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isServerUp, isServerDownConfirmed, probeServer } from '../../src/opencode/health';
import {
  HEALTH_CHECK_TIMEOUT,
  HEALTH_CRASH_CONFIRM_ATTEMPTS,
  HEALTH_CRASH_RETRY_INTERVAL,
  HEALTH_CHECK_URL,
  HEALTH_CONFIG_URL,
} from '../../src/config/health';
import { BASE_URL } from '../../src/config/server';

const mockSendRequest = vi.fn();

type HttpWindow = { cordova: { plugin: { http: { sendRequest: typeof mockSendRequest } } } };

type MockResponse = { status?: number; data?: unknown };

const setHttp = (): void => {
  (window as unknown as HttpWindow).cordova = {
    plugin: { http: { sendRequest: mockSendRequest } },
  };
};

const clearHttp = (): void => {
  delete (window as unknown as { cordova?: unknown }).cordova;
};

// Answers the API route with the given status/body through the success callback.
const respondWith = (response: MockResponse): void => {
  mockSendRequest.mockImplementation(
    (_u: string, _o: unknown, success: (r?: MockResponse) => void) => success(response),
  );
};

// Answers with the given status through the failure callback (how the native
// plugin reports non-2xx answers).
const respondWithStatus = (status: number): void => {
  mockSendRequest.mockImplementation(
    (_u: string, _o: unknown, _s: unknown, failure: (e: MockResponse) => void) =>
      failure({ status }),
  );
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

  it('should_return_true_when_api_route_answers_unauthorized', async () => {
    // Arrange — the V2 API challenges every unauthenticated request
    setHttp();
    respondWithStatus(401);

    // Act
    const result = await isServerUp();

    // Assert
    expect(result).toBe(true);
    expect(mockSendRequest).toHaveBeenCalledTimes(1);
    expect(mockSendRequest.mock.calls[0][0]).toBe(HEALTH_CONFIG_URL);
  });

  it('should_return_true_when_api_route_answers_json', async () => {
    // Arrange — the V2 API answers JSON once the request carries valid auth
    setHttp();
    respondWith({ status: 200, data: '[{"type":"document"}]' });

    // Act
    const result = await isServerUp();

    // Assert
    expect(result).toBe(true);
    expect(mockSendRequest).toHaveBeenCalledTimes(1);
  });

  it('should_fall_back_to_health_route_when_api_route_answers_html', async () => {
    // Arrange — V1 has no /api/* routes and answers them with the SPA shell
    setHttp();
    mockSendRequest.mockImplementation(
      (url: string, _o: unknown, success: (r?: MockResponse) => void) =>
        success(
          url === HEALTH_CONFIG_URL
            ? { status: 200, data: '<!doctype html><title>OpenCode</title>' }
            : { status: 200, data: '{"healthy":true,"version":"1.19.3"}' },
        ),
    );

    // Act
    const result = await isServerUp();

    // Assert
    expect(result).toBe(true);
    expect(mockSendRequest).toHaveBeenCalledTimes(2);
    expect(mockSendRequest.mock.calls[1][0]).toBe(HEALTH_CHECK_URL);
  });

  it('should_return_false_when_foreign_server_answers_html_on_every_route', async () => {
    // Arrange — a foreign HTTP server on the port serves HTML everywhere
    setHttp();
    respondWith({ status: 200, data: '<!doctype html><title>Some other app</title>' });

    // Act
    const result = await isServerUp();

    // Assert
    expect(result).toBe(false);
    expect(mockSendRequest).toHaveBeenCalledTimes(2);
  });

  it('should_not_probe_further_when_nothing_listens', async () => {
    // Arrange — connection refused on the first route
    setHttp();
    respondWithStatus(0);

    // Act
    const result = await isServerUp();

    // Assert
    expect(result).toBe(false);
    expect(mockSendRequest).toHaveBeenCalledTimes(1);
  });

  it('should_send_basic_auth_header_on_the_api_route_when_password_known', async () => {
    // Arrange
    setHttp();
    respondWith({ status: 200, data: '[]' });

    // Act
    await isServerUp({ password: 'secret' });

    // Assert
    const [url, options] = mockSendRequest.mock.calls[0];
    expect(url).toBe(HEALTH_CONFIG_URL);
    expect((options as { headers?: Record<string, string> }).headers?.Authorization).toBe(
      `Basic ${btoa('opencode:secret')}`,
    );
  });

  it('should_not_send_basic_auth_header_without_password', async () => {
    // Arrange
    setHttp();
    respondWith({ status: 200, data: '[]' });

    // Act
    await isServerUp();

    // Assert
    const [, options] = mockSendRequest.mock.calls[0];
    expect(
      (options as { headers?: Record<string, string> }).headers?.Authorization,
    ).toBeUndefined();
  });
});

describe('probeServer', () => {
  it('should_return_unauthorized_when_api_route_answers_401', async () => {
    // Arrange — the V2 API challenges every unauthenticated request
    setHttp();
    respondWithStatus(401);

    // Act
    const result = await probeServer();

    // Assert
    expect(result).toBe('unauthorized');
  });

  it('should_return_up_when_api_route_answers_json', async () => {
    // Arrange
    setHttp();
    respondWith({ status: 200, data: '[]' });

    // Act
    const result = await probeServer();

    // Assert
    expect(result).toBe('up');
  });

  it('should_return_down_when_cordova_http_absent', async () => {
    // Arrange
    clearHttp();

    // Act
    const result = await probeServer();

    // Assert
    expect(result).toBe('down');
  });

  it('should_probe_the_given_base_url_when_one_is_passed', async () => {
    // Arrange
    setHttp();
    respondWith({ status: 200, data: '[]' });

    // Act
    await probeServer({ baseUrl: 'http://192.168.1.10:4096' });

    // Assert
    expect(mockSendRequest.mock.calls[0][0]).toBe('http://192.168.1.10:4096/api/config');
  });

  it('should_fall_back_to_the_health_route_when_api_route_answers_html', async () => {
    // Arrange — V1 has no /api/* routes and answers them with the SPA shell
    setHttp();
    mockSendRequest.mockImplementation(
      (url: string, _o: unknown, success: (r?: MockResponse) => void) =>
        success(
          url.endsWith('/api/config')
            ? { status: 200, data: '<!doctype html><title>OpenCode</title>' }
            : { status: 200, data: '{"healthy":true,"version":"1.19.3"}' },
        ),
    );

    // Act
    const result = await probeServer();

    // Assert
    expect(result).toBe('up');
    expect(mockSendRequest.mock.calls[1][0]).toBe(`${BASE_URL}/global/health`);
  });
});

describe('isServerDownConfirmed', () => {
  it('should_return_false_immediately_when_first_probe_up', async () => {
    // Arrange
    setHttp();
    mockSendRequest.mockImplementation((_u: string, _o: unknown, success: () => void) => success());

    // Act
    const result = await isServerDownConfirmed();

    // Assert
    expect(result).toBe(false);
    expect(mockSendRequest).toHaveBeenCalledTimes(1);
  });

  it('should_return_true_when_all_probes_down', async () => {
    // Arrange
    setHttp();
    vi.useFakeTimers();
    mockSendRequest.mockImplementation(
      (_u: string, _o: unknown, _s: unknown, failure: (e: { status: number }) => void) =>
        failure({ status: 0 }),
    );
    const promise = isServerDownConfirmed();

    // Act
    await vi.advanceTimersByTimeAsync(
      HEALTH_CRASH_RETRY_INTERVAL * (HEALTH_CRASH_CONFIRM_ATTEMPTS - 1),
    );
    const result = await promise;

    // Assert
    expect(result).toBe(true);
    expect(mockSendRequest).toHaveBeenCalledTimes(HEALTH_CRASH_CONFIRM_ATTEMPTS);
  });

  it('should_return_false_when_server_recovers_on_second_probe', async () => {
    // Arrange
    setHttp();
    vi.useFakeTimers();
    mockSendRequest
      .mockImplementationOnce(
        (_u: string, _o: unknown, _s: unknown, failure: (e: { status: number }) => void) =>
          failure({ status: 0 }),
      )
      .mockImplementation((_u: string, _o: unknown, success: () => void) => success());
    const promise = isServerDownConfirmed();

    // Act
    await vi.advanceTimersByTimeAsync(HEALTH_CRASH_RETRY_INTERVAL);
    const result = await promise;

    // Assert
    expect(result).toBe(false);
    expect(mockSendRequest).toHaveBeenCalledTimes(2);
  });

  it('should_return_false_when_server_recovers_on_last_probe', async () => {
    // Arrange
    setHttp();
    vi.useFakeTimers();
    mockSendRequest
      .mockImplementationOnce(
        (_u: string, _o: unknown, _s: unknown, failure: (e: { status: number }) => void) =>
          failure({ status: 0 }),
      )
      .mockImplementationOnce(
        (_u: string, _o: unknown, _s: unknown, failure: (e: { status: number }) => void) =>
          failure({ status: 0 }),
      )
      .mockImplementation((_u: string, _o: unknown, success: () => void) => success());
    const promise = isServerDownConfirmed();

    // Act
    await vi.advanceTimersByTimeAsync(
      HEALTH_CRASH_RETRY_INTERVAL * (HEALTH_CRASH_CONFIRM_ATTEMPTS - 1),
    );
    const result = await promise;

    // Assert
    expect(result).toBe(false);
    expect(mockSendRequest).toHaveBeenCalledTimes(HEALTH_CRASH_CONFIRM_ATTEMPTS);
  });

  it('should_send_the_known_password_on_every_confirmation_probe', async () => {
    // Arrange
    setHttp();
    respondWithStatus(0);

    // Act
    await isServerDownConfirmed({ password: 'secret' });

    // Assert
    expect(mockSendRequest).toHaveBeenCalledTimes(HEALTH_CRASH_CONFIRM_ATTEMPTS);
    for (const call of mockSendRequest.mock.calls) {
      const [, options] = call;
      expect((options as { headers?: Record<string, string> }).headers?.Authorization).toBe(
        `Basic ${btoa('opencode:secret')}`,
      );
    }
  });
});
