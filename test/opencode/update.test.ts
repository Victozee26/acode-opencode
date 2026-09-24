import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installUpdate } from '../../src/opencode/update';
import * as executorModule from '../../src/terminal/executor';
import {
  INSTALL_UPDATE_COMMAND,
  INSTALL_UPDATE_COMMAND_ALLOW_SCRIPTS,
} from '../../src/config/update';
import { NPM_VERSION_COMMAND } from '../../src/config/opencode';

vi.mock('../../src/terminal/executor');

const mockExecute = vi.mocked(executorModule.execute);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('installUpdate', () => {
  it('should_use_allow_scripts_command_when_npm_is_at_minimum', async () => {
    // Arrange
    mockExecute.mockResolvedValue('11.16.0');

    // Act
    await installUpdate();

    // Assert
    expect(mockExecute).toHaveBeenNthCalledWith(1, NPM_VERSION_COMMAND);
    expect(mockExecute).toHaveBeenNthCalledWith(2, INSTALL_UPDATE_COMMAND_ALLOW_SCRIPTS);
  });

  it('should_use_plain_command_when_npm_is_below_minimum', async () => {
    // Arrange
    mockExecute.mockResolvedValueOnce('11.15.9');
    mockExecute.mockResolvedValueOnce('installed');

    // Act
    await installUpdate();

    // Assert
    expect(mockExecute).toHaveBeenNthCalledWith(2, INSTALL_UPDATE_COMMAND);
  });

  it('should_use_plain_command_when_npm_probe_fails', async () => {
    // Arrange
    mockExecute.mockRejectedValueOnce(new Error('npm: not found'));
    mockExecute.mockResolvedValueOnce('installed');

    // Act
    await installUpdate();

    // Assert
    expect(mockExecute).toHaveBeenNthCalledWith(2, INSTALL_UPDATE_COMMAND);
  });

  it('should_propagate_install_failure', async () => {
    // Arrange
    mockExecute.mockResolvedValueOnce('11.16.0');
    mockExecute.mockRejectedValueOnce(new Error('Command failed: EACCES'));

    // Act
    const promise = installUpdate();

    // Assert
    await expect(promise).rejects.toThrow('Command failed: EACCES');
  });
});
