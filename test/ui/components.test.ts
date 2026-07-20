import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createErrorDisplay } from '../../src/ui/components';
import { AppState, StateContext, HeaderActions } from '../../src/types';

function makeContext(error: StateContext['error']): StateContext {
  return {
    currentState: AppState.Error,
    error,
  };
}

describe('createErrorDisplay', () => {
  it('renders retry button when error has no logTail (empty string)', () => {
    const ctx = makeContext({ message: 'Something broke', logTail: '' });
    const onRetry = vi.fn();

    const el = createErrorDisplay(ctx, onRetry);

    const btn = el.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toBe('Retry');
    expect(el.querySelector('pre')).toBeNull();

    const h3 = el.querySelector('h3');
    expect(h3).not.toBeNull();
    expect(h3!.textContent).toContain('Something broke');
  });

  it('renders retry button when error has no logTail (falsy)', () => {
    const ctx = makeContext({ message: 'Something broke', logTail: '' });
    const onRetry = vi.fn();

    const el = createErrorDisplay(ctx, onRetry);

    expect(el.querySelector('button')).not.toBeNull();
    expect(el.querySelector('pre')).toBeNull();
  });

  it('<h3> uses opencode-error-heading class', () => {
    const ctx = makeContext({ message: 'Error', logTail: '' });
    const onRetry = vi.fn();

    const el = createErrorDisplay(ctx, onRetry);
    const h3 = el.querySelector('h3') as HTMLHeadingElement;

    expect(h3).not.toBeNull();
    expect(h3.className).toBe('opencode-error-heading');
  });

  it('renders both <pre> block and retry button when logTail is non-empty', () => {
    const ctx = makeContext({ message: 'Install failed', logTail: 'error: not found\n' });
    const onRetry = vi.fn();

    const el = createErrorDisplay(ctx, onRetry);

    const pre = el.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre!.textContent).toBe('error: not found\n');
    expect(el.querySelector('button')).not.toBeNull();
  });

  it('shows fallback message and retry button when context.error is null', () => {
    const ctx = makeContext(null);
    const onRetry = vi.fn();

    const el = createErrorDisplay(ctx, onRetry);

    expect(el.textContent).toContain('An unknown error occurred');
    expect(el.querySelector('button')).not.toBeNull();
    expect(el.querySelector('pre')).toBeNull();
  });

  it('calls onRetry when retry button is clicked', () => {
    const ctx = makeContext({ message: 'Boom', logTail: '' });
    const onRetry = vi.fn();

    const el = createErrorDisplay(ctx, onRetry);

    const btn = el.querySelector('button') as HTMLButtonElement;
    btn.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('calls onRetry with logTail present', () => {
    const ctx = makeContext({ message: 'Boom', logTail: 'traceback...' });
    const onRetry = vi.fn();

    const el = createErrorDisplay(ctx, onRetry);

    const btn = el.querySelector('button') as HTMLButtonElement;
    btn.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

// --- Phase 1: UI Structural Split ---

async function loadFreshUi() {
  vi.resetModules();
  return import('../../src/ui/index');
}

function makeActions(): RenderActions {
  return {
    start: vi.fn(),
    restart: vi.fn(),
    stop: vi.fn(),
    back: vi.fn(),
  };
}

interface RenderActions {
  start: () => void;
  restart: () => void;
  stop: () => void;
  back: () => void;
  updateInfo?: UpdateInfo | null;
  updateStatus?: UpdateStatus | null;
  onUpdateClick?: () => void;
  onCancelUpdate?: () => void;
}

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
}
type UpdateStatus = 'installing' | 'error' | 'updated';

describe('initUiPage', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('creates #opencode-header and #opencode-content inside $page.body', async () => {
    const { initUiPage } = await loadFreshUi();
    const $page = { body: document.body };
    initUiPage($page as any);

    expect(document.getElementById('opencode-header')).not.toBeNull();
    expect(document.getElementById('opencode-content')).not.toBeNull();
    expect(document.body.children.length).toBe(2);
  });

  it('clears $page.body before adding containers', async () => {
    const { initUiPage } = await loadFreshUi();
    document.body.innerHTML = '<p>stale</p>';
    const $page = { body: document.body };
    initUiPage($page as any);

    expect(document.body.children.length).toBe(2);
    expect(document.body.children[0].id).toBe('opencode-header');
    expect(document.body.children[1].id).toBe('opencode-content');
  });

  it('sets $page.body to flex column with 100% height', async () => {
    const { initUiPage } = await loadFreshUi();
    const $page = { body: document.body };
    initUiPage($page as any);

    expect(document.body.style.display).toBe('flex');
    expect(document.body.style.flexDirection).toBe('column');
    expect(document.body.style.height).toBe('100%');
  });

  it('sets #opencode-content to flex grow 1', async () => {
    const { initUiPage } = await loadFreshUi();
    const $page = { body: document.body };
    initUiPage($page as any);

    const content = document.getElementById('opencode-content')!;
    expect(content.style.flexGrow).toBe('1');
    expect(content.style.display).toBe('flex');
    expect(content.style.flexDirection).toBe('column');
  });

  it('is idempotent — clears and recreates containers on second call', async () => {
    const { initUiPage } = await loadFreshUi();
    const $page = { body: document.body };
    initUiPage($page as any);

    document.getElementById('opencode-content')!.textContent = 'data';

    initUiPage($page as any);

    expect(document.body.children.length).toBe(2);
    expect(document.getElementById('opencode-content')!.textContent).toBe('');
  });
});

describe('render with persistent containers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('creates header inside #opencode-header on first render', async () => {
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);

    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());

    const header = document.getElementById('opencode-header')!;
    expect(header.querySelector('.opencode-header')).not.toBeNull();
    expect(header.querySelector('.opencode-header-dot')).not.toBeNull();
    expect(header.querySelector('.opencode-header-label')?.textContent).toBe('OpenCode');
  });

  it('content changes between Ready and Idle but header persists', async () => {
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);

    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());

    const headerEl = document.querySelector('.opencode-header');
    const idleIcon = document.querySelector('.opencode-idle-icon');
    expect(idleIcon).not.toBeNull();

    render(AppState.Ready, { currentState: AppState.Ready, error: null }, makeActions());

    expect(document.querySelector('.opencode-header')).toBe(headerEl);
    expect(document.querySelector('.opencode-idle-icon')).toBeNull();
    expect(document.querySelector('iframe')).not.toBeNull();
  });

  it('content changes between Ready and Error states', async () => {
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);

    render(AppState.Ready, { currentState: AppState.Ready, error: null }, makeActions());
    expect(document.querySelector('iframe')).not.toBeNull();

    render(
      AppState.Error,
      { currentState: AppState.Error, error: { message: 'fail', logTail: '' } },
      makeActions(),
    );
    expect(document.querySelector('iframe')).toBeNull();
    expect(document.querySelector('.opencode-error-heading')).not.toBeNull();
  });

  it('same-state short-circuit does not clear content container', async () => {
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);

    render(AppState.Ready, { currentState: AppState.Ready, error: null }, makeActions());

    const content = document.getElementById('opencode-content')!;
    const iframe = content.querySelector('iframe');

    render(AppState.Ready, { currentState: AppState.Ready, error: null }, makeActions());

    expect(content.querySelector('iframe')).toBe(iframe);
  });
});

describe('updateHeader behavior via render', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('status dot is green when Ready, gray otherwise', async () => {
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);

    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());

    const dot = document.querySelector('.opencode-header-dot') as HTMLElement;
    expect(dot.style.background).toBe('var(--text-color, #888)');

    render(AppState.Ready, { currentState: AppState.Ready, error: null }, makeActions());
    expect(dot.style.background).toBe('var(--primary-color, #4caf50)');

    render(AppState.Error, { currentState: AppState.Error, error: { message: 'err', logTail: '' } }, makeActions());
    expect(dot.style.background).toBe('var(--text-color, #888)');
  });

  it('Start Server menu item hidden when Ready, visible otherwise', async () => {
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);

    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());

    const startItem = document.querySelector<HTMLElement>('[data-action-id="start"]')!;
    expect(startItem.style.display).not.toBe('none');

    render(AppState.Ready, { currentState: AppState.Ready, error: null }, makeActions());
    expect(startItem.style.display).toBe('none');

    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());
    expect(startItem.style.display).not.toBe('none');
  });

  it('Start Server hidden from creation when first render is Ready', async () => {
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);

    render(AppState.Ready, { currentState: AppState.Ready, error: null }, makeActions());

    const startItem = document.querySelector<HTMLElement>('[data-action-id="start"]')!;
    expect(startItem.style.display).toBe('none');
  });
});

describe('updateHeader directly (Phase 2)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('can be called directly with HeaderActions after header creation', async () => {
    const { initUiPage, render, updateHeader } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());

    expect(() => {
      updateHeader(AppState.Ready, {});
    }).not.toThrow();
  });

  it('changes status dot independently via updateHeader', async () => {
    const { initUiPage, render, updateHeader } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());

    const dot = document.querySelector('.opencode-header-dot') as HTMLElement;
    expect(dot.style.background).toBe('var(--text-color, #888)');

    updateHeader(AppState.Ready, {});
    expect(dot.style.background).toBe('var(--primary-color, #4caf50)');

    updateHeader(AppState.Idle, {});
    expect(dot.style.background).toBe('var(--text-color, #888)');
  });

  it('shows update banner when called with updateInfo', async () => {
    const { initUiPage, render, updateHeader } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());

    expect(document.querySelector('.opencode-header-update')).toBeNull();

    updateHeader(AppState.Idle, {
      updateInfo: { currentVersion: '1.0.0', latestVersion: '2.0.0' },
      onUpdateClick: vi.fn(),
    });

    const banner = document.querySelector('.opencode-header-update');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain('Update:');
    expect(banner!.textContent).toContain('1.0.0');
    expect(banner!.textContent).toContain('2.0.0');
  });

  it('removes banner when updateInfo is cleared', async () => {
    const { initUiPage, render, updateHeader } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());

    updateHeader(AppState.Idle, {
      updateInfo: { currentVersion: '1.0.0', latestVersion: '2.0.0' },
    });
    expect(document.querySelector('.opencode-header-update')).not.toBeNull();

    updateHeader(AppState.Idle, { updateInfo: null });
    expect(document.querySelector('.opencode-header-update')).toBeNull();
  });

  it('shows installing status on banner', async () => {
    const { initUiPage, render, updateHeader } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());

    updateHeader(AppState.Idle, {
      updateInfo: { currentVersion: '1.0.0', latestVersion: '2.0.0' },
      updateStatus: 'installing',
    });

    const banner = document.querySelector('.opencode-header-update');
    expect(banner).not.toBeNull();
    expect(banner!.classList.contains('opencode-header-update--installing')).toBe(true);
  });

  it('shows updated banner when updateStatus is updated', async () => {
    const { initUiPage, render, updateHeader } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());

    updateHeader(AppState.Idle, {
      updateInfo: { currentVersion: '1.0.0', latestVersion: '2.0.0' },
      updateStatus: 'updated',
    });

    const banner = document.querySelector('.opencode-header-update');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain('Updated to');
  });

  it('shows error banner when updateStatus is error', async () => {
    const { initUiPage, render, updateHeader } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());

    updateHeader(AppState.Idle, {
      updateStatus: 'error',
      onUpdateClick: vi.fn(),
    });

    const banner = document.querySelector('.opencode-header-update');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain('Update failed');
  });

  it('calls onUpdateClick when update banner is clicked', async () => {
    const { initUiPage, render, updateHeader } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());

    const onClick = vi.fn();
    updateHeader(AppState.Idle, {
      updateInfo: { currentVersion: '1.0.0', latestVersion: '2.0.0' },
      onUpdateClick: onClick,
    });

    const banner = document.querySelector('.opencode-header-update') as HTMLElement;
    banner.click();
    expect(onClick).toHaveBeenCalled();
  });

  it('calls onCancelUpdate when close button is clicked on installing banner', async () => {
    const { initUiPage, render, updateHeader } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());

    const onCancel = vi.fn();
    updateHeader(AppState.Idle, {
      updateInfo: { currentVersion: '1.0.0', latestVersion: '2.0.0' },
      updateStatus: 'installing',
      onCancelUpdate: onCancel,
    });

    const closeBtn = document.querySelector('.opencode-header-update-close') as HTMLElement;
    closeBtn.click();
    expect(onCancel).toHaveBeenCalled();
  });
});
