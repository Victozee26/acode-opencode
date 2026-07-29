import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppState } from '../src/types';
import * as stateModule from '../src/state';
import * as installModule from '../src/opencode/install';
import * as serverModule from '../src/opencode/server';
import * as healthModule from '../src/opencode/health';
import * as settingsModule from '../src/settings';
import * as updateModule from '../src/opencode/update';
import * as uiModule from '../src/ui/index';

vi.mock('../src/state');
vi.mock('../src/opencode/install');
vi.mock('../src/opencode/server');
vi.mock('../src/opencode/health');
vi.mock('../src/settings');
vi.mock('../src/opencode/update');
vi.mock('../src/ui/index');
vi.mock('../plugin.json', () => ({
  default: { id: 'acode.plugin', name: 'Plugin', main: 'main.js', version: '1.0.0' },
}));

const mockTransition = vi.mocked(stateModule.transition);
const mockGetState = vi.mocked(stateModule.getState);
const mockInstallUpdate = vi.mocked(updateModule.installUpdate);
const mockCheckForUpdates = vi.mocked(updateModule.checkForUpdates);
const mockUpdateHeader = vi.mocked(uiModule.updateHeader);
const mockSetError = vi.mocked(stateModule.setError);
const mockCheckInstalled = vi.mocked(installModule.checkInstalled);
const mockInstallOpenCode = vi.mocked(installModule.installOpenCode);
const mockUninstallOpenCode = vi.mocked(installModule.uninstallOpenCode);
const mockIsServerUp = vi.mocked(healthModule.isServerUp);
const mockStartServer = vi.mocked(serverModule.startServer);
const mockWaitForReady = vi.mocked(serverModule.waitForReady);
const mockRestartServer = vi.mocked(serverModule.restartServer);
const mockGetSettingsSchema = vi.mocked(settingsModule.getSettingsSchema);

import { AcodePlugin } from '../src/main';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSettingsSchema.mockReturnValue({ list: [] });
  mockCheckForUpdates.mockResolvedValue(null);
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
      'An unknown error occurred.',
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

describe('destroy', () => {
  const mockPage = {
    on: vi.fn(),
    off: vi.fn(),
    hide: vi.fn(),
    show: vi.fn(),
    settitle: vi.fn(),
    appendChild: vi.fn(),
    body: { innerHTML: '' },
    header: { innerHTML: '', style: {} },
    style: {},
  };

  const mockSideButton = {
    show: vi.fn(),
    hide: vi.fn(),
  };

  beforeEach(() => {
    (globalThis as any).acode = {
      addIcon: vi.fn(),
      require: vi.fn().mockReturnValue(vi.fn().mockReturnValue(mockSideButton)),
    };
    mockPage.hide = vi.fn();
    mockPage.show = vi.fn();
  });

  it('calls $page.off with the stored show handler', async () => {
    const plugin = makePlugin();
    await plugin.init('https://base/', mockPage as any, {} as any, '');
    await plugin.destroy();

    const handler = mockPage.on.mock.calls[0][1];
    expect(mockPage.off).toHaveBeenCalledWith('show', handler);
  });

  it('calls $page.hide()', async () => {
    const plugin = makePlugin();
    await plugin.init('https://base/', mockPage as any, {} as any, '');
    await plugin.destroy();

    expect(mockPage.style.display).toBe('none');
  });

  it('does not call $page.off when handleShow was never set', async () => {
    const plugin = makePlugin();
    (plugin as any).$page = { off: mockPage.off, hide: mockPage.hide };
    await plugin.destroy();

    expect(mockPage.off).not.toHaveBeenCalled();
    expect(mockPage.hide).toHaveBeenCalledTimes(1);
  });

  it('init() registers show listener with $page.on', async () => {
    const plugin = makePlugin();
    await plugin.init('https://base/', mockPage as any, {} as any, '');

    expect(mockPage.on).toHaveBeenCalledWith('show', expect.any(Function));
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

describe('handleReinstall', () => {
  beforeEach(() => {
    (globalThis as any).acode = {
      confirm: vi.fn(),
    };
    mockInstallOpenCode.mockResolvedValue(undefined);
    mockUninstallOpenCode.mockResolvedValue(undefined);
    mockCheckInstalled.mockResolvedValue(true);
    mockIsServerUp.mockResolvedValue(true);
  });

  it('confirm resolves true → reinstallFlow is triggered', async () => {
    (globalThis as any).acode.confirm.mockResolvedValue(true);
    const plugin = makePlugin();

    await (plugin as any).handleReinstall();
    await vi.waitFor(() => expect(mockUninstallOpenCode).toHaveBeenCalled());

    expect(globalThis.acode.confirm).toHaveBeenCalledWith(
      'Reinstall OpenCode',
      'This will uninstall and reinstall OpenCode. Continue?',
    );
    expect(mockTransition).toHaveBeenCalledWith(AppState.Uninstalling);
  });

  it('confirm resolves false → reinstallFlow is NOT triggered', async () => {
    (globalThis as any).acode.confirm.mockResolvedValue(false);
    const plugin = makePlugin();

    await (plugin as any).handleReinstall();

    expect(mockUninstallOpenCode).not.toHaveBeenCalled();
    expect(mockTransition).not.toHaveBeenCalled();
  });

  it('confirm throws → error propagates to caller', async () => {
    (globalThis as any).acode.confirm.mockRejectedValue(new Error('dialog dismissed'));
    const plugin = makePlugin();

    await expect((plugin as any).handleReinstall()).rejects.toThrow('dialog dismissed');
    expect(mockUninstallOpenCode).not.toHaveBeenCalled();
  });
});

describe('ctx / PluginContext', () => {
  it('stores a valid PluginContext on the instance', async () => {
    const mockPage = {
      on: vi.fn(),
      off: vi.fn(),
      hide: vi.fn(),
      show: vi.fn(),
      settitle: vi.fn(),
      appendChild: vi.fn(),
      body: { innerHTML: '' },
      header: { innerHTML: '', style: {} },
      style: {},
    };

    (globalThis as any).acode = {
      addIcon: vi.fn(),
      require: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ show: vi.fn(), hide: vi.fn() })),
    };

    const mockCtx: Acode.PluginContext = {
      created_at: Date.now(),
      uuid: 'test-uuid',
      grantedPermission: vi.fn(),
      listAllPermissions: vi.fn(),
      getSecret: vi.fn(),
      setSecret: vi.fn(),
    };

    const plugin = makePlugin();
    await plugin.init('https://base/', mockPage as any, {} as any, '', mockCtx);

    expect((plugin as any).ctx).toBe(mockCtx);
    expect((plugin as any).ctx.uuid).toBe('test-uuid');
  });

  it('handles null ctx gracefully (no throw)', async () => {
    const mockPage = {
      on: vi.fn(),
      off: vi.fn(),
      hide: vi.fn(),
      show: vi.fn(),
      settitle: vi.fn(),
      appendChild: vi.fn(),
      body: { innerHTML: '' },
      header: { innerHTML: '', style: {} },
      style: {},
    };

    (globalThis as any).acode = {
      addIcon: vi.fn(),
      require: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ show: vi.fn(), hide: vi.fn() })),
    };

    const plugin = makePlugin();

    await expect(
      plugin.init('https://base/', mockPage as any, {} as any, '', null),
    ).resolves.toBeUndefined();

    expect((plugin as any).ctx).toBeNull();
  });

  it('handles undefined ctx gracefully (no throw)', async () => {
    const mockPage = {
      on: vi.fn(),
      off: vi.fn(),
      hide: vi.fn(),
      show: vi.fn(),
      settitle: vi.fn(),
      appendChild: vi.fn(),
      body: { innerHTML: '' },
      header: { innerHTML: '', style: {} },
      style: {},
    };

    (globalThis as any).acode = {
      addIcon: vi.fn(),
      require: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ show: vi.fn(), hide: vi.fn() })),
    };

    const plugin = makePlugin();

    await expect(
      plugin.init('https://base/', mockPage as any, {} as any, ''),
    ).resolves.toBeUndefined();

    expect((plugin as any).ctx).toBeUndefined();
  });
});

describe('header-only updates (Phase 2)', () => {
  beforeEach(() => {
    mockCheckForUpdates.mockReset();
    mockInstallUpdate.mockReset();
    mockGetState.mockReturnValue({ currentState: AppState.Error, error: null });
  });

  it('handleCancelUpdate calls updateHeader, not transition', async () => {
    const plugin = makePlugin();
    (plugin as any).updateStatus = 'installing';
    (plugin as any).updateInfo = { currentVersion: '1.0.0', latestVersion: '2.0.0' };

    (plugin as any).handleCancelUpdate();

    expect(mockUpdateHeader).toHaveBeenCalled();
    expect(mockTransition).not.toHaveBeenCalled();
    expect((plugin as any).updateStatus).toBeNull();
  });

  it('handleUpdateClick calls updateHeader instead of transition on success', async () => {
    mockInstallUpdate.mockResolvedValue(undefined);
    mockCheckForUpdates.mockResolvedValue(null);

    const plugin = makePlugin();
    (plugin as any).updateInfo = { currentVersion: '1.0.0', latestVersion: '2.0.0' };

    await (plugin as any).handleUpdateClick();

    expect(mockUpdateHeader).toHaveBeenCalled();
    expect(mockTransition).not.toHaveBeenCalled();
    expect((plugin as any).updateStatus).toBe('updated');
  });

  it('handleUpdateClick calls updateHeader instead of transition on error', async () => {
    mockInstallUpdate.mockRejectedValue(new Error('network failed'));

    const plugin = makePlugin();
    (plugin as any).updateInfo = { currentVersion: '1.0.0', latestVersion: '2.0.0' };

    await (plugin as any).handleUpdateClick();

    expect(mockUpdateHeader).toHaveBeenCalled();
    expect(mockTransition).not.toHaveBeenCalled();
    expect((plugin as any).updateStatus).toBe('error');
  });

  it('handleUpdateClick does nothing when already installing', async () => {
    const plugin = makePlugin();
    (plugin as any).updateStatus = 'installing';

    await (plugin as any).handleUpdateClick();

    expect(mockUpdateHeader).not.toHaveBeenCalled();
    expect(mockInstallUpdate).not.toHaveBeenCalled();
  });
});

describe('toast notifications', () => {
  let toastMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    toastMock = vi.fn();
    (globalThis as any).acode = {
      require: (name: string) => (name === 'toast' ? toastMock : undefined),
    };
  });

  describe('showToast helper', () => {
    it('calls acode.require("toast") with message and duration 2000', () => {
      const plugin = makePlugin();
      (plugin as any).showToast('Hello');
      expect(toastMock).toHaveBeenCalledWith('Hello', 2000);
    });

    it('does not throw when acode is unavailable', () => {
      (globalThis as any).acode = undefined;
      const plugin = makePlugin();
      expect(() => (plugin as any).showToast('Hello')).not.toThrow();
    });

    it('does not throw when toast is not a function', () => {
      (globalThis as any).acode = {
        require: () => ({}),
      };
      const plugin = makePlugin();
      expect(() => (plugin as any).showToast('Hello')).not.toThrow();
    });
  });

  describe('event points', () => {
    it('startFlow → "OpenCode server already running" when server is already up', async () => {
      mockCheckInstalled.mockResolvedValue(true);
      mockIsServerUp.mockResolvedValue(true);

      const plugin = makePlugin();
      await (plugin as any).startFlow();

      expect(toastMock).toHaveBeenCalledWith('OpenCode server already running', 2000);
    });

    it('startFlow → "OpenCode server ready" when server starts successfully', async () => {
      mockCheckInstalled.mockResolvedValue(true);
      mockIsServerUp.mockResolvedValue(false);
      mockStartServer.mockResolvedValue(undefined);
      mockWaitForReady.mockResolvedValue(undefined);

      const plugin = makePlugin();
      await (plugin as any).startFlow();

      expect(toastMock).toHaveBeenCalledWith('OpenCode server ready', 2000);
    });

    it('handleRestart → "OpenCode server restarted"', async () => {
      mockRestartServer.mockResolvedValue(undefined);
      mockWaitForReady.mockResolvedValue(undefined);

      const plugin = makePlugin();
      await (plugin as any).handleRestart();

      expect(toastMock).toHaveBeenCalledWith('OpenCode server restarted', 2000);
    });

    it('handleStop → "Server stopped"', async () => {
      const plugin = makePlugin();
      await (plugin as any).handleStop();

      expect(toastMock).toHaveBeenCalledWith('Server stopped', 2000);
    });

    it('handleUpdateClick success → "Updated to X.X.X"', async () => {
      mockInstallUpdate.mockResolvedValue(undefined);
      mockCheckForUpdates.mockResolvedValue({ currentVersion: '1.0.0', latestVersion: '2.0.0' });

      const plugin = makePlugin();
      (plugin as any).updateInfo = { currentVersion: '1.0.0', latestVersion: '2.0.0' };

      await (plugin as any).handleUpdateClick();

      expect(toastMock).toHaveBeenCalledWith('Updated to 2.0.0', 2000);
    });

    it('handleUpdateClick success with no version → "Update complete"', async () => {
      mockInstallUpdate.mockResolvedValue(undefined);
      mockCheckForUpdates.mockResolvedValue(null);

      const plugin = makePlugin();
      (plugin as any).updateInfo = null;

      await (plugin as any).handleUpdateClick();

      expect(toastMock).toHaveBeenCalledWith('Update complete', 2000);
    });

    it('handleUpdateClick failure → "Update failed"', async () => {
      mockInstallUpdate.mockRejectedValue(new Error('network error'));

      const plugin = makePlugin();
      (plugin as any).updateInfo = { currentVersion: '1.0.0', latestVersion: '2.0.0' };

      await (plugin as any).handleUpdateClick();

      expect(toastMock).toHaveBeenCalledWith('Update failed', 2000);
    });
  });
});

describe('page lifecycle hooks (ondisconnect / onconnect)', () => {
  const mockPage: any = {
    on: vi.fn(),
    off: vi.fn(),
    hide: vi.fn(),
    show: vi.fn(),
    settitle: vi.fn(),
    appendChild: vi.fn(),
    body: { innerHTML: '' },
    header: { innerHTML: '', style: {} },
    style: {},
  };

  beforeEach(() => {
    (globalThis as any).acode = {
      addIcon: vi.fn(),
      require: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ show: vi.fn(), hide: vi.fn() })),
    };
    mockCheckForUpdates.mockResolvedValue(null);
  });

  it('init() sets $page.ondisconnect and $page.onconnect as functions', async () => {
    const plugin = makePlugin();
    await plugin.init('https://base/', mockPage as any, {} as any, '', null);
    expect(typeof mockPage.ondisconnect).toBe('function');
    expect(typeof mockPage.onconnect).toBe('function');
  });

  it('$page.ondisconnect calls stopHealthProbe', async () => {
    const plugin = makePlugin();
    const stopSpy = vi.spyOn(plugin as any, 'stopHealthProbe');
    await plugin.init('https://base/', mockPage as any, {} as any, '', null);
    mockPage.ondisconnect();
    expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  it('$page.ondisconnect does not throw when no health probe is running', async () => {
    const plugin = makePlugin();
    await plugin.init('https://base/', mockPage as any, {} as any, '', null);
    expect(() => mockPage.ondisconnect()).not.toThrow();
  });

  it('$page.onconnect does not throw (logging only)', async () => {
    const plugin = makePlugin();
    await plugin.init('https://base/', mockPage as any, {} as any, '', null);
    expect(() => mockPage.onconnect()).not.toThrow();
  });
});
