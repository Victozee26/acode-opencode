import plugin from '../plugin.json';

import { AppState } from './types';
import { onStateChange, transition, setError, reset } from './state';
import { render } from './ui/index';
import { checkInstalled, installOpenCode } from './opencode/install';
import { isServerUp, startServer, waitForReady, restartServer } from './opencode/server';
import { ERROR_FALLBACK_MESSAGE } from './config';
import { createLogger, setLogEnabled } from './logger';
import { DEBUG } from './config';

const log = createLogger('main');

const ICON_CLASS = 'opencode-icon';

export class AcodePlugin {
  private $page: Acode.WCPage | null = null;
  private isRunning = false;
  private sideButton: Acode.SideButton | null = null;
  private handleShow!: () => void;

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
      log.error('startFlow: failed', err);
      const { summary, logTail } = this.extractErrorInfo(err);
      setError(summary, logTail);
    }
  }

  private async handleRestart(): Promise<void> {
    log.info('handleRestart: restart requested');
    transition(AppState.StartingServer);

    try {
      await restartServer();
      await waitForReady();
      transition(AppState.Ready);
      log.info('handleRestart: ready');
    } catch (err) {
      log.error('handleRestart: failed', err);
      const { summary, logTail } = this.extractErrorInfo(err);
      setError(summary, logTail);
    }
  }

  private extractErrorInfo(err: unknown): { summary: string; logTail: string } {
    const rawMessage = err instanceof Error ? err.message : String(err);
    const text = rawMessage || ERROR_FALLBACK_MESSAGE;
    const lines = text.split('\n');
    const summary = lines[0];
    const logTail = lines.slice(1).join('\n');
    return { summary, logTail };
  }
}

if (window.acode) {
  const acodePlugin = new AcodePlugin();

  acode.setPluginInit(
    plugin.id,
    async (
      baseUrl: string,
      $page: Acode.WCPage,
      { cacheFileUrl, cacheFile }: Acode.PluginInitOptions,
    ) => {
      if (!baseUrl.endsWith('/')) {
        baseUrl += '/';
      }
      await acodePlugin.init(baseUrl, $page, cacheFile, cacheFileUrl);
    },
  );

  acode.setPluginUnmount(plugin.id, () => {
    acodePlugin.destroy();
  });
}
