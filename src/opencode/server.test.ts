import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startServer, stopServer } from './server';
import * as executorModule from '../terminal/executor';
import {
  STARTUP_CHECK_DELAY,
  STOP_POLL_INTERVAL,
  STOP_POLL_TIMEOUT,
  KILL_COMMAND,
  HARD_KILL_COMMAND,
} from '../config';

vi.mock('../terminal/executor');

const mockExecute = vi.mocked(executorModule.execute);

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  global.fetch = mockFetch;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('stopServer', () => {
  it('resolves after SIGTERM when server goes down during polling', async () => {
    mockExecute.mockResolvedValue('ok');
    mockFetch
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('connection refused'));

    const promise = stopServer();

    await vi.advanceTimersByTimeAsync(STOP_POLL_INTERVAL + 100);

    await expect(promise).resolves.toBeUndefined();
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith(KILL_COMMAND);
  });

  it('escalates to SIGKILL when SIGTERM does not stop the server', async () => {
    mockExecute.mockResolvedValue('ok');
    mockFetch.mockResolvedValue({});

    const promise = stopServer();

    await vi.advanceTimersByTimeAsync(STOP_POLL_TIMEOUT + STOP_POLL_INTERVAL * 2);
    mockFetch.mockRejectedValueOnce(new Error('down'));
    await vi.advanceTimersByTimeAsync(STOP_POLL_INTERVAL);

    await expect(promise).resolves.toBeUndefined();
    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(mockExecute).toHaveBeenNthCalledWith(1, KILL_COMMAND);
    expect(mockExecute).toHaveBeenNthCalledWith(2, HARD_KILL_COMMAND);
  });

  it('throws when port is still occupied after both SIGTERM and SIGKILL', async () => {
    mockExecute.mockResolvedValue('ok');
    mockFetch.mockResolvedValue({});

    const promise = stopServer();
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(
      (STOP_POLL_TIMEOUT + STOP_POLL_INTERVAL) * 2 + STOP_POLL_INTERVAL,
    );

    await expect(promise).rejects.toThrow(
      'Cannot stop server: port 4096 still occupied after SIGKILL',
    );
    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(mockExecute).toHaveBeenNthCalledWith(1, KILL_COMMAND);
    expect(mockExecute).toHaveBeenNthCalledWith(2, HARD_KILL_COMMAND);
  });

  it('handles execute(SIGTERM) throwing and still escalates on polling failure', async () => {
    mockExecute.mockRejectedValueOnce(new Error('pkill failed'));
    mockExecute.mockResolvedValue('ok');
    mockFetch.mockResolvedValue({});

    const promise = stopServer();
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(
      (STOP_POLL_TIMEOUT + STOP_POLL_INTERVAL) * 2 + STOP_POLL_INTERVAL,
    );

    await expect(promise).rejects.toThrow('Cannot stop server: port 4096 still occupied after SIGKILL');
    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(mockExecute).toHaveBeenNthCalledWith(1, KILL_COMMAND);
    expect(mockExecute).toHaveBeenNthCalledWith(2, HARD_KILL_COMMAND);
  });
});

describe('pollUntilDown (via stopServer)', () => {
  it('times out when server never goes down, rejecting after both poll phases', async () => {
    mockExecute.mockResolvedValue('ok');
    mockFetch.mockResolvedValue({});

    const promise = stopServer();
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(
      (STOP_POLL_TIMEOUT + STOP_POLL_INTERVAL) * 2 + STOP_POLL_INTERVAL,
    );

    await expect(promise).rejects.toThrow('Cannot stop server');
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it('returns promptly when server is already down (no polls needed)', async () => {
    mockExecute.mockResolvedValue('ok');
    mockFetch.mockRejectedValue(new Error('refused'));

    await expect(stopServer()).resolves.toBeUndefined();
  });
});

describe('startServer', () => {
  it('resolves when pgrep finds the process alive after delay', async () => {
    mockExecute
      .mockResolvedValueOnce('ok')
      .mockResolvedValueOnce('1234');

    const promise = startServer();
    await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY);
    await expect(promise).resolves.toBeUndefined();
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it('throws with log output when process not found (pgrep returns empty)', async () => {
    const logLines = 'Error: port conflict';
    mockExecute
      .mockResolvedValueOnce('ok')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce(`  ${logLines}  \n`);

    const promise = startServer();
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY);
    await expect(promise).rejects.toThrow('OpenCode server process exited');
    await expect(promise).rejects.toThrow(logLines);
  });

  it('throws with "(no log output)" when process not found and log read returns empty', async () => {
    mockExecute
      .mockResolvedValueOnce('ok')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('');

    const promise = startServer();
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY);
    await expect(promise).rejects.toThrow('(no log output)');
  });

  it('readLogTail trims whitespace from output when tail succeeds', async () => {
    mockExecute
      .mockResolvedValueOnce('ok')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('\n  ValueError: bad config  \n\n');

    const promise = startServer();
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY);
    await expect(promise).rejects.toThrow('ValueError: bad config');
  });

  it('readLogTail returns empty string when tail command fails', async () => {
    mockExecute
      .mockResolvedValueOnce('ok')
      .mockResolvedValueOnce('')
      .mockRejectedValueOnce(new Error('log file missing'));

    const promise = startServer();
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY);
    await expect(promise).rejects.toThrow('(no log output)');
  });
});
