import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppState } from '../src/types';
import * as stateModule from '../src/state';
import * as installModule from '../src/opencode/install';
import * as serverModule from '../src/opencode/server';
import * as healthModule from '../src/opencode/health';
import * as settingsModule from '../src/settings';
import * as updateModule from '../src/opencode/update';
import * as diagnosticsModule from '../src/opencode/diagnostics';
import {
  HEALTH_PROBE_INTERVAL,
  HEALTH_CONNECTION_LOST_MESSAGE,
} from '../src/config/health';
import { BASE_URL } from '../src/config/server';
import { buildAuthTokenUrl } from '../src/opencode/auth';

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
const mockIsServerDownConfirmed = vi.mocked(healthModule.isServerDownConfirmed);
const mockStartServer = vi.mocked(serverModule.startServer);
const mockWaitForReady = vi.mocked(serverModule.waitForReady);
const mockRestartServer = vi.mocked(serverModule.restartServer);
const mockStopServer = vi.mocked(serverModule.stopServer);
const mockGetServerLog = vi.mocked(serverModule.getServerLog);
const mockGetServerPassword = vi.mocked(serverModule.getServerPassword);
const mockGetSettingsSchema = vi.mocked(settingsModule.getSettingsSchema);
const mockGetRuntimeVersions = vi.mocked(diagnosticsModule.getRuntimeVersions);

import { AcodePlugin } from '../src/main';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  stateModule.reset();
  mockGetSettingsSchema.mockReturnValue({ list: [] } as any);
  (updateModule.checkForUpdates as any).mockResolvedValue(null);
  mockGetRuntimeVersions.mockResolvedValue({ node: '?', npm: '?' });
  (globalThis as any).acode = { pushNotification: vi.fn() };
});

afterEach(() => {
  vi.useRealTimers();
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

  it('should_use_auth_token_url_when_server_started', async () => {
    // Arrange
    mockCheckInstalled.mockResolvedValue(true);
    mockIsServerUp.mockResolvedValue(false);
    mockStartServer.mockResolvedValueOnce(undefined);
    mockWaitForReady.mockResolvedValue(undefined);
    mockGetServerPassword.mockReturnValueOnce('pw');
    const plugin = makePlugin();

    // Act
    await (plugin as any).startFlow();

    // Assert
    expect(stateModule.getState().currentState).toBe(AppState.Ready);
    expect((plugin as any).iframeUrl).toBe(buildAuthTokenUrl('pw'));
  });

  it('should_prompt_for_password_when_server_already_running', async () => {
    // Arrange
    mockCheckInstalled.mockResolvedValue(true);
    mockIsServerUp.mockResolvedValue(true);
    const promptMock = vi.fn().mockResolvedValue('typed-pw');
    (globalThis as any).acode.prompt = promptMock;
    const plugin = makePlugin();

    // Act
    await (plugin as any).startFlow();

    // Assert
    expect(stateModule.getState().currentState).toBe(AppState.Ready);
    expect(promptMock).toHaveBeenCalledTimes(1);
    expect((plugin as any).iframeUrl).toBe(buildAuthTokenUrl('typed-pw'));
  });

  it('should_fall_back_to_base_url_when_prompt_cancelled', async () => {
    // Arrange
    mockCheckInstalled.mockResolvedValue(true);
    mockIsServerUp.mockResolvedValue(true);
    (globalThis as any).acode.prompt = vi.fn().mockResolvedValue(null);
    const plugin = makePlugin();

    // Act
    await (plugin as any).startFlow();

    // Assert
    expect(stateModule.getState().currentState).toBe(AppState.Ready);
    expect((plugin as any).iframeUrl).toBe(BASE_URL);
  });

  it('should_reuse_held_password_without_prompting', async () => {
    // Arrange
    mockCheckInstalled.mockResolvedValue(true);
    mockIsServerUp.mockResolvedValue(true);
    mockGetServerPassword.mockReturnValueOnce('held-pw');
    const promptMock = vi.fn();
    (globalThis as any).acode.prompt = promptMock;
    const plugin = makePlugin();

    // Act
    await (plugin as any).startFlow();

    // Assert
    expect(promptMock).not.toHaveBeenCalled();
    expect((plugin as any).iframeUrl).toBe(buildAuthTokenUrl('held-pw'));
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

  it('should_stop_the_server_when_destroy_called', async () => {
    // Arrange
    const mockPage = makeMockPage();
    (globalThis as any).acode = {
      addIcon: vi.fn(),
      require: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ show: vi.fn(), hide: vi.fn() })),
    };
    mockStopServer.mockResolvedValue(undefined);
    const plugin = makePlugin();
    await plugin.init('https://base/', mockPage as any, {} as any, '');

    // Act
    await plugin.destroy();

    // Assert - the server this plugin started must not outlive the plugin
    expect(mockStopServer).toHaveBeenCalled();
  });

  it('should_not_throw_when_the_server_cannot_be_stopped', async () => {
    // Arrange
    const mockPage = makeMockPage();
    (globalThis as any).acode = {
      addIcon: vi.fn(),
      require: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ show: vi.fn(), hide: vi.fn() })),
    };
    mockStopServer.mockRejectedValue(new Error('stop failed'));
    const plugin = makePlugin();
    await plugin.init('https://base/', mockPage as any, {} as any, '');

    // Act
    await expect(plugin.destroy()).resolves.toBeUndefined();
  });
});

describe('handleRestart', () => {
  it('should_rebuild_auth_token_url_when_restart_succeeds', async () => {
    // Arrange
    mockWaitForReady.mockResolvedValue(undefined);
    mockGetServerPassword.mockReturnValueOnce('pw2');
    const plugin = makePlugin();

    // Act
    await (plugin as any).handleRestart();

    // Assert
    expect(stateModule.getState().currentState).toBe(AppState.Ready);
    expect((plugin as any).iframeUrl).toBe(buildAuthTokenUrl('pw2'));
  });

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

describe('manageHealthProbe', () => {
  it('should_set_error_with_logs_when_crash_confirmed', async () => {
    // Arrange
    vi.useFakeTimers();
    mockIsServerDownConfirmed.mockResolvedValue(true);
    mockGetServerLog.mockReturnValue('tail logs');
    stateModule.transition(AppState.Ready);
    const plugin = makePlugin();
    (plugin as any).manageHealthProbe(AppState.Ready);

    // Act
    await vi.advanceTimersByTimeAsync(HEALTH_PROBE_INTERVAL);

    // Assert
    expect(stateModule.getState().currentState).toBe(AppState.Error);
    expect(stateModule.getState().error?.message).toBe(HEALTH_CONNECTION_LOST_MESSAGE);
    expect(stateModule.getState().error?.logTail).toBe('tail logs');
    (plugin as any).stopHealthProbe();
  });

  it('should_stay_Ready_when_crash_not_confirmed', async () => {
    // Arrange
    vi.useFakeTimers();
    mockIsServerDownConfirmed.mockResolvedValue(false);
    stateModule.transition(AppState.Ready);
    const plugin = makePlugin();
    (plugin as any).manageHealthProbe(AppState.Ready);

    // Act
    await vi.advanceTimersByTimeAsync(HEALTH_PROBE_INTERVAL);

    // Assert
    expect(stateModule.getState().currentState).toBe(AppState.Ready);
    expect(stateModule.getState().error).toBeNull();
    (plugin as any).stopHealthProbe();
  });

  it('should_run_only_one_check_when_ticks_overlap', async () => {
    // Arrange
    vi.useFakeTimers();
    mockIsServerDownConfirmed.mockImplementation(() => new Promise<boolean>(() => {}));
    stateModule.transition(AppState.Ready);
    const plugin = makePlugin();
    (plugin as any).manageHealthProbe(AppState.Ready);

    // Act
    await vi.advanceTimersByTimeAsync(HEALTH_PROBE_INTERVAL * 2);

    // Assert
    expect(mockIsServerDownConfirmed).toHaveBeenCalledTimes(1);
    (plugin as any).stopHealthProbe();
  });

  it('should_not_error_when_left_Ready_before_confirm_resolves', async () => {
    // Arrange
    vi.useFakeTimers();
    mockIsServerDownConfirmed.mockImplementation(async () => {
      stateModule.transition(AppState.Idle);
      return true;
    });
    stateModule.transition(AppState.Ready);
    const plugin = makePlugin();
    (plugin as any).manageHealthProbe(AppState.Ready);

    // Act
    await vi.advanceTimersByTimeAsync(HEALTH_PROBE_INTERVAL);

    // Assert
    expect(stateModule.getState().currentState).toBe(AppState.Idle);
    expect(stateModule.getState().error).toBeNull();
    (plugin as any).stopHealthProbe();
  });

  it('should_ignore_stale_check_from_previous_Ready_session', async () => {
    // Arrange
    vi.useFakeTimers();
    let resolveCheck!: (value: boolean) => void;
    mockIsServerDownConfirmed.mockImplementation(
      () => new Promise<boolean>((resolve) => void (resolveCheck = resolve)),
    );
    stateModule.transition(AppState.Ready);
    const plugin = makePlugin();
    (plugin as any).manageHealthProbe(AppState.Ready);
    await vi.advanceTimersByTimeAsync(HEALTH_PROBE_INTERVAL);
    expect(mockIsServerDownConfirmed).toHaveBeenCalledTimes(1);

    // Act: leave Ready (stops probe, bumps epoch), re-enter, resolve stale check
    (plugin as any).manageHealthProbe(AppState.Idle);
    stateModule.transition(AppState.Ready);
    (plugin as any).manageHealthProbe(AppState.Ready);
    resolveCheck(true);
    await Promise.resolve();

    // Assert
    expect(stateModule.getState().currentState).toBe(AppState.Ready);
    expect(stateModule.getState().error).toBeNull();
    (plugin as any).stopHealthProbe();
  });

  it('should_set_error_when_pushNotification_throws', async () => {
    // Arrange
    vi.useFakeTimers();
    (globalThis as any).acode = {
      pushNotification: vi.fn(() => {
        throw new Error('nope');
      }),
    };
    mockIsServerDownConfirmed.mockResolvedValue(true);
    mockGetServerLog.mockReturnValue('tail logs');
    stateModule.transition(AppState.Ready);
    const plugin = makePlugin();
    (plugin as any).manageHealthProbe(AppState.Ready);

    // Act
    await vi.advanceTimersByTimeAsync(HEALTH_PROBE_INTERVAL);

    // Assert
    expect(stateModule.getState().currentState).toBe(AppState.Error);
    expect(stateModule.getState().error?.message).toBe(HEALTH_CONNECTION_LOST_MESSAGE);
    (plugin as any).stopHealthProbe();
  });
});

describe('handleStop', () => {
  it('should_reset_iframe_url_when_stopped', async () => {
    // Arrange
    mockStopServer.mockResolvedValueOnce('stopped');
    const plugin = makePlugin();
    (plugin as any).iframeUrl = 'http://127.0.0.1:4123/auth/connect/old';
    (plugin as any).enteredPassword = 'typed-pw';

    // Act
    await (plugin as any).handleStop();

    // Assert
    expect((plugin as any).iframeUrl).toBe(BASE_URL);
    expect((plugin as any).enteredPassword).toBeNull();
    expect(stateModule.getState().currentState).toBe(AppState.Idle);
  });

  it('should_stop_probe_before_stopServer_resolves', async () => {
    // Arrange
    vi.useFakeTimers();
    stateModule.transition(AppState.Ready);
    const plugin = makePlugin();
    (plugin as any).manageHealthProbe(AppState.Ready);
    let resolveStop!: (value: string) => void;
    mockStopServer.mockImplementation(
      () => new Promise<string>((resolve) => void (resolveStop = resolve)),
    );
    const stopPromise = (plugin as any).handleStop();

    // Act
    await Promise.resolve();
    const timerArmed = (plugin as any).healthProbeTimer !== null;

    // Assert
    expect(timerArmed).toBe(false);
    resolveStop('stopped');
    await stopPromise;
    expect(stateModule.getState().currentState).toBe(AppState.Idle);
  });
});

describe('handleUpdateClick', () => {
  it('should_show_new_version_when_update_succeeds', async () => {
    // Arrange
    (updateModule.installUpdate as any).mockResolvedValueOnce(undefined);
    (updateModule.checkForUpdates as any).mockResolvedValueOnce(null);
    (updateModule.getInstalledVersion as any).mockResolvedValueOnce('2.0.28');
    const plugin = makePlugin();
    (plugin as any).updateInfo = { currentVersion: '1.19.0', latestVersion: '2.0.28' };

    // Act
    await (plugin as any).handleUpdateClick();

    // Assert
    expect((plugin as any).updateStatus).toBe('updated');
    expect((plugin as any).updateInfo).toEqual({
      currentVersion: '2.0.28',
      latestVersion: '2.0.28',
    });
  });

  it('should_keep_fresh_info_when_update_still_available', async () => {
    // Arrange
    (updateModule.installUpdate as any).mockResolvedValueOnce(undefined);
    (updateModule.checkForUpdates as any).mockResolvedValueOnce({
      currentVersion: '2.0.27',
      latestVersion: '2.0.28',
    });
    const plugin = makePlugin();

    // Act
    await (plugin as any).handleUpdateClick();

    // Assert
    expect((plugin as any).updateInfo).toEqual({
      currentVersion: '2.0.27',
      latestVersion: '2.0.28',
    });
  });

  it('should_show_error_when_install_fails', async () => {
    // Arrange
    (updateModule.installUpdate as any).mockRejectedValueOnce(new Error('EACCES'));
    const plugin = makePlugin();

    // Act
    await (plugin as any).handleUpdateClick();

    // Assert
    expect((plugin as any).updateStatus).toBe('error');
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
