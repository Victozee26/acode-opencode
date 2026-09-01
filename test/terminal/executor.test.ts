import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  execute,
  startBackground,
  stopBackground,
  isBackgroundRunning,
  writeBackground,
  executeVerbose,
} from '../../src/terminal/executor';

const mockExecute = vi.fn();
const mockBgStart = vi.fn();
const mockBgStop = vi.fn();
const mockBgIsRunning = vi.fn();
const mockBgWrite = vi.fn();

beforeEach(() => {
  vi.stubGlobal('Executor', {
    execute: mockExecute,
    BackgroundExecutor: {
      start: mockBgStart,
      stop: mockBgStop,
      isRunning: mockBgIsRunning,
      write: mockBgWrite,
    },
  });
  mockExecute.mockReset();
  mockBgStart.mockReset();
  mockBgStop.mockReset();
  mockBgIsRunning.mockReset();
  mockBgWrite.mockReset();
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

describe('startBackground', () => {
  it('should_return_uuid_when_start_succeeds', async () => {
    // Arrange
    mockBgStart.mockResolvedValue('test-uuid');

    // Act
    const process = await startBackground('my-command');

    // Assert
    expect(process.uuid).toBe('test-uuid');
  });

  it('should_reject_when_start_fails', async () => {
    // Arrange
    mockBgStart.mockRejectedValue(new Error('spawn failed'));

    // Act
    const promise = startBackground('my-command');

    // Assert
    await expect(promise).rejects.toThrow('spawn failed');
  });
});

describe('stopBackground', () => {
  it('should_return_stopped_when_delegated', async () => {
    // Arrange
    mockBgStop.mockResolvedValue('stopped');

    // Act
    const result = await stopBackground('test-uuid');

    // Assert
    expect(result).toBe('stopped');
  });

  it('should_reject_when_stop_fails', async () => {
    // Arrange
    mockBgStop.mockRejectedValue(new Error('stop failed'));

    // Act
    const promise = stopBackground('test-uuid');

    // Assert
    await expect(promise).rejects.toThrow('stop failed');
  });
});

describe('isBackgroundRunning', () => {
  it('should_return_true_when_running', async () => {
    // Arrange
    mockBgIsRunning.mockResolvedValue(true);

    // Act
    const result = await isBackgroundRunning('test-uuid');

    // Assert
    expect(result).toBe(true);
  });

  it('should_return_false_when_not_running', async () => {
    // Arrange
    mockBgIsRunning.mockResolvedValue(false);

    // Act
    const result = await isBackgroundRunning('test-uuid');

    // Assert
    expect(result).toBe(false);
  });
});

describe('writeBackground', () => {
  it('should_return_ok_when_write_succeeds', async () => {
    // Arrange
    mockBgWrite.mockResolvedValue('ok');

    // Act
    const result = await writeBackground('test-uuid', 'input data');

    // Assert
    expect(result).toBe('ok');
  });

  it('should_reject_when_write_fails', async () => {
    // Arrange
    mockBgWrite.mockRejectedValue(new Error('write failed'));

    // Act
    const promise = writeBackground('test-uuid', 'input data');

    // Assert
    await expect(promise).rejects.toThrow('write failed');
  });
});

describe('BackgroundProcess methods', () => {
  it('should_stop_when_process_stop_called', async () => {
    // Arrange
    mockBgStart.mockResolvedValue('test-uuid');
    mockBgStop.mockResolvedValue('stopped');
    const process = await startBackground('my-command');

    // Act
    const result = await process.stop();

    // Assert
    expect(result).toBe('stopped');
  });

  it('should_return_true_when_process_isRunning_called', async () => {
    // Arrange
    mockBgStart.mockResolvedValue('test-uuid');
    mockBgIsRunning.mockResolvedValue(true);
    const process = await startBackground('my-command');

    // Act
    const result = await process.isRunning();

    // Assert
    expect(result).toBe(true);
  });

  it('should_write_when_process_write_called', async () => {
    // Arrange
    mockBgStart.mockResolvedValue('test-uuid');
    mockBgWrite.mockResolvedValue('ok');
    const process = await startBackground('my-command');

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
    mockBgStart.mockImplementation((_cmd, cb) => {
      capturedCallback = cb;
      return Promise.resolve('vb-uuid');
    });
  });

  it('should_resolve_with_stdout_when_exit_0', async () => {
    // Arrange
    const promise = executeVerbose('echo hi');

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

    // Act
    capturedCallback!('stderr', 'error: not found\n');
    capturedCallback!('exit', '127');

    // Assert
    await expect(promise).rejects.toThrow('Command failed: exit 127');
  });

  it('should_include_stderr_when_rejecting', async () => {
    // Arrange
    const promise = executeVerbose('bad-command');

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

    // Act
    capturedCallback!('stdout', 'fetching packages\n');
    capturedCallback!('stdout', '  installing\n');
    capturedCallback!('exit', '0');
    await promise;

    // Assert
    expect(lines).toEqual(['fetching packages', 'installing']);
  });

  it('should_reject_when_startBackground_fails', async () => {
    // Arrange
    mockBgStart.mockRejectedValue(new Error('spawn failed'));

    // Act
    const promise = executeVerbose('cmd');

    // Assert
    await expect(promise).rejects.toThrow('spawn failed');
  });
});
