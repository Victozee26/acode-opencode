import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createErrorDisplay } from '../../src/ui/components';
import { AppState, StateContext } from '../../src/types';

function makeContext(error: StateContext['error']): StateContext {
  return {
    currentState: AppState.Error,
    error,
  };
}

describe('createErrorDisplay', () => {
  it('should_render_retry_button_when_logTail_empty', () => {
    // Arrange
    const ctx = makeContext({ message: 'Something broke', logTail: '' });
    const onRetry = vi.fn();

    // Act
    const el = createErrorDisplay(ctx, onRetry);

    // Assert
    const btn = el.querySelector('button');
    expect(btn).not.toBeNull();
  });

  it('should_have_Retry_text_when_button_rendered', () => {
    // Arrange
    const ctx = makeContext({ message: 'Something broke', logTail: '' });
    const onRetry = vi.fn();

    // Act
    const el = createErrorDisplay(ctx, onRetry);

    // Assert
    expect(el.querySelector('button')!.textContent).toBe('Retry');
  });

  it('should_not_render_pre_when_logTail_empty', () => {
    // Arrange
    const ctx = makeContext({ message: 'Something broke', logTail: '' });
    const onRetry = vi.fn();

    // Act
    const el = createErrorDisplay(ctx, onRetry);

    // Assert
    expect(el.querySelector('pre')).toBeNull();
  });

  it('should_show_message_in_heading_when_error_present', () => {
    // Arrange
    const ctx = makeContext({ message: 'Something broke', logTail: '' });
    const onRetry = vi.fn();

    // Act
    const el = createErrorDisplay(ctx, onRetry);

    // Assert
    expect(el.querySelector('h3')!.textContent).toContain('Something broke');
  });

  it('should_show_heading_when_error_rendered', () => {
    // Arrange
    const ctx = makeContext({ message: 'Error', logTail: '' });
    const onRetry = vi.fn();

    // Act
    const el = createErrorDisplay(ctx, onRetry);

    // Assert
    expect(el.querySelector('h3')).not.toBeNull();
  });

  it('should_render_pre_when_logTail_non_empty', () => {
    // Arrange
    const ctx = makeContext({ message: 'Install failed', logTail: 'error: not found\n' });
    const onRetry = vi.fn();

    // Act
    const el = createErrorDisplay(ctx, onRetry);

    // Assert
    expect(el.querySelector('pre')!.textContent).toBe('error: not found\n');
  });

  it('should_render_button_even_when_logTail_present', () => {
    // Arrange
    const ctx = makeContext({ message: 'Install failed', logTail: 'error: not found\n' });
    const onRetry = vi.fn();

    // Act
    const el = createErrorDisplay(ctx, onRetry);

    // Assert
    expect(el.querySelector('button')).not.toBeNull();
  });

  it('should_show_fallback_when_error_is_null', () => {
    // Arrange
    const ctx = makeContext(null);
    const onRetry = vi.fn();

    // Act
    const el = createErrorDisplay(ctx, onRetry);

    // Assert
    expect(el.textContent).toContain('An unknown error occurred');
  });

  it('should_render_button_when_error_is_null', () => {
    // Arrange
    const ctx = makeContext(null);
    const onRetry = vi.fn();

    // Act
    const el = createErrorDisplay(ctx, onRetry);

    // Assert
    expect(el.querySelector('button')).not.toBeNull();
  });

  it('should_not_render_pre_when_error_is_null', () => {
    // Arrange
    const ctx = makeContext(null);
    const onRetry = vi.fn();

    // Act
    const el = createErrorDisplay(ctx, onRetry);

    // Assert
    expect(el.querySelector('pre')).toBeNull();
  });

  it('should_invoke_onRetry_when_button_clicked', () => {
    // Arrange
    const ctx = makeContext({ message: 'Boom', logTail: '' });
    const onRetry = vi.fn();
    const el = createErrorDisplay(ctx, onRetry);
    const btn = el.querySelector('button') as HTMLButtonElement;

    // Act
    btn.click();

    // Assert
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

// --- Phase 1: UI Structural Split ---

async function loadFreshUi() {
  vi.resetModules();
  const mod = await import('../../src/ui/index');
  mod.initUiStyles('http://test/');
  return mod;
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

  it('should_create_header_container_when_initUiPage_called', async () => {
    // Arrange
    const { initUiPage } = await loadFreshUi();
    const $page = { body: document.body };

    // Act
    initUiPage($page as any);

    // Assert
    expect(document.getElementById('opencode-header')).not.toBeNull();
  });

  it('should_create_content_container_when_initUiPage_called', async () => {
    // Arrange
    const { initUiPage } = await loadFreshUi();
    const $page = { body: document.body };

    // Act
    initUiPage($page as any);

    // Assert
    expect(document.getElementById('opencode-content')).not.toBeNull();
  });

  it('should_clear_stale_content_when_initUiPage_called', async () => {
    // Arrange
    const { initUiPage } = await loadFreshUi();
    document.body.innerHTML = '<p>stale</p>';
    const $page = { body: document.body };

    // Act
    initUiPage($page as any);

    // Assert
    expect(document.body.children[0].id).toBe('opencode-header');
  });

  it('should_recreate_when_initUiPage_called_twice', async () => {
    // Arrange
    const { initUiPage } = await loadFreshUi();
    const $page = { body: document.body };
    initUiPage($page as any);
    document.getElementById('opencode-content')!.textContent = 'data';

    // Act
    initUiPage($page as any);

    // Assert
    expect(document.getElementById('opencode-content')!.textContent).toBe('');
  });
});

describe('render with persistent containers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should_create_header_when_first_render_called', async () => {
    // Arrange
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);

    // Act
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());

    // Assert
    expect(document.getElementById('opencode-header')!.querySelector('.opencode-header')).not.toBeNull();
  });

  it('should_show_wordmark_image_when_first_render', async () => {
    // Arrange
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);

    // Act
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());

    // Assert
    const wordmark = document.querySelector('.opencode-header-wordmark') as HTMLImageElement;
    expect(wordmark.alt).toBe('OpenCode');
  });

  it('should_keep_header_when_content_changes_Idle_to_Ready', async () => {
    // Arrange
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());
    const headerEl = document.querySelector('.opencode-header');

    // Act
    render(AppState.Ready, { currentState: AppState.Ready, error: null }, makeActions());

    // Assert
    expect(document.querySelector('.opencode-header')).toBe(headerEl);
  });

  it('should_show_iframe_when_Ready_after_Idle', async () => {
    // Arrange
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());

    // Act
    render(AppState.Ready, { currentState: AppState.Ready, error: null }, makeActions());

    // Assert
    expect(document.querySelector('iframe')).not.toBeNull();
  });

  it('should_remove_iframe_when_Error_after_Ready', async () => {
    // Arrange
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Ready, { currentState: AppState.Ready, error: null }, makeActions());

    // Act
    render(
      AppState.Error,
      { currentState: AppState.Error, error: { message: 'fail', logTail: '' } },
      makeActions(),
    );

    // Assert
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('should_show_error_heading_when_Error_after_Ready', async () => {
    // Arrange
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Ready, { currentState: AppState.Ready, error: null }, makeActions());

    // Act
    render(
      AppState.Error,
      { currentState: AppState.Error, error: { message: 'fail', logTail: '' } },
      makeActions(),
    );

    // Assert
    expect(document.querySelector('.opencode-error-heading')).not.toBeNull();
  });

  it('should_not_clear_content_when_same_state_rendered', async () => {
    // Arrange
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Ready, { currentState: AppState.Ready, error: null }, makeActions());
    const content = document.getElementById('opencode-content')!;
    const iframe = content.querySelector('iframe');

    // Act
    render(AppState.Ready, { currentState: AppState.Ready, error: null }, makeActions());

    // Assert
    expect(content.querySelector('iframe')).toBe(iframe);
  });
});

describe('updateHeader behavior via render', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should_show_start_item_when_state_is_Idle', async () => {
    // Arrange
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);

    // Act
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());

    // Assert
    const startItem = document.querySelector<HTMLElement>('[data-action-id="start"]')!;
    expect(startItem.style.display).not.toBe('none');
  });

  it('should_hide_start_item_when_state_is_Ready', async () => {
    // Arrange
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());

    // Act
    render(AppState.Ready, { currentState: AppState.Ready, error: null }, makeActions());

    // Assert
    const startItem = document.querySelector<HTMLElement>('[data-action-id="start"]')!;
    expect(startItem.style.display).toBe('none');
  });

  it('should_hide_start_from_creation_when_first_render_Ready', async () => {
    // Arrange
    const { initUiPage, render } = await loadFreshUi();
    initUiPage({ body: document.body } as any);

    // Act
    render(AppState.Ready, { currentState: AppState.Ready, error: null }, makeActions());

    // Assert
    const startItem = document.querySelector<HTMLElement>('[data-action-id="start"]')!;
    expect(startItem.style.display).toBe('none');
  });
});

describe('updateHeader directly', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should_not_throw_when_updateHeader_called', async () => {
    // Arrange
    const { initUiPage, render, updateHeader } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());

    // Act
    const act = (): void => {
      updateHeader(AppState.Ready, {});
    };

    // Assert
    expect(act).not.toThrow();
  });

  it('should_show_banner_when_updateInfo_provided', async () => {
    // Arrange
    const { initUiPage, render, updateHeader } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());

    // Act
    updateHeader(AppState.Idle, {
      updateInfo: { currentVersion: '1.0.0', latestVersion: '2.0.0' },
      onUpdateClick: vi.fn(),
    });

    // Assert
    expect(document.querySelector('.opencode-header-update')).not.toBeNull();
  });

  it('should_contain_versions_when_banner_shown', async () => {
    // Arrange
    const { initUiPage, render, updateHeader } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());
    updateHeader(AppState.Idle, {
      updateInfo: { currentVersion: '1.0.0', latestVersion: '2.0.0' },
      onUpdateClick: vi.fn(),
    });

    // Act
    const banner = document.querySelector('.opencode-header-update')!;

    // Assert
    expect(banner.textContent).toContain('2.0.0');
  });

  it('should_remove_banner_when_updateInfo_cleared', async () => {
    // Arrange
    const { initUiPage, render, updateHeader } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());
    updateHeader(AppState.Idle, {
      updateInfo: { currentVersion: '1.0.0', latestVersion: '2.0.0' },
    });
    // Act
    updateHeader(AppState.Idle, { updateInfo: null });

    // Assert
    expect(document.querySelector('.opencode-header-update')).toBeNull();
  });

  it('should_mark_installing_when_status_installing', async () => {
    // Arrange
    const { initUiPage, render, updateHeader } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());

    // Act
    updateHeader(AppState.Idle, {
      updateInfo: { currentVersion: '1.0.0', latestVersion: '2.0.0' },
      updateStatus: 'installing',
    });

    // Assert
    expect(
      document.querySelector('.opencode-header-update')!.classList.contains('opencode-header-update--installing'),
    ).toBe(true);
  });

  it('should_show_updated_when_status_updated', async () => {
    // Arrange
    const { initUiPage, render, updateHeader } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());

    // Act
    updateHeader(AppState.Idle, {
      updateInfo: { currentVersion: '1.0.0', latestVersion: '2.0.0' },
      updateStatus: 'updated',
    });

    // Assert
    expect(document.querySelector('.opencode-header-update')!.textContent).toContain('Updated to');
  });

  it('should_show_error_when_status_error', async () => {
    // Arrange
    const { initUiPage, render, updateHeader } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());

    // Act
    updateHeader(AppState.Idle, {
      updateStatus: 'error',
      onUpdateClick: vi.fn(),
    });

    // Assert
    expect(document.querySelector('.opencode-header-update')!.textContent).toContain('Update failed');
  });

  it('should_call_onUpdateClick_when_banner_clicked', async () => {
    // Arrange
    const { initUiPage, render, updateHeader } = await loadFreshUi();
    initUiPage({ body: document.body } as any);
    render(AppState.Idle, { currentState: AppState.Idle, error: null }, makeActions());
    const onClick = vi.fn();
    updateHeader(AppState.Idle, {
      updateInfo: { currentVersion: '1.0.0', latestVersion: '2.0.0' },
      onUpdateClick: onClick,
    });
    const banner = document.querySelector('.opencode-header-update') as HTMLElement;

    // Act
    banner.click();

    // Assert
    expect(onClick).toHaveBeenCalled();
  });

  it('should_call_onCancel_when_close_clicked_during_installing', async () => {
    // Arrange
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

    // Act
    closeBtn.click();

    // Assert
    expect(onCancel).toHaveBeenCalled();
  });
});
