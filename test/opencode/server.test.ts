import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startServer, stopServer, waitForReady } from '../../src/opencode/server';
import * as executorModule from '../../src/terminal/executor';
import {
  STARTUP_CHECK_DELAY,
  STOP_POLL_INTERVAL,
  STOP_POLL_TIMEOUT,
  KILL_COMMAND,
  HARD_KILL_COMMAND,
  PROCESS_CHECK_COMMAND,
  READY_POLL_INTERVAL,
  READY_TIMEOUT,
} from '../../src/config/opencode';

vi.mock('../../src/terminal/executor');

const mockExecute = vi.mocked(executorModule.execute);

const mockBgStart = vi.fn();
const mockBgStop = vi.fn();
const mockBgIsRunning = vi.fn();

(globalThis as any).Executor = {
  BackgroundExecutor: {
    start: mockBgStart,
    stop: mockBgStop,
    isRunning: mockBgIsRunning,
  },
};

const mockSendRequest = vi.fn();

const respondUp = () =>
  mockSendRequest.mockImplementation((_u: string, _o: unknown, success: () => void) => success());
const respondDown = () =>
  mockSendRequest.mockImplementation(
    (_u: string, _o: unknown, _s: unknown, failure: (e: { status: number }) => void) =>
      failure({ status: 0 }),
  );

async function givenRunningServer(): Promise<void> {
  mockBgStart.mockResolvedValue('test-uuid');
  mockBgIsRunning.mockResolvedValue(true);
  mockExecute.mockResolvedValue('1234');

  const promise = startServer();
  await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY + 100);
  await promise;

  mockBgStart.mockClear();
  mockBgStop.mockClear();
  mockBgIsRunning.mockClear();
  mockExecute.mockClear();
  mockSendRequest.mockClear();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockBgStart.mockResolvedValue('test-uuid');
  mockBgStop.mockResolvedValue(undefined);
  mockBgIsRunning.mockResolvedValue(true);
  mockExecute.mockResolvedValue('ok');
  (window as any).cordova = { plugin: { http: { sendRequest: mockSendRequest } } };
});

afterEach(() => {
  vi.useRealTimers();
});

describe('startServer', () => {
  it('resolves when pgrep finds the process alive after delay', async () => {
    mockBgStart.mockResolvedValue('test-uuid');
    mockBgIsRunning.mockResolvedValue(true);
    mockExecute.mockResolvedValue('1234');

    const promise = startServer();
    await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY + 100);
    await expect(promise).resolves.toBeUndefined();
    expect(mockBgStart).toHaveBeenCalledTimes(1);
    expect(mockBgIsRunning).toHaveBeenCalledWith('test-uuid');
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith(PROCESS_CHECK_COMMAND);
  });

  it('throws when BackgroundExecutor.isRunning says process dead', async () => {
    mockBgStart.mockResolvedValue('test-uuid');
    mockBgIsRunning.mockResolvedValue(false);

    const promise = startServer();
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY + 100);
    await expect(promise).rejects.toThrow('OpenCode server process exited immediately after start.');
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('throws when pgrep returns empty', async () => {
    mockBgStart.mockResolvedValue('test-uuid');
    mockBgIsRunning.mockResolvedValue(true);
    mockExecute.mockResolvedValue('');

    const promise = startServer();
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY + 100);
    await expect(promise).rejects.toThrow('OpenCode server process exited immediately after start.');
  });
});

describe('stopServer', () => {
  it('resolves after BackgroundExecutor.stop() when server goes down during polling', async () => {
    await givenRunningServer();
    mockBgStop.mockResolvedValue(undefined);
    mockSendRequest
      .mockImplementationOnce((_u: string, _o: unknown, success: () => void) => success())
      .mockImplementationOnce(
        (_u: string, _o: unknown, _s: unknown, failure: (e: { status: number }) => void) =>
          failure({ status: 0 }),
      );

    const promise = stopServer();
    await vi.advanceTimersByTimeAsync(STOP_POLL_INTERVAL + 100);
    await expect(promise).resolves.toBeUndefined();
    expect(mockBgStop).toHaveBeenCalledWith('test-uuid');
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('escalates to HARD_KILL_COMMAND when stop succeeds but server stays up', async () => {
    await givenRunningServer();
    mockBgStop.mockResolvedValue(undefined);
    mockExecute.mockResolvedValue('ok');
    respondUp();

    const promise = stopServer();

    await vi.advanceTimersByTimeAsync(STOP_POLL_TIMEOUT + STOP_POLL_INTERVAL * 2);
    mockSendRequest.mockImplementationOnce(
      (_u: string, _o: unknown, _s: unknown, failure: (e: { status: number }) => void) =>
        failure({ status: 0 }),
    );
    await vi.advanceTimersByTimeAsync(STOP_POLL_INTERVAL + 100);

    await expect(promise).resolves.toBeUndefined();
    expect(mockBgStop).toHaveBeenCalledWith('test-uuid');
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith(HARD_KILL_COMMAND);
  });

  it('throws when port is still occupied after both phases', async () => {
    await givenRunningServer();
    mockBgStop.mockResolvedValue(undefined);
    mockExecute.mockResolvedValue('ok');
    respondUp();

    const promise = stopServer();
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(
      (STOP_POLL_TIMEOUT + STOP_POLL_INTERVAL) * 2 + STOP_POLL_INTERVAL,
    );

    await expect(promise).rejects.toThrow(
      'Cannot stop server: port 4096 still occupied after SIGKILL',
    );
    expect(mockBgStop).toHaveBeenCalledWith('test-uuid');
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith(HARD_KILL_COMMAND);
  });

  it('handles BackgroundExecutor.stop() throwing and falls back to pkill + escalation', async () => {
    await givenRunningServer();
    mockBgStop.mockRejectedValue(new Error('stop failed'));
    mockExecute.mockResolvedValue('ok');
    respondUp();

    const promise = stopServer();
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(
      (STOP_POLL_TIMEOUT + STOP_POLL_INTERVAL) * 2 + STOP_POLL_INTERVAL,
    );

    await expect(promise).rejects.toThrow('Cannot stop server: port 4096 still occupied after SIGKILL');
    expect(mockBgStop).toHaveBeenCalledWith('test-uuid');
    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(mockExecute).toHaveBeenNthCalledWith(1, KILL_COMMAND);
    expect(mockExecute).toHaveBeenNthCalledWith(2, HARD_KILL_COMMAND);
  });
});

describe('pollUntilDown (via stopServer)', () => {
  it('times out when server never goes down, rejecting after both poll phases', async () => {
    await givenRunningServer();
    mockBgStop.mockResolvedValue(undefined);
    mockExecute.mockResolvedValue('ok');
    respondUp();

    const promise = stopServer();
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(
      (STOP_POLL_TIMEOUT + STOP_POLL_INTERVAL) * 2 + STOP_POLL_INTERVAL,
    );

    await expect(promise).rejects.toThrow('Cannot stop server');
    expect(mockBgStop).toHaveBeenCalledWith('test-uuid');
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith(HARD_KILL_COMMAND);
  });

  it('returns promptly when server is already down', async () => {
    await givenRunningServer();
    mockBgStop.mockResolvedValue(undefined);
    respondDown();

    await expect(stopServer()).resolves.toBeUndefined();
    expect(mockBgStop).toHaveBeenCalledWith('test-uuid');
  });
});

describe('waitForReady', () => {
  it('resolves immediately when isServerUp returns true on first poll', async () => {
    respondUp();

    await expect(waitForReady()).resolves.toBeUndefined();
  });

  it('times out and includes process state when server never responds', async () => {
    respondDown();
    mockExecute.mockResolvedValue('12345');

    const promise = waitForReady();
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(READY_TIMEOUT + READY_POLL_INTERVAL);

    await expect(promise).rejects.toThrow(
      `Server did not respond within ${READY_TIMEOUT / 1000}s`,
    );
    await expect(promise).rejects.toThrow('Process state: alive');
  });

  it('times out and reports process dead when pgrep returns empty', async () => {
    respondDown();
    mockExecute.mockResolvedValue('');

    const promise = waitForReady();
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(READY_TIMEOUT + READY_POLL_INTERVAL);

    await expect(promise).rejects.toThrow('Process state: dead');
  });
});
