import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkInstalled, installOpenCode } from '../../src/opencode/install';
import * as executorModule from '../../src/terminal/executor';

vi.mock('../../src/terminal/executor');

const mockExecute = vi.mocked(executorModule.execute);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkInstalled', () => {
  it('returns true when execute resolves', async () => {
    mockExecute.mockResolvedValue('/usr/local/bin/opencode');

    await expect(checkInstalled()).resolves.toBe(true);
  });

  it('returns false when execute rejects (does not throw)', async () => {
    mockExecute.mockRejectedValue(new Error('not found'));

    await expect(checkInstalled()).resolves.toBe(false);
  });
});

describe('installOpenCode', () => {
  it('resolves without error when both executes succeed', async () => {
    mockExecute.mockResolvedValue('ok');

    await expect(installOpenCode()).resolves.toBeUndefined();
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it('throws "Installation failed (deps): ..." when first execute rejects', async () => {
    mockExecute.mockRejectedValueOnce(new Error('Command failed: network error'));

    await expect(installOpenCode()).rejects.toThrow(
      'Installation failed (deps): Command failed: network error',
    );
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('throws "Installation failed (opencode): ..." when second execute rejects', async () => {
    mockExecute.mockResolvedValueOnce('deps ok');
    mockExecute.mockRejectedValueOnce(new Error('Command failed: EACCES'));

    await expect(installOpenCode()).rejects.toThrow(
      'Installation failed (opencode): Command failed: EACCES',
    );
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it('handles non-Error rejection in deps step', async () => {
    mockExecute.mockRejectedValueOnce('plain string failure');

    await expect(installOpenCode()).rejects.toThrow(
      'Installation failed (deps): plain string failure',
    );
  });

  it('handles non-Error rejection in opencode step', async () => {
    mockExecute.mockResolvedValueOnce('deps ok');
    mockExecute.mockRejectedValueOnce('plain string failure');

    await expect(installOpenCode()).rejects.toThrow(
      'Installation failed (opencode): plain string failure',
    );
  });
});
