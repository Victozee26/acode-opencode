import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execute } from './executor';

const mockExecute = vi.fn();

beforeEach(() => {
  vi.stubGlobal('acode', {
    require: vi.fn(() => ({
      Executor: { execute: mockExecute },
    })),
  });
  mockExecute.mockReset();
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
