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
  it('should_return_true_when_execute_resolves', async () => {
    // Arrange
    mockExecute.mockResolvedValue('/usr/local/bin/opencode');

    // Act
    const result = await checkInstalled();

    // Assert
    expect(result).toBe(true);
  });

  it('should_return_false_when_execute_rejects', async () => {
    // Arrange
    mockExecute.mockRejectedValue(new Error('not found'));

    // Act
    const result = await checkInstalled();

    // Assert
    expect(result).toBe(false);
  });
});

describe('installOpenCode', () => {
  it('should_resolve_when_both_steps_succeed', async () => {
    // Arrange
    mockExecute.mockResolvedValue('ok');

    // Act
    const promise = installOpenCode();

    // Assert
    await expect(promise).resolves.toBeUndefined();
  });

  it('should_throw_deps_prefix_when_first_step_fails', async () => {
    // Arrange
    mockExecute.mockRejectedValueOnce(new Error('Command failed: network error'));

    // Act
    const promise = installOpenCode();

    // Assert
    await expect(promise).rejects.toThrow('Installation failed (deps): Command failed: network error');
  });

  it('should_throw_opencode_prefix_when_second_step_fails', async () => {
    // Arrange
    mockExecute.mockResolvedValueOnce('deps ok');
    mockExecute.mockRejectedValueOnce(new Error('Command failed: EACCES'));

    // Act
    const promise = installOpenCode();

    // Assert
    await expect(promise).rejects.toThrow('Installation failed (opencode): Command failed: EACCES');
  });

  it('should_throw_deps_prefix_when_rejection_is_string', async () => {
    // Arrange
    mockExecute.mockRejectedValueOnce('plain string failure');

    // Act
    const promise = installOpenCode();

    // Assert
    await expect(promise).rejects.toThrow('Installation failed (deps): plain string failure');
  });

  it('should_throw_opencode_prefix_when_second_rejection_is_string', async () => {
    // Arrange
    mockExecute.mockResolvedValueOnce('deps ok');
    mockExecute.mockRejectedValueOnce('plain string failure');

    // Act
    const promise = installOpenCode();

    // Assert
    await expect(promise).rejects.toThrow('Installation failed (opencode): plain string failure');
  });
});

describe('uninstallOpenCode', () => {
  it('should_resolve_when_execute_succeeds', async () => {
    // Arrange
    mockExecute.mockResolvedValue('uninstalled');

    // Act
    const promise = uninstallOpenCode();

    // Assert
    await expect(promise).resolves.toBeUndefined();
  });

  it('should_throw_prefix_when_execute_rejects', async () => {
    // Arrange
    mockExecute.mockRejectedValue(new Error('Command failed: EACCES'));

    // Act
    const promise = uninstallOpenCode();

    // Assert
    await expect(promise).rejects.toThrow('Uninstallation failed: Command failed: EACCES');
  });

  it('should_throw_prefix_when_rejection_is_string', async () => {
    // Arrange
    mockExecute.mockRejectedValue('plain string failure');

    // Act
    const promise = uninstallOpenCode();

    // Assert
    await expect(promise).rejects.toThrow('Uninstallation failed: plain string failure');
  });
});

describe('installOpenCode with onProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should_resolve_when_onProgress_provided', async () => {
    // Arrange
    mockExecuteVerbose.mockResolvedValue('ok');
    const onProgress = vi.fn();

    // Act
    const promise = installOpenCode(onProgress);

    // Assert
    await expect(promise).resolves.toBeUndefined();
  });

  it('should_throw_deps_prefix_when_verbose_first_step_fails', async () => {
    // Arrange
    mockExecuteVerbose.mockRejectedValueOnce(new Error('exit 1\nOutput: fail'));

    // Act
    const promise = installOpenCode(vi.fn());

    // Assert
    await expect(promise).rejects.toThrow('Installation failed (deps): exit 1');
  });

  it('should_throw_opencode_prefix_when_verbose_second_step_fails', async () => {
    // Arrange
    mockExecuteVerbose.mockResolvedValueOnce('deps ok');
    mockExecuteVerbose.mockRejectedValueOnce(new Error('exit 1\nOutput: fail'));

    // Act
    const promise = installOpenCode(vi.fn());

    // Assert
    await expect(promise).rejects.toThrow('Installation failed (opencode): exit 1');
  });
});
