import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkInstalled, installOpenCode, uninstallOpenCode } from '../../src/opencode/install';
import * as executorModule from '../../src/terminal/executor';

vi.mock('../../src/terminal/executor');

const mockExecute = vi.mocked(executorModule.execute);
const mockExecuteVerbose = vi.mocked(executorModule.executeVerbose);

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

describe('uninstallOpenCode', () => {
  it('resolves without error when execute succeeds', async () => {
    mockExecute.mockResolvedValue('uninstalled');

    await expect(uninstallOpenCode()).resolves.toBeUndefined();
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('throws "Uninstallation failed: ..." when execute rejects', async () => {
    mockExecute.mockRejectedValue(new Error('Command failed: EACCES'));

    await expect(uninstallOpenCode()).rejects.toThrow(
      'Uninstallation failed: Command failed: EACCES',
    );
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('handles non-Error rejection', async () => {
    mockExecute.mockRejectedValue('plain string failure');

    await expect(uninstallOpenCode()).rejects.toThrow(
      'Uninstallation failed: plain string failure',
    );
  });
});

describe('installOpenCode with onProgress (verbose)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses executeVerbose for deps and opencode steps when onProgress is provided', async () => {
    mockExecuteVerbose.mockResolvedValue('ok');
    const onProgress = vi.fn();

    await installOpenCode(onProgress);

    expect(mockExecuteVerbose).toHaveBeenCalledTimes(2);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('throws (deps) prefix when executeVerbose rejects on deps', async () => {
    mockExecuteVerbose.mockRejectedValueOnce(new Error('exit 1\nOutput: fail'));

    await expect(installOpenCode(vi.fn())).rejects.toThrow(
      'Installation failed (deps): exit 1',
    );
    expect(mockExecuteVerbose).toHaveBeenCalledTimes(1);
  });

  it('throws (opencode) prefix when executeVerbose rejects on opencode step', async () => {
    mockExecuteVerbose.mockResolvedValueOnce('deps ok');
    mockExecuteVerbose.mockRejectedValueOnce(new Error('exit 1\nOutput: fail'));

    await expect(installOpenCode(vi.fn())).rejects.toThrow(
      'Installation failed (opencode): exit 1',
    );
    expect(mockExecuteVerbose).toHaveBeenCalledTimes(2);
  });
});
