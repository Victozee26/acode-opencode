import plugin from '../plugin.json';

import { AppState } from './types';
import { onStateChange, transition, setError, reset } from './state';
import { render } from './ui/index';
import { checkInstalled, installOpenCode } from './opencode/install';
import { isServerUp, startServer, waitForReady, restartServer } from './opencode/server';
import { ERROR_FALLBACK_MESSAGE } from './config';

const ICON_CLASS = 'opencode-icon';

export class AcodePlugin {
  private $page: Acode.WCPage | null = null;
  private isRunning = false;
  private sideButton: Acode.SideButton | null = null;

  async init(
    baseUrl: string,
    $page: Acode.WCPage,
    _cacheFile: Acode.FileSystem,
    _cacheFileUrl: string,
  ): Promise<void> {
    this.$page = $page;
    ($page as any).setTitle('OpenCode');

    onStateChange((state, context) => {
      if (this.$page) {
        render(this.$page, state, context, () => this.handleRestart());
      }
    });

    $page.on('show', () => {
      if (!this.isRunning) {
        this.startFlow();
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

  async destroy(): Promise<void> {
    this.sideButton?.hide();
    this.sideButton = null;
    this.$page?.off('show', () => {});
    this.$page = null;
    reset();
  }

  private async startFlow(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

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
        transition(AppState.Ready);
        return;
      }

      transition(AppState.StartingServer);

      await startServer();
      await waitForReady();

      transition(AppState.Ready);
    } catch (err) {
      const { summary, logTail } = this.extractErrorInfo(err);
      setError(summary, logTail);
    }
  }

  private async handleRestart(): Promise<void> {
    transition(AppState.StartingServer);

    try {
      await restartServer();
      await waitForReady();
      transition(AppState.Ready);
    } catch (err) {
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
