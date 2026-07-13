import { describe, it, expect, vi } from 'vitest';
import { createErrorDisplay } from './components';
import { AppState, StateContext } from '../types';

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
  });

  it('renders retry button when error has no logTail (falsy)', () => {
    const ctx = makeContext({ message: 'Something broke', logTail: '' });
    const onRetry = vi.fn();

    const el = createErrorDisplay(ctx, onRetry);

    expect(el.querySelector('button')).not.toBeNull();
    expect(el.querySelector('pre')).toBeNull();
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
