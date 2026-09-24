import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkInstalled, installOpenCode, uninstallOpenCode } from '../../src/opencode/install';
import * as executorModule from '../../src/terminal/executor';
import {
  INSTALL_DEPS_COMMAND,
  INSTALL_OPENCODE_COMMAND,
  INSTALL_OPENCODE_COMMAND_ALLOW_SCRIPTS,
  NPM_VERSION_COMMAND,
} from '../../src/config/opencode';

vi.mock('../../src/terminal/executor');

const mockExecute = vi.mocked(executorModule.execute);
const mockExecuteVerbose = vi.mocked(executorModule.executeVerbose);

beforeEach(() => {
  vi.resetAllMocks();
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
  it('should_resolve_when_all_steps_succeed', async () => {
    // Arrange
    mockExecute.mockResolvedValue('11.16.0');

    // Act
    const promise = installOpenCode();

    // Assert
    await expect(promise).resolves.toBeUndefined();
    expect(mockExecute).toHaveBeenNthCalledWith(1, INSTALL_DEPS_COMMAND);
    expect(mockExecute).toHaveBeenNthCalledWith(2, NPM_VERSION_COMMAND);
    expect(mockExecute).toHaveBeenNthCalledWith(3, INSTALL_OPENCODE_COMMAND_ALLOW_SCRIPTS);
  });

  it('should_use_plain_command_when_npm_is_below_minimum', async () => {
    // Arrange
    mockExecute.mockResolvedValueOnce('deps ok');
    mockExecute.mockResolvedValueOnce('11.15.9');
    mockExecute.mockResolvedValueOnce('installed');

    // Act
    const promise = installOpenCode();

    // Assert
    await expect(promise).resolves.toBeUndefined();
    expect(mockExecute).toHaveBeenNthCalledWith(3, INSTALL_OPENCODE_COMMAND);
  });

  it('should_use_plain_command_when_npm_probe_fails', async () => {
    // Arrange
    mockExecute.mockResolvedValueOnce('deps ok');
    mockExecute.mockRejectedValueOnce(new Error('npm: not found'));
    mockExecute.mockResolvedValueOnce('installed');

    // Act
    const promise = installOpenCode();

    // Assert
    await expect(promise).resolves.toBeUndefined();
    expect(mockExecute).toHaveBeenNthCalledWith(3, INSTALL_OPENCODE_COMMAND);
  });

  it('should_throw_deps_prefix_when_first_step_fails', async () => {
    // Arrange
    mockExecute.mockRejectedValueOnce(new Error('Command failed: network error'));

    // Act
    const promise = installOpenCode();

    // Assert
    await expect(promise).rejects.toThrow('Installation failed (deps): Command failed: network error');
  });

  it('should_throw_opencode_prefix_when_install_step_fails', async () => {
    // Arrange
    mockExecute.mockResolvedValueOnce('deps ok');
    mockExecute.mockResolvedValueOnce('11.16.0');
    mockExecute.mockRejectedValueOnce(new Error('Command failed: EACCES'));

    // Act
    const promise = installOpenCode();

    // Assert
    await expect(promise).rejects.toThrow('Installation failed (opencode): Command failed: EACCES');
    expect(mockExecute).toHaveBeenNthCalledWith(3, INSTALL_OPENCODE_COMMAND_ALLOW_SCRIPTS);
  });

  it('should_throw_deps_prefix_when_rejection_is_string', async () => {
    // Arrange
    mockExecute.mockRejectedValueOnce('plain string failure');

    // Act
    const promise = installOpenCode();

    // Assert
    await expect(promise).rejects.toThrow('Installation failed (deps): plain string failure');
  });

  it('should_throw_opencode_prefix_when_install_rejection_is_string', async () => {
    // Arrange
    mockExecute.mockResolvedValueOnce('deps ok');
    mockExecute.mockResolvedValueOnce('11.16.0');
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
    vi.resetAllMocks();
  });

  it('should_resolve_when_onProgress_provided', async () => {
    // Arrange
    mockExecute.mockResolvedValue('11.16.0');
    mockExecuteVerbose.mockResolvedValue('ok');
    const onProgress = vi.fn();

    // Act
    const promise = installOpenCode(onProgress);

    // Assert
    await expect(promise).resolves.toBeUndefined();
    expect(mockExecuteVerbose).toHaveBeenNthCalledWith(1, INSTALL_DEPS_COMMAND, onProgress);
    expect(mockExecuteVerbose).toHaveBeenNthCalledWith(
      2,
      INSTALL_OPENCODE_COMMAND_ALLOW_SCRIPTS,
      onProgress,
    );
  });

  it('should_throw_deps_prefix_when_verbose_first_step_fails', async () => {
    // Arrange
    mockExecuteVerbose.mockRejectedValueOnce(new Error('exit 1\nOutput: fail'));

    // Act
    const promise = installOpenCode(vi.fn());

    // Assert
    await expect(promise).rejects.toThrow('Installation failed (deps): exit 1');
  });

  it('should_throw_opencode_prefix_when_verbose_install_step_fails', async () => {
    // Arrange
    mockExecute.mockResolvedValue('11.16.0');
    mockExecuteVerbose.mockResolvedValueOnce('deps ok');
    mockExecuteVerbose.mockRejectedValueOnce(new Error('exit 1\nOutput: fail'));

    // Act
    const promise = installOpenCode(vi.fn());

    // Assert
    await expect(promise).rejects.toThrow('Installation failed (opencode): exit 1');
    expect(mockExecuteVerbose).toHaveBeenNthCalledWith(
      2,
      INSTALL_OPENCODE_COMMAND_ALLOW_SCRIPTS,
      expect.any(Function),
    );
  });
});
