import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startServer, stopServer, waitForReady } from '../../src/opencode/server';
import * as executorModule from '../../src/terminal/executor';
import {
  STOP_POLL_INTERVAL,
  STOP_POLL_TIMEOUT,
  READY_POLL_INTERVAL,
  READY_TIMEOUT,
} from '../../src/config/opencode';

vi.mock('../../src/terminal/executor');

const mockExecute = vi.mocked(executorModule.execute);
const mockStartBackground = vi.mocked(executorModule.startBackground);
const mockStopBackground = vi.mocked(executorModule.stopBackground);

const mockSendRequest = vi.fn();

const respondUp = (): void => {
  mockSendRequest.mockImplementation((_u: string, _o: unknown, success: () => void) => success());
};

const respondDown = (): void => {
  mockSendRequest.mockImplementation(
    (_u: string, _o: unknown, _s: unknown, failure: (e: { status: number }) => void) =>
      failure({ status: 0 }),
  );
};

async function givenRunningServer(): Promise<void> {
  mockStartBackground.mockResolvedValue({ uuid: 'test-uuid' } as executorModule.BackgroundProcess);
  await startServer();
  mockStartBackground.mockClear();
  mockStopBackground.mockClear();
  mockExecute.mockClear();
  mockSendRequest.mockClear();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockStartBackground.mockResolvedValue({ uuid: 'test-uuid' } as executorModule.BackgroundProcess);
  mockStopBackground.mockResolvedValue('stopped');
  mockExecute.mockResolvedValue('ok');
  (window as any).cordova = { plugin: { http: { sendRequest: mockSendRequest } } };
});

afterEach(() => {
  vi.useRealTimers();
});

describe('startServer', () => {
  it('should_resolve_when_background_process_launches', async () => {
    // Arrange
    mockStartBackground.mockResolvedValue({ uuid: 'test-uuid' } as executorModule.BackgroundProcess);

    // Act
    const promise = startServer();

    // Assert
    await expect(promise).resolves.toBeUndefined();
  });
});

describe('stopServer', () => {
  it('should_resolve_when_server_goes_down_after_stop', async () => {
    // Arrange
    await givenRunningServer();
    mockStopBackground.mockResolvedValue('stopped');
    mockSendRequest
      .mockImplementationOnce((_u: string, _o: unknown, success: () => void) => success())
      .mockImplementationOnce(
        (_u: string, _o: unknown, _s: unknown, failure: (e: { status: number }) => void) =>
          failure({ status: 0 }),
      );

    // Act
    const promise = stopServer();
    await vi.advanceTimersByTimeAsync(STOP_POLL_INTERVAL + 100);

    // Assert
    await expect(promise).resolves.toBeUndefined();
  });

  it('should_resolve_promptly_when_server_already_down', async () => {
    // Arrange
    await givenRunningServer();
    mockStopBackground.mockResolvedValue('stopped');
    respondDown();

    // Act
    const promise = stopServer();

    // Assert
    await expect(promise).resolves.toBeUndefined();
  });

  it('should_throw_when_port_still_occupied_after_SIGKILL', async () => {
    // Arrange
    await givenRunningServer();
    mockStopBackground.mockResolvedValue('stopped');
    mockExecute.mockResolvedValue('ok');
    respondUp();
    const promise = stopServer();
    promise.catch(() => {});

    // Act
    await vi.advanceTimersByTimeAsync(
      (STOP_POLL_TIMEOUT + STOP_POLL_INTERVAL) * 2 + STOP_POLL_INTERVAL,
    );

    // Assert
    await expect(promise).rejects.toThrow('Cannot stop server: port 4096 still occupied after SIGKILL');
  });

  it('should_throw_after_both_poll_phases_when_server_never_down', async () => {
    // Arrange
    await givenRunningServer();
    mockStopBackground.mockResolvedValue('stopped');
    mockExecute.mockResolvedValue('ok');
    respondUp();
    const promise = stopServer();
    promise.catch(() => {});

    // Act
    await vi.advanceTimersByTimeAsync(
      (STOP_POLL_TIMEOUT + STOP_POLL_INTERVAL) * 2 + STOP_POLL_INTERVAL,
    );

    // Assert
    await expect(promise).rejects.toThrow('Cannot stop server');
  });
});

describe('waitForReady', () => {
  it('should_resolve_immediately_when_server_is_up', async () => {
    // Arrange
    respondUp();

    // Act
    const promise = waitForReady();

    // Assert
    await expect(promise).resolves.toBeUndefined();
  });

  it('should_throw_timeout_with_alive_when_pgrep_has_output', async () => {
    // Arrange
    respondDown();
    mockExecute.mockResolvedValue('12345');
    const promise = waitForReady();
    promise.catch(() => {});

    // Act
    await vi.advanceTimersByTimeAsync(READY_TIMEOUT + READY_POLL_INTERVAL);

    // Assert
    await expect(promise).rejects.toThrow(`Server did not respond within ${READY_TIMEOUT / 1000}s`);
  });

  it('should_report_dead_when_pgrep_empty', async () => {
    // Arrange
    respondDown();
    mockExecute.mockResolvedValue('');
    const promise = waitForReady();
    promise.catch(() => {});

    // Act
    await vi.advanceTimersByTimeAsync(READY_TIMEOUT + READY_POLL_INTERVAL);

    // Assert
    await expect(promise).rejects.toThrow('Process state: dead');
  });

  it('should_report_alive_process_state_when_server_never_responds', async () => {
    // Arrange
    respondDown();
    mockExecute.mockResolvedValue('12345');
    const promise = waitForReady();
    promise.catch(() => {});

    // Act
    await vi.advanceTimersByTimeAsync(READY_TIMEOUT + READY_POLL_INTERVAL);

    // Assert
    await expect(promise).rejects.toThrow('Process state: alive');
  });
});
