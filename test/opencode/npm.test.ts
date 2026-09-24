import { describe, it, expect, vi, beforeEach } from 'vitest';
import { selectNpmCommand } from '../../src/opencode/npm';
import * as executorModule from '../../src/terminal/executor';
import { NPM_VERSION_COMMAND } from '../../src/config/opencode';

vi.mock('../../src/terminal/executor');

const mockExecute = vi.mocked(executorModule.execute);

const ALLOW_SCRIPTS_COMMAND = 'allow-scripts install command';
const FALLBACK_COMMAND = 'fallback install command';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('selectNpmCommand', () => {
  it('should_run_npm_version_probe', async () => {
    // Arrange
    mockExecute.mockResolvedValue('11.16.0');

    // Act
    await selectNpmCommand(ALLOW_SCRIPTS_COMMAND, FALLBACK_COMMAND);

    // Assert
    expect(mockExecute).toHaveBeenCalledWith(NPM_VERSION_COMMAND);
  });

  it('should_return_allow_scripts_command_at_minimum_version', async () => {
    // Arrange
    mockExecute.mockResolvedValue('11.16.0');

    // Act
    const result = await selectNpmCommand(ALLOW_SCRIPTS_COMMAND, FALLBACK_COMMAND);

    // Assert
    expect(result).toBe(ALLOW_SCRIPTS_COMMAND);
  });

  it('should_return_allow_scripts_command_above_minimum_version', async () => {
    // Arrange
    mockExecute.mockResolvedValue('12.0.0');

    // Act
    const result = await selectNpmCommand(ALLOW_SCRIPTS_COMMAND, FALLBACK_COMMAND);

    // Assert
    expect(result).toBe(ALLOW_SCRIPTS_COMMAND);
  });

  it('should_return_allow_scripts_command_when_output_has_trailing_newline', async () => {
    // Arrange
    mockExecute.mockResolvedValue('  11.20.0\n');

    // Act
    const result = await selectNpmCommand(ALLOW_SCRIPTS_COMMAND, FALLBACK_COMMAND);

    // Assert
    expect(result).toBe(ALLOW_SCRIPTS_COMMAND);
  });

  it('should_return_fallback_when_version_is_below_minimum', async () => {
    // Arrange
    mockExecute.mockResolvedValue('11.15.9');

    // Act
    const result = await selectNpmCommand(ALLOW_SCRIPTS_COMMAND, FALLBACK_COMMAND);

    // Assert
    expect(result).toBe(FALLBACK_COMMAND);
  });

  it('should_return_fallback_when_older_major_version', async () => {
    // Arrange
    mockExecute.mockResolvedValue('10.9.0');

    // Act
    const result = await selectNpmCommand(ALLOW_SCRIPTS_COMMAND, FALLBACK_COMMAND);

    // Assert
    expect(result).toBe(FALLBACK_COMMAND);
  });

  it('should_return_fallback_when_probe_rejects', async () => {
    // Arrange
    mockExecute.mockRejectedValue(new Error('npm: not found'));

    // Act
    const result = await selectNpmCommand(ALLOW_SCRIPTS_COMMAND, FALLBACK_COMMAND);

    // Assert
    expect(result).toBe(FALLBACK_COMMAND);
  });

  it('should_return_fallback_when_output_is_unparseable', async () => {
    // Arrange
    mockExecute.mockResolvedValue('not a version');

    // Act
    const result = await selectNpmCommand(ALLOW_SCRIPTS_COMMAND, FALLBACK_COMMAND);

    // Assert
    expect(result).toBe(FALLBACK_COMMAND);
  });

  it('should_return_fallback_when_probe_resolves_undefined', async () => {
    // Arrange — auto-mocked execute with no implementation
    mockExecute.mockResolvedValue(undefined as unknown as string);

    // Act
    const result = await selectNpmCommand(ALLOW_SCRIPTS_COMMAND, FALLBACK_COMMAND);

    // Assert
    expect(result).toBe(FALLBACK_COMMAND);
  });
});
