import plugin from '../plugin.json';

import { AppState, UpdateInfo, UpdateStatus } from './types';
import { onStateChange, transition, getState, setError, reset } from './state';
import {
  render,
  initUiStyles,
  initUiPage,
  updateHeader,
  updateIframeScale,
  setSpinnerProgress,
  applyHeaderVisibility,
  destroyOrientationListener,
  setErrorVersions,
} from './ui/index';
import type { RenderActions } from './ui/index';
import type { HeaderActions } from './types';
import { checkInstalled, installOpenCode, uninstallOpenCode } from './opencode/install';
import {
  startServer,
  waitForReady,
  restartServer,
  stopServer,
  getServerLog,
  getServerPassword,
} from './opencode/server';
import { buildAuthTokenUrl } from './opencode/auth';
import { BASE_URL } from './config/server';
import { isServerUp, isServerDownConfirmed, probeServer } from './opencode/health';
import { parseRemoteHost, buildRemoteIframeUrl, RemoteHost } from './opencode/remote';
import {
  REMOTE_BAD_PASSWORD_MESSAGE,
  REMOTE_INVALID_HOST_MESSAGE,
  REMOTE_PROMPT_MESSAGE,
  REMOTE_PROMPT_PLACEHOLDER,
  REMOTE_PROMPT_TITLE,
  REMOTE_UNREACHABLE_MESSAGE,
} from './config/remote';
import { checkForUpdates, installUpdate, getInstalledVersion } from './opencode/update';
import { getRuntimeVersions } from './opencode/diagnostics';
import { createLogger, setLogLevel } from './logger';
import { extractErrorInfo } from './error';
import {
  getSettingsSchema,
  setOnScaleChange,
  setOnHideHeaderChange,
  getLogLevel,
  getRemoteHost,
} from './settings';
import { HEALTH_PROBE_INTERVAL, HEALTH_CONNECTION_LOST_MESSAGE } from './config/health';

const log = createLogger('main');

const ICON_CLASS = 'opencode-icon';

/**
 * AcodePlugin orchestrates the OpenCode plugin lifecycle.
 *
 * Responsibilities:
 * - `init()` wires the reactive UI (onStateChange -> render) and the page `show`
 *   event + side-button so the app starts on demand.
 * - `ctx` stores the PluginContext for persistent key-value storage and permission checks.
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
  private updateInfo: UpdateInfo | null = null;
  private updateStatus: UpdateStatus | null = null;
  private iframeUrl: string = BASE_URL;
  // Password typed by the user for an already-running server the plugin did
  // not start (see resolveAlreadyRunningUrl). One-shot per session: cleared on
  // stop, never persisted.
  private enteredPassword: string | null = null;
  // Remote connection state: set when the plugin connects to an OpenCode server
  // on another machine instead of starting a local one. Holds the parsed host
  // and the password the user entered for it (never persisted). Null means the
  // plugin runs its own local server.
  private remote: { host: RemoteHost; password: string | null } | null = null;
  private healthProbeTimer: ReturnType<typeof setInterval> | null = null;
  private healthCheckInProgress = false;
  private healthProbeEpoch = 0;
  private ctx: Acode.PluginContext | null = null;

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
    ctx: Acode.PluginContext | null,
  ): Promise<void> {
    setLogLevel(getLogLevel() as 'none' | 'debug' | 'info' | 'warn' | 'error');
    log.info('init: plugin initializing');
    initUiStyles(baseUrl);
    setOnScaleChange((scale) => updateIframeScale(scale));
    setOnHideHeaderChange(() => applyHeaderVisibility());
    this.$page = $page;
    this.ctx = ctx;
    if (ctx) {
      log.info(`init: plugin context available (created_at=${ctx.created_at})`);
    }
    initUiPage($page);
    if ($page.header) {
      $page.header.innerHTML = '';
      $page.header.style.display = 'none';
    }

    $page.ondisconnect = () => {
      log.info('page disconnected — stopping health probe');
      this.stopHealthProbe();
    };

    $page.onconnect = () => {
      log.info('page connected');
    };

    const STACK_ID = 'opencode-plugin';
    const builtinShow = $page.show.bind($page);
    let pageShown = false;

    $page.show = () => {
      if (!pageShown) {
        pageShown = true;
        builtinShow();
      } else {
        const actionStack = acode.require('actionStack');
        if (!actionStack.has(STACK_ID)) {
          actionStack.push({
            id: STACK_ID,
            action: () => $page.hide(),
          });
        }
      }
      $page.style.display = '';
    };

    $page.hide = (): string => {
      $page.style.display = 'none';
      return '';
    };

    onStateChange((state, context) => {
      if (this.$page) {
        this.manageHealthProbe(state);
        const actions: RenderActions = {
          start: () => this.handleStart(),
          restart: () => this.handleRestart(),
          stop: () => this.handleStop(),
          back: () => this.$page?.hide(),
          iframeUrl: this.iframeUrl,
          updateInfo: this.updateInfo,
          updateStatus: this.updateStatus,
          onUpdateClick: () => this.handleUpdateClick(),
          onCancelUpdate: () => this.handleCancelUpdate(),
          onReinstall: () => this.handleReinstall(),
          remote: this.remote !== null,
        };
        render(state, context, actions);
        if (state === AppState.Error) {
          this.probeRuntimeVersions();
        }
      }
    });

    // Lazy start: only run the flow the first time the page is shown.
    this.handleShow = () => {
      if (!this.isRunning) {
        this.startFlow();
      }
    };
    $page.on('show', this.handleShow);

    // Fire-and-forget update check: runs in background, never blocks startup,
    // never throws. When a newer version is found, triggers a re-render so the
    // hamburger menu shows the version delta.
    this.runUpdateCheck().then((info) => {
      if (info) {
        this.updateInfo = info;
        updateHeader(getState().currentState, this.getHeaderActions());
      }
    });

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
   * `show` handler, hides the page, and resets the state machine to Idle.
   */
  async destroy(): Promise<void> {
    log.info('destroy: tearing down');
    this.stopHealthProbe();
    destroyOrientationListener();
    setOnHideHeaderChange(() => {});
    this.sideButton?.hide();
    this.sideButton = null;
    if (this.handleShow) {
      this.$page?.off('show', this.handleShow);
    }
    this.$page?.hide();
    this.$page = null;
    // Stop the server this plugin started, so disabling the plugin does not
    // leave an orphaned `opencode serve` holding port 4123. `stopServer()` is a
    // no-op when the plugin never started the server (e.g. the user pointed it
    // at a server that was already running), so an external server is never
    // touched.
    try {
      await stopServer();
    } catch (err: unknown) {
      log.warn('destroy: could not stop the server', err);
    }
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

    // A configured remote host replaces the whole local lifecycle: the plugin
    // neither installs nor starts OpenCode locally, it just connects. An
    // unparsable host is an error — it must not silently fall back to running
    // a local server, which is not what the user asked for.
    const remoteSetting = getRemoteHost();
    if (remoteSetting) {
      const remoteHost = parseRemoteHost(remoteSetting);
      if (!remoteHost) {
        setError(REMOTE_INVALID_HOST_MESSAGE, '');
        return;
      }
      await this.startRemoteFlow(remoteHost);
      return;
    }

    transition(AppState.CheckingInstall);

    try {
      const installed = await checkInstalled();

      if (!installed) {
        transition(AppState.Installing);
        await installOpenCode((text) => {
          setSpinnerProgress(text);
        });
      }

      transition(AppState.CheckingServer);

      const serverUp = await isServerUp();
      if (serverUp) {
        log.info('startFlow: server already up, skipping start');
        this.showToast('OpenCode server already running');
        this.iframeUrl = await this.resolveAlreadyRunningUrl();
        transition(AppState.Ready);
        return;
      }

      transition(AppState.StartingServer);

      await startServer();
      await waitForReady();
      this.iframeUrl = this.resolveIframeUrl();

      transition(AppState.Ready);
      log.info('startFlow: ready');
      this.showToast('OpenCode server ready');
    } catch (err) {
      this.handleError('startFlow', err);
    }
  }

  /**
   * Restarts the OpenCode server after it's already been brought up once.
   * Reuses the StartingServer state and restartServer() rather than re-running
   * the full install/check flow. In remote mode there is no local server to
   * restart, so the remote connection is re-established instead.
   */
  private async handleRestart(): Promise<void> {
    if (this.remote) {
      log.info('handleRestart: remote mode — reconnecting');
      await this.startRemoteFlow(this.remote.host);
      return;
    }

    log.info('handleRestart: restart requested');
    transition(AppState.StartingServer);

    try {
      log.info('handleRestart: calling restartServer');
      await restartServer();
      log.info('handleRestart: restartServer done, waiting for ready');
      await waitForReady();
      this.iframeUrl = this.resolveIframeUrl();
      log.info('handleRestart: server ready, transitioning to Ready');
      transition(AppState.Ready);
      log.info('handleRestart: ready');
      this.showToast('OpenCode server restarted');
    } catch (err) {
      this.handleError('handleRestart', err);
    }
  }

  /**
   * Starts the OpenCode server from Idle/Error. Reuses startFlow(); the
   * `isRunning` guard inside startFlow blocks re-entry while a flow is already
   * in progress, and we only (re)start from settled states so a click during a
   * transitional state (e.g. already StartingServer) is ignored.
   */
  private handleStart(): void {
    const state = getState().currentState;
    if (state === AppState.Ready) return;
    if (state === AppState.Idle || state === AppState.Error) {
      this.isRunning = false;
      void this.startFlow();
    }
  }

  /**
   * Stops the OpenCode server and returns to Idle so the user can start again.
   */
  /**
   * Shows a confirmation modal, and if confirmed, runs the reinstall flow:
   * uninstall → verify → install → start server.
   */
  private async handleReinstall(): Promise<void> {
    log.info('handleReinstall: showing confirmation dialog');
    const confirmed = await acode.confirm(
      'Reinstall OpenCode',
      'This will uninstall and reinstall OpenCode. Continue?',
    );
    if (confirmed) {
      void this.reinstallFlow();
    }
  }

  /**
   * Drives the reinstall flow through the state machine:
   * Uninstalling → CheckingInstall → Installing → CheckingServer →
   * StartingServer → Ready.
   */
  private async reinstallFlow(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    log.info('reinstallFlow: beginning');

    try {
      transition(AppState.Uninstalling);
      await uninstallOpenCode();

      transition(AppState.CheckingInstall);
      const installed = await checkInstalled();
      if (installed) {
        log.warn('reinstallFlow: opencode still present after uninstall, continuing');
      }

      transition(AppState.Installing);
      await installOpenCode((text) => {
        setSpinnerProgress(text);
      });

      transition(AppState.CheckingServer);
      const serverUp = await isServerUp();
      if (serverUp) {
        log.info('reinstallFlow: server already up, skipping start');
        this.iframeUrl = await this.resolveAlreadyRunningUrl();
        transition(AppState.Ready);
        return;
      }

      transition(AppState.StartingServer);
      await startServer();
      await waitForReady();
      this.iframeUrl = this.resolveIframeUrl();

      transition(AppState.Ready);
      log.info('reinstallFlow: ready');
    } catch (err) {
      this.handleError('reinstallFlow', err);
    } finally {
      this.isRunning = false;
    }
  }

  private async handleStop(): Promise<void> {
    log.info('handleStop: stopping server');
    this.stopHealthProbe();
    try {
      await stopServer();
      log.info('handleStop: server stopped');
      this.isRunning = false;
      this.iframeUrl = BASE_URL;
      this.enteredPassword = null;
      this.remote = null;
      transition(AppState.Idle);
      this.showToast('Server stopped');
    } catch (err) {
      this.handleError('handleStop', err);
    }
  }

  /**
   * Resolves the iframe URL for a plugin-started server: builds the
   * `?auth_token=` URL from the held password, or the plain base URL when no
   * password is held (V1 server). Synchronous and infallible — no network.
   */
  private resolveIframeUrl(): string {
    const password = getServerPassword();
    return password ? buildAuthTokenUrl(password) : BASE_URL;
  }

  /**
   * Resolves the iframe URL for an already-running server the plugin did not
   * start. Reuses a held or previously entered password when available;
   * otherwise prompts once via the native dialog. Cancel/empty degrades to
   * the plain base URL (manual login in the web UI).
   */
  private async resolveAlreadyRunningUrl(): Promise<string> {
    const known = getServerPassword() ?? this.enteredPassword;
    if (known) {
      return buildAuthTokenUrl(known);
    }
    const entered = await this.promptServerPassword();
    if (entered) {
      this.enteredPassword = entered;
      return buildAuthTokenUrl(entered);
    }
    return BASE_URL;
  }

  /**
   * Asks for the running server's password via the native prompt dialog.
   * Returns the typed password, or null on cancel/empty/failure.
   */
  private async promptServerPassword(): Promise<string | null> {
    try {
      const answer = await acode.prompt(
        'OpenCode server is already running. Enter its password to sign in automatically, or cancel for manual login.',
        '',
        'text',
        { placeholder: 'Server password' },
      );
      return answer ? answer : null;
    } catch {
      return null;
    }
  }

  /**
   * Connects to a remote OpenCode server instead of starting a local one.
   *
   * The remote server is probed first: an auth challenge means the user is
   * asked for the password once, a wrong password is reported as an error,
   * and an unreachable host is reported as such. The resolved host and
   * password become the target of the Ready-state health check.
   */
  private async startRemoteFlow(host: RemoteHost): Promise<void> {
    log.info(`startRemoteFlow: connecting to ${host.baseUrl}`);
    transition(AppState.CheckingServer);
    this.remote = { host, password: null };

    try {
      const verdict = await probeServer({ baseUrl: host.baseUrl });
      if (verdict === 'unauthorized') {
        await this.authorizeRemote(host);
        return;
      }
      if (verdict !== 'up') {
        setError(REMOTE_UNREACHABLE_MESSAGE, '');
        return;
      }
      this.iframeUrl = buildRemoteIframeUrl(host.baseUrl, null);
      transition(AppState.Ready);
      log.info('startRemoteFlow: ready');
    } catch (err: unknown) {
      this.handleError('startRemoteFlow', err);
    }
  }

  /**
   * Asks for the remote server's password and retries the probe with it.
   * A rejected password is an error; cancelling degrades to the plain base
   * URL, so the user can still sign in by hand in the web UI.
   */
  private async authorizeRemote(host: RemoteHost): Promise<void> {
    const entered = await this.promptRemotePassword();
    if (!entered) {
      this.iframeUrl = buildRemoteIframeUrl(host.baseUrl, null);
      transition(AppState.Ready);
      return;
    }

    const verdict = await probeServer({ baseUrl: host.baseUrl, password: entered });
    if (verdict === 'unauthorized') {
      setError(REMOTE_BAD_PASSWORD_MESSAGE, '');
      return;
    }
    if (verdict !== 'up') {
      setError(REMOTE_UNREACHABLE_MESSAGE, '');
      return;
    }

    this.remote = { host, password: entered };
    this.iframeUrl = buildRemoteIframeUrl(host.baseUrl, entered);
    transition(AppState.Ready);
    log.info('authorizeRemote: remote server ready');
  }

  /**
   * Asks for the remote server's password via the native prompt dialog.
   * Returns the typed password, or null on cancel/empty/failure.
   */
  private async promptRemotePassword(): Promise<string | null> {
    try {
      const answer = await acode.prompt(
        REMOTE_PROMPT_TITLE,
        REMOTE_PROMPT_MESSAGE,
        'text',
        { placeholder: REMOTE_PROMPT_PLACEHOLDER },
      );
      return answer ? answer : null;
    } catch {
      return null;
    }
  }

  /**
   * The server the Ready-state health check probes: the remote host in remote
   * mode, the plugin's own local server otherwise.
   */
  private getProbeTarget(): { baseUrl: string; password: string | null } {
    if (this.remote) {
      return { baseUrl: this.remote.host.baseUrl, password: this.remote.password };
    }
    return { baseUrl: BASE_URL, password: getServerPassword() };
  }

  /**
   * Fire-and-forget wrapper around the module-level checkForUpdates().
   *
   * Runs in the background (never awaited at call site) and never throws —
   * all errors are caught and logged inside checkForUpdates(). Returns null
   * when no update is available or the check could not be performed.
   */
  private runUpdateCheck(): Promise<UpdateInfo | null> {
    return checkForUpdates().catch(() => null);
  }

  private getHeaderActions(): HeaderActions {
    return {
      updateInfo: this.updateInfo,
      updateStatus: this.updateStatus,
      onUpdateClick: () => this.handleUpdateClick(),
      onCancelUpdate: () => this.handleCancelUpdate(),
      onReinstall: () => this.handleReinstall(),
    };
  }

  /**
   * Handler for the "Update" click in the hamburger menu.
   *
   * Sets status to 'installing' (triggering a pulsing banner), installs the
   * latest release via npm, then refreshes the banner to the newly installed
   * version (the pre-update info would otherwise show the stale old version).
   * On failure the banner shows an error state clickable for retry. Guarded
   * against re-entrant clicks.
   */
  private async handleUpdateClick(): Promise<void> {
    if (this.updateStatus === 'installing') return;

    this.updateStatus = 'installing';
    updateHeader(getState().currentState, this.getHeaderActions());

    try {
      await installUpdate();

      this.updateStatus = 'updated';

      const fresh = await this.runUpdateCheck();
      if (fresh) {
        this.updateInfo = fresh;
      } else {
        const installed = await getInstalledVersion();
        if (installed) {
          this.updateInfo = { currentVersion: installed, latestVersion: installed };
        }
      }
      updateHeader(getState().currentState, this.getHeaderActions());
      const freshInfo = this.updateInfo;
      const version = freshInfo ? freshInfo.latestVersion : '';
      this.showToast(version ? `Updated to ${version}` : 'Update complete');
    } catch (err) {
      log.error('handleUpdateClick: failed', err);
      this.updateStatus = 'error';
      updateHeader(getState().currentState, this.getHeaderActions());
      this.showToast('Update failed');
    }
  }

  /**
   * Cancels an in-progress update by clearing the update status.
   * The updateInfo is kept so the banner reverts to the pre-update
   * "Update: X → Y" message.
   */
  private handleCancelUpdate(): void {
    this.updateStatus = null;
    updateHeader(getState().currentState, this.getHeaderActions());
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

  /**
   * Fire-and-forget companion to the error render: probes the node and npm
   * versions and pushes them into the error view's diagnostics block. The
   * error screen renders immediately with pending placeholders and is filled
   * in once the probe answers (`?` on failure). Hooked to the state listener
   * rather than handleError() so every setError() entry point is covered, and
   * bounded in getRuntimeVersions() so it can never hang the UI.
   */
  private probeRuntimeVersions(): void {
    getRuntimeVersions()
      .then(setErrorVersions)
      .catch((err: unknown) => {
        log.warn('probeRuntimeVersions: failed', err);
      });
  }

  private manageHealthProbe(state: AppState): void {
    if (state === AppState.Ready && !this.healthProbeTimer) {
      this.healthProbeTimer = setInterval(async () => {
        if (this.healthCheckInProgress) {
          return;
        }
        const epoch = this.healthProbeEpoch;
        this.healthCheckInProgress = true;
        try {
          const down = await isServerDownConfirmed(this.getProbeTarget());
          if (epoch !== this.healthProbeEpoch) {
            return;
          }
          if (down) {
            if (getState().currentState !== AppState.Ready) {
              return;
            }
            this.stopHealthProbe();
            try {
              acode.pushNotification('OpenCode', HEALTH_CONNECTION_LOST_MESSAGE, {
                type: 'error',
              });
            } catch {
              // pushNotification not available — not critical
            }
            setError(HEALTH_CONNECTION_LOST_MESSAGE, getServerLog());
          }
        } finally {
          this.healthCheckInProgress = false;
        }
      }, HEALTH_PROBE_INTERVAL);
    } else if (state !== AppState.Ready && this.healthProbeTimer) {
      this.stopHealthProbe();
    }
  }

  private showToast(message: string): void {
    try {
      const toast = acode.require('toast');
      if (typeof toast === 'function') {
        toast(message, 2000);
      }
    } catch {
      // toast module unavailable — not critical
    }
  }

  private stopHealthProbe(): void {
    if (this.healthProbeTimer) {
      this.healthProbeEpoch++;
      clearInterval(this.healthProbeTimer);
      this.healthProbeTimer = null;
    }
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
      { cacheFileUrl, cacheFile, ctx }: Acode.PluginInitOptions,
    ) => {
      // Normalize the trailing slash so asset paths (e.g. icon.png) concatenate
      // correctly regardless of how Acode supplies the base URL.
      if (!baseUrl.endsWith('/')) {
        baseUrl += '/';
      }
      await acodePlugin.init(baseUrl, $page, cacheFile, cacheFileUrl, ctx);
    },
    getSettingsSchema(),
  );

  // setPluginUnmount registers teardown; Acode calls this when the plugin is
  // disabled or the host page is destroyed.
  acode.setPluginUnmount(plugin.id, () => {
    acodePlugin.destroy();
  });
}
