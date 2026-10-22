import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  execute,
  startProcess,
  stopProcess,
  isProcessRunning,
  writeProcess,
  executeVerbose,
  ensureAlpineAvailable,
} from '../../src/terminal/executor';

const mockExecute = vi.fn();
const mockStart = vi.fn();
const mockStop = vi.fn();
const mockIsRunning = vi.fn();
const mockWrite = vi.fn();
// The background executor is mocked too, so the tests can prove that no
// long-lived process is started on it: Android may kill background processes
// once Acode leaves the foreground.
const mockBgStart = vi.fn();

beforeEach(() => {
  // Drop the globals stubbed by the previous test before setting up the mocks.
  vi.unstubAllGlobals();
  vi.stubGlobal('Executor', {
    execute: mockExecute,
    start: mockStart,
    stop: mockStop,
    isRunning: mockIsRunning,
    write: mockWrite,
    BackgroundExecutor: {
      start: mockBgStart,
      stop: vi.fn(),
      isRunning: vi.fn(),
      write: vi.fn(),
    },
  });
  // No terminal global by default: the plugin then skips the runtime check,
  // which is the behaviour on Acode builds that do not expose it.
  vi.stubGlobal('Terminal', undefined);
  mockExecute.mockReset();
  mockStart.mockReset();
  mockStop.mockReset();
  mockIsRunning.mockReset();
  mockWrite.mockReset();
  mockBgStart.mockReset();
});

describe('ensureAlpineAvailable', () => {
  it('should_throw_when_the_terminal_runtime_is_missing', async () => {
    // Arrange
    vi.stubGlobal('Terminal', { isInstalled: vi.fn().mockResolvedValue(false) });

    // Act
    const promise = ensureAlpineAvailable();

    // Assert
    await expect(promise).rejects.toThrow("terminal environment is not installed");
  });

  it('should_resolve_when_the_terminal_runtime_is_available', async () => {
    // Arrange
    vi.stubGlobal('Terminal', { isInstalled: vi.fn().mockResolvedValue(true) });

    // Act / Assert
    await expect(ensureAlpineAvailable()).resolves.toBeUndefined();
  });

  it('should_skip_the_check_when_the_terminal_global_is_absent', async () => {
    // Arrange
    vi.stubGlobal('Terminal', undefined);

    // Act / Assert
    await expect(ensureAlpineAvailable()).resolves.toBeUndefined();
  });

  it('should_skip_the_check_when_the_probe_fails', async () => {
    // Arrange
    vi.stubGlobal('Terminal', {
      isInstalled: vi.fn().mockRejectedValue(new Error('probe failed')),
    });

    // Act / Assert
    await expect(ensureAlpineAvailable()).resolves.toBeUndefined();
  });

  it('should_reject_the_command_when_the_terminal_runtime_is_missing', async () => {
    // Arrange
    vi.stubGlobal('Terminal', { isInstalled: vi.fn().mockResolvedValue(false) });
    mockExecute.mockResolvedValue('hello');

    // Act
    const promise = execute('echo hello');

    // Assert
    await expect(promise).rejects.toThrow("terminal environment is not installed");
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

describe('execute', () => {
  it('should_resolve_with_output_when_command_succeeds', async () => {
    // Arrange
    mockExecute.mockResolvedValue('hello world');

    // Act
    const result = await execute('echo hello', false);

    // Assert
    expect(result).toBe('hello world');
  });

  it('should_reject_with_command_failed_when_no_output', async () => {
    // Arrange
    mockExecute.mockRejectedValue(new Error('ENOENT'));

    // Act
    const promise = execute('bad-command');

    // Assert
    await expect(promise).rejects.toThrow('Command failed: ENOENT');
  });

  it('should_reject_with_output_when_error_has_output', async () => {
    // Arrange
    const err = Object.assign(new Error('non-zero exit'), { output: 'not found' });
    mockExecute.mockRejectedValue(err);

    // Act
    const promise = execute('bad-command');

    // Assert
    await expect(promise).rejects.toThrow('Command failed: non-zero exit\nOutput: not found');
  });

  it('should_reject_with_string_when_rejection_is_string', async () => {
    // Arrange
    mockExecute.mockRejectedValue('plain string error');

    // Act
    const promise = execute('bad-command');

    // Assert
    await expect(promise).rejects.toThrow('Command failed: plain string error');
  });

  it('should_include_output_when_rejection_object_has_output', async () => {
    // Arrange
    const rejection = { message: 'gone', output: 'traceback...' };
    mockExecute.mockRejectedValue(rejection);

    // Act
    const promise = execute('bad-command');

    // Assert
    await expect(promise).rejects.toThrow('Output: traceback...');
  });

  it('should_include_output_when_rejection_has_no_message', async () => {
    // Arrange
    const rejection = { output: 'some stderr output' };
    mockExecute.mockRejectedValue(rejection);

    // Act
    const promise = execute('bad-command');

    // Assert
    await expect(promise).rejects.toThrow('Output: some stderr output');
  });
});

describe('startProcess', () => {
  it('should_return_uuid_when_start_succeeds', async () => {
    // Arrange
    mockStart.mockResolvedValue('test-uuid');

    // Act
    const process = await startProcess('my-command');

    // Assert
    expect(process.uuid).toBe('test-uuid');
  });

  it('should_start_on_the_foreground_executor', async () => {
    // Arrange
    mockStart.mockResolvedValue('test-uuid');

    // Act
    await startProcess('my-command');

    // Assert - the background executor is the one Android may kill
    expect(mockStart).toHaveBeenCalled();
    expect(mockBgStart).not.toHaveBeenCalled();
  });

  it('should_reject_when_start_fails', async () => {
    // Arrange
    mockStart.mockRejectedValue(new Error('spawn failed'));

    // Act
    const promise = startProcess('my-command');

    // Assert
    await expect(promise).rejects.toThrow('spawn failed');
  });
});

describe('stopProcess', () => {
  it('should_return_stopped_when_delegated', async () => {
    // Arrange
    mockStop.mockResolvedValue('stopped');

    // Act
    const result = await stopProcess('test-uuid');

    // Assert
    expect(result).toBe('stopped');
  });

  it('should_reject_when_stop_fails', async () => {
    // Arrange
    mockStop.mockRejectedValue(new Error('stop failed'));

    // Act
    const promise = stopProcess('test-uuid');

    // Assert
    await expect(promise).rejects.toThrow('stop failed');
  });
});

describe('isProcessRunning', () => {
  it('should_return_true_when_running', async () => {
    // Arrange
    mockIsRunning.mockResolvedValue(true);

    // Act
    const result = await isProcessRunning('test-uuid');

    // Assert
    expect(result).toBe(true);
  });

  it('should_return_false_when_not_running', async () => {
    // Arrange
    mockIsRunning.mockResolvedValue(false);

    // Act
    const result = await isProcessRunning('test-uuid');

    // Assert
    expect(result).toBe(false);
  });
});

describe('writeProcess', () => {
  it('should_return_ok_when_write_succeeds', async () => {
    // Arrange
    mockWrite.mockResolvedValue('ok');

    // Act
    const result = await writeProcess('test-uuid', 'input data');

    // Assert
    expect(result).toBe('ok');
  });

  it('should_reject_when_write_fails', async () => {
    // Arrange
    mockWrite.mockRejectedValue(new Error('write failed'));

    // Act
    const promise = writeProcess('test-uuid', 'input data');

    // Assert
    await expect(promise).rejects.toThrow('write failed');
  });
});

describe('ProcessHandle methods', () => {
  it('should_stop_when_process_stop_called', async () => {
    // Arrange
    mockStart.mockResolvedValue('test-uuid');
    mockStop.mockResolvedValue('stopped');
    const process = await startProcess('my-command');

    // Act
    const result = await process.stop();

    // Assert
    expect(result).toBe('stopped');
  });

  it('should_return_true_when_process_isRunning_called', async () => {
    // Arrange
    mockStart.mockResolvedValue('test-uuid');
    mockIsRunning.mockResolvedValue(true);
    const process = await startProcess('my-command');

    // Act
    const result = await process.isRunning();

    // Assert
    expect(result).toBe(true);
  });

  it('should_write_when_process_write_called', async () => {
    // Arrange
    mockStart.mockResolvedValue('test-uuid');
    mockWrite.mockResolvedValue('ok');
    const process = await startProcess('my-command');

    // Act
    const result = await process.write('hello');

    // Assert
    expect(result).toBe('ok');
  });
});

describe('executeVerbose', () => {
  let capturedCallback: ExecutorOutputCallback | null = null;

  beforeEach(() => {
    capturedCallback = null;
    mockStart.mockImplementation((_cmd, cb) => {
      capturedCallback = cb;
      return Promise.resolve('vb-uuid');
    });
  });

  it('should_resolve_with_stdout_when_exit_0', async () => {
    // Arrange
    const promise = executeVerbose('echo hi');
    await vi.waitFor(() => expect(capturedCallback).toBeTypeOf('function'));

    // Act
    capturedCallback!('stdout', 'hello ');
    capturedCallback!('stdout', 'world\n');
    capturedCallback!('exit', '0');

    // Assert
    await expect(promise).resolves.toBe('hello world\n');
  });

  it('should_reject_with_exit_code_when_non_zero', async () => {
    // Arrange
    const promise = executeVerbose('bad-command');
    await vi.waitFor(() => expect(capturedCallback).toBeTypeOf('function'));

    // Act
    capturedCallback!('stderr', 'error: not found\n');
    capturedCallback!('exit', '127');

    // Assert
    await expect(promise).rejects.toThrow('Command failed: exit 127');
  });

  it('should_include_stderr_when_rejecting', async () => {
    // Arrange
    const promise = executeVerbose('bad-command');
    await vi.waitFor(() => expect(capturedCallback).toBeTypeOf('function'));

    // Act
    capturedCallback!('stderr', 'error: not found\n');
    capturedCallback!('exit', '127');

    // Assert
    await expect(promise).rejects.toThrow('error: not found');
  });

  it('should_call_onProgress_with_trimmed_line_when_chunk_received', async () => {
    // Arrange
    const lines: string[] = [];
    const promise = executeVerbose('cmd', (text) => lines.push(text));
    await vi.waitFor(() => expect(capturedCallback).toBeTypeOf('function'));

    // Act
    capturedCallback!('stdout', 'fetching packages\n');
    capturedCallback!('stdout', '  installing\n');
    capturedCallback!('exit', '0');
    await promise;

    // Assert
    expect(lines).toEqual(['fetching packages', 'installing']);
  });

  it('should_reject_when_startProcess_fails', async () => {
    // Arrange
    mockStart.mockRejectedValue(new Error('spawn failed'));

    // Act
    const promise = executeVerbose('cmd');

    // Assert
    await expect(promise).rejects.toThrow('spawn failed');
  });
});
