import plugin from '../plugin.json';

import { AppState } from './types';
import { onStateChange, transition, setError, reset } from './state';
import { render } from './ui/index';
import { checkInstalled, installOpenCode } from './opencode/install';
import { isServerUp, startServer, waitForReady, restartServer } from './opencode/server';

const ICON_ID = 'opencode-icon';

export class AcodePlugin {
  private $page: Acode.WCPage | null = null;
  private isRunning = false;

  async init(
    $page: Acode.WCPage,
    _cacheFile: Acode.FileSystem,
    _cacheFileUrl: string,
  ): Promise<void> {
    this.$page = $page;
    $page.settitle('OpenCode');

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

    acode.addIcon(ICON_ID, 'icon.png');
  }

  async destroy(): Promise<void> {
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
      const message = err instanceof Error ? err.message : String(err);
      setError(message, message || 'No output captured. Check /tmp/opencode.log in Alpine terminal.');
    }
  }

  private async handleRestart(): Promise<void> {
    transition(AppState.StartingServer);

    try {
      await restartServer();
      await waitForReady();
      transition(AppState.Ready);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message, message || 'No output captured. Check /tmp/opencode.log in Alpine terminal.');
    }
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
      await acodePlugin.init($page, cacheFile, cacheFileUrl);
    },
  );

  acode.setPluginUnmount(plugin.id, () => {
    acodePlugin.destroy();
  });
}
