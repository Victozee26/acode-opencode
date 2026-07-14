import plugin from '../plugin.json';

import { AppState } from './types';
import { onStateChange, transition, setError, reset } from './state';
import { render } from './ui/index';
import { checkInstalled, installOpenCode } from './opencode/install';
import { startServer, waitForReady, restartServer } from './opencode/server';
import { isServerUp } from './opencode/health';
import { createLogger, setLogEnabled } from './logger';
import { DEBUG } from './config';
import { extractErrorInfo } from './error';

const log = createLogger('main');

const ICON_CLASS = 'opencode-icon';

/**
 * AcodePlugin orchestrates the OpenCode plugin lifecycle.
 *
 * Responsibilities:
 * - `init()` wires the reactive UI (onStateChange -> render) and the page `show`
 *   event + side-button so the app starts on demand.
 * - `destroy()` tears everything down and resets the state machine.
 * - `startFlow()` is the state-machine driver that installs/starts OpenCode.
 * - `handleRestart()` reuses the StartingServer path to restart a running server.
 */
export class AcodePlugin {
  private $page: Acode.WCPage | null = null;
  // `isRunning` guards against re-entrant startFlow: the page `show` event can
  // fire repeatedly (e.g. on every re-display), so it prevents starting the
  // install/start sequence more than once concurrently.
  private isRunning = false;
  private sideButton: Acode.SideButton | null = null;
  private handleShow!: () => void;

  /**
   * Registers the reactive render hook and UI entry points.
   *
   * - Subscribes onStateChange to render(state, context, onRestart); the UI is
   *   purely reactive, so every state change re-renders the page.
   * - Wires `handleShow` to the page `show` event so the flow kicks off when the
   *   page becomes visible, but only if it isn't already running.
   * - Registers the side-button that opens the page.
   */
  async init(
    baseUrl: string,
    $page: Acode.WCPage,
    _cacheFile: Acode.FileSystem,
    _cacheFileUrl: string,
  ): Promise<void> {
    setLogEnabled(DEBUG);
    log.info('init: plugin initializing');
    this.$page = $page;
    $page.settitle('OpenCode');

    onStateChange((state, context) => {
      if (this.$page) {
        render(this.$page, state, context, () => this.handleRestart());
      }
    });

    // Lazy start: only run the flow the first time the page is shown.
    this.handleShow = () => {
      if (!this.isRunning) {
        this.startFlow();
      }
    };
    $page.on('show', this.handleShow);

    const iconUrl = baseUrl + 'icon.png';
    acode.addIcon(ICON_CLASS, iconUrl);

    const SideButton = acode.require('sideButton');
    this.sideButton = SideButton({
      text: 'OpenCode',
      icon: ICON_CLASS,
      onclick: () => {
        this.$page?.show();
      },
    });
    this.sideButton.show();
  }

  /**
   * Tears down the plugin: hides/removes the side-button, unsubscribes the
   * `show` handler, hides the page, and resets the state machine back to Idle.
   */
  async destroy(): Promise<void> {
    log.info('destroy: tearing down');
    this.sideButton?.hide();
    this.sideButton = null;
    if (this.handleShow) {
      this.$page?.off('show', this.handleShow);
    }
    this.$page?.hide();
    this.$page = null;
    reset();
  }

  /**
   * Drives the state machine forward:
   * CheckingInstall -> (Installing if not installed) -> CheckingServer ->
   * (skip straight to Ready if the server is already up) -> StartingServer ->
   * Ready.
   *
   * Any failure is routed through extractErrorInfo + setError, which moves the
   * machine into the Error state and renders a diagnostic view.
   */
  private async startFlow(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    log.info('startFlow: beginning');

    transition(AppState.CheckingInstall);

    try {
      const installed = await checkInstalled();

      if (!installed) {
        transition(AppState.Installing);
        await installOpenCode();
      }

      transition(AppState.CheckingServer);

      const serverUp = await isServerUp();
      if (serverUp) {
        log.info('startFlow: server already up, skipping start');
        transition(AppState.Ready);
        return;
      }

      transition(AppState.StartingServer);

      await startServer();
      await waitForReady();

      transition(AppState.Ready);
      log.info('startFlow: ready');
    } catch (err) {
      this.handleError('startFlow', err);
    }
  }

  /**
   * Restarts the OpenCode server after it's already been brought up once.
   * Reuses the StartingServer state and restartServer() rather than re-running
   * the full install/check flow.
   */
  private async handleRestart(): Promise<void> {
    log.info('handleRestart: restart requested');
    transition(AppState.StartingServer);

    try {
      await restartServer();
      await waitForReady();
      transition(AppState.Ready);
      log.info('handleRestart: ready');
    } catch (err) {
      this.handleError('handleRestart', err);
    }
  }

  /**
   * Shared error path for the flow drivers. Normalizes the thrown value via
   * extractErrorInfo and routes it through setError() so the state machine
   * enters Error and the UI renders diagnostics.
   */
  private handleError(stage: string, err: unknown): void {
    log.error(`${stage}: failed`, err);
    const { summary, logTail } = extractErrorInfo(err);
    setError(summary, logTail);
  }
}

// Bootstrap: register the plugin with Acode only when the global `acode` object
// exists (i.e. we are running inside the Acode WebView).
if (window.acode) {
  const acodePlugin = new AcodePlugin();

  // setPluginInit registers the entry point Acode calls once when the plugin is
  // loaded; cacheFile/cacheFileUrl are destructured from PluginInitOptions.
  acode.setPluginInit(
    plugin.id,
    async (
      baseUrl: string,
      $page: Acode.WCPage,
      { cacheFileUrl, cacheFile }: Acode.PluginInitOptions,
    ) => {
      // Normalize the trailing slash so asset paths (e.g. icon.png) concatenate
      // correctly regardless of how Acode supplies the base URL.
      if (!baseUrl.endsWith('/')) {
        baseUrl += '/';
      }
      await acodePlugin.init(baseUrl, $page, cacheFile, cacheFileUrl);
    },
  );

  // setPluginUnmount registers teardown; Acode calls this when the plugin is
  // disabled or the host page is destroyed.
  acode.setPluginUnmount(plugin.id, () => {
    acodePlugin.destroy();
  });
}
