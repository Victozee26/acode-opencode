import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  startServer,
  stopServer,
  waitForReady,
  getServerLog,
  buildStartCommand,
  getServerPassword,
  isV2Server,
} from '../../src/opencode/server';
import * as executorModule from '../../src/terminal/executor';
import { SERVER_PASSWORD_ENV, PORT } from '../../src/config/server';
import { HEALTH_CONFIG_URL } from '../../src/config/health';
import {
  STOP_POLL_INTERVAL,
  STOP_POLL_TIMEOUT,
  READY_POLL_INTERVAL,
  READY_TIMEOUT,
  KILL_COMMAND,
  HARD_KILL_COMMAND,
  PROCESS_CHECK_COMMAND,
} from '../../src/config/opencode';

vi.mock('../../src/terminal/executor');

const mockExecute = vi.mocked(executorModule.execute);
const mockStartProcess = vi.mocked(executorModule.startProcess);
const mockStopProcess = vi.mocked(executorModule.stopProcess);

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockStartProcess.mockResolvedValue({ uuid: 'test-uuid' } as executorModule.ProcessHandle);
  mockStopProcess.mockResolvedValue('stopped');
  mockExecute.mockResolvedValue('ok');
  (window as any).cordova = { plugin: { http: { sendRequest: mockSendRequest } } };
});

afterEach(() => {
  vi.useRealTimers();
});

describe('startServer', () => {
  it('should_resolve_when_the_process_launches', async () => {
    // Arrange
    mockStartProcess.mockResolvedValue({ uuid: 'test-uuid' } as executorModule.ProcessHandle);

    // Act
    const promise = startServer();

    // Assert
    await expect(promise).resolves.toBeUndefined();
  });

  it('should_reject_when_start_fails', async () => {
    // Arrange
    mockStartProcess.mockRejectedValue(new Error('spawn failed'));

    // Act
    const promise = startServer();

    // Assert
    await expect(promise).rejects.toThrow('spawn failed');
  });

  it('should_drop_proot_warnings_but_keep_proot_info_in_server_log', async () => {
    // Arrange
    mockStartProcess.mockImplementation((_command, onData) => {
      onData?.(
        'stdout',
        'proot warning: can\'t sanitize binding "/proc/self/fd/0": No such file or directory\n' +
          'Warning: OPENCODE_SERVER_PASSWORD is not set; server is unsecured.\n' +
          'proot info: vpid 1: terminated with signal 9\n' +
          'opencode server listening on http://127.0.0.1:4123',
      );
      return Promise.resolve({ uuid: 'test-uuid' } as executorModule.ProcessHandle);
    });

    // Act
    await startServer();

    // Assert
    expect(getServerLog()).toBe(
      'Warning: OPENCODE_SERVER_PASSWORD is not set; server is unsecured.\n' +
        'proot info: vpid 1: terminated with signal 9\n' +
        'opencode server listening on http://127.0.0.1:4123',
    );
  });
});

describe('stopServer', () => {
  it('should_resolve_when_server_goes_down_after_stop', async () => {
    // Arrange
    mockStartProcess.mockResolvedValue({ uuid: 'test-uuid' } as executorModule.ProcessHandle);
    await startServer();
    mockStartProcess.mockClear();
    mockStopProcess.mockClear();
    mockExecute.mockClear();
    mockSendRequest.mockClear();
    mockStopProcess.mockResolvedValue('stopped');
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
    mockStartProcess.mockResolvedValue({ uuid: 'test-uuid' } as executorModule.ProcessHandle);
    await startServer();
    mockStartProcess.mockClear();
    mockStopProcess.mockClear();
    mockExecute.mockClear();
    mockSendRequest.mockClear();
    mockStopProcess.mockResolvedValue('stopped');
    respondDown();

    // Act
    const promise = stopServer();

    // Assert
    await expect(promise).resolves.toBeUndefined();
  });

  it('should_throw_when_port_still_occupied_after_SIGKILL', async () => {
    // Arrange
    mockStartProcess.mockResolvedValue({ uuid: 'test-uuid' } as executorModule.ProcessHandle);
    await startServer();
    mockStartProcess.mockClear();
    mockStopProcess.mockClear();
    mockExecute.mockClear();
    mockSendRequest.mockClear();
    mockStopProcess.mockResolvedValue('stopped');
    mockExecute.mockResolvedValue('ok');
    respondUp();
    const promise = stopServer();
    promise.catch(() => {});

    // Act
    await vi.advanceTimersByTimeAsync(
      (STOP_POLL_TIMEOUT + STOP_POLL_INTERVAL) * 2 + STOP_POLL_INTERVAL,
    );

    // Assert
    await expect(promise).rejects.toThrow('Cannot stop server: port 4123 still occupied after SIGKILL');
  });

  it('should_throw_after_both_poll_phases_when_server_never_down', async () => {
    // Arrange
    mockStartProcess.mockResolvedValue({ uuid: 'test-uuid' } as executorModule.ProcessHandle);
    await startServer();
    mockStartProcess.mockClear();
    mockStopProcess.mockClear();
    mockExecute.mockClear();
    mockSendRequest.mockClear();
    mockStopProcess.mockResolvedValue('stopped');
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

describe('v2 server auth', () => {
  it('should_scope_kill_and_process_checks_to_plugin_port', () => {
    // Assert
    for (const command of [KILL_COMMAND, HARD_KILL_COMMAND, PROCESS_CHECK_COMMAND]) {
      expect(command).toContain(`--port ${PORT}`);
    }
  });

  it('should_build_plain_command_when_password_null', () => {
    // Act
    const command = buildStartCommand(null);

    // Assert
    expect(command).toBe('opencode serve --port 4123 --hostname 127.0.0.1');
  });

  it('should_prefix_password_via_env_when_password_set', () => {
    // Act
    const command = buildStartCommand('secret');

    // Assert
    expect(command).toBe(
      `env ${SERVER_PASSWORD_ENV}=secret opencode serve --port 4123 --hostname 127.0.0.1`,
    );
  });

  it('should_enable_auth_when_cli_is_v2', async () => {
    // Arrange
    mockExecute.mockResolvedValue('2.0.27');

    // Act
    await startServer();

    // Assert
    expect(isV2Server()).toBe(true);
    const password = getServerPassword();
    expect(password).toMatch(/^[0-9a-f]{48}$/);
    expect(mockStartProcess).toHaveBeenCalledWith(
      expect.stringContaining(`${SERVER_PASSWORD_ENV}=${password}`),
      expect.any(Function),
      true,
    );
    respondDown();
    await stopServer();
  });

  it('should_skip_auth_when_cli_is_v1', async () => {
    // Arrange
    mockExecute.mockResolvedValue('1.8.0');

    // Act
    await startServer();

    // Assert
    expect(isV2Server()).toBe(false);
    expect(getServerPassword()).toBeNull();
    expect(mockStartProcess).toHaveBeenCalledWith(
      'opencode serve --port 4123 --hostname 127.0.0.1',
      expect.any(Function),
      true,
    );
    respondDown();
    await stopServer();
  });

  it('should_clear_password_when_server_stops', async () => {
    // Arrange
    mockExecute.mockResolvedValue('2.0.27');
    await startServer();
    expect(getServerPassword()).not.toBeNull();
    respondDown();

    // Act
    await stopServer();

    // Assert
    expect(getServerPassword()).toBeNull();
    expect(isV2Server()).toBe(false);
  });

  it('should_clear_auth_when_start_fails', async () => {
    // Arrange
    mockExecute.mockResolvedValue('2.0.27');
    mockStartProcess.mockRejectedValueOnce(new Error('spawn failed'));

    // Act
    const promise = startServer();

    // Assert
    await expect(promise).rejects.toThrow('spawn failed');
    expect(getServerPassword()).toBeNull();
    expect(isV2Server()).toBe(false);
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

  it('should_probe_with_the_launch_password', async () => {
    // Arrange — a V2 launch holds the password the API expects
    mockExecute.mockResolvedValue('2.1.2');
    await startServer();
    mockSendRequest.mockClear();
    respondUp();

    // Act
    await waitForReady();

    // Assert
    const [url, options] = mockSendRequest.mock.calls[0];
    expect(url).toBe(HEALTH_CONFIG_URL);
    expect((options as { headers?: Record<string, string> }).headers?.Authorization).toBe(
      `Basic ${btoa(`opencode:${getServerPassword()}`)}`,
    );
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
