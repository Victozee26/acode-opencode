import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppState } from '../src/types';
import * as stateModule from '../src/state';
import * as installModule from '../src/opencode/install';
import * as serverModule from '../src/opencode/server';
import * as healthModule from '../src/opencode/health';
import * as settingsModule from '../src/settings';
import * as updateModule from '../src/opencode/update';
import * as diagnosticsModule from '../src/opencode/diagnostics';

vi.mock('../src/opencode/install');
vi.mock('../src/opencode/server');
vi.mock('../src/opencode/health');
vi.mock('../src/settings');
vi.mock('../src/opencode/update');
vi.mock('../src/opencode/diagnostics');
vi.mock('../src/ui/index');
vi.mock('../plugin.json', () => ({
  default: { id: 'acode.plugin', name: 'Plugin', main: 'main.js', version: '1.0.0' },
}));

const mockCheckInstalled = vi.mocked(installModule.checkInstalled);
const mockInstallOpenCode = vi.mocked(installModule.installOpenCode);
const mockIsServerUp = vi.mocked(healthModule.isServerUp);
const mockStartServer = vi.mocked(serverModule.startServer);
const mockWaitForReady = vi.mocked(serverModule.waitForReady);
const mockRestartServer = vi.mocked(serverModule.restartServer);
const mockGetSettingsSchema = vi.mocked(settingsModule.getSettingsSchema);
const mockGetRuntimeVersions = vi.mocked(diagnosticsModule.getRuntimeVersions);

import { AcodePlugin } from '../src/main';

beforeEach(() => {
  vi.clearAllMocks();
  stateModule.reset();
  mockGetSettingsSchema.mockReturnValue({ list: [] } as any);
  (updateModule.checkForUpdates as any).mockResolvedValue(null);
  mockGetRuntimeVersions.mockResolvedValue({ node: '?', npm: '?' });
});

function makePlugin(): AcodePlugin {
  return new AcodePlugin();
}

function makeMockPage() {
  return {
    on: vi.fn(),
    off: vi.fn(),
    hide: vi.fn(),
    show: vi.fn(),
    settitle: vi.fn(),
    appendChild: vi.fn(),
    body: { innerHTML: '' },
    header: { innerHTML: '', style: {} as any },
    style: {} as any,
  };
}

describe('startFlow', () => {
  it('should_reach_Ready_when_installed_and_server_up', async () => {
    // Arrange
    mockCheckInstalled.mockResolvedValue(true);
    mockIsServerUp.mockResolvedValue(true);
    const plugin = makePlugin();

    // Act
    await (plugin as any).startFlow();

    // Assert
    expect(stateModule.getState().currentState).toBe(AppState.Ready);
  });

  it('should_reach_Ready_when_installed_but_server_needs_start', async () => {
    // Arrange
    mockCheckInstalled.mockResolvedValue(true);
    mockIsServerUp.mockResolvedValue(false);
    mockWaitForReady.mockResolvedValue(undefined);
    const plugin = makePlugin();

    // Act
    await (plugin as any).startFlow();

    // Assert
    expect(stateModule.getState().currentState).toBe(AppState.Ready);
  });

  it('should_reach_Ready_when_not_installed_and_install_succeeds', async () => {
    // Arrange
    mockCheckInstalled.mockResolvedValue(false);
    mockInstallOpenCode.mockResolvedValue(undefined);
    mockIsServerUp.mockResolvedValue(false);
    mockWaitForReady.mockResolvedValue(undefined);
    const plugin = makePlugin();

    // Act
    await (plugin as any).startFlow();

    // Assert
    expect(stateModule.getState().currentState).toBe(AppState.Ready);
  });

  it('should_set_error_when_install_fails', async () => {
    // Arrange
    mockCheckInstalled.mockResolvedValue(false);
    mockInstallOpenCode.mockRejectedValue(new Error('Installation failed (deps): EACCES'));
    const plugin = makePlugin();

    // Act
    await (plugin as any).startFlow();

    // Assert
    expect(stateModule.getState().currentState).toBe(AppState.Error);
  });

  it('should_set_error_when_waitForReady_fails', async () => {
    // Arrange
    mockCheckInstalled.mockResolvedValue(true);
    mockIsServerUp.mockResolvedValue(false);
    mockWaitForReady.mockRejectedValue(new Error('Server did not respond within 15s'));
    const plugin = makePlugin();

    // Act
    await (plugin as any).startFlow();

    // Assert
    expect(stateModule.getState().currentState).toBe(AppState.Error);
  });

  it('should_use_fallback_message_when_error_empty', async () => {
    // Arrange
    mockCheckInstalled.mockResolvedValue(true);
    mockIsServerUp.mockResolvedValue(false);
    mockStartServer.mockRejectedValue(new Error(''));
    const plugin = makePlugin();

    // Act
    await (plugin as any).startFlow();

    // Assert
    expect(stateModule.getState().error?.message).toBe('An unknown error occurred.');
  });

  it('should_handle_string_rejection_when_start_fails', async () => {
    // Arrange
    mockCheckInstalled.mockResolvedValue(true);
    mockIsServerUp.mockResolvedValue(false);
    mockStartServer.mockRejectedValue('plain string error');
    const plugin = makePlugin();

    // Act
    await (plugin as any).startFlow();

    // Assert
    expect(stateModule.getState().error?.message).toBe('plain string error');
  });
});

describe('destroy', () => {
  it('should_hide_page_when_destroy_called', async () => {
    // Arrange
    const mockPage = makeMockPage();
    (globalThis as any).acode = {
      addIcon: vi.fn(),
      require: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ show: vi.fn(), hide: vi.fn() })),
    };
    const plugin = makePlugin();
    await plugin.init('https://base/', mockPage as any, {} as any, '');

    // Act
    await plugin.destroy();

    // Assert
    expect(mockPage.style.display).toBe('none');
  });

  it('should_reset_state_when_destroy_called', async () => {
    // Arrange
    const mockPage = makeMockPage();
    (globalThis as any).acode = {
      addIcon: vi.fn(),
      require: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ show: vi.fn(), hide: vi.fn() })),
    };
    const plugin = makePlugin();
    await plugin.init('https://base/', mockPage as any, {} as any, '');
    stateModule.transition(AppState.Ready);

    // Act
    await plugin.destroy();

    // Assert
    expect(stateModule.getState().currentState).toBe(AppState.Idle);
  });
});

describe('handleRestart', () => {
  it('should_reach_Ready_when_restart_succeeds', async () => {
    // Arrange
    mockWaitForReady.mockResolvedValue(undefined);
    const plugin = makePlugin();

    // Act
    await (plugin as any).handleRestart();

    // Assert
    expect(stateModule.getState().currentState).toBe(AppState.Ready);
  });

  it('should_set_error_when_restart_fails', async () => {
    // Arrange
    mockRestartServer.mockRejectedValue(new Error('port busy'));
    const plugin = makePlugin();

    // Act
    await (plugin as any).handleRestart();

    // Assert
    expect(stateModule.getState().currentState).toBe(AppState.Error);
  });
});

describe('ctx / PluginContext', () => {
  it('should_store_ctx_when_init_with_valid_ctx', async () => {
    // Arrange
    const mockPage = makeMockPage();
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

    // Act
    await plugin.init('https://base/', mockPage as any, {} as any, '', mockCtx);

    // Assert
    expect((plugin as any).ctx.uuid).toBe('test-uuid');
  });

  it('should_handle_null_ctx_without_throw', async () => {
    // Arrange
    const mockPage = makeMockPage();
    (globalThis as any).acode = {
      addIcon: vi.fn(),
      require: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ show: vi.fn(), hide: vi.fn() })),
    };
    const plugin = makePlugin();

    // Act
    const promise = plugin.init('https://base/', mockPage as any, {} as any, '', null);

    // Assert
    await expect(promise).resolves.toBeUndefined();
  });

  it('should_have_null_ctx_when_init_with_null', async () => {
    // Arrange
    const mockPage = makeMockPage();
    (globalThis as any).acode = {
      addIcon: vi.fn(),
      require: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ show: vi.fn(), hide: vi.fn() })),
    };
    const plugin = makePlugin();
    await plugin.init('https://base/', mockPage as any, {} as any, '', null);

    // Act
    const ctx = (plugin as any).ctx;

    // Assert
    expect(ctx).toBeNull();
  });
});

describe('showToast helper', () => {
  it('should_call_toast_when_message_provided', () => {
    // Arrange
    const toastMock = vi.fn();
    (globalThis as any).acode = {
      require: (name: string) => (name === 'toast' ? toastMock : undefined),
    };
    const plugin = makePlugin();

    // Act
    (plugin as any).showToast('Hello');

    // Assert
    expect(toastMock).toHaveBeenCalledWith('Hello', 2000);
  });

  it('should_not_throw_when_acode_unavailable', () => {
    // Arrange
    (globalThis as any).acode = undefined;
    const plugin = makePlugin();

    // Act
    const act = (): void => (plugin as any).showToast('Hello');

    // Assert
    expect(act).not.toThrow();
  });
});

describe('page lifecycle hooks', () => {
  it('should_set_ondisconnect_when_init_called', async () => {
    // Arrange
    const mockPage = makeMockPage() as any;
    (globalThis as any).acode = {
      addIcon: vi.fn(),
      require: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ show: vi.fn(), hide: vi.fn() })),
    };
    const plugin = makePlugin();

    // Act
    await plugin.init('https://base/', mockPage, {} as any, '', null);

    // Assert
    expect(typeof mockPage.ondisconnect).toBe('function');
  });

  it('should_set_onconnect_when_init_called', async () => {
    // Arrange
    const mockPage = makeMockPage() as any;
    (globalThis as any).acode = {
      addIcon: vi.fn(),
      require: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ show: vi.fn(), hide: vi.fn() })),
    };
    const plugin = makePlugin();

    // Act
    await plugin.init('https://base/', mockPage, {} as any, '', null);

    // Assert
    expect(typeof mockPage.onconnect).toBe('function');
  });
});
