import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getRuntimeVersions } from '../../src/opencode/diagnostics';
import * as executorModule from '../../src/terminal/executor';
import {
  NODE_VERSION_COMMAND,
  NPM_VERSION_COMMAND,
  RUNTIME_VERSION_PROBE_TIMEOUT,
  VERSION_UNKNOWN,
} from '../../src/config/opencode';

vi.mock('../../src/terminal/executor');

const mockExecute = vi.mocked(executorModule.execute);

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getRuntimeVersions', () => {
  it('should_return_both_versions_when_probes_succeed', async () => {
    // Arrange
    mockExecute.mockImplementation(async (command) =>
      command === NODE_VERSION_COMMAND ? 'v26.8.2\n' : '11.19.1\n',
    );

    // Act
    const result = await getRuntimeVersions();

    // Assert
    expect(result).toEqual({ node: 'v26.8.2', npm: '11.19.1' });
    expect(mockExecute).toHaveBeenCalledWith(NODE_VERSION_COMMAND);
    expect(mockExecute).toHaveBeenCalledWith(NPM_VERSION_COMMAND);
  });

  it('should_use_first_line_when_output_is_multiline', async () => {
    // Arrange
    mockExecute.mockResolvedValue('v26.8.2\nextra line');

    // Act
    const result = await getRuntimeVersions();

    // Assert
    expect(result.node).toBe('v26.8.2');
  });

  it('should_report_unknown_when_one_probe_fails', async () => {
    // Arrange
    mockExecute.mockImplementation(async (command) => {
      if (command === NODE_VERSION_COMMAND) throw new Error('node: not found');
      return '11.19.1\n';
    });

    // Act
    const result = await getRuntimeVersions();

    // Assert
    expect(result).toEqual({ node: VERSION_UNKNOWN, npm: '11.19.1' });
  });

  it('should_report_unknown_when_output_is_empty', async () => {
    // Arrange
    mockExecute.mockResolvedValue('   \n');

    // Act
    const result = await getRuntimeVersions();

    // Assert
    expect(result).toEqual({ node: VERSION_UNKNOWN, npm: VERSION_UNKNOWN });
  });

  it('should_resolve_unknown_versions_when_probe_times_out', async () => {
    // Arrange
    vi.useFakeTimers();
    mockExecute.mockReturnValue(new Promise<string>(() => {}));

    // Act
    const pending = getRuntimeVersions();
    await vi.advanceTimersByTimeAsync(RUNTIME_VERSION_PROBE_TIMEOUT);

    // Assert
    await expect(pending).resolves.toEqual({ node: VERSION_UNKNOWN, npm: VERSION_UNKNOWN });
  });
});
