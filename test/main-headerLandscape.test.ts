import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApplyHeaderVisibility = vi.fn();
const mockDestroyOrientationListener = vi.fn();
const mockInitUiPage = vi.fn();
const mockInitUiStyles = vi.fn();

// capture handler wired via setOnHideHeaderChange
let capturedHideHandler: ((v: boolean) => void) | null = null;

vi.mock('../src/ui/index', () => ({
  applyHeaderVisibility: (...args: any[]) => mockApplyHeaderVisibility(...args),
  destroyOrientationListener: (...args: any[]) => mockDestroyOrientationListener(...args),
  initUiPage: (...args: any[]) => mockInitUiPage(...args),
  initUiStyles: (...args: any[]) => mockInitUiStyles(...args),
  render: vi.fn(),
  updateHeader: vi.fn(),
  updateIframeScale: vi.fn(),
  setSpinnerProgress: vi.fn(),
}));

vi.mock('../src/settings', () => ({
  getSettingsSchema: vi.fn(() => ({ list: [] as any[], cb: vi.fn() })),
  setOnScaleChange: vi.fn(),
  setOnHideHeaderChange: vi.fn((h: any) => { capturedHideHandler = h; }),
  getAutoStart: vi.fn(() => false),
  getEnableConsoleLogs: vi.fn(() => false),
  getLogLevel: vi.fn(() => 'info'),
  getHideHeaderInLandscape: vi.fn(() => true),
  getIframeScale: vi.fn(() => 1.0),
}));

vi.mock('../src/state', () => ({
  onStateChange: vi.fn(),
  transition: vi.fn(),
  getState: vi.fn(() => ({ currentState: 'idle', error: null })),
  setError: vi.fn(),
  reset: vi.fn(),
}));

vi.mock('../src/opencode/install', () => ({
  checkInstalled: vi.fn(),
  installOpenCode: vi.fn(),
  uninstallOpenCode: vi.fn(),
}));

vi.mock('../src/opencode/server', () => ({
  startServer: vi.fn(),
  waitForReady: vi.fn(),
  restartServer: vi.fn(),
  stopServer: vi.fn(),
}));

vi.mock('../src/opencode/health', () => ({
  isServerUp: vi.fn(),
}));

vi.mock('../src/opencode/update', () => ({
  checkForUpdates: vi.fn(() => Promise.resolve(null)),
  installUpdate: vi.fn(),
}));

vi.mock('../plugin.json', () => ({
  default: { id: 'acode.plugin', name: 'Plugin', main: 'main.js', version: '1.0.0' },
}));

import { AcodePlugin } from '../src/main';
import * as settingsModule from '../src/settings';

beforeEach(() => {
  vi.clearAllMocks();
  capturedHideHandler = null;
  (settingsModule.setOnHideHeaderChange as any).mockImplementation((h: any) => { capturedHideHandler = h; });
  (globalThis as any).acode = {
    addIcon: vi.fn(),
    require: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ show: vi.fn(), hide: vi.fn() })),
  };
});

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

describe('AcodePlugin landscape wiring', () => {
  it('init wires setOnHideHeaderChange → applyHeaderVisibility', async () => {
    const plugin = new AcodePlugin();
    const page = makeMockPage();
    await plugin.init('https://base/', page as any, {} as any, '', null as any);
    expect(settingsModule.setOnHideHeaderChange).toHaveBeenCalledTimes(1);
    expect(capturedHideHandler).not.toBeNull();
    // invoking handler should call applyHeaderVisibility
    capturedHideHandler!(true);
    expect(mockApplyHeaderVisibility).toHaveBeenCalledTimes(1);
    capturedHideHandler!(false);
    expect(mockApplyHeaderVisibility).toHaveBeenCalledTimes(2);
    await plugin.destroy();
  });

  it('destroy calls destroyOrientationListener and clears handler', async () => {
    const plugin = new AcodePlugin();
    const page = makeMockPage();
    await plugin.init('https://base/', page as any, {} as any, '', null as any);
    const handlerBefore = capturedHideHandler;
    expect(handlerBefore).not.toBeNull();
    await plugin.destroy();
    expect(mockDestroyOrientationListener).toHaveBeenCalledTimes(1);
    // setOnHideHeaderChange should have been called again with noop
    expect(settingsModule.setOnHideHeaderChange).toHaveBeenCalledTimes(2);
    const secondCall = (settingsModule.setOnHideHeaderChange as any).mock.calls[1][0] as Function;
    // noop should not call applyHeaderVisibility
    secondCall(true);
    expect(mockApplyHeaderVisibility).toHaveBeenCalledTimes(0); // only init's handler had 0 calls before destroy in this test (we did not invoke)
    // captured handler after destroy is noop, not original
    // verify original handler still works but is no longer wired (settings module would have replaced)
    // To confirm wiring is cleared, we check that capturedHideHandler after destroy is noop (second call)
    // The settings module's internal handler is now noop, so future setting changes won't trigger UI
  });

  it('destroy is idempotent — second destroy does not throw and calls destroyOrientationListener again', async () => {
    const plugin = new AcodePlugin();
    const page = makeMockPage();
    await plugin.init('https://base/', page as any, {} as any, '', null as any);
    await plugin.destroy();
    expect(() => plugin.destroy()).not.toThrow;
    await plugin.destroy();
    expect(mockDestroyOrientationListener).toHaveBeenCalledTimes(2);
  });

  it('live toggle via handler respects destroy cleanup', async () => {
    const plugin = new AcodePlugin();
    const page = makeMockPage();
    await plugin.init('https://base/', page as any, {} as any, '', null as any);
    // handler before destroy should trigger apply
    capturedHideHandler!(true);
    expect(mockApplyHeaderVisibility).toHaveBeenCalledTimes(1);
    await plugin.destroy();
    // after destroy, the handler stored in settings is noop — calling captured old handler still would trigger, but the *new* handler is noop.
    // Simulate settings cb invoking current handler: get the noop
    const noop = (settingsModule.setOnHideHeaderChange as any).mock.calls[1][0] as Function;
    mockApplyHeaderVisibility.mockClear();
    noop(true);
    expect(mockApplyHeaderVisibility).not.toHaveBeenCalled();
  });
});
