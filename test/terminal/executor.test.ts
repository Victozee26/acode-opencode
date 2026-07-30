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
  it('resolves with the command output on success', async () => {
    mockExecute.mockResolvedValue('hello world');

    await expect(execute('echo hello', false)).resolves.toBe('hello world');
  });

  it('rejects with "Command failed: <message>" when no output property present', async () => {
    mockExecute.mockRejectedValue(new Error('ENOENT'));

    await expect(execute('bad-command')).rejects.toThrow('Command failed: ENOENT');
  });

  it('rejects with "Command failed: <message>\\nOutput: <output>" when output property exists', async () => {
    const err = Object.assign(new Error('non-zero exit'), { output: 'not found' });
    mockExecute.mockRejectedValue(err);

    await expect(execute('bad-command')).rejects.toThrow(
      'Command failed: non-zero exit\nOutput: not found',
    );
  });

  it('handles non-Error rejection (string)', async () => {
    mockExecute.mockRejectedValue('plain string error');

    await expect(execute('bad-command')).rejects.toThrow('Command failed: plain string error');
  });

  it('handles non-Error rejection with output property', async () => {
    const rejection = { message: 'gone', output: 'traceback...' };
    mockExecute.mockRejectedValue(rejection);

    await expect(execute('bad-command')).rejects.toThrow(
      'Command failed: [object Object]\nOutput: traceback...',
    );
  });

  it('handles rejection with output but no message property', async () => {
    const rejection = { output: 'some stderr output' };
    mockExecute.mockRejectedValue(rejection);

    await expect(execute('bad-command')).rejects.toThrow(
      'Command failed: [object Object]\nOutput: some stderr output',
    );
  });
});

describe('startBackground', () => {
  it('resolves with a BackgroundProcess containing the uuid', async () => {
    mockBgStart.mockResolvedValue('test-uuid');

    const process = await startBackground('my-command');
    expect(process.uuid).toBe('test-uuid');
  });

  it('passes command, callback, and alpine flag to BackgroundExecutor.start', async () => {
    mockBgStart.mockResolvedValue('test-uuid');
    const onData = vi.fn();

    await startBackground('my-command', onData, false);

    expect(mockBgStart).toHaveBeenCalledWith('my-command', onData, false);
  });

  it('provides a noop callback when onData is omitted', async () => {
    mockBgStart.mockResolvedValue('test-uuid');

    await startBackground('my-command');

    expect(mockBgStart).toHaveBeenCalledTimes(1);
    const passedCallback = mockBgStart.mock.calls[0][1];
    expect(typeof passedCallback).toBe('function');
    expect(() => passedCallback('stdout', 'test')).not.toThrow();
  });
});

describe('stopBackground', () => {
  it('delegates to BackgroundExecutor.stop and returns the result', async () => {
    mockBgStop.mockResolvedValue('stopped');

    const result = await stopBackground('test-uuid');
    expect(result).toBe('stopped');
    expect(mockBgStop).toHaveBeenCalledWith('test-uuid');
  });
});

describe('isBackgroundRunning', () => {
  it('delegates to BackgroundExecutor.isRunning and returns the result', async () => {
    mockBgIsRunning.mockResolvedValue(true);

    const result = await isBackgroundRunning('test-uuid');
    expect(result).toBe(true);
    expect(mockBgIsRunning).toHaveBeenCalledWith('test-uuid');
  });
});

describe('writeBackground', () => {
  it('delegates to BackgroundExecutor.write and returns the result', async () => {
    mockBgWrite.mockResolvedValue('ok');

    const result = await writeBackground('test-uuid', 'input data');
    expect(result).toBe('ok');
    expect(mockBgWrite).toHaveBeenCalledWith('test-uuid', 'input data');
  });
});

describe('BackgroundProcess methods', () => {
  it('stop() on the process object delegates to stopBackground', async () => {
    mockBgStart.mockResolvedValue('test-uuid');
    mockBgStop.mockResolvedValue('stopped');

    const process = await startBackground('my-command');
    const result = await process.stop();
    expect(result).toBe('stopped');
    expect(mockBgStop).toHaveBeenCalledWith('test-uuid');
  });

  it('isRunning() on the process object delegates to isBackgroundRunning', async () => {
    mockBgStart.mockResolvedValue('test-uuid');
    mockBgIsRunning.mockResolvedValue(true);

    const process = await startBackground('my-command');
    const result = await process.isRunning();
    expect(result).toBe(true);
    expect(mockBgIsRunning).toHaveBeenCalledWith('test-uuid');
  });

  it('write() on the process object delegates to writeBackground', async () => {
    mockBgStart.mockResolvedValue('test-uuid');
    mockBgWrite.mockResolvedValue('ok');

    const process = await startBackground('my-command');
    const result = await process.write('hello');
    expect(result).toBe('ok');
    expect(mockBgWrite).toHaveBeenCalledWith('test-uuid', 'hello');
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

  it('resolves with full accumulated stdout on exit with code 0', async () => {
    const promise = executeVerbose('echo hi');

    capturedCallback!('stdout', 'hello ');
    capturedCallback!('stdout', 'world\n');
    capturedCallback!('exit', '0');

    await expect(promise).resolves.toBe('hello world\n');
  });

  it('rejects with exit code and output on non-zero exit', async () => {
    const promise = executeVerbose('bad-command');

    capturedCallback!('stderr', 'error: not found\n');
    capturedCallback!('exit', '127');

    await expect(promise).rejects.toThrow('Command failed: exit 127');
    await expect(promise).rejects.toThrow('error: not found');
  });

  it('calls onProgress with latest trimmed line from each chunk', async () => {
    const lines: string[] = [];
    const promise = executeVerbose('cmd', (text) => lines.push(text));

    capturedCallback!('stdout', 'fetching packages\n');
    capturedCallback!('stdout', '  installing\n');
    capturedCallback!('exit', '0');

    await promise;
    expect(lines).toEqual(['fetching packages', 'installing']);
  });

  it('rejects when startBackground promise rejects', async () => {
    mockBgStart.mockRejectedValue(new Error('spawn failed'));

    await expect(executeVerbose('cmd')).rejects.toThrow('spawn failed');
  });
});
