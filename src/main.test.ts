import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppState } from './types';
import * as stateModule from './state';
import * as installModule from './opencode/install';
import * as serverModule from './opencode/server';

vi.mock('./state');
vi.mock('./opencode/install');
vi.mock('./opencode/server');
vi.mock('./ui/index');
vi.mock('../plugin.json', () => ({
  default: { id: 'acode.plugin', name: 'Plugin', main: 'main.js', version: '1.0.0' },
}));

const mockTransition = vi.mocked(stateModule.transition);
const mockSetError = vi.mocked(stateModule.setError);
const mockCheckInstalled = vi.mocked(installModule.checkInstalled);
const mockInstallOpenCode = vi.mocked(installModule.installOpenCode);
const mockIsServerUp = vi.mocked(serverModule.isServerUp);
const mockStartServer = vi.mocked(serverModule.startServer);
const mockWaitForReady = vi.mocked(serverModule.waitForReady);
const mockRestartServer = vi.mocked(serverModule.restartServer);

import { AcodePlugin } from './main';

beforeEach(() => {
  vi.clearAllMocks();
});

function makePlugin(): AcodePlugin {
  return new AcodePlugin();
}

describe('startFlow', () => {
  it('checkInstalled=true, isServerUp=true → CheckingInstall→CheckingServer→Ready', async () => {
    mockCheckInstalled.mockResolvedValue(true);
    mockIsServerUp.mockResolvedValue(true);

    const plugin = makePlugin();
    await (plugin as any).startFlow();

    expect(mockTransition).toHaveBeenNthCalledWith(1, AppState.CheckingInstall);
    expect(mockTransition).toHaveBeenNthCalledWith(2, AppState.CheckingServer);
    expect(mockTransition).toHaveBeenNthCalledWith(3, AppState.Ready);
    expect(mockTransition).toHaveBeenCalledTimes(3);
    expect(mockInstallOpenCode).not.toHaveBeenCalled();
  });

  it('checkInstalled=true, isServerUp=false, waitForReady succeeds → StartingServer→Ready', async () => {
    mockCheckInstalled.mockResolvedValue(true);
    mockIsServerUp.mockResolvedValue(false);
    mockWaitForReady.mockResolvedValue(undefined);

    const plugin = makePlugin();
    await (plugin as any).startFlow();

    expect(mockTransition).toHaveBeenNthCalledWith(1, AppState.CheckingInstall);
    expect(mockTransition).toHaveBeenNthCalledWith(2, AppState.CheckingServer);
    expect(mockTransition).toHaveBeenNthCalledWith(3, AppState.StartingServer);
    expect(mockTransition).toHaveBeenNthCalledWith(4, AppState.Ready);
    expect(mockStartServer).toHaveBeenCalled();
    expect(mockWaitForReady).toHaveBeenCalled();
  });

  it('checkInstalled=false, install succeeds, isServerUp=false → transitions through Installing', async () => {
    mockCheckInstalled.mockResolvedValue(false);
    mockInstallOpenCode.mockResolvedValue(undefined);
    mockIsServerUp.mockResolvedValue(false);
    mockWaitForReady.mockResolvedValue(undefined);

    const plugin = makePlugin();
    await (plugin as any).startFlow();

    expect(mockTransition).toHaveBeenNthCalledWith(1, AppState.CheckingInstall);
    expect(mockTransition).toHaveBeenNthCalledWith(2, AppState.Installing);
    expect(mockTransition).toHaveBeenNthCalledWith(3, AppState.CheckingServer);
    expect(mockTransition).toHaveBeenNthCalledWith(4, AppState.StartingServer);
    expect(mockTransition).toHaveBeenNthCalledWith(5, AppState.Ready);
    expect(mockInstallOpenCode).toHaveBeenCalled();
  });

  it('installOpenCode throws → setError called with summary and empty logTail', async () => {
    mockCheckInstalled.mockResolvedValue(false);
    mockInstallOpenCode.mockRejectedValue(new Error('Installation failed (deps): EACCES'));

    const plugin = makePlugin();
    await (plugin as any).startFlow();

    expect(mockSetError).toHaveBeenCalledWith('Installation failed (deps): EACCES', '');
  });

  it('waitForReady throws "Server did not respond" → setError with summary and empty logTail', async () => {
    mockCheckInstalled.mockResolvedValue(true);
    mockIsServerUp.mockResolvedValue(false);
    mockWaitForReady.mockRejectedValue(new Error('Server did not respond within 15s'));

    const plugin = makePlugin();
    await (plugin as any).startFlow();

    expect(mockSetError).toHaveBeenCalledWith('Server did not respond within 15s', '');
  });

  it('uses fallback log message when error message is empty', async () => {
    mockCheckInstalled.mockResolvedValue(true);
    mockIsServerUp.mockResolvedValue(false);
    mockStartServer.mockRejectedValue(new Error(''));

    const plugin = makePlugin();
    await (plugin as any).startFlow();

    expect(mockSetError).toHaveBeenCalledWith(
      'No output captured. Check /tmp/opencode.log in Alpine terminal.',
      '',
    );
  });

  it('handles non-Error rejection (string) → setError with summary and empty logTail', async () => {
    mockCheckInstalled.mockResolvedValue(true);
    mockIsServerUp.mockResolvedValue(false);
    mockStartServer.mockRejectedValue('plain string error');

    const plugin = makePlugin();
    await (plugin as any).startFlow();

    expect(mockSetError).toHaveBeenCalledWith('plain string error', '');
  });
});

describe('handleRestart', () => {
  it('restart+waitForReady succeeds → StartingServer→Ready', async () => {
    mockWaitForReady.mockResolvedValue(undefined);

    const plugin = makePlugin();
    await (plugin as any).handleRestart();

    expect(mockTransition).toHaveBeenNthCalledWith(1, AppState.StartingServer);
    expect(mockTransition).toHaveBeenNthCalledWith(2, AppState.Ready);
    expect(mockRestartServer).toHaveBeenCalled();
    expect(mockWaitForReady).toHaveBeenCalled();
  });

  it('restartServer throws → setError with summary and empty logTail', async () => {
    mockRestartServer.mockRejectedValue(new Error('port busy'));

    const plugin = makePlugin();
    await (plugin as any).handleRestart();

    expect(mockSetError).toHaveBeenCalledWith('port busy', '');
  });
});
